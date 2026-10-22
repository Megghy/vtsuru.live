<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

import type { AlertVariants } from '.'
import { alertVariants } from '.'

const props = defineProps<{
  class?: HTMLAttributes['class']
  variant?: AlertVariants['variant']
}>()
</script>

<template>
  <div
    :class="cn(alertVariants({ variant }), props.class)"
    role="alert"
  >
    <slot name="icon" />
    <slot />
  </div>
</template>
