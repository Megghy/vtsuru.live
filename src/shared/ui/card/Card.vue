<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from '@/shared/utils/cn'

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <div
    :class="
      cn(
        'rounded-lg border-[length:var(--ui-border-width,1px)] [border-style:var(--ui-border-style,solid)] bg-card text-card-foreground shadow-[var(--ui-shadow,0_1px_2px_rgb(0_0_0/0.05))]',
        props.class,
      )
    "
  >
    <slot />
  </div>
</template>
