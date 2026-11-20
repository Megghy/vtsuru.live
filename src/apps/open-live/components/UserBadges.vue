<script setup lang="ts">
import type { DanmakuUserInfo } from '@/api/generated/model'
import { getGuardColor } from '@/shared/utils/queue'

withDefaults(
  defineProps<{
    user?: DanmakuUserInfo
    showFanMedal?: boolean
    size?: 'tiny' | 'small'
  }>(),
  {
    showFanMedal: true,
    size: 'tiny',
  },
)

const GUARD_NAME: Record<number, string> = { 1: '总督', 2: '提督', 3: '舰长' }
</script>

<template>
  <span
    v-if="showFanMedal && user?.fans_medal_wearing_status"
    class="inline-flex items-center rounded-full bg-muted text-[10px] leading-none pr-1.5 py-0 border border-border/40 select-none shrink-0 whitespace-nowrap"
    :class="size === 'small' ? 'h-5' : 'h-4'"
  >
    <span
      class="inline-flex-center h-full rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 font-semibold px-1.5 mr-1 text-[10px] leading-none tabular-nums"
    >
      {{ user?.fans_medal_level }}
    </span>
    <span class="text-sky-600 dark:text-sky-400 font-medium leading-none">{{ user?.fans_medal_name }}</span>
  </span>

  <span
    v-if="(user?.guard_level ?? 0) > 0"
    class="inline-flex-center rounded px-1.5 py-0 text-[10px] leading-none text-white font-medium select-none shrink-0 whitespace-nowrap"
    :class="size === 'small' ? 'h-5' : 'h-4'"
    :style="{ backgroundColor: getGuardColor(user?.guard_level) }"
  >
    {{ GUARD_NAME[user?.guard_level ?? 0] }}
  </span>
</template>
