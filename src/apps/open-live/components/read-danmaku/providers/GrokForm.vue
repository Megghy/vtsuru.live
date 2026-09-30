<script setup lang="ts">
import { NSelect, NSlider, NText, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'

import type { VoiceOption } from '@/apps/open-live/voice-providers'
import { useSpeechService } from '@/store/useSpeechService'

import SectionField from '../SectionField.vue'
import VoiceSelectWithPreview from '../VoiceSelectWithPreview.vue'

const speechService = useSpeechService()
const { settings } = speechService
const message = useMessage()
const voices = ref<VoiceOption[]>([])
const loading = ref(false)
const languageOptions = [
  { label: '中文', value: 'zh' },
  { label: '自动识别', value: 'auto' },
  { label: '英文', value: 'en' },
  { label: '日语', value: 'ja' },
  { label: '韩语', value: 'ko' },
]

async function loadVoices() {
  loading.value = true
  try {
    voices.value = await speechService.getCurrentProvider()!.getVoices()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '获取 Grok 音色失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadVoices)
</script>

<template>
  <div class="form">
    <NText
      depth="3"
      style="font-size: 12px"
      >第三方渠道，不保证可用性。</NText
    >
    <SectionField label="音色">
      <VoiceSelectWithPreview
        v-model="settings.providers['grok-tts'].voice"
        :options="voices"
        :loading="loading"
        placeholder="Eve"
        @focus="loadVoices"
      />
    </SectionField>
    <SectionField label="语言">
      <NSelect
        v-model:value="settings.providers['grok-tts'].language"
        :options="languageOptions"
        size="small"
      />
    </SectionField>
    <SectionField
      label="语速"
      :value="settings.speechInfo.rate.toFixed(2)"
    >
      <NSlider
        v-model:value="settings.speechInfo.rate"
        :min="0.7"
        :max="1.5"
        :step="0.01"
      />
    </SectionField>
  </div>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
