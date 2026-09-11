<script setup lang="ts">
import {
  computed,
  onMounted,
} from 'vue'

import { loadObsStoreFonts } from '@/apps/obs-store/utils/fontLoader'

import type { ClockState } from '../types'
import FlipCard from './FlipCard.vue'

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
  loadObsStoreFonts(['Bebas+Neue', 'Oswald:wght@600;700'])
})

// 解析倒计时显示时间段 (MM:SS 或 HH:MM:SS)
const parsedTimerParts = computed(() => {
  const timeStr = props.state.mode === 'countdown'
    ? props.countdownData.displayTime
    : props.stopwatchData.displayTime

  const parts = timeStr.split(':')
  if (parts.length === 3) {
    return { hours: parts[0], minutes: parts[1], seconds: parts[2] }
  }
  return { hours: null, minutes: parts[0] || '00', seconds: parts[1] || '00' }
})
</script>

<template>
  <div
    class="flip-clock-root"
    :style="{
      '--accent': props.state.accentColor,
      '--user-text': props.state.textColor || '#ffffff',
      '--user-bg': props.state.bgColor || '#141417',
      '--user-opacity': props.state.bgOpacity / 100,
    }"
  >
    <!-- 顶部微型标题 -->
    <div
      v-if="props.state.title"
      class="flip-clock-header"
    >
      <span class="flip-clock-title">{{ props.state.title }}</span>
    </div>

    <!-- 翻页卡片主体组 -->
    <div class="flip-cards-container">
      <!-- 实时时钟模式 -->
      <template v-if="props.state.mode === 'clock'">
        <!-- 小时卡片 -->
        <FlipCard
          :value="props.clockData.hours"
          label="HOURS"
        />

        <div class="flip-divider">
          <span class="dot" />
          <span class="dot" />
        </div>

        <!-- 分钟卡片 -->
        <FlipCard
          :value="props.clockData.minutes"
          label="MINUTES"
        />

        <!-- 秒钟卡片 -->
        <template v-if="props.state.showSeconds">
          <div class="flip-divider">
            <span class="dot" />
            <span class="dot" />
          </div>

          <FlipCard
            :value="props.clockData.seconds"
            label="SECONDS"
          />
        </template>
      </template>

      <!-- 倒计时模式 -->
      <template v-else-if="props.state.mode === 'countdown'">
        <div
          v-if="props.countdownData.isFinished"
          class="flip-finished-banner"
        >
          {{ props.state.timerEndText || 'LIVE STARTED' }}
        </div>
        <template v-else>
          <template v-if="parsedTimerParts.hours">
            <FlipCard
              :value="parsedTimerParts.hours"
              label="HOURS"
            />
            <div class="flip-divider">
              <span class="dot" />
              <span class="dot" />
            </div>
          </template>

          <FlipCard
            :value="parsedTimerParts.minutes"
            label="MINUTES"
          />

          <div class="flip-divider">
            <span class="dot" />
            <span class="dot" />
          </div>

          <FlipCard
            :value="parsedTimerParts.seconds"
            label="SECONDS"
          />
        </template>
      </template>

      <!-- 正计时模式 -->
      <template v-else-if="props.state.mode === 'stopwatch'">
        <template v-if="parsedTimerParts.hours">
          <FlipCard
            :value="parsedTimerParts.hours"
            label="HOURS"
          />
          <div class="flip-divider">
            <span class="dot" />
            <span class="dot" />
          </div>
        </template>

        <FlipCard
          :value="parsedTimerParts.minutes"
          label="MINUTES"
        />

        <div class="flip-divider">
          <span class="dot" />
          <span class="dot" />
        </div>

        <FlipCard
          :value="parsedTimerParts.seconds"
          label="SECONDS"
        />
      </template>
    </div>

    <!-- 底部日期与星期小胶囊 -->
    <div
      v-if="props.state.showDate || props.state.showDayOfWeek"
      class="flip-footer"
    >
      <span
        v-if="props.state.showDate"
        class="footer-badge"
      >{{ props.clockData.dateStr }}</span>
      <span
        v-if="props.state.showDayOfWeek"
        class="footer-badge"
      >{{ props.clockData.dayOfWeekEn }} ({{ props.clockData.dayOfWeekZh }})</span>
      <span
        v-if="!props.state.is24Hour && props.clockData.ampm"
        class="footer-badge ampm"
      >{{ props.clockData.ampm }}</span>
    </div>
  </div>
</template>

<style scoped>
.flip-clock-root {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  min-width: 290px;
  user-select: none;
  font-family: 'Oswald', -apple-system, BlinkMacSystemFont, sans-serif;
  box-sizing: border-box;
}

.flip-clock-header {
  margin-bottom: 6px;
}

.flip-clock-title {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}

.flip-cards-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.flip-divider {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 1px;
  margin-bottom: 18px; /* 对齐数字垂直中心 */
}

.flip-divider .dot {
  width: 6px;
  height: 6px;
  background: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--accent);
}

.flip-finished-banner {
  font-family: 'Bebas Neue', 'Oswald', sans-serif;
  background: var(--accent);
  color: #000000;
  font-size: 36px;
  font-weight: 400;
  padding: 14px 30px;
  border-radius: 8px;
  letter-spacing: 0.08em;
  animation: pulse 1s infinite;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(0.97); }
}

.flip-footer {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}

.footer-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
}

.footer-badge.ampm {
  background: var(--accent);
  color: #000000;
  font-weight: 800;
}
</style>
