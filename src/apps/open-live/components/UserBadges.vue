<script setup lang="ts">
import type { DanmakuUserInfo } from '@/api/api-models'
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
    class="inline-flex items-center rounded-full bg-muted text-[10px] pr-1.5 py-0 border border-border/40 select-none"
  >
    <span
      class="inline-flex items-center justify-center rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 font-semibold px-1.5 mr-1 text-[10px]"
    >
      {{ user?.fans_medal_level }}
    </span>
    <span class="text-sky-600 dark:text-sky-400 font-medium">{{ user?.fans_medal_name }}</span>
  </span>

  <span
    v-if="(user?.guard_level ?? 0) > 0"
    class="inline-flex items-center rounded px-1.5 py-0 text-[10px] text-white font-medium select-none"
    :style="{ backgroundColor: getGuardColor(user?.guard_level) }"
  >
    {{ GUARD_NAME[user?.guard_level ?? 0] }}
  </span>
</template>
