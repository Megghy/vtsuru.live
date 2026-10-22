<script setup lang="ts">
import { useVModel } from '@vueuse/core'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

export interface InputProps {
  defaultValue?: string | number
  modelValue?: string | number
  class?: HTMLAttributes['class']
  size?: 'default' | 'sm' | 'xs' | 'lg'
  type?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
}

const props = withDefaults(defineProps<InputProps>(), {
  size: 'sm',
})

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void
}>()

const modelValue = useVModel(props, 'modelValue', emits, {
  passive: true,
  defaultValue: props.defaultValue,
})

const sizeClasses: Record<string, string> = {
  default: 'h-control-default px-3 py-1 text-sm',
  sm: 'h-control-sm px-2.5 py-1 text-xs',
  xs: 'h-control-xs px-2 py-0.5 text-xs',
  lg: 'h-control-lg px-4 py-2 text-base',
}
</script>

<template>
  <input
    v-model="modelValue"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :class="
      cn(
        'flex w-full rounded-md border border-input bg-background ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
        sizeClasses[props.size] || sizeClasses.default,
        props.class,
      )
    "
  />
</template>
