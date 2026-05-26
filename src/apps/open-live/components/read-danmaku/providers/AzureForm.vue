<script setup lang="ts">
import { ref, watch } from 'vue'
import { NText } from 'naive-ui'
import { useSpeechService } from '@/store/useSpeechService'
import type { VoiceOption } from '@/apps/open-live/voice-providers'
import SectionField from '../SectionField.vue'
import VoiceSelectWithPreview from '../VoiceSelectWithPreview.vue'

const speechService = useSpeechService()
const { settings } = speechService
const voices = ref<VoiceOption[]>([])
const voicesLoading = ref(false)

async function loadVoices() {
  if (voicesLoading.value) return
  const provider = speechService.getCurrentProvider()
  if (!provider) {
    voices.value = []
    return
  }
  const result = provider.getVoices()
  if (result instanceof Promise) {
    voicesLoading.value = true
    try {
      voices.value = await result
    } finally {
      voicesLoading.value = false
    }
  } else {
    voices.value = result
  }
}

watch(() => settings.value.provider, (val) => {
  if (val === 'azure') loadVoices()
}, { immediate: true })
</script>

<template>
  <SectionField label="音色">
    <VoiceSelectWithPreview
      v-model="settings.providers.azure.azureVoice"
      :options="voices"
      :loading="voicesLoading"
      placeholder="zh-CN-XiaoxiaoNeural"
      @focus="loadVoices"
    />
    <NText depth="3" style="font-size: 11px">
      使用本站提供的 Microsoft Azure 语音合成服务
    </NText>
  </SectionField>
</template>
