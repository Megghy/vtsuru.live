<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

import type { AlertVariants } from '.'
import { alertVariants } from '.'

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class']
    variant?: AlertVariants['variant']
    size?: AlertVariants['size']
  }>(),
  {
    variant: 'default',
    size: 'default',
  },
)
</script>

<template>
  <div
    :class="cn(alertVariants({ variant: props.variant, size: props.size }), props.class)"
    role="alert"
  >
    <slot name="icon" />
    <slot />
  </div>
</template>
