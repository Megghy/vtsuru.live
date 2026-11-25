<script setup lang="ts">
import { ImagePlus, X } from 'lucide-vue-next'
import { onBeforeUnmount, ref } from 'vue'

import type { ResponseQAInfo } from '@/api/generated/model'
import { postApiQaSend } from '@/api/generated/qa/qa'
import CaptchaWidget from '@/apps/user/components/CaptchaWidget.vue'
import { refreshCaptcha, requestWithCaptchaRetry, type CaptchaHandle } from '@/shared/captcha'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'
import { useMessage } from '@/shared/utils'

const MAX_FOLLOWUP_IMAGES = 9
const MAX_IMAGE_SIZE = 10 * 1024 * 1024

interface PendingImage {
  file: File
  previewUrl: string
}

const props = defineProps<{ root: ResponseQAInfo }>()
const emit = defineEmits<{ (e: 'sent'): void }>()

const message = useMessage()
const content = ref('')
const token = ref('')
const turnstile = ref<CaptchaHandle>()
const isSending = ref(false)
const pendingImages = ref<PendingImage[]>([])
const fileInputRef = ref<HTMLInputElement>()

function revokeImages() {
  for (const item of pendingImages.value) {
    URL.revokeObjectURL(item.previewUrl)
  }
  pendingImages.value = []
}

function appendFiles(fileList: FileList | File[]) {
  for (const file of Array.from(fileList)) {
    if (!file.type.startsWith('image/')) continue
    if (file.size > MAX_IMAGE_SIZE) {
      message.warning(`图片「${file.name}」不能超过 10MB`)
      continue
    }
    if (pendingImages.value.length >= MAX_FOLLOWUP_IMAGES) {
      message.warning(`最多只能上传 ${MAX_FOLLOWUP_IMAGES} 张图片`)
      break
    }
    pendingImages.value.push({ file, previewUrl: URL.createObjectURL(file) })
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) appendFiles(input.files)
  input.value = ''
}

function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  const files: File[] = []
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile()
      if (f) files.push(f)
    }
  }
  if (files.length) appendFiles(files)
}

function removeImage(index: number) {
  const [removed] = pendingImages.value.splice(index, 1)
  if (removed) URL.revokeObjectURL(removed.previewUrl)
}

async function send() {
  const text = content.value.trim()
  if (!text || !token.value || isSending.value) return
  isSending.value = true
  try {
    const response = await requestWithCaptchaRetry({
      getToken: () => token.value,
      refresh: () => refreshCaptcha(turnstile.value),
      request: async (captchaToken) =>
        postApiQaSend(
          {
            data: JSON.stringify({
              Target: props.root.target.id,
              IsAnonymous: props.root.isAnonymous,
              Message: text,
              ThreadRootId: props.root.id,
            }),
            files: pendingImages.value.length ? (pendingImages.value.map((p) => p.file) as any) : undefined,
          },
          { headers: { Turnstile: captchaToken } },
        ) as any,
    })
    if (response.code !== 200) throw new Error(response.message)
    content.value = ''
    revokeImages()
    message.success('追问已发送')
    emit('sent')
  } catch (err) {
    message.error(`追问失败: ${err instanceof Error ? err.message : err}`)
  } finally {
    isSending.value = false
    turnstile.value?.reset()
  }
}

onBeforeUnmount(revokeImages)
</script>

<template>
  <div class="space-y-2">
    <Textarea
      v-model="content"
      placeholder="继续追问（支持粘贴图片）..."
      maxlength="10000"
      :rows="2"
      @paste="onPaste"
    />

    <div
      v-if="pendingImages.length > 0"
      class="flex items-center gap-2 flex-wrap"
    >
      <div
        v-for="(item, idx) in pendingImages"
        :key="item.previewUrl"
        class="relative rounded-md overflow-hidden border border-border size-14 bg-muted/40"
      >
        <img
          :src="item.previewUrl"
          alt=""
          class="size-full object-cover"
        />
        <button
          type="button"
          aria-label="移除图片"
          class="absolute top-0.5 right-0.5 size-4 rounded-full bg-black/70 text-white flex-center"
          @click="removeImage(idx)"
        >
          <X class="size-2.5" />
        </button>
      </div>
    </div>

    <div class="flex-between gap-2 flex-wrap">
      <div class="flex items-center gap-2 flex-wrap">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="onFileChange"
        />
        <Button
          type="button"
          size="xs"
          variant="outline"
          class="gap-1"
          :disabled="pendingImages.length >= MAX_FOLLOWUP_IMAGES"
          @click="fileInputRef?.click()"
        >
          <ImagePlus class="size-3.5" />
          附图 ({{ pendingImages.length }}/{{ MAX_FOLLOWUP_IMAGES }})
        </Button>
        <CaptchaWidget
          ref="turnstile"
          v-model="token"
        />
      </div>

      <Button
        :disabled="!content.trim() || !token || isSending"
        :loading="isSending"
        @click="send"
      >
        发送追问
      </Button>
    </div>
  </div>
</template>
