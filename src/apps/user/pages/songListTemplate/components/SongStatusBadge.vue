<script setup lang="ts">
import { computed } from 'vue'

import { Badge } from '@/shared/ui/badge'

const props = withDefaults(
  defineProps<{
    songKey: string
    singingKeys: Set<string>
    queuedKeys: Set<string>
    /** tag: Badge；text: 纯文本 span */
    variant?: 'tag' | 'text'
    size?: 'tiny' | 'small'
  }>(),
  {
    variant: 'tag',
    size: 'tiny',
  },
)

const status = computed(() => {
  if (props.singingKeys.has(props.songKey)) return 'singing' as const
  if (props.queuedKeys.has(props.songKey)) return 'queued' as const
  return null
})
</script>

<template>
  <template v-if="status">
    <Badge
      v-if="variant === 'tag'"
      class="song-status-badge text-[10px] font-normal"
      :class="[
        size === 'tiny' ? 'h-4 px-1' : 'h-4.5 px-1.5',
        status === 'singing'
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      ]"
      variant="outline"
    >
      {{ status === 'singing' ? '演唱中' : '排队中' }}
    </Badge>
    <span
      v-else
      class="text-xs font-semibold"
      :class="status === 'singing' ? 'text-[var(--vtsuru-warning,#f59e0b)]' : 'text-[var(--vtsuru-success,#22c55e)]'"
    >
      {{ status === 'singing' ? '演唱中' : '排队中' }}
    </span>
  </template>
</template>

