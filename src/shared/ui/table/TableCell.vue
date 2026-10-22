<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()
</script>

<template>
  <td :class="cn('py-2 px-3 text-xs align-middle [&:has([role=checkbox])]:pr-0', props.class)">
    <slot />
  </td>
</template>
