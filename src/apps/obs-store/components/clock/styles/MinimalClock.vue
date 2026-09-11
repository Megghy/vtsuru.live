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
  loadObsStoreFonts(['Space+Grotesk:wght@700'])
})
</script>

<template>
  <div
    class="minimal-clock-root"
    :style="{
      '--accent': props.state.accentColor,
      '--user-text': props.state.textColor || '#ffffff',
    }"
  >
    <!-- 顶部极简副标 -->
    <div
      v-if="props.state.title"
      class="minimal-title"
    >
      {{ props.state.title }}
    </div>

    <!-- 主时间呈现 -->
    <div class="minimal-time-row">
      <template v-if="props.state.mode === 'clock'">
        <span class="minimal-hours">{{ props.clockData.hours }}</span>
        <span class="minimal-colon">:</span>
        <span class="minimal-minutes">{{ props.clockData.minutes }}</span>
        <template v-if="props.state.showSeconds">
          <span class="minimal-colon">:</span>
          <span class="minimal-sec">{{ props.clockData.seconds }}</span>
        </template>
        <span
          v-if="props.state.showMilliseconds"
          class="minimal-ms"
        >.{{ props.clockData.milliseconds }}</span>
        <span
          v-if="!props.state.is24Hour && props.clockData.ampm"
          class="minimal-ampm"
        >{{ props.clockData.ampm }}</span>
      </template>

      <template v-else-if="props.state.mode === 'countdown'">
        <span
          v-if="props.countdownData.isFinished"
          class="minimal-finished"
        >{{ props.state.timerEndText || 'LIVE NOW' }}</span>
        <span
          v-else
          class="minimal-timer"
        >{{ props.countdownData.displayTime }}</span>
      </template>

      <template v-else-if="props.state.mode === 'stopwatch'">
        <span class="minimal-timer">{{ props.stopwatchData.displayTime }}</span>
      </template>
    </div>

    <!-- 底部极简日期与星期 -->
    <div
      v-if="props.state.showDate || props.state.showDayOfWeek"
      class="minimal-footer"
    >
      <span
        v-if="props.state.showDate"
        class="footer-item"
      >{{ props.clockData.dateStr }}</span>
      <span
        v-if="props.state.showDayOfWeek"
        class="footer-item highlight"
      >{{ props.clockData.dayOfWeekEn }}</span>
    </div>
  </div>
</template>

<style scoped>
.minimal-clock-root {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  background: transparent;
  padding: 4px;
  user-select: none;
  font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif;
  color: var(--user-text);
  text-shadow:
    0 2px 6px rgba(0, 0, 0, 0.9),
    0 0 16px rgba(0, 0, 0, 0.6);
  box-sizing: border-box;
}

.minimal-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 2px;
}

.minimal-time-row {
  display: flex;
  align-items: baseline;
  font-variant-numeric: tabular-nums;
  line-height: 0.95;
}

.minimal-hours,
.minimal-minutes,
.minimal-sec,
.minimal-timer {
  font-size: 48px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.minimal-sec {
  color: var(--accent);
}

.minimal-colon {
  font-size: 44px;
  font-weight: 700;
  margin: 0 1px;
  opacity: 0.8;
}

.minimal-ms {
  font-size: 20px;
  font-weight: 700;
  opacity: 0.8;
  margin-left: 3px;
}

.minimal-ampm {
  font-size: 14px;
  font-weight: 700;
  margin-left: 6px;
  color: var(--accent);
}

.minimal-finished {
  font-size: 34px;
  font-weight: 700;
  color: var(--accent);
}

.minimal-footer {
  display: flex;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  margin-top: 4px;
  letter-spacing: 0.04em;
}

.footer-item {
  opacity: 0.85;
}

.footer-item.highlight {
  color: var(--accent);
  opacity: 1;
}
</style>
