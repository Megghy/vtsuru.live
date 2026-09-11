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
  loadObsStoreFonts(['Rajdhani:wght@600;700', 'Share+Tech+Mono'])
})
</script>

<template>
  <div
    class="tactical-hud-root"
    :style="{
      '--accent': props.state.accentColor,
      '--user-text': props.state.textColor || '#38bdf8',
      '--user-bg': props.state.bgColor || '#050c14',
      '--user-opacity': props.state.bgOpacity / 100,
    }"
  >
    <!-- 战术四角瞄准角标 -->
    <span class="hud-corner top-left" />
    <span class="hud-corner top-right" />
    <span class="hud-corner bottom-left" />
    <span class="hud-corner bottom-right" />

    <!-- 战术顶栏 -->
    <div class="hud-top-bar">
      <span class="hud-tag"><span class="crosshair">+</span> SEC.OPS // UTC+8</span>
      <span class="hud-coords">LOC: 31.23°N 121.47°E</span>
    </div>

    <!-- 主时间显示与扫描线容器 -->
    <div class="hud-center-stage">
      <div class="hud-scanlines" />

      <template v-if="props.state.mode === 'clock'">
        <div class="hud-time-wrap">
          <span class="hud-bracket">[</span>
          <span class="hud-digits">{{ props.clockData.hours }}:{{ props.clockData.minutes }}</span>
          <template v-if="props.state.showSeconds">
            <span class="hud-sec">:{{ props.clockData.seconds }}</span>
          </template>
          <span
            v-if="props.state.showMilliseconds"
            class="hud-ms"
          >.{{ props.clockData.milliseconds }}</span>
          <span class="hud-bracket">]</span>
        </div>
      </template>

      <template v-else-if="props.state.mode === 'countdown'">
        <div
          v-if="props.countdownData.isFinished"
          class="hud-finished-text"
        >
          [ MISSION READY // {{ props.state.timerEndText || 'LIVE NOW' }} ]
        </div>
        <div
          v-else
          class="hud-time-wrap"
        >
          <span class="hud-bracket">[</span>
          <span class="hud-digits timer">{{ props.countdownData.displayTime }}</span>
          <span
            v-if="props.state.showMilliseconds"
            class="hud-ms"
          >.{{ props.countdownData.ms }}</span>
          <span class="hud-bracket">]</span>
        </div>
      </template>

      <template v-else-if="props.state.mode === 'stopwatch'">
        <div class="hud-time-wrap">
          <span class="hud-bracket">[</span>
          <span class="hud-digits timer">{{ props.stopwatchData.displayTime }}</span>
          <span
            v-if="props.state.showMilliseconds"
            class="hud-ms"
          >.{{ props.stopwatchData.ms }}</span>
          <span class="hud-bracket">]</span>
        </div>
      </template>
    </div>

    <!-- 底部状态指示条 -->
    <div class="hud-bottom-bar">
      <span class="hud-date">{{ props.clockData.dateStr }} // {{ props.clockData.dayOfWeekEn }}</span>
      <div class="hud-meter-bars">
        <span class="bar b1" />
        <span class="bar b2" />
        <span class="bar b3" />
        <span class="bar b4" />
        <span class="bar b5" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tactical-hud-root {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  min-width: 320px;
  background: var(--user-bg);
  background-color: rgba(5, 12, 20, var(--user-opacity, 0.92));
  border: 1px solid rgba(56, 189, 248, 0.35);
  padding: 10px 18px;
  font-family: 'Rajdhani', 'Share Tech Mono', monospace;
  color: var(--user-text);
  box-shadow:
    0 0 20px rgba(56, 189, 248, 0.2),
    inset 0 0 14px rgba(56, 189, 248, 0.08);
  user-select: none;
  box-sizing: border-box;
}

/* 瞄准角标 */
.hud-corner {
  position: absolute;
  width: 7px;
  height: 7px;
  border-color: var(--accent);
  border-style: solid;
}
.hud-corner.top-left { top: -2px; left: -2px; border-width: 2px 0 0 2px; }
.hud-corner.top-right { top: -2px; right: -2px; border-width: 2px 2px 0 0; }
.hud-corner.bottom-left { bottom: -2px; left: -2px; border-width: 0 0 2px 2px; }
.hud-corner.bottom-right { bottom: -2px; right: -2px; border-width: 0 2px 2px 0; }

.hud-top-bar {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  opacity: 0.8;
  margin-bottom: 4px;
}

.crosshair {
  color: var(--accent);
}

.hud-center-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 0;
  overflow: hidden;
}

.hud-scanlines {
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.25),
    rgba(0, 0, 0, 0.25) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
}

.hud-time-wrap {
  display: flex;
  align-items: baseline;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-shadow: 0 0 10px var(--accent);
}

.hud-bracket {
  font-size: 32px;
  font-weight: 400;
  color: var(--accent);
  opacity: 0.7;
}

.hud-digits {
  display: inline-block;
  min-width: 5ch;
  text-align: center;
  font-size: 44px;
  font-weight: 700;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
}

.hud-sec {
  display: inline-block;
  min-width: 3ch;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: 28px;
  font-weight: 700;
  color: var(--accent);
}

.hud-ms {
  font-size: 16px;
  font-weight: 700;
  opacity: 0.8;
  margin-left: 2px;
}

.hud-finished-text {
  font-size: 20px;
  font-weight: 800;
  color: var(--accent);
  text-shadow: 0 0 16px var(--accent);
  letter-spacing: 0.08em;
  animation: hudAlert 0.8s infinite;
}

@keyframes hudAlert {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.hud-bottom-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  opacity: 0.85;
  margin-top: 4px;
}

.hud-meter-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 8px;
}

.hud-meter-bars .bar {
  width: 3px;
  background: var(--accent);
  opacity: 0.8;
}
.b1 { height: 3px; }
.b2 { height: 6px; }
.b3 { height: 8px; }
.b4 { height: 4px; }
.b5 { height: 7px; }
</style>
