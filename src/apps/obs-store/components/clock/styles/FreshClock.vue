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
  loadObsStoreFonts(['Quicksand:wght@600;700'])
})
</script>

<template>
  <div
    class="fresh-clock-root"
    :style="{
      '--accent': props.state.accentColor || '#10b981',
      '--user-text': props.state.textColor || '#064e3b',
      '--user-bg': props.state.bgColor || '#ecfdf5',
      '--user-opacity': props.state.bgOpacity / 100,
    }"
  >
    <div class="fresh-card">
      <!-- 顶部清新叶片与微标 -->
      <div class="fresh-header">
        <div class="leaf-icon">
          🍃
        </div>
        <span class="fresh-title">{{ props.state.title || 'NATURAL BREEZE' }}</span>
      </div>

      <!-- 时间主体 -->
      <div class="fresh-time-display">
        <!-- 实时时钟模式 -->
        <template v-if="props.state.mode === 'clock'">
          <span class="fresh-digits">{{ props.clockData.hours }}</span>
          <span class="fresh-dot" />
          <span class="fresh-digits">{{ props.clockData.minutes }}</span>
          <template v-if="props.state.showSeconds">
            <span class="fresh-dot" />
            <span class="fresh-digits sec">{{ props.clockData.seconds }}</span>
          </template>
        </template>

        <!-- 倒计时模式 -->
        <template v-else-if="props.state.mode === 'countdown'">
          <div
            v-if="props.countdownData.isFinished"
            class="fresh-finished"
          >
            🌱 {{ props.state.timerEndText || 'STARTING' }}
          </div>
          <div
            v-else
            class="fresh-timer-digits"
          >
            {{ props.countdownData.displayTime }}
          </div>
        </template>

        <!-- 正计时模式 -->
        <template v-else-if="props.state.mode === 'stopwatch'">
          <div class="fresh-timer-digits">
            {{ props.stopwatchData.displayTime }}
          </div>
        </template>
      </div>

      <!-- 底部日期与自然小标 -->
      <div
        v-if="props.state.showDate || props.state.showDayOfWeek"
        class="fresh-footer"
      >
        <span
          v-if="props.state.showDate"
          class="fresh-pill"
        >{{ props.clockData.dateStr }}</span>
        <span
          v-if="props.state.showDayOfWeek"
          class="fresh-pill"
        >{{ props.clockData.dayOfWeekZh }}</span>
        <span
          v-if="!props.state.is24Hour && props.clockData.ampm"
          class="fresh-pill ampm"
        >{{ props.clockData.ampm }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fresh-clock-root {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
  font-family: 'Quicksand', -apple-system, sans-serif;
  box-sizing: border-box;
}

.fresh-card {
  min-width: 270px;
  background: var(--user-bg);
  background-color: rgba(236, 253, 245, var(--user-opacity, 0.95));
  border: 1.5px solid rgba(16, 185, 129, 0.3);
  border-radius: 18px;
  padding: 8px 20px 10px 20px;
  box-shadow:
    0 10px 25px rgba(16, 185, 129, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.fresh-header {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: -2px;
}

.leaf-icon {
  font-size: 11px;
  animation: leafSway 3s infinite ease-in-out;
}

@keyframes leafSway {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(15deg); }
}

.fresh-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--accent);
  text-transform: uppercase;
}

.fresh-time-display {
  display: flex;
  align-items: center;
  gap: 4px;
}

.fresh-digits {
  display: inline-block;
  min-width: 2.1ch;
  text-align: center;
  font-size: 48px;
  font-weight: 700;
  color: var(--user-text);
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}

.fresh-digits.sec {
  min-width: 2.1ch;
}

.fresh-dot {
  width: 5px;
  height: 5px;
  background: var(--accent);
  border-radius: 50%;
  opacity: 0.8;
  margin: 0 1px;
}

.fresh-timer-digits {
  display: inline-block;
  min-width: 5ch;
  text-align: center;
  font-size: 44px;
  font-weight: 700;
  color: var(--user-text);
  font-variant-numeric: tabular-nums;
}

.fresh-finished {
  font-size: 26px;
  font-weight: 700;
  color: var(--accent);
}

.fresh-footer {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.fresh-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.15);
  color: var(--user-text);
}

.fresh-pill.ampm {
  background: var(--accent);
  color: #ffffff;
}
</style>
