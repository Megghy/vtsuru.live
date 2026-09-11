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
  loadObsStoreFonts(['Orbitron:wght@700;900', 'Share+Tech+Mono'])
})
</script>

<template>
  <div
    class="casio-watch-case"
    :style="{
      '--accent': props.state.accentColor,
      '--user-text': props.state.textColor || undefined,
      '--user-bg': props.state.bgColor || undefined,
      '--user-opacity': props.state.bgOpacity / 100,
    }"
  >
    <!-- 四角微型工业铆钉螺丝 -->
    <span class="bolt top-left" />
    <span class="bolt top-right" />
    <span class="bolt bottom-left" />
    <span class="bolt bottom-right" />

    <!-- 顶部外壳刻字 -->
    <div class="case-bezel-top">
      <span class="bezel-text-left">PROTECTION</span>
      <span class="bezel-brand">VTSURU <span class="sub">CHRONO</span></span>
      <span class="bezel-text-right">WR 20BAR</span>
    </div>

    <!-- 内部双层液晶表盘 (LCD Screen) -->
    <div class="lcd-screen-inner">
      <!-- 液晶屏顶部分栏 -->
      <div class="lcd-top-bar">
        <div class="lcd-dow-box">
          <span class="dow-label">{{ props.clockData.dayOfWeekEn }}</span>
        </div>
        <div class="lcd-date-box">
          <span class="lcd-date-text">{{ props.clockData.dateShort }}</span>
        </div>
        <div class="lcd-indicator-box">
          <span
            v-if="props.state.is24Hour"
            class="indicator active"
          >24H</span>
          <span
            v-else
            class="indicator active"
          >{{ props.clockData.ampm }}</span>
          <span
            class="indicator"
            :class="{ active: props.state.timerRunning }"
          >SPLIT</span>
        </div>
      </div>

      <!-- 液晶屏主时间呈现 -->
      <div class="lcd-main-display">
        <!-- 实时时钟模式 -->
        <template v-if="props.state.mode === 'clock'">
          <div class="digits-wrap">
            <span class="digit-chunk">{{ props.clockData.hours }}</span>
            <span class="lcd-colon">:</span>
            <span class="digit-chunk">{{ props.clockData.minutes }}</span>
            <template v-if="props.state.showSeconds">
              <span class="lcd-colon">:</span>
              <span class="digit-chunk sec">{{ props.clockData.seconds }}</span>
            </template>
            <span
              v-if="props.state.showMilliseconds"
              class="lcd-ms"
            >{{ props.clockData.milliseconds }}</span>
          </div>
        </template>

        <!-- 倒计时模式 -->
        <template v-else-if="props.state.mode === 'countdown'">
          <div
            v-if="props.countdownData.isFinished"
            class="lcd-finished-text"
          >
            {{ props.state.timerEndText || 'LIVE NOW' }}
          </div>
          <div
            v-else
            class="digits-wrap"
          >
            <span class="digit-chunk timer">{{ props.countdownData.displayTime }}</span>
            <span
              v-if="props.state.showMilliseconds"
              class="lcd-ms"
            >{{ props.countdownData.ms }}</span>
          </div>
        </template>

        <!-- 正计时模式 -->
        <template v-else-if="props.state.mode === 'stopwatch'">
          <div class="digits-wrap">
            <span class="digit-chunk timer">{{ props.stopwatchData.displayTime }}</span>
            <span
              v-if="props.state.showMilliseconds"
              class="lcd-ms"
            >{{ props.stopwatchData.ms }}</span>
          </div>
        </template>
      </div>

      <!-- 倒计时进度条 / 刻度条 -->
      <div
        v-if="props.state.mode === 'countdown' && props.state.showProgress"
        class="lcd-scale-bar"
      >
        <div
          class="lcd-scale-fill"
          :style="{ width: `${props.countdownData.percent}%` }"
        />
      </div>
    </div>

    <!-- 底部外壳刻字 -->
    <div class="case-bezel-bottom">
      <span class="bezel-text">ILLUMINATOR // ELECTRO LUMINESCENCE</span>
    </div>
  </div>
</template>

<style scoped>
.casio-watch-case {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 290px;
  background: var(--user-bg, #1e2024);
  background-color: rgba(30, 32, 36, var(--user-opacity, 0.95));
  border: 3px solid #2d3139;
  border-radius: 12px;
  padding: 10px 14px;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.6),
    inset 0 1px 1px rgba(255, 255, 255, 0.15),
    inset 0 -2px 4px rgba(0, 0, 0, 0.5);
  font-family: 'Share Tech Mono', 'Courier New', Courier, monospace;
  user-select: none;
  box-sizing: border-box;
}

/* 螺丝钉 */
.bolt {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #64748b;
  box-shadow: inset 0 1px 1px #000;
}
.bolt.top-left { top: 6px; left: 6px; }
.bolt.top-right { top: 6px; right: 6px; }
.bolt.bottom-left { bottom: 6px; left: 6px; }
.bolt.bottom-right { bottom: 6px; right: 6px; }

/* 边框刻字 */
.case-bezel-top,
.case-bezel-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: 'Orbitron', 'Share Tech Mono', monospace;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #94a3b8;
  padding: 0 4px;
}

.bezel-brand {
  font-size: 10px;
  color: #e2e8f0;
}
.bezel-brand .sub {
  color: var(--accent);
}

.case-bezel-bottom {
  justify-content: center;
  margin-top: 4px;
}

/* 液晶屏 */
.lcd-screen-inner {
  background: #0f1715;
  border: 2px solid #060b09;
  border-radius: 6px;
  padding: 8px 12px;
  margin: 4px 0;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.9);
  color: var(--user-text, #22c55e);
}

.lcd-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  border-bottom: 1px dashed rgba(34, 197, 94, 0.25);
  padding-bottom: 4px;
  margin-bottom: 4px;
}

.dow-label {
  background: rgba(34, 197, 94, 0.15);
  padding: 1px 4px;
  border-radius: 2px;
  color: var(--user-text, #4ade80);
}

.lcd-indicator-box {
  display: flex;
  gap: 4px;
}

.indicator {
  font-size: 8px;
  opacity: 0.25;
}
.indicator.active {
  opacity: 1;
  color: var(--accent);
}

.lcd-main-display {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
}

.digits-wrap {
  display: flex;
  align-items: baseline;
  font-family: 'Orbitron', 'Share Tech Mono', monospace;
  font-size: 34px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-shadow: 0 0 10px rgba(34, 197, 94, 0.6);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.digit-chunk {
  display: inline-block;
  min-width: 2.1ch;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.digit-chunk.sec {
  min-width: 2.1ch;
}

.digit-chunk.timer {
  font-size: 36px;
  min-width: 5ch;
}

.lcd-colon {
  margin: 0 1px;
  opacity: 0.85;
}

.lcd-ms {
  font-size: 16px;
  margin-left: 4px;
  opacity: 0.8;
}

.lcd-finished-text {
  font-family: 'Orbitron', 'Share Tech Mono', monospace;
  font-size: 24px;
  font-weight: 900;
  color: var(--accent);
  text-shadow: 0 0 12px var(--accent);
  letter-spacing: 0.08em;
  animation: lcdBlink 1s infinite;
}

@keyframes lcdBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.lcd-scale-bar {
  height: 3px;
  background: rgba(34, 197, 94, 0.15);
  border-radius: 1px;
  margin-top: 4px;
  overflow: hidden;
}

.lcd-scale-fill {
  height: 100%;
  background: var(--accent);
}
</style>
