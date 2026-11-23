<script setup lang="ts">
import {
  BellRing,
  CalendarCheck,
  Crown,
  Gift,
  MessageSquareQuote,
  ShoppingBag,
  Sparkles,
  UserPlus,
} from 'lucide-vue-next'
import { computed, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

import {
  ALERT_KIND_MAP,
  DEFAULT_ALERT_BOX_STATE,
  formatAlertPrice,
  getAlertRule,
  renderAlertTemplate,
} from './types'
import type { AlertBoxAction, AlertBoxState, AlertEventKind, AlertPayload } from './types'

const props = withDefaults(
  defineProps<{
    channelId?: string
    userId?: number
    inlineMode?: boolean
    noShadow?: boolean
  }>(),
  {
    inlineMode: false,
    noShadow: false,
  },
)

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const { state, onAction } = useObsBridge<AlertBoxState, AlertBoxAction>({
  componentId: 'alert-box',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_ALERT_BOX_STATE,
  role: 'viewer',
})

useGoogleFont(computed(() => state.value.fontFamily || undefined))
const customFontCss = computed(() => resolveFontFamilyCss(state.value.fontFamily))

const queue = ref<AlertPayload[]>([])
const activeAlert = ref<AlertPayload | null>(null)
const progressKey = ref(0)
const seenIds = new Set<string>()

let activeTimer: ReturnType<typeof setTimeout> | undefined
let gapTimer: ReturnType<typeof setTimeout> | undefined
let sharedAudioCtx: AudioContext | null = null

const iconMap = {
  guard: Crown,
  sc: MessageSquareQuote,
  gift: Gift,
  point_redeem: ShoppingBag,
  checkin: CalendarCheck,
  follow: UserPlus,
} as const

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctor()
  }
  return sharedAudioCtx
}

function playSynthChime(kind: AlertEventKind) {
  if (!state.value.playSound) return
  const volume = Math.max(0, Math.min(100, state.value.soundVolume ?? 45)) / 100
  if (volume <= 0) return

  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => {})
  }

  const sequences: Record<AlertEventKind, number[]> = {
    guard: [523.25, 659.25, 783.99, 1046.5],
    sc: [587.33, 739.99, 880],
    gift: [659.25, 880, 1174.66],
    point_redeem: [523.25, 698.46, 880],
    checkin: [587.33, 880],
    follow: [523.25, 659.25],
  }

  const notes = sequences[kind] ?? [587.33, 880]
  const now = ctx.currentTime
  const gainPeak = volume * 0.14

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = kind === 'guard' || kind === 'sc' ? 'triangle' : 'sine'
    osc.frequency.setValueAtTime(freq, now + idx * 0.08)

    const start = now + idx * 0.08
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34)

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + 0.36)
  })
}

function clearTimers() {
  if (activeTimer) {
    clearTimeout(activeTimer)
    activeTimer = undefined
  }
  if (gapTimer) {
    clearTimeout(gapTimer)
    gapTimer = undefined
  }
}

function playNext() {
  if (activeAlert.value || queue.value.length === 0) return
  const next = queue.value.shift()
  if (!next) return

  activeAlert.value = next
  progressKey.value++

  const duration = Math.max(1500, Math.min(20000, state.value.durationMs || 4500))
  activeTimer = setTimeout(() => {
    activeAlert.value = null
    activeTimer = undefined
    if (queue.value.length > 0) {
      gapTimer = setTimeout(() => {
        gapTimer = undefined
        playNext()
      }, 240)
    }
  }, duration)

  try {
    playSynthChime(next.kind)
  } catch {
    // 无音频输出设备或浏览器策略阻止时不影响视觉播报
  }
}

function enqueueAlert(payload: AlertPayload) {
  if (!payload?.id) return
  if (seenIds.has(payload.id)) return
  seenIds.add(payload.id)
  if (seenIds.size > 200) {
    const first = seenIds.values().next().value
    if (first) seenIds.delete(first)
  }

  if (queue.value.length >= 25) {
    queue.value.shift()
  }
  queue.value.push(payload)
  playNext()
}

function clearQueue() {
  clearTimers()
  queue.value = []
  activeAlert.value = null
}

const unbindAction = onAction((action) => {
  if (action.type === 'TRIGGER_ALERT') {
    enqueueAlert(action.payload)
  } else if (action.type === 'CLEAR_QUEUE') {
    clearQueue()
  }
})

onUnmounted(() => {
  unbindAction()
  clearTimers()
})

defineExpose({
  enqueueAlert,
  clearQueue,
})

const activeRule = computed(() => (activeAlert.value ? getAlertRule(state.value, activeAlert.value.kind) : null))
const activeAccent = computed(() => activeRule.value?.accentColor || '#38bdf8')
const activeMessage = computed(() =>
  activeAlert.value && activeRule.value
    ? renderAlertTemplate(activeRule.value.template, activeAlert.value)
    : '',
)
const activeBadge = computed(() => (activeAlert.value ? ALERT_KIND_MAP[activeAlert.value.kind]?.badge ?? 'EVENT' : ''))
const activeIcon = computed(() => (activeAlert.value ? iconMap[activeAlert.value.kind] : Sparkles))
const activePriceLabel = computed(() => {
  const alert = activeAlert.value
  if (!alert || !alert.price || alert.price <= 0) return ''
  if (alert.kind === 'point_redeem' || alert.kind === 'checkin') {
    return `${formatAlertPrice(alert.price)} 积分`
  }
  return `￥${formatAlertPrice(alert.price)}`
})

const transitionName = computed(() => `alert-${state.value.animation || 'pop'}`)
const durationCss = computed(() => `${Math.max(1500, Math.min(20000, state.value.durationMs || 4500))}ms`)
</script>

<template>
  <div
    class="alert-obs-root"
    :class="[
      `theme-${state.theme}`,
      {
        'is-inline': props.inlineMode,
        'is-no-shadow': props.noShadow,
      },
    ]"
    :style="{
      '--alert-accent': activeAccent,
      '--alert-duration': durationCss,
      fontFamily: customFontCss,
    }"
  >
    <Transition :name="transitionName" mode="out-in">
      <div
        v-if="activeAlert && activeRule"
        :key="activeAlert.id"
        class="alert-card"
      >
        <div class="alert-accent-bar" />

        <div class="alert-body">
          <div class="alert-visual">
            <img
              v-if="activeRule.mediaUrl"
              :src="activeRule.mediaUrl"
              alt=""
              class="alert-media-img"
            >
            <img
              v-else-if="state.showAvatar && activeAlert.avatar"
              :src="activeAlert.avatar"
              alt=""
              class="alert-avatar-img"
            >
            <div
              v-else
              class="alert-icon-badge"
            >
              <component :is="activeIcon" class="alert-icon-svg" />
            </div>
          </div>

          <div class="alert-content">
            <div class="alert-header">
              <span class="alert-kind-chip">{{ activeBadge }}</span>
              <span class="alert-title">{{ activeRule.title }}</span>
              <span
                v-if="activePriceLabel"
                class="alert-price-pill"
              >
                {{ activePriceLabel }}
              </span>
            </div>

            <div class="alert-user-row">
              <span class="alert-user-name">{{ activeAlert.user || '神秘观众' }}</span>
              <span
                v-if="activeAlert.item && activeAlert.kind !== 'sc'"
                class="alert-item-tag"
              >
                {{ activeAlert.item }}<template v-if="(activeAlert.count ?? 1) > 1"> ×{{ activeAlert.count }}</template>
              </span>
            </div>

            <p class="alert-message">{{ activeMessage }}</p>
          </div>
        </div>

        <div
          v-if="state.showProgressBar"
          class="alert-progress-track"
        >
          <div
            :key="progressKey"
            class="alert-progress-fill"
          />
        </div>
      </div>

      <div
        v-else-if="props.inlineMode"
        key="idle-placeholder"
        class="alert-idle-card"
      >
        <div class="alert-idle-icon">
          <BellRing class="size-4" />
        </div>
        <div class="alert-idle-text">
          <div class="alert-idle-title">播报待机中（独立 OBS 源无事件时完全透明）</div>
          <div class="alert-idle-desc">点击左侧「一键模拟」按钮，即可在此与 OBS 同步预览播报动效</div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.alert-obs-root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
  pointer-events: none;
}

.alert-card {
  position: relative;
  width: 100%;
  max-width: 496px;
  overflow: hidden;
  border-radius: 16px;
  box-sizing: border-box;
}

.alert-accent-bar {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--alert-accent, #38bdf8);
}

.alert-body {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px 16px 20px;
}

.alert-visual {
  flex-shrink: 0;
}

.alert-media-img,
.alert-avatar-img {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  object-fit: cover;
  display: block;
  border: 2px solid color-mix(in srgb, var(--alert-accent, #38bdf8) 65%, transparent);
}

.alert-icon-badge {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--alert-accent, #38bdf8) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--alert-accent, #38bdf8) 45%, transparent);
  color: var(--alert-accent, #38bdf8);
}

.alert-icon-svg {
  width: 26px;
  height: 26px;
}

.alert-content {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.alert-header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.alert-kind-chip {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--alert-accent, #38bdf8) 22%, transparent);
  color: var(--alert-accent, #38bdf8);
}

.alert-title {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.82;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alert-price-pill {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--alert-accent, #38bdf8);
  color: #090d16;
}

.alert-user-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.alert-user-name {
  font-size: 19px;
  font-weight: 800;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alert-item-tag {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--alert-accent, #38bdf8);
}

.alert-message {
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
  opacity: 0.92;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.alert-progress-track {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.alert-progress-fill {
  width: 100%;
  height: 100%;
  background: var(--alert-accent, #38bdf8);
  transform-origin: left center;
  animation: alert-countdown var(--alert-duration, 4500ms) linear forwards;
}

@keyframes alert-countdown {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

/* 待机占位（仅 inlineMode） */
.alert-idle-card {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 440px;
  padding: 14px 18px;
  border-radius: 12px;
  border: 1px dashed rgba(148, 163, 184, 0.4);
  background: rgba(15, 23, 42, 0.45);
  color: #e2e8f0;
  backdrop-filter: blur(8px);
}

.alert-idle-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(56, 189, 248, 0.16);
  color: #38bdf8;
}

.alert-idle-title {
  font-size: 12px;
  font-weight: 600;
}

.alert-idle-desc {
  margin-top: 2px;
  font-size: 11px;
  opacity: 0.72;
}

/* 主题：card */
.theme-card .alert-card {
  background: rgba(16, 18, 26, 0.92);
  color: #f8fafc;
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.46);
}

/* 主题：minimal */
.theme-minimal .alert-card {
  background: rgba(12, 14, 20, 0.56);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.18);
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85);
}

/* 主题：neon */
.theme-neon .alert-card {
  background: rgba(8, 10, 18, 0.94);
  color: #f8fafc;
  border: 1.5px solid var(--alert-accent, #38bdf8);
  box-shadow: 0 0 22px color-mix(in srgb, var(--alert-accent, #38bdf8) 42%, transparent);
}

.theme-neon .alert-user-name {
  text-shadow: 0 0 12px color-mix(in srgb, var(--alert-accent, #38bdf8) 65%, transparent);
}

/* 主题：glass */
.theme-glass .alert-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.08));
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(18px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.26);
}

/* noShadow 模式 */
.is-no-shadow .alert-card,
.is-no-shadow .alert-user-name,
.is-no-shadow .alert-idle-card {
  box-shadow: none !important;
  text-shadow: none !important;
}

/* 入场动效：仅过渡 opacity & transform */
.alert-slide-enter-active,
.alert-slide-leave-active,
.alert-scale-enter-active,
.alert-scale-leave-active,
.alert-pop-enter-active,
.alert-pop-leave-active {
  transition: opacity 180ms ease, transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.alert-slide-enter-from {
  opacity: 0;
  transform: translateX(-36px);
}
.alert-slide-leave-to {
  opacity: 0;
  transform: translateX(28px);
}

.alert-scale-enter-from {
  opacity: 0;
  transform: scale(0.86);
}
.alert-scale-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

.alert-pop-enter-from {
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}
.alert-pop-leave-to {
  opacity: 0;
  transform: translateY(-14px) scale(0.96);
}
</style>
