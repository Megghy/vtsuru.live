<script setup lang="ts">
import { Clock, Crown, Eye, Flame, Heart, MessageCircle, Users } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

import {
  DEFAULT_LIVE_HUD_STATE,
  LIVE_HUD_METRIC_LIST,
  SAMPLE_LIVE_HUD_METRICS,
  formatHudCount,
  formatLiveDuration,
  normalizeEpochMs,
} from './types'
import type { LiveHudAction, LiveHudMetricKey, LiveHudMetrics, LiveHudState } from './types'

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

const { state } = useObsBridge<LiveHudState, LiveHudAction>({
  componentId: 'live-hud',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_LIVE_HUD_STATE,
  role: 'viewer',
})

useGoogleFont(computed(() => state.value.fontFamily || undefined))
const customFontCss = computed(() => resolveFontFamilyCss(state.value.fontFamily))

const mountedAt = Date.now()
const sampleStartAt = mountedAt - (1 * 3600 + 42 * 60 + 18) * 1000
const nowMs = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  timer = setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const iconMap = {
  onlineRank: Flame,
  totalLikes: Heart,
  watchedCount: Eye,
  fansCount: Users,
  guardCount: Crown,
  liveDuration: Clock,
  danmakuCount: MessageCircle,
} as const

const effectiveMetrics = computed<LiveHudMetrics>(() => {
  if (state.value.useSampleData) {
    return {
      ...SAMPLE_LIVE_HUD_METRICS,
      liveStartAt: sampleStartAt,
    }
  }
  return state.value.metrics ?? DEFAULT_LIVE_HUD_STATE.metrics
})

const metricItems = computed(() => {
  const m = effectiveMetrics.value
  const visible = state.value.visibleMetrics ?? DEFAULT_LIVE_HUD_STATE.visibleMetrics
  const startAtMs = normalizeEpochMs(m.liveStartAt)

  return LIVE_HUD_METRIC_LIST.filter((meta) => visible[meta.key]).map((meta) => {
    let valueText = '0'
    if (meta.key === 'liveDuration') {
      valueText = m.isLive && startAtMs > 0 ? formatLiveDuration(startAtMs, nowMs.value) : '00:00:00'
    } else {
      valueText = formatHudCount(m[meta.key as Exclude<LiveHudMetricKey, 'liveDuration'>] ?? 0)
    }
    return {
      key: meta.key,
      label: meta.shortLabel,
      fullLabel: meta.label,
      valueText,
      icon: iconMap[meta.key],
    }
  })
})
</script>

<template>
  <div
    class="live-hud-root"
    :class="[
      `theme-${state.theme}`,
      `layout-${state.layout}`,
      `size-${state.size}`,
      {
        'is-inline': props.inlineMode,
        'is-no-shadow': props.noShadow,
      },
    ]"
    :style="{
      '--hud-accent': state.accentColor || '#38bdf8',
      fontFamily: customFontCss,
    }"
  >
    <div class="hud-shell">
      <div
        v-if="state.showLiveDot"
        class="hud-live-badge"
        :class="{ 'is-offline': !effectiveMetrics.isLive }"
      >
        <span class="hud-live-dot" />
        <span class="hud-live-text">{{ state.liveLabel || 'LIVE' }}</span>
      </div>

      <div
        v-if="metricItems.length > 0"
        class="hud-metrics-list"
      >
        <div
          v-for="item in metricItems"
          :key="item.key"
          class="hud-metric-item"
        >
          <div class="hud-metric-head">
            <component
              :is="item.icon"
              class="hud-metric-icon"
            />
            <span class="hud-metric-label">
              {{ state.layout === 'vertical' ? item.fullLabel : item.label }}
            </span>
          </div>
          <span class="hud-metric-value">{{ item.valueText }}</span>
        </div>
      </div>

      <div
        v-else
        class="hud-empty"
      >
        请至少开启一项展示指标
      </div>
    </div>
  </div>
</template>

<style scoped>
.live-hud-root {
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

.hud-shell {
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 100%;
  box-sizing: border-box;
  transition: opacity 180ms ease, transform 180ms ease, background-color 180ms ease, border-color 180ms ease;
}

.hud-live-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(244, 63, 94, 0.18);
  border: 1px solid rgba(244, 63, 94, 0.45);
  color: #fb7185;
  flex-shrink: 0;
}

.hud-live-badge.is-offline {
  background: rgba(148, 163, 184, 0.16);
  border-color: rgba(148, 163, 184, 0.35);
  color: #cbd5e1;
}

.hud-live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f43f5e;
  box-shadow: 0 0 8px rgba(244, 63, 94, 0.85);
  animation: hud-pulse 1.6s ease-in-out infinite;
}

.hud-live-badge.is-offline .hud-live-dot {
  background: #94a3b8;
  box-shadow: none;
  animation: none;
}

@keyframes hud-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(0.82);
  }
}

.hud-live-text {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1;
}

.hud-metrics-list {
  display: flex;
  align-items: center;
  min-width: 0;
}

.hud-metric-item {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.hud-metric-head {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  opacity: 0.78;
}

.hud-metric-icon {
  width: 14px;
  height: 14px;
  color: var(--hud-accent, #38bdf8);
  flex-shrink: 0;
}

.hud-metric-label {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.hud-metric-value {
  font-size: 16px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  white-space: nowrap;
}

.hud-empty {
  font-size: 12px;
  opacity: 0.7;
  padding: 4px 8px;
}

/* 尺寸档位：compact */
.size-compact .hud-metric-value {
  font-size: 14px;
}
.size-compact .hud-metric-label {
  font-size: 10px;
}
.size-compact .hud-metric-icon {
  width: 12px;
  height: 12px;
}
.size-compact .hud-live-badge {
  padding: 3px 8px;
}

/* 布局 1: pill（单行胶囊条） */
.layout-pill .hud-shell {
  border-radius: 999px;
  padding: 10px 18px;
}

.layout-pill.size-compact .hud-shell {
  padding: 7px 14px;
  gap: 10px;
}

.layout-pill .hud-metrics-list {
  flex-wrap: nowrap;
  gap: 0;
}

.layout-pill .hud-metric-item {
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 0 14px;
  position: relative;
}

.layout-pill.size-compact .hud-metric-item {
  padding: 0 10px;
}

.layout-pill .hud-metric-item + .hud-metric-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 15%;
  bottom: 15%;
  width: 1px;
  background: rgba(255, 255, 255, 0.14);
}

/* 布局 2: card（分块指标卡） */
.layout-card .hud-shell {
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  padding: 0 !important;
}

.layout-card .hud-metrics-list {
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}

.layout-card .hud-metric-item {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 96px;
  padding: 10px 14px;
  border-radius: 12px;
}

.layout-card.size-compact .hud-metric-item {
  min-width: 82px;
  padding: 7px 10px;
}

/* 布局 3: vertical（竖排侧边栏） */
.layout-vertical .hud-shell {
  flex-direction: column;
  align-items: stretch;
  width: 220px;
  padding: 12px 14px;
  border-radius: 14px;
  gap: 10px;
}

.layout-vertical.size-compact .hud-shell {
  width: 192px;
  padding: 9px 12px;
  gap: 7px;
}

.layout-vertical .hud-live-badge {
  align-self: flex-start;
}

.layout-vertical .hud-metrics-list {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.layout-vertical .hud-metric-item {
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.layout-vertical .hud-metric-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

/* 主题 1: card */
.theme-card.layout-pill .hud-shell,
.theme-card.layout-vertical .hud-shell,
.theme-card.layout-card .hud-metric-item {
  background: rgba(16, 18, 26, 0.88);
  color: #f8fafc;
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.42);
}

/* 主题 2: minimal */
.theme-minimal.layout-pill .hud-shell,
.theme-minimal.layout-vertical .hud-shell,
.theme-minimal.layout-card .hud-metric-item {
  background: rgba(12, 14, 20, 0.42);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.16);
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85);
}

/* 主题 3: neon */
.theme-neon.layout-pill .hud-shell,
.theme-neon.layout-vertical .hud-shell,
.theme-neon.layout-card .hud-metric-item {
  background: rgba(8, 10, 18, 0.92);
  color: #f8fafc;
  border: 1.5px solid var(--hud-accent, #38bdf8);
  box-shadow: 0 0 18px color-mix(in srgb, var(--hud-accent, #38bdf8) 36%, transparent);
}

.theme-neon .hud-metric-value {
  text-shadow: 0 0 10px color-mix(in srgb, var(--hud-accent, #38bdf8) 65%, transparent);
}

/* 主题 4: glass */
.theme-glass.layout-pill .hud-shell,
.theme-glass.layout-vertical .hud-shell,
.theme-glass.layout-card .hud-metric-item {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.06));
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(16px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.24);
}

/* noShadow */
.is-no-shadow .hud-shell,
.is-no-shadow .hud-metric-item,
.is-no-shadow .hud-metric-value,
.is-no-shadow .hud-live-dot {
  box-shadow: none !important;
  text-shadow: none !important;
}
</style>
