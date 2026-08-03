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
  <UBadge
    v-if="showFanMedal && user?.fans_medal_wearing_status"
    :size="size"
    round
    :bordered="false"
    style="padding: 0 6px 0 0"
  >
    <UBadge
      :size="size"
      round
      :bordered="false"
      type="info"
      style="margin-right: 4px"
    >
      {{ user?.fans_medal_level }}
    </UBadge>
    <span style="color: var(--vtsuru-info)">{{ user?.fans_medal_name }}</span>
  </UBadge>

  <UBadge
    v-if="(user?.guard_level ?? 0) > 0"
    :size="size"
    :bordered="false"
    color="neutral"
    :style="{ backgroundColor: getGuardColor(user?.guard_level), color: 'white' }"
  >
    {{ GUARD_NAME[user?.guard_level ?? 0] }}
  </UBadge>
</template>
