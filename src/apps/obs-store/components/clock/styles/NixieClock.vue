<script setup lang="ts">
import { computed, onMounted } from 'vue'

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
  loadObsStoreFonts(['Chakra+Petch:wght@700', 'Share+Tech+Mono'])
})

// 解析倒计时或正计时的分与秒
const parsedTimerParts = computed(() => {
  const timeStr = props.state.mode === 'countdown'
    ? props.countdownData.displayTime
    : props.stopwatchData.displayTime

  const parts = timeStr.split(':')
  if (parts.length === 3) {
    return { hours: parts[0], minutes: parts[1], seconds: parts[2] }
  }
  return { hours: '', minutes: parts[0] || '00', seconds: parts[1] || '00' }
})
</script>

<template>
  <div
    class="nixie-clock-root"
    :style="{
      '--accent': props.state.accentColor || '#ff7700',
      '--user-text': props.state.textColor || '#ff8800',
      '--user-bg': props.state.bgColor || '#1c1917',
      '--user-opacity': props.state.bgOpacity / 100,
    }"
  >
    <!-- 辉光管外壳与底座 -->
    <div class="nixie-chassis">
      <!-- 顶部金属铭牌 -->
      <div class="nixie-plate">
        <span class="plate-code">NIXIE-IN18 // DIVERGENCE</span>
        <span class="plate-title">{{ props.state.title || '1.048596%' }}</span>
      </div>

      <!-- 真空玻璃辉光管阵列 -->
      <div class="tubes-row">
        <!-- 实时时钟模式 -->
        <template v-if="props.state.mode === 'clock'">
          <!-- 小时管 -->
          <div class="nixie-tube">
            <div class="tube-glass">
              <div class="mesh-grid" />
              <div class="specular-reflection" />
              <span class="filament-glow-ghost">88</span>
              <span class="filament-digit">{{ props.clockData.hours }}</span>
            </div>
            <div class="tube-socket" />
          </div>

          <!-- 分隔点 -->
          <div class="nixie-colons">
            <span class="dot-tube top" />
            <span class="dot-tube bottom" />
          </div>

          <!-- 分钟管 -->
          <div class="nixie-tube">
            <div class="tube-glass">
              <div class="mesh-grid" />
              <div class="specular-reflection" />
              <span class="filament-glow-ghost">88</span>
              <span class="filament-digit">{{ props.clockData.minutes }}</span>
            </div>
            <div class="tube-socket" />
          </div>

          <!-- 秒数管 (可选) -->
          <template v-if="props.state.showSeconds">
            <div class="nixie-colons">
              <span class="dot-tube top" />
              <span class="dot-tube bottom" />
            </div>

            <div class="nixie-tube">
              <div class="tube-glass">
                <div class="mesh-grid" />
                <div class="specular-reflection" />
                <span class="filament-glow-ghost">88</span>
                <span class="filament-digit sec">{{ props.clockData.seconds }}</span>
              </div>
              <div class="tube-socket" />
            </div>
          </template>
        </template>

        <!-- 倒计时 / 正计时模式 -->
        <template v-else>
          <div
            v-if="props.state.mode === 'countdown' && props.countdownData.isFinished"
            class="nixie-finished-banner"
          >
            {{ props.state.timerEndText || 'WORLD LINE' }}
          </div>
          <template v-else>
            <div
              v-if="parsedTimerParts.hours"
              class="nixie-tube"
            >
              <div class="tube-glass">
                <div class="mesh-grid" />
                <div class="specular-reflection" />
                <span class="filament-glow-ghost">88</span>
                <span class="filament-digit">{{ parsedTimerParts.hours }}</span>
              </div>
              <div class="tube-socket" />
            </div>

            <div
              v-if="parsedTimerParts.hours"
              class="nixie-colons"
            >
              <span class="dot-tube top" />
              <span class="dot-tube bottom" />
            </div>

            <div class="nixie-tube">
              <div class="tube-glass">
                <div class="mesh-grid" />
                <div class="specular-reflection" />
                <span class="filament-glow-ghost">88</span>
                <span class="filament-digit">{{ parsedTimerParts.minutes }}</span>
              </div>
              <div class="tube-socket" />
            </div>

            <div class="nixie-colons">
              <span class="dot-tube top" />
              <span class="dot-tube bottom" />
            </div>

            <div class="nixie-tube">
              <div class="tube-glass">
                <div class="mesh-grid" />
                <div class="specular-reflection" />
                <span class="filament-glow-ghost">88</span>
                <span class="filament-digit">{{ parsedTimerParts.seconds }}</span>
              </div>
              <div class="tube-socket" />
            </div>
          </template>
        </template>
      </div>

      <!-- 底部日期与状态指示条 -->
      <div
        v-if="props.state.showDate || props.state.showDayOfWeek"
        class="nixie-footer"
      >
        <span v-if="props.state.showDate">{{ props.clockData.dateStr }}</span>
        <span v-if="props.state.showDayOfWeek">{{ props.clockData.dayOfWeekEn }}</span>
        <span v-if="!props.state.is24Hour && props.clockData.ampm">{{ props.clockData.ampm }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.nixie-clock-root {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
  font-family: 'Chakra Petch', 'Share Tech Mono', monospace;
  box-sizing: border-box;
}

.nixie-chassis {
  background: var(--user-bg);
  background-color: rgba(28, 25, 23, var(--user-opacity, 0.96));
  border: 3px solid #44403c;
  border-radius: 10px;
  padding: 10px 14px 12px 14px;
  box-shadow:
    0 16px 36px rgba(0, 0, 0, 0.85),
    inset 0 2px 0 rgba(255, 255, 255, 0.12),
    inset 0 -3px 6px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 290px;
  box-sizing: border-box;
}

.nixie-plate {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #a8a29e;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 4px;
  margin-bottom: 8px;
}

.plate-code {
  color: var(--accent);
}

.tubes-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

/* 单个真空玻璃辉光管 */
.nixie-tube {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tube-glass {
  position: relative;
  width: 68px;
  height: 82px;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.08) 0%,
    rgba(20, 15, 10, 0.85) 15%,
    rgba(10, 8, 5, 0.95) 85%,
    rgba(255, 255, 255, 0.05) 100%
  );
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 20px 20px 6px 6px;
  box-shadow:
    inset 0 0 12px rgba(255, 120, 0, 0.18),
    0 4px 12px rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* 阳极金属丝网 (Anode Wire Mesh) */
.mesh-grid {
  position: absolute;
  inset: 4px;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
  background-size: 4px 4px;
  pointer-events: none;
  border-radius: 16px 16px 4px 4px;
}

/* 玻璃高光反光面 */
.specular-reflection {
  position: absolute;
  top: 6px;
  left: 8px;
  width: 6px;
  height: 60%;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.4) 0%,
    rgba(255, 255, 255, 0.05) 80%,
    transparent 100%
  );
  border-radius: 3px;
  pointer-events: none;
}

/* 未点亮的幽灵暗灯丝重影 */
.filament-glow-ghost {
  position: absolute;
  font-size: 46px;
  font-weight: 700;
  color: rgba(255, 120, 0, 0.07);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  pointer-events: none;
}

/* 点亮的发光氖气灯丝 (Neon Filament) */
.filament-digit {
  position: relative;
  z-index: 2;
  font-size: 46px;
  font-weight: 700;
  color: #fff7ed;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  text-shadow:
    0 0 4px #ffedd5,
    0 0 10px var(--accent),
    0 0 20px var(--accent),
    0 0 35px var(--accent);
}

.tube-socket {
  width: 54px;
  height: 6px;
  background: linear-gradient(180deg, #78716c 0%, #292524 100%);
  border: 1px solid #1c1917;
  border-radius: 0 0 4px 4px;
}

/* 冒号发光管 */
.nixie-colons {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 2px 28px 2px;
}

.dot-tube {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fff7ed;
  box-shadow:
    0 0 4px #ffedd5,
    0 0 10px var(--accent),
    0 0 18px var(--accent);
  animation: nixieFlicker 2s infinite ease-in-out;
}

@keyframes nixieFlicker {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
  72% { opacity: 0.95; }
}

.nixie-finished-banner {
  font-size: 24px;
  font-weight: 700;
  color: var(--accent);
  text-shadow: 0 0 16px var(--accent);
  padding: 18px 24px;
}

.nixie-footer {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-size: 9px;
  color: #a8a29e;
  letter-spacing: 0.08em;
  margin-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 4px;
}
</style>
