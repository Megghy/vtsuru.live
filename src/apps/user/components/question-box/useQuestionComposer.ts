import { useNow } from '@vueuse/core'
import { computed, onUnmounted, ref, watch, type Ref } from 'vue'

import { useAccount } from '@/api/account'
import type { QAInfo, UserInfo } from '@/api/api-models'
import { QueryPostAPI } from '@/api/query'
import { QUESTION_API_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { useBiliAuth } from '@/store/useBiliAuth'

import { useQuestionBoxHistory } from './questionBoxHistory'

interface QuestionDraft {
  message: string
  tag: string | null
  anonymousName: string
  anonymousEmail: string
  isAnonymous: boolean
}

interface TurnstileHandle {
  remove: () => void
  reset: () => void
}

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
])
const MAX_FILE_SIZE = 10 * 1024 * 1024
const SEND_COOLDOWN = 30_000
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

function emptyDraft(): QuestionDraft {
  return { message: '', tag: null, anonymousName: '', anonymousEmail: '', isAnonymous: true }
}

export function useQuestionComposer(target: Ref<UserInfo | undefined>, onSubmitted: () => void) {
  const accountInfo = useAccount()
  const biliAuth = useBiliAuth()
  const history = useQuestionBoxHistory()
  const draft = usePersistedStorage<QuestionDraft>(
    () => `QuestionBox.Draft.${target.value?.id ?? 'pending'}`,
    emptyDraft(),
    {
      serializer: {
        read: (value) => (value ? JSON.parse(value) : emptyDraft()),
        write: (value) => JSON.stringify(value),
      },
    },
  )
  const selectedFiles = ref<File[]>([])
  const imagePreviewUrls = ref<string[]>([])
  const turnstile = ref<TurnstileHandle>()
  const token = ref('')
  const isSending = ref(false)
  const isDragging = ref(false)
  const isSent = ref(false)
  const nextSendAt = ref(Date.now())
  const { now, pause, resume } = useNow({ interval: 1000, controls: true })
  pause()

  const isUserLoggedIn = computed(() => Boolean(accountInfo.value?.id))
  const isBiliAuthed = computed(() => biliAuth.isAuthed && Boolean(biliAuth.biliAuth?.userId))
  const isIdentified = computed(() => isUserLoggedIn.value || isBiliAuthed.value)
  const isSelf = computed(() => {
    if (target.value?.id === accountInfo.value?.id) return true
    if (!target.value?.biliId || !biliAuth.biliAuth?.userId) return false
    return String(target.value.biliId) === String(biliAuth.biliAuth.userId)
  })
  const identityName = computed(() => {
    if (!isIdentified.value || draft.value.isAnonymous) return '匿名提问'
    return accountInfo.value?.name || biliAuth.biliAuth?.name || '已认证身份'
  })
  const allowUploadImage = computed(() => target.value?.extra?.allowQuestionBoxUploadImage ?? false)
  const canUploadImages = computed(() => !isSelf.value && (isIdentified.value || allowUploadImage.value))
  const maxImages = computed(() => (isIdentified.value ? 9 : 3))
  const characterCount = computed(() => [...segmenter.segment(draft.value.message)].length)
  const cooldownSeconds = computed(() => Math.max(0, Math.ceil((nextSendAt.value - now.value.getTime()) / 1000)))

  watch(cooldownSeconds, (val) => {
    if (val > 0) resume()
    else pause()
  })

  const canSubmit = computed(
    () =>
      !isSelf.value &&
      !isSending.value &&
      Boolean(token.value) &&
      characterCount.value >= 3 &&
      cooldownSeconds.value === 0 &&
      isValidEmail(draft.value.anonymousEmail),
  )

  function isValidEmail(email: string) {
    return !email || /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(email)
  }

  function validateFile(file: File) {
    if (file.size > MAX_FILE_SIZE) return '单张图片不能超过 10MB'
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) return '仅支持 PNG、JPG、GIF、WEBP、SVG 和 ICO 格式'
    if (
      selectedFiles.value.some(
        (item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified,
      )
    )
      return `图片“${file.name}”已添加`
    return ''
  }

  function addFiles(files: File[], notify: (message: string, type: 'warning' | 'error') => void) {
    for (const file of files) {
      if (selectedFiles.value.length >= maxImages.value) {
        notify(`最多可添加 ${maxImages.value} 张图片`, 'warning')
        return
      }
      const validationMessage = validateFile(file)
      if (validationMessage) {
        notify(
          validationMessage,
          validationMessage.includes('10MB') || validationMessage.includes('格式') ? 'error' : 'warning',
        )
        continue
      }
      selectedFiles.value = [...selectedFiles.value, file]
      imagePreviewUrls.value = [...imagePreviewUrls.value, URL.createObjectURL(file)]
    }
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(imagePreviewUrls.value[index])
    selectedFiles.value = selectedFiles.value.filter((_, itemIndex) => itemIndex !== index)
    imagePreviewUrls.value = imagePreviewUrls.value.filter((_, itemIndex) => itemIndex !== index)
  }

  function clearImages() {
    imagePreviewUrls.value.forEach((url) => URL.revokeObjectURL(url))
    selectedFiles.value = []
    imagePreviewUrls.value = []
  }

  async function sendQuestion() {
    if (!target.value?.id) throw new Error('未加载到提问对象')
    if (characterCount.value < 3) throw new Error('内容最少需要 3 个字')
    if (cooldownSeconds.value > 0) throw new Error(`请等待 ${cooldownSeconds.value} 秒后再提交`)
    if (!isValidEmail(draft.value.anonymousEmail)) throw new Error('邮箱格式不正确')
    if (!token.value) throw new Error('请先完成人机验证')

    isSending.value = true
    const submittedDraft = { ...draft.value }
    const hasImage = selectedFiles.value.length > 0
    const formData = new FormData()
    formData.append(
      'Data',
      JSON.stringify({
        Target: target.value.id,
        IsAnonymous: !isIdentified.value || submittedDraft.isAnonymous,
        Message: submittedDraft.message,
        Tag: submittedDraft.tag,
        AnonymousName: !isIdentified.value && submittedDraft.anonymousName ? submittedDraft.anonymousName : undefined,
        AnonymousEmail:
          !isIdentified.value && submittedDraft.anonymousEmail ? submittedDraft.anonymousEmail : undefined,
      }),
    )
    selectedFiles.value.forEach((file) => formData.append('Files', file))

    try {
      const headers: [string, string][] = [['Turnstile', token.value]]
      const response = isBiliAuthed.value
        ? await biliAuth.QueryBiliAuthPostAPI<QAInfo>(`${QUESTION_API_URL}send`, formData, headers)
        : await QueryPostAPI<QAInfo>(`${QUESTION_API_URL}send`, formData, headers)
      if (response.code !== 200) throw new Error(response.message)

      if (!isIdentified.value) {
        history.add({
          id: `local-${Date.now()}-${crypto.randomUUID()}`,
          targetUserId: target.value.id,
          targetUserName: target.value.name,
          message: submittedDraft.message,
          tag: submittedDraft.tag,
          anonymousName: submittedDraft.anonymousName,
          anonymousEmail: submittedDraft.anonymousEmail,
          hasImage,
          sendAt: Date.now(),
        })
      }

      draft.value = emptyDraft()
      clearImages()
      token.value = ''
      isSent.value = true
      nextSendAt.value = Date.now() + SEND_COOLDOWN
      turnstile.value?.reset()
      onSubmitted()
    } finally {
      isSending.value = false
    }
  }

  function composeAgain() {
    isSent.value = false
  }

  onUnmounted(() => {
    turnstile.value?.remove()
    clearImages()
  })

  return {
    addFiles,
    allowUploadImage,
    canSubmit,
    canUploadImages,
    characterCount,
    composeAgain,
    cooldownSeconds,
    draft,
    identityName,
    imagePreviewUrls,
    isDragging,
    isIdentified,
    isSelf,
    isSending,
    isSent,
    isUserLoggedIn,
    isValidEmail,
    maxImages,
    removeImage,
    selectedFiles,
    sendQuestion,
    token,
    turnstile,
  }
}
