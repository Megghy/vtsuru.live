<script setup lang="ts">
import { OPENAI_PRESET_VOICES } from '@/apps/open-live/voice-providers/openai'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useSpeechService } from '@/store/useSpeechService'

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
  <div class="flex flex-col gap-3">
    <Alert class="py-2 px-3 border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
      <AlertDescription class="text-xs text-current m-0">
        请求由浏览器直连 API 服务方，不经过 VTsuru 后端（避免 IP 暴露和延迟）
      </AlertDescription>
    </Alert>

    <SectionField
      label="Base URL"
      hint="OpenAI 兼容服务的根路径，会自动追加 /v1/audio/speech"
    >
      <Input
        v-model="settings.providers.openai.baseUrl"
        placeholder="https://api.openai.com"
      />
    </SectionField>

    <SectionField label="API Key">
      <Input
        v-model="settings.providers.openai.apiKey"
        type="password"
        placeholder="sk-xxxx"
      />
    </SectionField>

    <SectionField label="模型">
      <Input
        v-model="settings.providers.openai.model"
        placeholder="tts-1"
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
      <Select v-model="settings.providers.openai.format">
        <SelectTrigger class="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in formatOptions"
            :key="opt.value"
            :value="opt.value"
            class="text-xs"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </SectionField>
  </div>
</template>
