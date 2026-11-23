<script setup lang="ts">
import { Check, Flag } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import type { EventModel } from '@/api/client-types'
import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import {
  computeGoalEventDelta,
  computeGoalProgressPercent,
  formatCountdownClock,
  getNextMilestone,
  getSortedMilestones,
  getVisibleRemainingMs,
} from './goalEngine'
import { DEFAULT_GOAL_STATE } from './types'
import type { GoalAction, GoalState } from './types'

const props = defineProps<{
  channelId?: string
  userId?: number
  inlineMode?: boolean
  noShadow?: boolean
}>()

const route = useRoute()
const account = useAccount()
const danmakuClient = useDanmakuClient()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const { state, onAction } = useObsBridge<GoalState, GoalAction>({
  componentId: 'goal',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_GOAL_STATE,
  role: 'viewer',
})

// 当 OBS 端携带登录态且开启 directTrackOnObs 时，在本地保留临时增量（服务端新快照到达时归零防重复）
const localProgressOffset = ref(0)
const localAddedMs = ref(0)
const seenDirectIds = new Set<string>()

watch(
  () => [state.value.current, state.value.countdownEndAt, state.value.pausedRemainingMs],
  () => {
    localProgressOffset.value = 0
    localAddedMs.value = 0
  },
)

const effectiveCurrent = computed(() => Number((state.value.current + localProgressOffset.value).toFixed(2)))
const effectiveState = computed<GoalState>(() => ({
  ...state.value,
  current: effectiveCurrent.value,
  countdownEndAt: state.value.countdownEndAt + localAddedMs.value,
  pausedRemainingMs: state.value.pausedRemainingMs + localAddedMs.value,
}))

const nowMs = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  clockTimer = setInterval(() => {
    nowMs.value = Date.now()
  }, 250)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  danmakuClient.offEvent('all', handleDirectEvent)
})

const showProgress = computed(() => state.value.mode === 'goal' || state.value.mode === 'combo')
const showCountdown = computed(() => state.value.mode === 'subathon' || state.value.mode === 'combo')

const progressPercent = computed(() => computeGoalProgressPercent(effectiveCurrent.value, state.value.target))
const displayPercentText = computed(() => {
  if (!state.value.target || state.value.target <= 0) return '0%'
  const raw = Math.round((effectiveCurrent.value / state.value.target) * 100)
  return `${Math.max(0, raw)}%`
})

const sortedMilestones = computed(() =>
  state.value.showMilestones ? getSortedMilestones(state.value.milestones) : [],
)
const nextMilestone = computed(() => getNextMilestone(effectiveCurrent.value, sortedMilestones.value))
const allMilestonesDone = computed(
  () => sortedMilestones.value.length > 0 && nextMilestone.value === null,
)

const remainingMs = computed(() => getVisibleRemainingMs(effectiveState.value, nowMs.value))
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

function handleDirectEvent(event: EventModel) {
  if (props.inlineMode || !state.value.directTrackOnObs) return
  const key = event.eventId || `${event.type}:${event.uid}:${event.time}:${event.price}`
  if (seenDirectIds.has(key)) return
  seenDirectIds.add(key)
  if (seenDirectIds.size > 400) {
    const first = seenDirectIds.values().next().value
    if (first) seenDirectIds.delete(first)
  }
  const res = computeGoalEventDelta(effectiveState.value, {
    type: event.type,
    priceYuan: event.price ?? 0,
    guardLevel: event.guard_level,
    num: event.num ?? 1,
    giftName: event.msg,
  })
  if (!res) return
  if (res.addedProgress > 0) {
    localProgressOffset.value = Number((localProgressOffset.value + res.addedProgress).toFixed(2))
  }
  if (res.addedSeconds > 0) {
    localAddedMs.value += res.addedSeconds * 1000
  }
  showDelta(res.deltaText)
}

watch(
  () => [!props.inlineMode && state.value.directTrackOnObs && account.value.id > 0],
  async ([enabled]) => {
    if (enabled) {
      danmakuClient.onEvent('all', handleDirectEvent)
      try {
        await danmakuClient.ensureOpenlive()
      } catch {
        // 独立 OBS 源无 OpenLive 会话时静默降级为纯云端桥接同步
      }
    } else {
      danmakuClient.offEvent('all', handleDirectEvent)
    }
  },
  { immediate: true },
)

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

useGoogleFont(computed(() => state.value.fontFamily || undefined))
const customFontCss = computed(() => resolveFontFamilyCss(state.value.fontFamily))
</script>

<template>
  <div
    class="goal-obs-root"
    :class="[`theme-${state.theme}`, { 'is-inline': props.inlineMode }]"
    :style="{ '--goal-accent': state.accentColor, fontFamily: customFontCss }"
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
        <div class="goal-bar-wrap">
          <div class="goal-bar-track">
            <div
              class="goal-bar-fill"
              :style="{ transform: `scaleX(${progressPercent / 100})` }"
            />
          </div>

          <!-- 阶段里程碑刻度点 -->
          <div
            v-if="sortedMilestones.length && state.target > 0"
            class="goal-milestone-ticks"
          >
            <span
              v-for="ms in sortedMilestones"
              :key="ms.id"
              class="milestone-tick"
              :class="{ 'is-reached': effectiveCurrent >= ms.target }"
              :style="{ left: `${Math.min(100, (ms.target / state.target) * 100)}%` }"
              :title="`${ms.target}${state.unit} · ${ms.label}`"
            />
          </div>
        </div>

        <div class="goal-metrics-row">
          <span class="metric-current">
            <strong>{{ effectiveCurrent }}</strong>
            <span class="metric-sep">/</span>
            <span>{{ state.target }}</span>
            <span
              v-if="state.unit"
              class="metric-unit"
            >
              {{ state.unit }}
            </span>
          </span>

          <div class="goal-right-meta">
            <span
              v-if="nextMilestone"
              class="milestone-pill"
            >
              <Flag class="milestone-icon" />
              <span>{{ nextMilestone.target }}{{ state.unit }} {{ nextMilestone.label }}</span>
            </span>
            <span
              v-else-if="allMilestonesDone"
              class="milestone-pill is-done"
            >
              <Check class="milestone-icon" />
              <span>全部阶段已达成</span>
            </span>

            <span
              v-if="state.showPercent"
              class="metric-percent"
            >
              {{ displayPercentText }}
            </span>
          </div>
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

.goal-bar-wrap {
  position: relative;
  width: 100%;
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

.goal-milestone-ticks {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.milestone-tick {
  position: absolute;
  top: 50%;
  width: 6px;
  height: 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.45);
  border: 1.5px solid rgba(15, 23, 42, 0.85);
  transform: translate(-50%, -50%);
  transition: background-color 0.2s ease, transform 0.2s ease;
}

.milestone-tick.is-reached {
  background: #ffffff;
  border-color: var(--goal-accent, #f43f5e);
}

.goal-metrics-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.goal-right-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.milestone-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 240px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.14);
  font-size: 11px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.milestone-pill.is-done {
  background: color-mix(in srgb, var(--goal-accent, #f43f5e) 24%, transparent);
  border-color: color-mix(in srgb, var(--goal-accent, #f43f5e) 45%, transparent);
}

.milestone-icon {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
  color: var(--goal-accent, #f43f5e);
}

.metric-current {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  flex-shrink: 0;
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
  flex-shrink: 0;
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
