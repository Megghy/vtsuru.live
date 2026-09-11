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
  loadObsStoreFonts(['Inter:wght@700;800;900'])
})
</script>

<template>
  <div
    class="swiss-clock-root"
    :style="{
      '--accent': props.state.accentColor,
      '--user-text': props.state.textColor || '#000000',
      '--user-bg': props.state.bgColor || '#ffffff',
      '--user-opacity': props.state.bgOpacity / 100,
    }"
  >
    <!-- 顶部状态行 -->
    <div class="swiss-top-bar">
      <div class="swiss-tag-group">
        <span class="swiss-bullet" />
        <span class="swiss-tag">SYS.TIME</span>
      </div>
      <span class="swiss-title">{{ props.state.title || 'STUDIO EDITION' }}</span>
    </div>

    <!-- 核心排版网格：左大数字，右双行日历 -->
    <div class="swiss-main-grid">
      <!-- 左侧大数字 -->
      <div class="swiss-time-block">
        <template v-if="props.state.mode === 'clock'">
          <span class="swiss-digits">{{ props.clockData.hours }}:{{ props.clockData.minutes }}</span>
          <span
            v-if="props.state.showSeconds"
            class="swiss-sec"
          >{{ props.clockData.seconds }}</span>
        </template>
        <template v-else-if="props.state.mode === 'countdown'">
          <span
            v-if="props.countdownData.isFinished"
            class="swiss-digits finished"
          >{{ props.state.timerEndText || 'LIVE NOW' }}</span>
          <span
            v-else
            class="swiss-digits"
          >{{ props.countdownData.displayTime }}</span>
        </template>
        <template v-else-if="props.state.mode === 'stopwatch'">
          <span class="swiss-digits">{{ props.stopwatchData.displayTime }}</span>
        </template>
      </div>

      <!-- 瑞士分割细线 -->
      <div class="swiss-vertical-line" />

      <!-- 右侧垂直日历与信息块 -->
      <div class="swiss-calendar-block">
        <span class="swiss-dow">{{ props.clockData.dayOfWeekEn }}</span>
        <span class="swiss-date">{{ props.clockData.dateStr }}</span>
        <span class="swiss-locale">{{ props.clockData.dayOfWeekZh }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.swiss-clock-root {
  display: inline-flex;
  flex-direction: column;
  min-width: 320px;
  background: var(--user-bg);
  background-color: rgba(255, 255, 255, var(--user-opacity, 0.96));
  color: var(--user-text);
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  padding: 10px 16px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  user-select: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  box-sizing: border-box;
}

.swiss-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  padding-bottom: 4px;
  margin-bottom: 6px;
}

.swiss-tag-group {
  display: flex;
  align-items: center;
  gap: 5px;
}

.swiss-bullet {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}

.swiss-tag {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  opacity: 0.7;
}

.swiss-title {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  opacity: 0.5;
}

.swiss-main-grid {
  display: flex;
  align-items: center;
  gap: 12px;
}

.swiss-time-block {
  display: flex;
  align-items: baseline;
  line-height: 0.95;
}

.swiss-digits {
  display: inline-block;
  min-width: 5ch;
  text-align: center;
  font-size: 46px;
  font-weight: 900;
  letter-spacing: -0.04em;
  font-variant-numeric: tabular-nums;
}

.swiss-digits.finished {
  font-size: 32px;
  color: var(--accent);
}

.swiss-sec {
  display: inline-block;
  min-width: 2.1ch;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: 20px;
  font-weight: 800;
  color: var(--accent);
  margin-left: 3px;
}

.swiss-vertical-line {
  width: 1px;
  height: 40px;
  background: rgba(0, 0, 0, 0.15);
}

.swiss-calendar-block {
  display: flex;
  flex-direction: column;
  justify-content: center;
  line-height: 1.2;
}

.swiss-dow {
  font-size: 14px;
  font-weight: 900;
  letter-spacing: 0.05em;
}

.swiss-date {
  font-size: 11px;
  font-weight: 700;
  opacity: 0.75;
}

.swiss-locale {
  font-size: 9px;
  font-weight: 600;
  opacity: 0.5;
}
</style>
