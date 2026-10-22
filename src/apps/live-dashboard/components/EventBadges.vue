<script setup lang="ts">
import { getMedalColor } from '@/apps/client/components/danmaku/danmakuUtils'
import { getGuardColor } from '@/shared/utils/queue'

import type { DashboardEvent } from '../core/types'
import { GUARD_NAMES } from '../core/types'

defineProps<{ event: DashboardEvent; showMedal: boolean }>()
</script>

<template>
  <span
    v-if="showMedal && event.medalName && event.medalLevel > 0"
    class="medal inline-flex items-stretch border border-[var(--medal)] rounded overflow-hidden text-[0.75em] leading-[1.5] shrink-0 align-middle"
    :style="{ '--medal': getMedalColor(event.medalLevel) }"
    :class="{ 'opacity-55': !event.medalWearing }"
  >
    <span class="bg-[var(--medal)] text-white px-1">{{ event.medalName }}</span>
    <span class="text-[var(--medal)] bg-white px-1 font-semibold">{{ event.medalLevel }}</span>
  </span>
  <span
    v-if="event.guardLevel > 0"
    class="inline-block text-white text-[0.75em] leading-[1.5] px-1 rounded shrink-0 align-middle"
    :style="{ background: getGuardColor(event.guardLevel) }"
    >{{ GUARD_NAMES[event.guardLevel] }}</span
  >
</template>
