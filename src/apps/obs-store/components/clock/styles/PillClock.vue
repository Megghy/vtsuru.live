<script setup lang="ts">
import { onMounted } from 'vue'

import { loadObsStoreFonts } from '@/apps/obs-store/utils/fontLoader'

import type { ClockState } from '../types'

const props = defineProps<{
  state: ClockState
  clockData: {
    hours: string
    minutes: string
    seconds: string
    milliseconds: string
    ampm: string
    dateStr: string
    dateShort: string
    dayOfWeekZh: string
    dayOfWeekEn: string
  }
  countdownData: {
    remainMs: number
    isFinished: boolean
    displayTime: string
    ms: string
    percent: number
  }
  stopwatchData: {
    elapsed: number
    displayTime: string
    ms: string
  }
}>()

onMounted(() => {
  loadObsStoreFonts(['Plus+Jakarta+Sans:wght@700;800'])
})
</script>

<template>
  <div
    class="pill-clock-root"
    :style="{
      '--accent': props.state.accentColor,
      '--user-text': props.state.textColor || '#ffffff',
      '--user-bg': props.state.bgColor || '#18181b',
      '--user-opacity': props.state.bgOpacity / 100,
    }"
  >
    <!-- 左侧状态灯胶囊 -->
    <div class="pill-live-badge">
      <span class="live-dot" />
      <span class="live-text">{{ props.state.title || 'LIVE' }}</span>
    </div>

    <!-- 中间主时间呈现 -->
    <div class="pill-time-center">
      <template v-if="props.state.mode === 'clock'">
        <span class="pill-digits">{{ props.clockData.hours }}:{{ props.clockData.minutes }}</span>
        <span
          v-if="props.state.showSeconds"
          class="pill-sec"
        >:{{ props.clockData.seconds }}</span>
        <span
          v-if="!props.state.is24Hour && props.clockData.ampm"
          class="pill-ampm"
        >{{ props.clockData.ampm }}</span>
      </template>
      <template v-else-if="props.state.mode === 'countdown'">
        <span
          v-if="props.countdownData.isFinished"
          class="pill-finished"
        >{{ props.state.timerEndText || 'START' }}</span>
        <span
          v-else
          class="pill-digits"
        >{{ props.countdownData.displayTime }}</span>
      </template>
      <template v-else-if="props.state.mode === 'stopwatch'">
        <span class="pill-digits">{{ props.stopwatchData.displayTime }}</span>
      </template>
    </div>

    <!-- 右侧次级日期胶囊 -->
    <div
      v-if="props.state.showDate || props.state.showDayOfWeek"
      class="pill-date-capsule"
    >
      <span
        v-if="props.state.showDayOfWeek"
        class="pill-dow"
      >{{ props.clockData.dayOfWeekEn }}</span>
      <span
        v-if="props.state.showDate"
        class="pill-date"
      >{{ props.clockData.dateShort }}</span>
    </div>
  </div>
</template>

<style scoped>
.pill-clock-root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 280px;
  gap: 12px;
  background: var(--user-bg);
  background-color: rgba(24, 24, 27, var(--user-opacity, 0.92));
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 9999px;
  padding: 6px 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  user-select: none;
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  box-sizing: border-box;
}

.pill-live-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 3px 8px;
  border-radius: 9999px;
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.live-text {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #f4f4f5;
}

.pill-time-center {
  display: flex;
  align-items: baseline;
  color: var(--user-text);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.pill-digits {
  display: inline-block;
  min-width: 5ch;
  text-align: center;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.pill-sec {
  display: inline-block;
  min-width: 3ch;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: 19px;
  font-weight: 700;
  opacity: 0.85;
  color: var(--accent);
}

.pill-ampm {
  font-size: 11px;
  font-weight: 800;
  margin-left: 4px;
  opacity: 0.7;
}

.pill-finished {
  font-size: 22px;
  font-weight: 800;
  color: var(--accent);
}

.pill-date-capsule {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.1;
  background: rgba(255, 255, 255, 0.06);
  padding: 3px 8px;
  border-radius: 6px;
}

.pill-dow {
  font-size: 9px;
  font-weight: 800;
  color: var(--accent);
}

.pill-date {
  font-size: 10px;
  font-weight: 600;
  color: #a1a1aa;
}
</style>
