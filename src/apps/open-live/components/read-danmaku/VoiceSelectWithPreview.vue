<script setup lang="ts">
import { ref } from 'vue'

import { useSpeechService } from '@/store/useSpeechService'

defineProps<{
  modelValue: string
  options: any[]
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
    <USelectMenu
      :value="modelValue"
      :items="options as any"
      :loading="loading"
      :placeholder="placeholder ?? '选择音色'"
      :filterable="filterable !== false"
      :fallback-option="() => ({ label: modelValue ? `已选择: ${modelValue}` : '未选择', value: modelValue || '' })"
      style="flex: 1"
      @update:value="$emit('update:modelValue', $event)"
      @focus="$emit('focus')"
      value-key="value"
    />
    <UButton
      :loading="previewing"
      variant="soft"
      size="medium"
      @click="onPreview"
    >
      <template #leading>
        <UIcon name="i-lucide-circle" />
      </template>
      试听
    </UButton>
  </div>
</template>

<style scoped>
.voice-select-row {
  display: flex;
  gap: 6px;
  align-items: stretch;
}
</style>
