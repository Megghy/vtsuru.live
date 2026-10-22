<script setup lang="ts">
import { NumberFieldInput } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

export interface NumberFieldInputProps {
  class?: HTMLAttributes['class']
  size?: 'default' | 'sm' | 'xs' | 'lg'
}

const props = withDefaults(defineProps<NumberFieldInputProps>(), {
  size: 'sm',
})

const sizeClasses: Record<string, string> = {
  default: 'h-control-default py-2 text-sm',
  sm: 'h-control-sm py-1 text-xs',
  xs: 'h-control-xs py-0.5 text-xs',
  lg: 'h-control-lg py-2 text-base',
}
</script>

<template>
  <NumberFieldInput
    :class="
      cn(
        'flex w-full rounded-md border border-input bg-transparent text-center shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        sizeClasses[props.size] || sizeClasses.sm,
        props.class,
      )
    "
  />
</template>
