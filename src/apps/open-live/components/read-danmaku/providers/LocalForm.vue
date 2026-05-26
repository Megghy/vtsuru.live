<script setup lang="ts">
import { computed } from 'vue'
import { useSpeechService } from '@/store/useSpeechService'
import SectionField from '../SectionField.vue'
import VoiceSelectWithPreview from '../VoiceSelectWithPreview.vue'

const speechService = useSpeechService()
const { settings } = speechService
const voices = computed(() => speechService.getAvailableVoices())
</script>

<template>
  <SectionField label="语音">
    <VoiceSelectWithPreview
      v-model="settings.speechInfo.voice"
      :options="voices"
      placeholder="将使用浏览器默认语音"
    />
  </SectionField>
</template>
