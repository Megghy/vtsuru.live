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
  loadObsStoreFonts(['Press+Start+2P'])
})
</script>

<template>
  <div
    class="pixel-clock-root"
    :style="{
      '--accent': props.state.accentColor || '#facc15',
      '--user-text': props.state.textColor || '#ffffff',
      '--user-bg': props.state.bgColor || '#18181b',
      '--user-opacity': props.state.bgOpacity / 100,
    }"
  >
    <div class="pixel-box">
      <!-- 8-Bit 顶部小标与生命值 -->
      <div class="pixel-header">
        <span class="pixel-title">1P {{ props.state.title || 'STAGE 01' }}</span>
        <div class="pixel-hearts">
          <span class="heart">♥</span>
          <span class="heart">♥</span>
          <span class="heart">♥</span>
        </div>
      </div>

      <!-- 时间主体 -->
      <div class="pixel-time-display">
        <!-- 实时时钟模式 -->
        <template v-if="props.state.mode === 'clock'">
          <span class="pixel-digits">{{ props.clockData.hours }}</span>
          <span class="pixel-colon">:</span>
          <span class="pixel-digits">{{ props.clockData.minutes }}</span>
          <template v-if="props.state.showSeconds">
            <span class="pixel-colon">:</span>
            <span class="pixel-digits sec">{{ props.clockData.seconds }}</span>
          </template>
        </template>

        <!-- 倒计时模式 -->
        <template v-else-if="props.state.mode === 'countdown'">
          <div
            v-if="props.countdownData.isFinished"
            class="pixel-finished"
          >
            ! GAME START !
          </div>
          <div
            v-else
            class="pixel-timer-digits"
          >
            {{ props.countdownData.displayTime }}
          </div>
        </template>

        <!-- 正计时模式 -->
        <template v-else-if="props.state.mode === 'stopwatch'">
          <div class="pixel-timer-digits">
            {{ props.stopwatchData.displayTime }}
          </div>
        </template>
      </div>

      <!-- 底部像素日期 -->
      <div
        v-if="props.state.showDate || props.state.showDayOfWeek"
        class="pixel-footer"
      >
        <span
          v-if="props.state.showDate"
          class="pixel-badge"
        >{{ props.clockData.dateShort }}</span>
        <span
          v-if="props.state.showDayOfWeek"
          class="pixel-badge"
        >{{ props.clockData.dayOfWeekEn }}</span>
        <span
          v-if="!props.state.is24Hour && props.clockData.ampm"
          class="pixel-badge ampm"
        >{{ props.clockData.ampm }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pixel-clock-root {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
  font-family: 'Press Start 2P', monospace, monospace;
  box-sizing: border-box;
}

.pixel-box {
  min-width: 270px;
  background: var(--user-bg);
  background-color: rgba(24, 24, 27, var(--user-opacity, 0.95));
  border: 3px solid #000000;
  box-shadow:
    inset -3px -3px 0px 0px rgba(0, 0, 0, 0.6),
    inset 3px 3px 0px 0px rgba(255, 255, 255, 0.2),
    4px 4px 0px 0px #000000;
  padding: 8px 14px 8px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pixel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: 4px;
}

.pixel-title {
  font-size: 8px;
  color: var(--accent);
  letter-spacing: 0.08em;
}

.pixel-hearts {
  display: flex;
  gap: 3px;
}

.heart {
  color: #ef4444;
  font-size: 9px;
  animation: heartPulse 1.5s infinite;
}

@keyframes heartPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.pixel-time-display {
  display: flex;
  align-items: center;
  gap: 2px;
  line-height: 1;
}

.pixel-digits {
  display: inline-block;
  min-width: 2.1ch;
  text-align: center;
  font-size: 28px;
  color: var(--user-text);
  letter-spacing: 0.05em;
  font-variant-numeric: tabular-nums;
}

.pixel-digits.sec {
  min-width: 2.1ch;
}

.pixel-colon {
  font-size: 24px;
  color: var(--accent);
  animation: pixelBlink 1s infinite;
}

@keyframes pixelBlink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

.pixel-timer-digits {
  display: inline-block;
  min-width: 5ch;
  text-align: center;
  font-size: 26px;
  color: var(--user-text);
  font-variant-numeric: tabular-nums;
}

.pixel-finished {
  font-size: 16px;
  color: var(--accent);
  padding: 4px 0;
}

.pixel-footer {
  display: flex;
  gap: 4px;
  margin-top: 6px;
}

.pixel-badge {
  font-size: 7px;
  padding: 2px 4px;
  background: #27272a;
  border: 1px solid #3f3f46;
  color: #e4e4e7;
}

.pixel-badge.ampm {
  background: var(--accent);
  color: #000000;
  font-weight: 700;
}
</style>
