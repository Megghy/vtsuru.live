<script setup lang="ts">
import { useVModel } from '@vueuse/core'
import { Calendar as CalendarIcon } from 'lucide-vue-next'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

export interface DateRangePickerProps {
  start?: string
  end?: string
  class?: HTMLAttributes['class']
  size?: 'default' | 'sm' | 'xs'
  disabled?: boolean
}

const props = withDefaults(defineProps<DateRangePickerProps>(), {
  size: 'sm',
})

const emits = defineEmits<{
  (e: 'update:start', val: string): void
  (e: 'update:end', val: string): void
}>()

const startVal = useVModel(props, 'start', emits, { passive: true })
const endVal = useVModel(props, 'end', emits, { passive: true })

const containerHeights: Record<string, string> = {
  default: 'h-control-default px-3',
  sm: 'h-control-sm px-2.5',
  xs: 'h-control-xs px-2',
}
</script>

<template>
  <div
    :class="
      cn(
        'inline-flex items-center gap-1.5 rounded-md border border-input bg-background text-foreground transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background',
        containerHeights[props.size] || containerHeights.sm,
        disabled && 'opacity-50 pointer-events-none',
        props.class,
      )
    "
  >
    <CalendarIcon class="size-3.5 text-muted-foreground shrink-0 pointer-events-none" />
    <input
      v-model="startVal"
      type="date"
      :disabled="disabled"
      class="bg-transparent border-0 p-0 text-xs text-foreground focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
    />
    <span class="text-xs text-muted-foreground select-none">至</span>
    <input
      v-model="endVal"
      type="date"
      :disabled="disabled"
      class="bg-transparent border-0 p-0 text-xs text-foreground focus:outline-none focus:ring-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-60 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
    />
  </div>
</template>
