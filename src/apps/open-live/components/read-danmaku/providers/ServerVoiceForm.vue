<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import type { VoiceOption } from '@/apps/open-live/voice-providers'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Slider } from '@/shared/ui/slider'
import { useSpeechService } from '@/store/useSpeechService'

import SectionField from '../SectionField.vue'
import VoiceSelectWithPreview from '../VoiceSelectWithPreview.vue'

const props = defineProps<{ providerId: string }>()
const speechService = useSpeechService()
const { settings } = speechService
const voices = ref<VoiceOption[]>([])
const loading = ref(false)
const rateLimits = computed(() => (props.providerId === 'grok-tts' ? [0.7, 1.5] : [0.5, 2]))
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
    toast.error(error instanceof Error ? error.message : '获取音色失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadVoices)
</script>

<template>
  <div class="flex flex-col gap-3">
    <span class="text-xs text-muted-foreground">第三方渠道，不保证可用性。</span>

    <SectionField label="音色">
      <VoiceSelectWithPreview
        v-model="settings.providers[providerId].voice"
        :options="voices"
        :loading="loading"
        placeholder="选择音色"
        @focus="loadVoices"
      />
    </SectionField>

    <SectionField
      v-if="providerId === 'grok-tts'"
      label="语言"
    >
      <Select v-model="settings.providers[providerId].language">
        <SelectTrigger class="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in languageOptions"
            :key="opt.value"
            :value="opt.value"
            class="text-xs"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </SectionField>

    <SectionField
      label="语速"
      :value="settings.speechInfo.rate.toFixed(2)"
    >
      <Slider
        :model-value="[settings.speechInfo.rate]"
        :min="rateLimits[0]"
        :max="rateLimits[1]"
        :step="0.01"
        @update:model-value="
          (val) => {
            if (val?.[0] !== undefined) settings.speechInfo.rate = val[0]
          }
        "
      />
    </SectionField>
  </div>
</template>
