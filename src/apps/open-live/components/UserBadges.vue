<script setup lang="ts">
import type { DanmakuUserInfo } from '@/api/api-models'
import { NTag } from 'naive-ui';
import { getGuardColor } from '@/shared/utils/queue'

withDefaults(defineProps<{
  user?: DanmakuUserInfo
  showFanMedal?: boolean
  size?: 'tiny' | 'small'
}>(), {
  showFanMedal: true,
  size: 'tiny',
})

const GUARD_NAME: Record<number, string> = { 1: '总督', 2: '提督', 3: '舰长' }
</script>

<template>
  <NTag
    v-if="showFanMedal && user?.fans_medal_wearing_status"
    :size="size"
    round
    :bordered="false"
    style="padding: 0 6px 0 0;"
  >
    <NTag :size="size" round :bordered="false" type="info" style="margin-right: 4px;">
      {{ user?.fans_medal_level }}
    </NTag>
    <span style="color: var(--n-info-color)">{{ user?.fans_medal_name }}</span>
  </NTag>

  <NTag
    v-if="(user?.guard_level ?? 0) > 0"
    :size="size"
    :bordered="false"
    :color="{ textColor: 'white', color: getGuardColor(user?.guard_level) }"
  >
    {{ GUARD_NAME[user?.guard_level ?? 0] }}
  </NTag>
</template>
