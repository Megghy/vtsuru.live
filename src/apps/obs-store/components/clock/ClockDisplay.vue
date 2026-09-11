<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from 'vue'
import { useRoute } from 'vue-router'

import { useObsBridge } from '@/apps/obs-store/sync'

import CalculatorClock from './styles/CalculatorClock.vue'
import CasioClock from './styles/CasioClock.vue'
import CuteClock from './styles/CuteClock.vue'
import DotMatrixClock from './styles/DotMatrixClock.vue'
import FlipClock from './styles/FlipClock.vue'
import FreshClock from './styles/FreshClock.vue'
import MinimalClock from './styles/MinimalClock.vue'
import NixieClock from './styles/NixieClock.vue'
import PillClock from './styles/PillClock.vue'
import PixelClock from './styles/PixelClock.vue'
import SwissClock from './styles/SwissClock.vue'
import TacticalClock from './styles/TacticalClock.vue'
import VintageClock from './styles/VintageClock.vue'
import { DEFAULT_CLOCK_STATE } from './types'
import type {
  ClockAction,
  ClockState,
} from './types'

const props = defineProps<{
  channelId?: string
  inlineMode?: boolean
}>()

const route = useRoute()
const targetChannel = computed(
  () => props.channelId || (route.query.channel as string) || 'default',
)

const { state } = useObsBridge<ClockState, ClockAction>({
  componentId: 'clock',
  channelId: targetChannel.value,
  defaultState: DEFAULT_CLOCK_STATE,
  role: 'viewer',
})

// 本地高精度时间驱动
const now = ref(Date.now())
let rafId: number | null = null

function tick() {
  now.value = Date.now()
  rafId = requestAnimationFrame(tick)
}

onMounted(() => {
  rafId = requestAnimationFrame(tick)
})

onUnmounted(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
})

// 计算时钟数据
const clockData = computed(() => {
  const d = new Date(now.value)
  const rawHours = d.getHours()
  const minutes = d.getMinutes().toString().padStart(2, '0')
  const seconds = d.getSeconds().toString().padStart(2, '0')
  const milliseconds = Math.floor(d.getMilliseconds() / 10).toString().padStart(2, '0')

  let hoursStr = ''
  let ampm = ''

  if (state.value.is24Hour) {
    hoursStr = rawHours.toString().padStart(2, '0')
  } else {
    ampm = rawHours >= 12 ? 'PM' : 'AM'
    const h12 = rawHours % 12 || 12
    hoursStr = h12.toString().padStart(2, '0')
  }

  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const date = d.getDate().toString().padStart(2, '0')

  const daysZh = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const daysEn = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const dayOfWeekZh = daysZh[d.getDay()]
  const dayOfWeekEn = daysEn[d.getDay()]

  return {
    hours: hoursStr,
    minutes,
    seconds,
    milliseconds,
    ampm,
    dateStr: `${year}-${month}-${date}`,
    dateShort: `${month}/${date}`,
    dayOfWeekZh,
    dayOfWeekEn,
  }
})

// 计算倒计时数据
const countdownData = computed(() => {
  const totalMs = state.value.countdownDuration * 1000
  let elapsed = state.value.timerElapsed

  if (state.value.timerRunning && state.value.timerStartTime > 0) {
    elapsed += Math.max(0, now.value - state.value.timerStartTime)
  }

  const remainMs = Math.max(0, totalMs - elapsed)
  const isFinished = remainMs <= 0

  const totalSec = Math.floor(remainMs / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0')
  const seconds = (totalSec % 60).toString().padStart(2, '0')
  const ms = Math.floor((remainMs % 1000) / 10).toString().padStart(2, '0')

  const hoursStr = hours > 0 ? `${hours.toString().padStart(2, '0')}:` : ''
  const percent = totalMs > 0 ? Math.min(100, Math.max(0, ((totalMs - remainMs) / totalMs) * 100)) : 100

  return {
    remainMs,
    isFinished,
    displayTime: `${hoursStr}${minutes}:${seconds}`,
    ms,
    percent,
  }
})

// 计算正计时数据
const stopwatchData = computed(() => {
  let elapsed = state.value.timerElapsed
  if (state.value.timerRunning && state.value.timerStartTime > 0) {
    elapsed += Math.max(0, now.value - state.value.timerStartTime)
  }

  const totalSec = Math.floor(elapsed / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0')
  const seconds = (totalSec % 60).toString().padStart(2, '0')
  const ms = Math.floor((elapsed % 1000) / 10).toString().padStart(2, '0')

  const hoursStr = hours > 0 ? `${hours.toString().padStart(2, '0')}:` : ''

  return {
    elapsed,
    displayTime: `${hoursStr}${minutes}:${seconds}`,
    ms,
  }
})
</script>

<template>
  <div
    class="clock-obs-wrapper"
    :class="{ 'is-inline': props.inlineMode }"
  >
    <!-- 1. 复古电子表 / 卡西欧 -->
    <CasioClock
      v-if="state.theme === 'casio'"
      :state="state"
      :clock-data="clockData"
      :countdown-data="countdownData"
      :stopwatch-data="stopwatchData"
    />

    <!-- 2. 拟物机械翻页钟 -->
    <FlipClock
      v-else-if="state.theme === 'flip'"
      :state="state"
      :clock-data="clockData"
      :countdown-data="countdownData"
      :stopwatch-data="stopwatchData"
    />

    <!-- 3. 瑞士现代杂志版式 -->
    <SwissClock
      v-else-if="state.theme === 'swiss'"
      :state="state"
      :clock-data="clockData"
      :countdown-data="countdownData"
      :stopwatch-data="stopwatchData"
    />

    <!-- 4. 纯透连笔花体字 -->
    <VintageClock
      v-else-if="state.theme === 'vintage'"
      :state="state"
      :clock-data="clockData"
      :countdown-data="countdownData"
      :stopwatch-data="stopwatchData"
    />

    <!-- 5. 工业 LED 点阵屏 -->
    <DotMatrixClock
      v-else-if="state.theme === 'dotmatrix'"
      :state="state"
      :clock-data="clockData"
      :countdown-data="countdownData"
      :stopwatch-data="stopwatchData"
    />

    <!-- 6. 太阳能科学计算器 -->
    <CalculatorClock
      v-else-if="state.theme === 'calculator'"
      :state="state"
      :clock-data="clockData"
      :countdown-data="countdownData"
      :stopwatch-data="stopwatchData"
    />

    <!-- 7. 赛博战术 HUD -->
    <TacticalClock
      v-else-if="state.theme === 'tactical'"
      :state="state"
      :clock-data="clockData"
      :countdown-data="countdownData"
      :stopwatch-data="stopwatchData"
    />

    <!-- 8. 灵动悬浮胶囊 -->
    <PillClock
      v-else-if="state.theme === 'pill'"
      :state="state"
      :clock-data="clockData"
      :countdown-data="countdownData"
      :stopwatch-data="stopwatchData"
    />

    <!-- 9. 软萌猫耳气泡 (Cute) -->
    <CuteClock
      v-else-if="state.theme === 'cute'"
      :state="state"
      :clock-data="clockData"
      :countdown-data="countdownData"
      :stopwatch-data="stopwatchData"
    />

    <!-- 10. 清新日系微风 (Fresh) -->
    <FreshClock
      v-else-if="state.theme === 'fresh'"
      :state="state"
      :clock-data="clockData"
      :countdown-data="countdownData"
      :stopwatch-data="stopwatchData"
    />

    <!-- 11. 8-Bit 像素街机 (Pixel) -->
    <PixelClock
      v-else-if="state.theme === 'pixel'"
      :state="state"
      :clock-data="clockData"
      :countdown-data="countdownData"
      :stopwatch-data="stopwatchData"
    />

    <!-- 12. 真空辉光管 (Nixie) -->
    <NixieClock
      v-else-if="state.theme === 'nixie'"
      :state="state"
      :clock-data="clockData"
      :countdown-data="countdownData"
      :stopwatch-data="stopwatchData"
    />

    <!-- 13. 纯字极简无框 -->
    <MinimalClock
      v-else
      :state="state"
      :clock-data="clockData"
      :countdown-data="countdownData"
      :stopwatch-data="stopwatchData"
    />
  </div>
</template>

<style scoped>
.clock-obs-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.clock-obs-wrapper.is-inline {
  width: 100%;
  height: 100%;
}
</style>
