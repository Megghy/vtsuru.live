<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-card-content
    :class="cn(props.class)"
  >
    <slot />
  </div>
</template>

<style>
:where([data-card-content]) {
  padding: 0.625rem 0.75rem;
}

:where([data-card-header] ~ [data-card-content]) {
  padding-top: 0;
}
</style>
