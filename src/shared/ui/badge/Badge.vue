<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

import type { BadgeVariants } from '.'
import { badgeVariants } from '.'

const props = withDefaults(
  defineProps<{
    variant?: BadgeVariants['variant']
    size?: BadgeVariants['size']
    class?: HTMLAttributes['class']
  }>(),
  {
    variant: 'default',
    size: 'default',
  },
)
</script>

<template>
  <div
    data-slot="badge"
    :data-variant="variant || 'default'"
    :class="cn(badgeVariants({ variant, size }), props.class)"
  >
    <slot />
  </div>
</template>
