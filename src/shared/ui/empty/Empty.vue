<script setup lang="ts">
import { InboxIcon } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    description?: string
    size?: 'small' | 'medium' | 'large'
  }>(),
  {
    description: '暂无数据',
    size: 'medium',
  },
)
</script>

<template>
  <div class="flex flex-col items-center justify-center p-6 text-center text-muted-foreground select-none">
    <slot name="icon">
      <InboxIcon
        class="mb-2 text-muted-foreground/40 stroke-[1.5]"
        :class="size === 'small' ? 'size-7' : size === 'large' ? 'size-12' : 'size-9'"
      />
    </slot>
    <div class="text-xs font-normal">
      <slot>{{ description }}</slot>
    </div>
    <div v-if="$slots.extra" class="mt-3">
      <slot name="extra" />
    </div>
  </div>
</template>
