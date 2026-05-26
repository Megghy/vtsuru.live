<script setup lang="ts">
import { Play20Filled } from '@vicons/fluent'
import { NButton, NIcon, NSelect } from 'naive-ui'
import { ref } from 'vue'
import { useSpeechService } from '@/store/useSpeechService'
import type { VoiceOption } from '@/apps/open-live/voice-providers'

defineProps<{
  modelValue: string
  options: VoiceOption[]
  loading?: boolean
  placeholder?: string
  filterable?: boolean
  previewText?: string
}>()
defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'focus'): void
}>()

const previewing = ref(false)
const { previewVoice } = useSpeechService()

async function onPreview() {
  previewing.value = true
  try {
    await previewVoice('你好呀, 这是一段试听')
  } finally {
    previewing.value = false
  }
}
</script>

<template>
  <div class="voice-select-row">
    <NSelect
      :value="modelValue"
      :options="options as any"
      :loading="loading"
      :placeholder="placeholder ?? '选择音色'"
      :filterable="filterable !== false"
      :fallback-option="() => ({ label: modelValue ? `已选择: ${modelValue}` : '未选择', value: modelValue || '' })"
      style="flex: 1"
      @update:value="$emit('update:modelValue', $event)"
      @focus="$emit('focus')"
    />
    <NButton
      :loading="previewing"
      tertiary
      size="medium"
      @click="onPreview"
    >
      <template #icon>
        <NIcon :component="Play20Filled" />
      </template>
      试听
    </NButton>
  </div>
</template>

<style scoped>
.voice-select-row {
  display: flex;
  gap: 6px;
  align-items: stretch;
}
</style>
