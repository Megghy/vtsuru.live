<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { BadgeVariants } from "."
import { cn } from '@/shared/utils/cn'
import { badgeVariants } from "."

const props = withDefaults(
  defineProps<{
    variant?: BadgeVariants["variant"]
    size?: BadgeVariants["size"]
    class?: HTMLAttributes["class"]
  }>(),
  {
    variant: 'default',
    size: 'default',
  },
)
</script>

<template>
  <div :class="cn(badgeVariants({ variant, size }), props.class)">
    <slot />
  </div>
</template>
