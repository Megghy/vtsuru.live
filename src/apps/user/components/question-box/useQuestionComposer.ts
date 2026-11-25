import { useIntervalFn } from '@vueuse/core'
import { computed, onUnmounted, ref, watch, type Ref } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponseUserInfo } from '@/api/generated/model'
import { postApiQaSend } from '@/api/generated/qa/qa'
import { refreshCaptcha, requestWithCaptchaRetry, type CaptchaHandle } from '@/shared/captcha'
import { usePersistedStorage } from '@/shared/storage/persist'
import { useBiliAuth } from '@/store/useBiliAuth'

import { useQuestionBoxHistory } from './questionBoxHistory'

interface QuestionDraft {
  message: string
  tag: string | null
  anonymousName: string
  anonymousEmail: string
  isAnonymous: boolean
  allowPublic: boolean
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
const DEFAULT_SEND_COOLDOWN_SEC = 30
const DEFAULT_MAX_MESSAGE_LENGTH = 10000
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

function emptyDraft(isAnonymous = true): QuestionDraft {
  return { message: '', tag: null, anonymousName: '', anonymousEmail: '', isAnonymous, allowPublic: true }
}

function normalizeQuestionDraft(raw: unknown): QuestionDraft {
  const parsed = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    message: typeof parsed.message === 'string' ? parsed.message : '',
    tag: typeof parsed.tag === 'string' ? parsed.tag : null,
    anonymousName: typeof parsed.anonymousName === 'string' ? parsed.anonymousName : '',
    anonymousEmail: typeof parsed.anonymousEmail === 'string' ? parsed.anonymousEmail : '',
    isAnonymous: parsed.isAnonymous !== false,
    allowPublic: parsed.allowPublic !== false,
  }
}

export function isQuestionSubmitAllowed(params: {
  allowUnregistedUser: boolean
  allowAnonymous: boolean
  isIdentified: boolean
  isAnonymous: boolean
}): boolean {
  if (!params.allowUnregistedUser && !params.isIdentified) return false
  if (!params.allowAnonymous && params.isIdentified && params.isAnonymous) return false
  return true
}

export function useQuestionComposer(target: Ref<ResponseUserInfo | undefined>, onSubmitted: () => void) {
  const accountInfo = useAccount()
  const biliAuth = useBiliAuth()
  const history = useQuestionBoxHistory()
  const draft = usePersistedStorage<QuestionDraft>(
    () => `QuestionBox.Draft.${target.value?.id ?? 'pending'}`,
    emptyDraft(),
    {
      serializer: {
        read: (value) => {
          if (!value) return emptyDraft()
          try {
            return normalizeQuestionDraft(JSON.parse(value))
          } catch {
            return emptyDraft()
          }
        },
        write: (value) => JSON.stringify(value),
      },
    },
  )
  function cooldownStorageKey(targetId?: number) {
    return `QuestionBox.Cooldown.${targetId ?? 'pending'}`
  }

  function readSavedCooldown(targetId?: number): number {
    try {
      const raw = window.localStorage.getItem(cooldownStorageKey(targetId))
      const parsed = raw ? Number(raw) : 0
      return Number.isFinite(parsed) ? parsed : 0
    } catch {
      return 0
    }
  }

  function writeSavedCooldown(targetId: number | undefined, value: number) {
    try {
      window.localStorage.setItem(cooldownStorageKey(targetId), String(value))
    } catch {
      // ignore storage quota errors
    }
  }

  const nextSendAt = ref(readSavedCooldown(target.value?.id))
  watch(
    () => target.value?.id,
    (id) => {
      nextSendAt.value = readSavedCooldown(id)
    },
  )
  const selectedFiles = ref<File[]>([])
  const imagePreviewUrls = ref<string[]>([])
  const turnstile = ref<CaptchaHandle>()
  const token = ref('')
  const isSending = ref(false)
  const isDragging = ref(false)
  const isSent = ref(false)
  const nowMs = ref(Date.now())
  const { pause, resume } = useIntervalFn(
    () => {
      nowMs.value = Date.now()
    },
    1000,
    { immediate: false },
  )

  const isUserLoggedIn = computed(() => Boolean(accountInfo.value?.id))
  const isBiliAuthed = computed(() => biliAuth.isAuthed && Boolean(biliAuth.biliAuth?.userId))
  const isIdentified = computed(() => isUserLoggedIn.value || isBiliAuthed.value)
  const isSelf = computed(() => {
    if (target.value?.id != null && accountInfo.value?.id != null && target.value.id === accountInfo.value.id) {
      return true
    }
    if (!target.value?.biliId || !biliAuth.biliAuth?.userId) return false
    return String(target.value.biliId) === String(biliAuth.biliAuth.userId)
  })
  const identityName = computed(() => {
    if (!isIdentified.value || draft.value.isAnonymous) return '匿名提问'
    return accountInfo.value?.name || biliAuth.biliAuth?.name || '已认证身份'
  })
  const allowUploadImage = computed(() => target.value?.extra?.allowQuestionBoxUploadImage ?? false)
  const allowAnonymous = computed(() => target.value?.extra?.allowQuestionBoxAnonymous !== false)
  const allowUnregistedUser = computed(() => target.value?.extra?.allowQuestionBoxUnregistedUser !== false)
  const allowDefaultPublic = computed(() => target.value?.extra?.questionBoxDefaultPublic !== false)
  const isPaused = computed(() => Boolean(target.value?.extra?.questionBoxPaused))
  const pauseMessage = computed(
    () => target.value?.extra?.questionBoxPauseMessage?.trim() || '主播当前暂停接收新提问，欢迎浏览下方公开问答。',
  )
  const notice = computed(() => target.value?.extra?.questionBoxNotice?.trim() || '')
  const configuredCooldownSeconds = computed(() => {
    const val = target.value?.extra?.questionBoxCooldownSeconds
    return typeof val === 'number' && val >= 5 ? val : DEFAULT_SEND_COOLDOWN_SEC
  })
  const maxMessageLength = computed(() => {
    const val = target.value?.extra?.questionBoxMaxMessageLength
    return typeof val === 'number' && val >= 50 ? Math.min(10000, val) : DEFAULT_MAX_MESSAGE_LENGTH
  })
  const mustUseRealName = computed(() => !allowAnonymous.value && isIdentified.value)
  const canUploadImages = computed(() => !isSelf.value && !isPaused.value && allowUploadImage.value)
  const maxImages = computed(() => (isIdentified.value ? 9 : 3))
  const characterCount = computed(() => [...segmenter.segment(draft.value.message)].length)
  const isMessageTooLong = computed(() => characterCount.value > maxMessageLength.value)
  const hasValidMessageLength = computed(
    () => draft.value.message.trim().length > 0 && characterCount.value >= 3 && !isMessageTooLong.value,
  )
  const cooldownSeconds = computed(() => Math.max(0, Math.ceil((nextSendAt.value - nowMs.value) / 1000)))

  watch(
    cooldownSeconds,
    (val) => {
      if (val > 0) resume()
      else pause()
    },
    { immediate: true },
  )

  watch(
    [mustUseRealName, () => draft.value.isAnonymous],
    ([forceRealName, isAnonymous]) => {
      if (forceRealName && isAnonymous) {
        draft.value = { ...draft.value, isAnonymous: false }
      }
    },
    { immediate: true, flush: 'sync' },
  )

  const canSubmit = computed(
    () =>
      !isSelf.value &&
      !isPaused.value &&
      !isSending.value &&
      Boolean(token.value) &&
      hasValidMessageLength.value &&
      cooldownSeconds.value === 0 &&
      (isIdentified.value || isValidEmail(draft.value.anonymousEmail)) &&
      isQuestionSubmitAllowed({
        allowUnregistedUser: allowUnregistedUser.value,
        allowAnonymous: allowAnonymous.value,
        isIdentified: isIdentified.value,
        isAnonymous: draft.value.isAnonymous,
      }),
  )

  const submitDisabledReason = computed(() => {
    if (isSelf.value || isSending.value || cooldownSeconds.value > 0) return ''
    if (isPaused.value) return '当前暂停接收新提问'
    if (!allowUnregistedUser.value && !isIdentified.value) return '需先登录或完成 B 站认证'
    if (mustUseRealName.value && draft.value.isAnonymous) return '需以当前身份实名提交'
    if (!isIdentified.value && !isValidEmail(draft.value.anonymousEmail)) return '邮箱格式不正确'
    if (isMessageTooLong.value) return `内容不能超过 ${maxMessageLength.value} 个字`
    if (!hasValidMessageLength.value) return characterCount.value === 0 ? '请先输入留言内容' : '内容最少需要 3 个字'
    if (!token.value) return '请先完成人机验证'
    return ''
  })

  function isValidEmail(email: string) {
    const trimmed = email.trim()
    return !trimmed || /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(trimmed)
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
    if (isPaused.value) throw new Error(pauseMessage.value)
    if (isMessageTooLong.value) throw new Error(`内容不能超过 ${maxMessageLength.value} 个字`)
    if (!hasValidMessageLength.value) throw new Error('内容最少需要 3 个字')
    if (cooldownSeconds.value > 0) throw new Error(`请等待 ${cooldownSeconds.value} 秒后再提交`)
    const trimmedEmail = draft.value.anonymousEmail.trim()
    const trimmedName = draft.value.anonymousName.trim()
    if (!isIdentified.value && !isValidEmail(trimmedEmail)) throw new Error('邮箱格式不正确')
    if (!token.value) throw new Error('请先完成人机验证')

    isSending.value = true
    const submittedDraft = { ...draft.value }
    const hasImage = selectedFiles.value.length > 0
    const targetId = target.value.id
    const targetName = target.value.name

    try {
      const response = await requestWithCaptchaRetry({
        getToken: () => token.value,
        refresh: () => refreshCaptcha(turnstile.value),
        request: async (captchaToken) => {
          const dataStr = JSON.stringify({
            Target: targetId,
            IsAnonymous: !isIdentified.value || submittedDraft.isAnonymous,
            Message: submittedDraft.message,
            Tag: submittedDraft.tag,
            AnonymousName: !isIdentified.value && trimmedName ? trimmedName : undefined,
            AnonymousEmail: !isIdentified.value && trimmedEmail ? trimmedEmail : undefined,
            AllowPublic: allowDefaultPublic.value ? submittedDraft.allowPublic !== false : undefined,
          })
          const headers: Record<string, string> = { Turnstile: captchaToken }
          if (isBiliAuthed.value) {
            const authHeaders = await biliAuth.getBiliAuthHeaders()
            for (const [k, v] of authHeaders) {
              headers[k] = v
            }
          }
          return postApiQaSend({ data: dataStr, files: selectedFiles.value }, { headers }) as any
        },
      })
      if (response.code !== 200) throw new Error(response.message)

      // 未登录站内账号（含纯 B 站认证访客）写入本地提问历史
      if (!isUserLoggedIn.value) {
        history.add({
          id: `local-${Date.now()}-${crypto.randomUUID()}`,
          targetUserId: targetId,
          targetUserName: targetName,
          message: submittedDraft.message,
          tag: submittedDraft.tag,
          anonymousName: trimmedName || (isBiliAuthed.value && !submittedDraft.isAnonymous ? biliAuth.biliAuth?.name || '' : ''),
          anonymousEmail: trimmedEmail,
          hasImage,
          sendAt: Date.now(),
        })
      }

      draft.value = emptyDraft(!mustUseRealName.value)
      clearImages()
      token.value = ''
      isSent.value = true
      const currentNow = Date.now()
      nowMs.value = currentNow
      nextSendAt.value = currentNow + configuredCooldownSeconds.value * 1000
      writeSavedCooldown(targetId, nextSendAt.value)
      onSubmitted()
    } finally {
      isSending.value = false
      turnstile.value?.reset()
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
    allowAnonymous,
    allowDefaultPublic,
    allowUnregistedUser,
    allowUploadImage,
    canSubmit,
    canUploadImages,
    characterCount,
    composeAgain,
    cooldownSeconds,
    draft,
    hasValidMessageLength,
    identityName,
    imagePreviewUrls,
    isDragging,
    isIdentified,
    isMessageTooLong,
    isPaused,
    isSelf,
    isSending,
    isSent,
    isUserLoggedIn,
    isValidEmail,
    maxImages,
    maxMessageLength,
    notice,
    pauseMessage,
    removeImage,
    selectedFiles,
    sendQuestion,
    submitDisabledReason,
    token,
    turnstile,
  }
}
