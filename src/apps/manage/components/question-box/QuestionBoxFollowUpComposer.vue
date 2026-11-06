<script setup lang="ts">
import { ref } from 'vue'

import type { ResponseQAInfo } from '@/api/generated/model'
import { postApiQaSend } from '@/api/generated/qa/qa'
import CaptchaWidget from '@/apps/user/components/CaptchaWidget.vue'
import { refreshCaptcha, requestWithCaptchaRetry, type CaptchaHandle } from '@/shared/captcha'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'
import { useMessage } from '@/shared/utils'

const props = defineProps<{ root: ResponseQAInfo }>()
const emit = defineEmits<{ (e: 'sent'): void }>()

const message = useMessage()
const content = ref('')
const token = ref('')
const turnstile = ref<CaptchaHandle>()
const isSending = ref(false)

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
          },
          { headers: { Turnstile: captchaToken } },
        ) as any,
    })
    if (response.code !== 200) throw new Error(response.message)
    content.value = ''
    message.success('追问已发送')
    emit('sent')
  } catch (err) {
    message.error(`追问失败: ${err instanceof Error ? err.message : err}`)
  } finally {
    isSending.value = false
    turnstile.value?.reset()
  }
}
</script>

<template>
  <div class="space-y-2">
    <Textarea
      v-model="content"
      placeholder="继续追问..."
      maxlength="10000"
      :rows="2"
    />
    <div class="flex-between gap-2">
      <CaptchaWidget
        ref="turnstile"
        v-model="token"
      />
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
