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
  loadObsStoreFonts(['Gaegu:wght@700'])
})
</script>

<template>
  <div
    class="cute-clock-root"
    :style="{
      '--accent': props.state.accentColor || '#f43f5e',
      '--user-text': props.state.textColor || '#475569',
      '--user-bg': props.state.bgColor || '#fff1f2',
      '--user-opacity': props.state.bgOpacity / 100,
    }"
  >
    <!-- 猫耳轮廓耳朵 -->
    <div class="neko-ears">
      <div class="ear left">
        <div class="ear-inner" />
      </div>
      <div class="ear right">
        <div class="ear-inner" />
      </div>
    </div>

    <!-- 萌系奶油气泡主体 -->
    <div class="cute-bubble-body">
      <!-- 顶部小标与心形呼吸灯 -->
      <div class="cute-header">
        <div class="heart-indicator">
          <span class="heart-icon">♥</span>
          <span class="live-pill">{{ props.state.title || 'LIVE' }}</span>
        </div>
        <span class="sparkle">✦</span>
      </div>

      <!-- 时间主体 -->
      <div class="cute-time-display">
        <!-- 实时时钟模式 -->
        <template v-if="props.state.mode === 'clock'">
          <span class="cute-digits">{{ props.clockData.hours }}</span>
          <span class="cute-colon">:</span>
          <span class="cute-digits">{{ props.clockData.minutes }}</span>
          <template v-if="props.state.showSeconds">
            <span class="cute-colon">:</span>
            <span class="cute-digits sec">{{ props.clockData.seconds }}</span>
          </template>
        </template>

        <!-- 倒计时模式 -->
        <template v-else-if="props.state.mode === 'countdown'">
          <div
            v-if="props.countdownData.isFinished"
            class="cute-finished"
          >
            ★ {{ props.state.timerEndText || 'LIVE NOW' }} ★
          </div>
          <div
            v-else
            class="cute-timer-digits"
          >
            {{ props.countdownData.displayTime }}
          </div>
        </template>

        <!-- 正计时模式 -->
        <template v-else-if="props.state.mode === 'stopwatch'">
          <div class="cute-timer-digits">
            {{ props.stopwatchData.displayTime }}
          </div>
        </template>
      </div>

      <!-- 底部日期与星期萌系标签 -->
      <div
        v-if="props.state.showDate || props.state.showDayOfWeek"
        class="cute-footer"
      >
        <span
          v-if="props.state.showDate"
          class="cute-tag"
        >🐾 {{ props.clockData.dateShort }}</span>
        <span
          v-if="props.state.showDayOfWeek"
          class="cute-tag"
        >{{ props.clockData.dayOfWeekZh }}</span>
        <span
          v-if="!props.state.is24Hour && props.clockData.ampm"
          class="cute-tag ampm"
        >{{ props.clockData.ampm }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cute-clock-root {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
  font-family: 'Gaegu', cursive, -apple-system, sans-serif;
  box-sizing: border-box;
}

/* 顶部立体猫耳朵 */
.neko-ears {
  position: absolute;
  top: -12px;
  left: 20px;
  right: 20px;
  display: flex;
  justify-content: space-between;
  z-index: 1;
  pointer-events: none;
}

.ear {
  width: 24px;
  height: 20px;
  background: var(--user-bg);
  background-color: rgba(255, 241, 242, var(--user-opacity, 0.95));
  border: 2px solid var(--accent);
  border-bottom: none;
  border-radius: 12px 12px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ear.left {
  transform: rotate(-12deg);
}

.ear.right {
  transform: rotate(12deg);
}

.ear-inner {
  width: 12px;
  height: 10px;
  background: var(--accent);
  opacity: 0.35;
  border-radius: 6px 6px 0 0;
}

/* 奶油圆角主体 */
.cute-bubble-body {
  position: relative;
  z-index: 2;
  min-width: 270px;
  background: var(--user-bg);
  background-color: rgba(255, 241, 242, var(--user-opacity, 0.95));
  border: 2.5px solid var(--accent);
  border-radius: 24px;
  padding: 8px 18px 10px 18px;
  box-shadow:
    0 8px 20px rgba(244, 63, 94, 0.15),
    inset 0 2px 0 rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cute-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin-bottom: -4px;
}

.heart-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
}

.heart-icon {
  color: var(--accent);
  font-size: 14px;
  animation: heartBeat 1.2s infinite ease-in-out;
}

@keyframes heartBeat {
  0%, 100% { transform: scale(1); }
  30% { transform: scale(1.3); }
  60% { transform: scale(1.1); }
}

.live-pill {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: 0.05em;
}

.sparkle {
  color: #fbbf24;
  font-size: 12px;
}

.cute-time-display {
  display: flex;
  align-items: baseline;
  gap: 2px;
  line-height: 1;
}

.cute-digits {
  display: inline-block;
  min-width: 2.1ch;
  text-align: center;
  font-size: 50px;
  font-weight: 700;
  color: var(--user-text);
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}

.cute-digits.sec {
  min-width: 2.1ch;
}

.cute-colon {
  font-size: 40px;
  font-weight: 700;
  color: var(--accent);
  animation: cuteBlink 1.5s infinite;
}

@keyframes cuteBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.cute-timer-digits {
  display: inline-block;
  min-width: 5ch;
  text-align: center;
  font-size: 44px;
  font-weight: 700;
  color: var(--user-text);
  font-variant-numeric: tabular-nums;
}

.cute-finished {
  font-size: 28px;
  font-weight: 700;
  color: var(--accent);
  padding: 4px 10px;
}

.cute-footer {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.cute-tag {
  font-size: 13px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 12px;
  background: rgba(244, 63, 94, 0.1);
  color: var(--user-text);
  border: 1px solid rgba(244, 63, 94, 0.2);
}

.cute-tag.ampm {
  background: var(--accent);
  color: #ffffff;
}
</style>
