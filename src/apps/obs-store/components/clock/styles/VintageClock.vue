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
  loadObsStoreFonts(['Great+Vibes'])
})
</script>

<template>
  <div
    class="calligraphy-clock-root"
    :style="{
      '--accent': props.state.accentColor || '#f59e0b',
      '--user-text': props.state.textColor || '#ffffff',
    }"
  >
    <!-- 顶部文艺流线小标题 -->
    <div
      v-if="props.state.title"
      class="calligraphy-title"
    >
      ~ {{ props.state.title }} ~
    </div>

    <!-- 纯透连笔花体字时间 -->
    <div class="calligraphy-time-row">
      <!-- 实时时钟模式 -->
      <template v-if="props.state.mode === 'clock'">
        <span class="calligraphy-digits">{{ props.clockData.hours }}</span>
        <span class="calligraphy-colon">:</span>
        <span class="calligraphy-digits">{{ props.clockData.minutes }}</span>
        <template v-if="props.state.showSeconds">
          <span class="calligraphy-colon">:</span>
          <span class="calligraphy-digits sec">{{ props.clockData.seconds }}</span>
        </template>
      </template>

      <!-- 倒计时模式 -->
      <template v-else-if="props.state.mode === 'countdown'">
        <div
          v-if="props.countdownData.isFinished"
          class="calligraphy-finished"
        >
          {{ props.state.timerEndText || 'Live Now' }}
        </div>
        <div
          v-else
          class="calligraphy-timer-digits"
        >
          {{ props.countdownData.displayTime }}
        </div>
      </template>

      <!-- 正计时模式 -->
      <template v-else-if="props.state.mode === 'stopwatch'">
        <div class="calligraphy-timer-digits">
          {{ props.stopwatchData.displayTime }}
        </div>
      </template>
    </div>

    <!-- 底部典雅斜体日期与星期 -->
    <div
      v-if="props.state.showDate || props.state.showDayOfWeek"
      class="calligraphy-footer"
    >
      <span
        v-if="props.state.showDate"
        class="calligraphy-date"
      >{{ props.clockData.dateStr }}</span>
      <span
        v-if="props.state.showDate && props.state.showDayOfWeek"
        class="calligraphy-sep"
      >·</span>
      <span
        v-if="props.state.showDayOfWeek"
        class="calligraphy-day"
      >{{ props.clockData.dayOfWeekEn }}</span>
      <span
        v-if="!props.state.is24Hour && props.clockData.ampm"
        class="calligraphy-ampm"
      >{{ props.clockData.ampm }}</span>
    </div>
  </div>
</template>

<style scoped>
.calligraphy-clock-root {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
  font-family: 'Great Vibes', 'Brush Script MT', cursive, serif;
  background: transparent;
  padding: 4px 8px;
  box-sizing: border-box;
}

.calligraphy-title {
  font-size: 20px;
  color: var(--accent);
  letter-spacing: 0.06em;
  margin-bottom: -6px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
}

.calligraphy-time-row {
  display: flex;
  align-items: baseline;
  gap: 2px;
  line-height: 1;
}

.calligraphy-digits {
  font-size: 64px;
  font-weight: 400;
  color: var(--user-text);
  letter-spacing: 0.03em;
  text-shadow:
    0 2px 10px rgba(0, 0, 0, 0.8),
    0 0 20px rgba(0, 0, 0, 0.5);
}

.calligraphy-colon {
  font-size: 46px;
  color: var(--accent);
  margin: 0 1px;
  opacity: 0.85;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
}

.calligraphy-timer-digits {
  font-size: 56px;
  color: var(--user-text);
  text-shadow:
    0 2px 10px rgba(0, 0, 0, 0.8),
    0 0 20px rgba(0, 0, 0, 0.5);
}

.calligraphy-finished {
  font-size: 42px;
  color: var(--accent);
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.8);
}

.calligraphy-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  color: #e2e8f0;
  margin-top: -4px;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.8);
}

.calligraphy-sep {
  color: var(--accent);
}

.calligraphy-ampm {
  color: var(--accent);
  font-size: 16px;
  margin-left: 4px;
}
</style>
