<script setup lang="ts">
import { Play20Filled } from '@vicons/fluent'
import { computed, ref } from 'vue'

import { Button } from '@/shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useSpeechService } from '@/store/useSpeechService'

const props = defineProps<{
  modelValue: string
  options: any[]
  loading?: boolean
  placeholder?: string
  filterable?: boolean
  previewText?: string
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'focus'): void
}>()

const previewing = ref(false)
const { previewVoice } = useSpeechService()

const normalizedOptions = computed(() => {
  return (props.options || []).map((opt: any) => {
    if (typeof opt === 'string') return { label: opt, value: opt }
    return {
      label: opt.label || String(opt.value),
      value: String(opt.value),
    }
  })
})

async function onPreview() {
  previewing.value = true
  try {
    await previewVoice(props.previewText || '你好呀, 这是一段试听')
  } finally {
    previewing.value = false
  }
}
</script>

<template>
  <div class="voice-select-row">
    <div class="flex-1 min-w-0">
      <Select
        :model-value="modelValue"
        @update:model-value="$emit('update:modelValue', String($event ?? ''))"
      >
        <SelectTrigger class="w-full h-9">
          <SelectValue :placeholder="placeholder ?? '选择音色'" />
        </SelectTrigger>
        <SelectContent class="max-h-60">
          <SelectItem
            v-for="opt in normalizedOptions"
            :key="opt.value"
            :value="opt.value"
            class="text-xs"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
    <Button
      variant="outline"
      :loading="previewing"
      class="gap-1 h-9 shrink-0"
      @click="onPreview"
    >
      <Play20Filled class="size-3.5" />
      试听
    </Button>
  </div>
</template>

<style scoped>
.voice-select-row {
  display: flex;
  gap: 6px;
  align-items: stretch;
}
</style>
