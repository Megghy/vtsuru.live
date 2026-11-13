<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'

import { computeGoalProgressPercent, formatCountdownClock, getVisibleRemainingMs } from './goalEngine'
import { DEFAULT_GOAL_STATE } from './types'
import type { GoalAction, GoalState } from './types'

const props = defineProps<{
  channelId?: string
  inlineMode?: boolean
}>()

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const { state, onAction } = useObsBridge<GoalState, GoalAction>({
  componentId: 'goal',
  channelId: targetChannel,
  defaultState: DEFAULT_GOAL_STATE,
  role: 'viewer',
})

const nowMs = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  clockTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 250)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

const showProgress = computed(() => state.value.mode === 'goal' || state.value.mode === 'combo')
const showCountdown = computed(() => state.value.mode === 'subathon' || state.value.mode === 'combo')

const progressPercent = computed(() => computeGoalProgressPercent(state.value.current, state.value.target))
const displayPercentText = computed(() => {
  if (!state.value.target || state.value.target <= 0) return '0%'
  const raw = Math.round((state.value.current / state.value.target) * 100)
  return `${Math.max(0, raw)}%`
})

const remainingMs = computed(() => getVisibleRemainingMs(state.value, nowMs.value))
const formattedClock = computed(() => formatCountdownClock(remainingMs.value))

// 飘字提示动效
const deltaBanner = ref('')
let deltaTimer: ReturnType<typeof setTimeout> | undefined

function showDelta(text: string) {
  if (!text) return
  deltaBanner.value = text
  if (deltaTimer) clearTimeout(deltaTimer)
  deltaTimer = setTimeout(() => {
    deltaBanner.value = ''
  }, 2200)
}

watch(
  () => state.value.lastDeltaTick,
  (tick, prev) => {
    if (prev !== undefined && tick !== prev && state.value.lastDeltaText) {
      showDelta(state.value.lastDeltaText)
    }
  },
)

onMounted(() => {
  onAction((action) => {
    if (action.type === 'DELTA_TIME' || action.type === 'DELTA_PROGRESS') {
      showDelta(action.label)
    }
  })
})
</script>

<template>
  <div
    class="goal-obs-root"
    :class="[`theme-${state.theme}`, { 'is-inline': props.inlineMode }]"
    :style="{ '--goal-accent': state.accentColor }"
  >
    <div class="goal-container">
      <div class="goal-top-row">
        <div class="goal-titles">
          <div class="goal-title">{{ state.title || '直播目标' }}</div>
          <div
            v-if="state.subtitle"
            class="goal-subtitle"
          >
            {{ state.subtitle }}
          </div>
        </div>

        <Transition name="delta-pop">
          <div
            v-if="deltaBanner"
            class="goal-delta-chip"
          >
            {{ deltaBanner }}
          </div>
        </Transition>

        <div
          v-if="showCountdown"
          class="goal-clock"
          :class="{ 'is-paused': state.countdownPaused }"
        >
          <span class="clock-text">{{ formattedClock }}</span>
          <span
            v-if="state.countdownPaused"
            class="clock-status"
          >
            PAUSED
          </span>
        </div>
      </div>

      <template v-if="showProgress">
        <div class="goal-bar-track">
          <div
            class="goal-bar-fill"
            :style="{ transform: `scaleX(${progressPercent / 100})` }"
          />
        </div>

        <div class="goal-metrics-row">
          <span class="metric-current">
            <strong>{{ state.current }}</strong>
            <span class="metric-sep">/</span>
            <span>{{ state.target }}</span>
            <span
              v-if="state.unit"
              class="metric-unit"
            >
              {{ state.unit }}
            </span>
          </span>
          <span
            v-if="state.showPercent"
            class="metric-percent"
          >
            {{ displayPercentText }}
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.goal-obs-root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
}

.goal-container {
  width: 100%;
  max-width: 560px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.goal-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.goal-titles {
  min-width: 0;
  flex: 1;
}

.goal-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.goal-subtitle {
  font-size: 11px;
  opacity: 0.72;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.goal-clock {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.clock-text {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0.03em;
  line-height: 1;
}

.clock-status {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.14);
  letter-spacing: 0.08em;
}

.goal-clock.is-paused {
  opacity: 0.78;
}

.goal-delta-chip {
  position: absolute;
  top: -10px;
  right: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--goal-accent, #f43f5e);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
  pointer-events: none;
}

.delta-pop-enter-active,
.delta-pop-leave-active {
  transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.delta-pop-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.92);
}

.delta-pop-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.96);
}

.goal-bar-track {
  width: 100%;
  height: 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  overflow: hidden;
}

.goal-bar-fill {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: var(--goal-accent, #f43f5e);
  transform-origin: left center;
  transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.goal-metrics-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.metric-current {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
}

.metric-current strong {
  font-size: 16px;
  font-weight: 800;
}

.metric-sep {
  opacity: 0.55;
}

.metric-unit {
  opacity: 0.8;
  font-size: 12px;
}

.metric-percent {
  font-weight: 700;
  color: var(--goal-accent, #f43f5e);
}

/* 主题 1: card */
.theme-card .goal-container {
  background: rgba(17, 17, 22, 0.88);
  color: #f8fafc;
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  padding: 16px 20px;
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
}

/* 主题 2: minimal */
.theme-minimal .goal-container {
  color: #ffffff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85);
  padding: 8px 12px;
}

.theme-minimal .goal-bar-track {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.25);
}

/* 主题 3: neon */
.theme-neon .goal-container {
  background: rgba(8, 10, 18, 0.92);
  color: #f8fafc;
  border: 1.5px solid var(--goal-accent, #f43f5e);
  box-shadow: 0 0 18px color-mix(in srgb, var(--goal-accent, #f43f5e) 35%, transparent);
  padding: 16px 20px;
  border-radius: 12px;
}

.theme-neon .clock-text {
  text-shadow: 0 0 12px color-mix(in srgb, var(--goal-accent, #f43f5e) 70%, transparent);
}

/* 主题 4: glass */
.theme-glass .goal-container {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.06));
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(16px);
  padding: 16px 20px;
  border-radius: 16px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
}
</style>
