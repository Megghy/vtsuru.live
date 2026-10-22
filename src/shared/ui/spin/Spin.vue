<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    show?: boolean
    size?: 'small' | 'medium' | 'large'
    description?: string
  }>(),
  {
    show: true,
    size: 'medium',
  },
)
</script>

<template>
  <div
    v-if="$slots.default"
    class="relative"
  >
    <slot />
    <div
      v-if="show"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[1px] transition-all"
    >
      <Loader2
        class="animate-spin text-primary"
        :class="size === 'small' ? 'size-4' : size === 'large' ? 'size-8' : 'size-6'"
      />
      <span
        v-if="description"
        class="mt-2 text-xs text-muted-foreground"
        >{{ description }}</span
      >
    </div>
  </div>
  <div
    v-else-if="show"
    class="flex flex-col items-center justify-center p-4"
  >
    <Loader2
      class="animate-spin text-primary"
      :class="size === 'small' ? 'size-4' : size === 'large' ? 'size-8' : 'size-6'"
    />
    <span
      v-if="description"
      class="mt-2 text-xs text-muted-foreground"
      >{{ description }}</span
    >
  </div>
</template>
