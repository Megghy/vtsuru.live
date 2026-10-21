<script setup lang="ts">
import { NumberFieldInput } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <NumberFieldInput
    :class="
      cn(
        'flex h-8 w-full rounded-md border border-input bg-transparent py-1 text-center text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
        props.class,
      )
    "
  />
</template>
