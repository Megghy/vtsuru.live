<script setup lang="ts">
import { computed } from 'vue'

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

// 5x7 经典字符点阵字体表 (每一行一个 5-bit 数字)
const FONT_MAP: Record<string, number[]> = {
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  '3': [0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  '6': [0b00110, 0b01000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00010, 0b01100],
  ':': [0b00000, 0b00100, 0b00100, 0b00000, 0b00100, 0b00100, 0b00000],
  '-': [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
  ' ': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
  '.': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00100, 0b00100],
  'A': [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  'B': [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  'C': [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  'D': [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  'E': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  'F': [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  'G': [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  'H': [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  'I': [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  'L': [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  'N': [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  'O': [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  'P': [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  'R': [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  'S': [0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110],
  'T': [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  'U': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  'V': [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  'W': [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
}

// 点阵矩阵网格参数
const ROWS = 7
const COLS = computed(() => {
  // 如果显示秒数: 8个字符 (HH:MM:SS) -> 8 * 6 - 1 = 47 列；不显秒 5个字符 (HH:MM) -> 29 列
  if (props.state.mode === 'clock') {
    return props.state.showSeconds ? 47 : 29
  }
  return 35 // 倒计时 / 正计时固定 35 列
})

// 当前展示的文本字符串
const displayText = computed(() => {
  if (props.state.mode === 'clock') {
    return props.state.showSeconds
      ? `${props.clockData.hours}:${props.clockData.minutes}:${props.clockData.seconds}`
      : `${props.clockData.hours}:${props.clockData.minutes}`
  } else if (props.state.mode === 'countdown') {
    if (props.countdownData.isFinished) {
      return (props.state.timerEndText || 'START').toUpperCase().slice(0, 6)
    }
    return props.countdownData.displayTime
  } else {
    return props.stopwatchData.displayTime
  }
})

// 将文本转化为 2D 点阵布尔矩阵 (ROWS x COLS)
const dotMatrix = computed(() => {
  const text = displayText.value
  const colsCount = COLS.value
  const matrix: boolean[][] = Array.from({ length: ROWS }, () => Array(colsCount).fill(false))

  let colOffset = 0
  for (let i = 0; i < text.length; i++) {
    const char = text[i] || ' '
    const charPattern = FONT_MAP[char] || FONT_MAP[char.toUpperCase()] || FONT_MAP[' ']

    for (let r = 0; r < ROWS; r++) {
      const rowBits = charPattern[r] ?? 0
      for (let c = 0; c < 5; c++) {
        const isLit = Boolean((rowBits >> (4 - c)) & 1)
        if (colOffset + c < colsCount) {
          matrix[r][colOffset + c] = isLit
        }
      }
    }
    // 字符后留 1 列间隔
    colOffset += 6
  }

  return matrix
})
</script>

<template>
  <div
    class="dotmatrix-clock-root"
    :style="{
      '--accent': props.state.accentColor || '#facc15',
      '--unlit-dot': '#282810',
      '--board-bg': props.state.bgColor || '#0c0a09',
      '--user-opacity': props.state.bgOpacity / 100,
    }"
  >
    <div class="dot-panel">
      <!-- 顶部工业标牌 -->
      <div class="dot-panel-header">
        <span class="dot-brand">{{ props.state.title || 'LED MATRIX DISPLAY' }}</span>
        <span class="dot-status">● RUN</span>
      </div>

      <!-- 真正的 2D 圆形 LED 点阵阵列 -->
      <div
        class="dot-grid"
        :style="{
          gridTemplateColumns: `repeat(${COLS}, 5px)`,
          gridTemplateRows: `repeat(${ROWS}, 5px)`,
        }"
      >
        <template
          v-for="(row, rIndex) in dotMatrix"
          :key="rIndex"
        >
          <div
            v-for="(isLit, cIndex) in row"
            :key="`${rIndex}-${cIndex}`"
            class="dot-led"
            :class="{ 'is-lit': isLit }"
          />
        </template>
      </div>

      <!-- 底部日期 -->
      <div
        v-if="props.state.showDate || props.state.showDayOfWeek"
        class="dot-panel-footer"
      >
        <span v-if="props.state.showDate">{{ props.clockData.dateStr }}</span>
        <span v-if="props.state.showDayOfWeek">{{ props.clockData.dayOfWeekEn }}</span>
        <span v-if="!props.state.is24Hour && props.clockData.ampm">{{ props.clockData.ampm }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dotmatrix-clock-root {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
  font-family: monospace;
  box-sizing: border-box;
}

.dot-panel {
  background: var(--board-bg);
  background-color: rgba(12, 10, 9, var(--user-opacity, 0.96));
  border: 3px solid #292524;
  border-radius: 8px;
  padding: 10px 14px 10px 14px;
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.8),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}

.dot-panel-header {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--accent);
  opacity: 0.75;
  margin-bottom: 6px;
}

.dot-status {
  animation: dotBlink 1.2s infinite;
}

@keyframes dotBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

/* 真实的圆形 LED 点阵网格 */
.dot-grid {
  display: grid;
  gap: 2px;
  background: #000000;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #1c1917;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.9);
}

.dot-led {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: var(--unlit-dot);
  box-sizing: border-box;
  transition: background-color 0.05s, box-shadow 0.05s;
}

/* 点亮时的 LED 圆点高亮与光晕效果（与用户截图 1:1 吻合） */
.dot-led.is-lit {
  background-color: var(--accent);
  box-shadow:
    0 0 4px var(--accent),
    0 0 7px var(--accent);
}

.dot-panel-footer {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 8px;
  color: #a8a29e;
  letter-spacing: 0.08em;
  margin-top: 6px;
}
</style>
