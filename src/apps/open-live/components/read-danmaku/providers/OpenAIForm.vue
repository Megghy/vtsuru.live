<script setup lang="ts">
import { NAlert, NInput, NSelect, NText } from 'naive-ui'
import { useSpeechService } from '@/store/useSpeechService'
import { OPENAI_PRESET_VOICES } from '@/apps/open-live/voice-providers/openai'
import SectionField from '../SectionField.vue'
import VoiceSelectWithPreview from '../VoiceSelectWithPreview.vue'

const speechService = useSpeechService()
const { settings } = speechService

const formatOptions = [
  { label: 'mp3', value: 'mp3' },
  { label: 'opus', value: 'opus' },
  { label: 'aac', value: 'aac' },
  { label: 'flac', value: 'flac' },
  { label: 'wav', value: 'wav' },
]
</script>

<template>
  <div class="form">
    <NAlert type="info" :bordered="false" size="small">
      <NText style="font-size: 12px">
        请求由浏览器直连 API 服务方, 不经过 VTsuru 后端 (避免 IP 暴露和延迟)
      </NText>
    </NAlert>

    <SectionField label="Base URL" hint="OpenAI 兼容服务的根路径，会自动追加 /v1/audio/speech">
      <NInput
        v-model:value="settings.providers.openai.baseUrl"
        placeholder="https://api.openai.com"
        size="small"
      />
    </SectionField>

    <SectionField label="API Key">
      <NInput
        v-model:value="settings.providers.openai.apiKey"
        type="password"
        show-password-on="click"
        placeholder="sk-xxxx"
        size="small"
      />
    </SectionField>

    <SectionField label="模型">
      <NInput
        v-model:value="settings.providers.openai.model"
        placeholder="tts-1"
        size="small"
      />
    </SectionField>

    <SectionField label="音色">
      <VoiceSelectWithPreview
        v-model="settings.providers.openai.voice"
        :options="OPENAI_PRESET_VOICES as any"
        placeholder="alloy / nova / onyx ..."
      />
    </SectionField>

    <SectionField label="音频格式">
      <NSelect
        v-model:value="settings.providers.openai.format"
        :options="formatOptions"
        size="small"
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
