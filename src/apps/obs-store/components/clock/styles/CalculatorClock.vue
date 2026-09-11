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
  loadObsStoreFonts(['Chakra+Petch:ital,wght@1,700'])
})
</script>

<template>
  <div
    class="calc-clock-root"
    :style="{
      '--accent': props.state.accentColor || '#3f3f46',
      '--user-text': props.state.textColor || '#18181b',
      '--user-bg': props.state.bgColor || '#c8cfbb',
      '--user-opacity': props.state.bgOpacity / 100,
    }"
  >
    <div class="calc-chassis">
      <!-- 顶部太阳能电池板与型号刻字 -->
      <div class="calc-top-row">
        <div class="calc-brand">
          <span class="calc-model">fx-991</span>
          <span class="calc-sub">TWO WAY POWER</span>
        </div>

        <!-- 4格太阳能光伏板 -->
        <div class="solar-panel">
          <div class="solar-cell" />
          <div class="solar-cell" />
          <div class="solar-cell" />
          <div class="solar-cell" />
        </div>
      </div>

      <!-- 黄绿反射式 LCD 液晶屏 -->
      <div class="calc-screen">
        <!-- 计算器常驻角标 -->
        <div class="calc-indicators">
          <span class="calc-flag active">DEG</span>
          <span class="calc-flag">RAD</span>
          <span class="calc-flag active">M</span>
          <span class="calc-flag">FIX</span>
          <span
            v-if="props.state.title"
            class="calc-title-tag"
          >{{ props.state.title }}</span>
        </div>

        <!-- LCD 数值显示区 (带 88:88:88 暗底) -->
        <div class="calc-time-wrapper">
          <div class="calc-ghost-layer">
            <template v-if="props.state.mode === 'clock'">
              88:88<span v-if="props.state.showSeconds">:88</span>
            </template>
            <template v-else>
              88:88
            </template>
          </div>

          <div class="calc-real-layer">
            <!-- 实时时钟模式 -->
            <template v-if="props.state.mode === 'clock'">
              <span class="calc-digits">{{ props.clockData.hours }}</span>
              <span class="calc-colon">:</span>
              <span class="calc-digits">{{ props.clockData.minutes }}</span>
              <template v-if="props.state.showSeconds">
                <span class="calc-colon">:</span>
                <span class="calc-digits sec">{{ props.clockData.seconds }}</span>
              </template>
            </template>

            <!-- 倒计时模式 -->
            <template v-else-if="props.state.mode === 'countdown'">
              <div
                v-if="props.countdownData.isFinished"
                class="calc-finished"
              >
                0:00 END
              </div>
              <div
                v-else
                class="calc-timer-digits"
              >
                {{ props.countdownData.displayTime }}
              </div>
            </template>

            <!-- 正计时模式 -->
            <template v-else-if="props.state.mode === 'stopwatch'">
              <div class="calc-timer-digits">
                {{ props.stopwatchData.displayTime }}
              </div>
            </template>
          </div>
        </div>

        <!-- 底部日期与星期 -->
        <div
          v-if="props.state.showDate || props.state.showDayOfWeek"
          class="calc-footer"
        >
          <span
            v-if="props.state.showDate"
            class="calc-meta"
          >{{ props.clockData.dateStr }}</span>
          <span
            v-if="props.state.showDayOfWeek"
            class="calc-meta"
          >{{ props.clockData.dayOfWeekEn }}</span>
          <span
            v-if="!props.state.is24Hour && props.clockData.ampm"
            class="calc-meta ampm"
          >{{ props.clockData.ampm }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calc-clock-root {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
  font-family: 'Chakra Petch', 'Orbitron', monospace, sans-serif;
  box-sizing: border-box;
}

.calc-chassis {
  background: #27272a;
  border: 2px solid #3f3f46;
  border-radius: 8px;
  min-width: 290px;
  padding: 8px 12px 10px 12px;
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.65),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.calc-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 2px;
}

.calc-brand {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.calc-model {
  font-size: 11px;
  font-weight: 700;
  color: #e4e4e7;
  letter-spacing: 0.05em;
  font-style: italic;
}

.calc-sub {
  font-size: 7px;
  color: #a1a1aa;
  margin-top: 1px;
}

/* 4格太阳能硅晶电池板 */
.solar-panel {
  display: flex;
  gap: 2px;
  background: #18181b;
  border: 1px solid #09090b;
  padding: 2px;
  border-radius: 2px;
}

.solar-cell {
  width: 14px;
  height: 14px;
  background: linear-gradient(135deg, #451a03 0%, #1e1b4b 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 黄灰泛青液晶屏幕 */
.calc-screen {
  background: var(--user-bg);
  background-color: rgba(200, 207, 187, var(--user-opacity, 0.95));
  border: 2px solid #18181b;
  border-radius: 4px;
  padding: 4px 10px 6px 10px;
  box-shadow: inset 0 2px 5px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
}

.calc-indicators {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 8px;
  font-weight: 700;
  color: rgba(24, 24, 27, 0.25);
  margin-bottom: 2px;
}

.calc-flag.active {
  color: var(--user-text);
}

.calc-title-tag {
  margin-left: auto;
  font-size: 8px;
  color: var(--user-text);
  font-weight: 700;
}

.calc-time-wrapper {
  position: relative;
  display: flex;
  justify-content: flex-end;
  line-height: 1;
}

.calc-ghost-layer {
  position: absolute;
  right: 0;
  top: 0;
  font-size: 38px;
  font-style: italic;
  font-weight: 700;
  color: rgba(24, 24, 27, 0.08);
  letter-spacing: 0.04em;
  pointer-events: none;
  font-variant-numeric: tabular-nums;
}

.calc-real-layer {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 1px;
}

.calc-digits {
  display: inline-block;
  min-width: 2.1ch;
  text-align: center;
  font-size: 38px;
  font-style: italic;
  font-weight: 700;
  color: var(--user-text);
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}

.calc-digits.sec {
  min-width: 2.1ch;
}

.calc-colon {
  font-size: 32px;
  font-style: italic;
  color: var(--user-text);
  margin: 0 1px;
}

.calc-timer-digits {
  display: inline-block;
  min-width: 5ch;
  text-align: right;
  font-size: 36px;
  font-style: italic;
  font-weight: 700;
  color: var(--user-text);
  font-variant-numeric: tabular-nums;
}

.calc-finished {
  font-size: 26px;
  font-style: italic;
  font-weight: 700;
  color: var(--user-text);
}

.calc-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  font-size: 9px;
  font-weight: 700;
  color: rgba(24, 24, 27, 0.75);
  margin-top: 3px;
}
</style>
