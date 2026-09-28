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
    class="medal"
    :style="{ '--medal': getMedalColor(event.medalLevel) }"
    :class="{ 'medal--dim': !event.medalWearing }"
  >
    <span class="medal__name">{{ event.medalName }}</span>
    <span class="medal__level">{{ event.medalLevel }}</span>
  </span>
  <span
    v-if="event.guardLevel > 0"
    class="guard"
    :style="{ background: getGuardColor(event.guardLevel) }"
  >{{ GUARD_NAMES[event.guardLevel] }}</span>
</template>

<style scoped>
.medal {
  display: inline-flex;
  align-items: stretch;
  border: 1px solid var(--medal);
  border-radius: 4px;
  overflow: hidden;
  font-size: 0.75em;
  line-height: 1.5;
  flex-shrink: 0;
  vertical-align: middle;
}

.medal--dim {
  opacity: 0.55;
}

.medal__name {
  background: var(--medal);
  color: #fff;
  padding: 0 4px;
}

.medal__level {
  color: var(--medal);
  background: #fff;
  padding: 0 4px;
  font-weight: 600;
}

.guard {
  display: inline-block;
  color: #fff;
  font-size: 0.75em;
  line-height: 1.5;
  padding: 0 4px;
  border-radius: 4px;
  flex-shrink: 0;
  vertical-align: middle;
}
</style>
