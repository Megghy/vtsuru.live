<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <div
    data-slot="card-header"
    data-card-header
    :class="cn('flex flex-col gap-y-1 p-3 pb-1.5', props.class)"
  >
    <slot />
  </div>
</template>
