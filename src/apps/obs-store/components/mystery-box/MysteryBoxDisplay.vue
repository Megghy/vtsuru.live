<script setup lang="ts">
import { CloudRain, Crown, Gift, PackageOpen, Sparkles, TrendingDown, TrendingUp } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

import { DEFAULT_MYSTERY_BOX_STATE, formatYuan, roundYuan } from './types'
import type { MysteryBoxAction, MysteryBoxLastPull, MysteryBoxState } from './types'

const props = defineProps<{
  channelId?: string
  userId?: number
  inlineMode?: boolean
  noShadow?: boolean
}>()

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const { state, onAction } = useObsBridge<MysteryBoxState, MysteryBoxAction>({
  componentId: 'mystery-box',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_MYSTERY_BOX_STATE,
  role: 'viewer',
})

useGoogleFont(computed(() => state.value.fontFamily || undefined))
const customFontCss = computed(() => resolveFontFamilyCss(state.value.fontFamily))

const netProfit = computed(() => roundYuan(state.value.totalValue - state.value.totalCost))
const isPositive = computed(() => netProfit.value >= 0)

const luckyRank = computed(() => {
  if (!state.value.userStats.length) return []
  return state.value.userStats.toSorted((a, b) => b.netProfit - a.netProfit || b.totalValue - a.totalValue).slice(0, 2)
})

const unluckyRank = computed(() => {
  if (!state.value.userStats.length) return []
  return state.value.userStats.toSorted((a, b) => a.netProfit - b.netProfit || b.totalCost - a.totalCost).slice(0, 2)
})

const topGifts = computed(() => state.value.giftStats.slice(0, 4))

// 最新一发飘字/闪卡动效
const flashPull = ref<MysteryBoxLastPull | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | undefined
let lastFlashedId = ''

function triggerFlash(pull: MysteryBoxLastPull) {
  if (!pull?.id || pull.id === lastFlashedId) return
  lastFlashedId = pull.id
  flashPull.value = pull
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    flashPull.value = null
  }, 3200)
}

watch(
  () => state.value.lastPull?.id,
  (id, prevId) => {
    if (prevId !== undefined && id && id !== prevId && state.value.lastPull) {
      triggerFlash(state.value.lastPull)
    }
  },
)

let disposeAction: (() => void) | undefined

onMounted(() => {
  disposeAction = onAction((action) => {
    if (action.type === 'PULL_FLASH') {
      triggerFlash(action.pull)
    } else if (action.type === 'RESET') {
      flashPull.value = null
      lastFlashedId = ''
    }
  })
})

onUnmounted(() => {
  disposeAction?.()
  if (flashTimer) clearTimeout(flashTimer)
})
</script>

<template>
  <div
    class="mb-obs-root"
    :class="[
      `theme-${state.theme}`,
      `mode-${state.viewMode}`,
      { 'is-inline': props.inlineMode, 'no-shadow': props.noShadow },
    ]"
    :style="{ '--mb-accent': state.accentColor, fontFamily: customFontCss }"
  >
    <div class="mb-card">
      <!-- 最新出货闪卡浮层 -->
      <Transition name="mb-flash">
        <div
          v-if="flashPull"
          class="mb-flash-banner"
          :class="flashPull.profit > 0 ? 'is-jackpot' : 'is-loss'"
        >
          <Sparkles
            v-if="flashPull.profit > 0"
            class="mb-flash-icon"
          />
          <Gift
            v-else
            class="mb-flash-icon"
          />
          <div class="mb-flash-text">
            <span class="mb-flash-user">{{ flashPull.uname }}</span>
            <span class="mb-flash-desc">
              开出 {{ flashPull.giftName }}{{ flashPull.num > 1 ? ` ×${flashPull.num}` : '' }}
            </span>
          </div>
          <span class="mb-flash-profit">{{ formatYuan(flashPull.profit, true) }}</span>
        </div>
      </Transition>

      <!-- 顶部标题栏 -->
      <div class="mb-header">
        <div class="mb-title-group">
          <PackageOpen class="mb-title-icon" />
          <span class="mb-title">{{ state.title || '盲盒盈亏统计' }}</span>
          <span class="mb-count-pill">已拆 {{ state.totalOpens }} 盒</span>
        </div>
        <div
          class="mb-profit-pill"
          :class="isPositive ? 'is-gain' : 'is-loss'"
        >
          <TrendingUp
            v-if="isPositive"
            class="mb-pill-icon"
          />
          <TrendingDown
            v-else
            class="mb-pill-icon"
          />
          <span>{{ formatYuan(netProfit, true) }}</span>
        </div>
      </div>

      <!-- 核心三指标 -->
      <div class="mb-kpi-grid">
        <div class="mb-kpi-cell">
          <span class="mb-kpi-label">总投入</span>
          <span class="mb-kpi-value">{{ formatYuan(state.totalCost) }}</span>
        </div>
        <div class="mb-kpi-cell">
          <span class="mb-kpi-label">开出价值</span>
          <span class="mb-kpi-value">{{ formatYuan(state.totalValue) }}</span>
        </div>
        <div class="mb-kpi-cell">
          <span class="mb-kpi-label">净盈亏</span>
          <span
            class="mb-kpi-value"
            :class="isPositive ? 'text-gain' : 'text-loss'"
          >
            {{ formatYuan(netProfit, true) }}
          </span>
        </div>
      </div>

      <!-- 完整模式：欧皇/非酋榜 + 出货统计 -->
      <template v-if="state.viewMode === 'full'">
        <div
          v-if="state.showRankings"
          class="mb-rank-grid"
        >
          <div class="mb-rank-box is-lucky">
            <div class="mb-rank-head">
              <Crown class="mb-rank-icon" />
              <span>欧皇榜</span>
            </div>
            <div
              v-if="luckyRank.length"
              class="mb-rank-list"
            >
              <div
                v-for="(user, idx) in luckyRank"
                :key="user.key"
                class="mb-rank-row"
              >
                <span class="mb-rank-name">{{ idx + 1 }}. {{ user.uname }}</span>
                <span
                  class="mb-rank-val"
                  :class="user.netProfit >= 0 ? 'text-gain' : 'text-loss'"
                >
                  {{ formatYuan(user.netProfit, true) }}
                </span>
              </div>
            </div>
            <div
              v-else
              class="mb-empty-hint"
            >
              等待拆盒...
            </div>
          </div>

          <div class="mb-rank-box is-unlucky">
            <div class="mb-rank-head">
              <CloudRain class="mb-rank-icon" />
              <span>非酋榜</span>
            </div>
            <div
              v-if="unluckyRank.length"
              class="mb-rank-list"
            >
              <div
                v-for="(user, idx) in unluckyRank"
                :key="user.key"
                class="mb-rank-row"
              >
                <span class="mb-rank-name">{{ idx + 1 }}. {{ user.uname }}</span>
                <span
                  class="mb-rank-val"
                  :class="user.netProfit >= 0 ? 'text-gain' : 'text-loss'"
                >
                  {{ formatYuan(user.netProfit, true) }}
                </span>
              </div>
            </div>
            <div
              v-else
              class="mb-empty-hint"
            >
              等待拆盒...
            </div>
          </div>
        </div>

        <div
          v-if="state.showGiftStats"
          class="mb-gifts-section"
        >
          <div class="mb-section-label">出货统计</div>
          <div
            v-if="topGifts.length"
            class="mb-gift-chips"
          >
            <div
              v-for="gift in topGifts"
              :key="gift.name"
              class="mb-gift-chip"
            >
              <span class="mb-gift-name">{{ gift.name }}</span>
              <span class="mb-gift-meta">×{{ gift.count }} · {{ formatYuan(gift.totalValue) }}</span>
            </div>
          </div>
          <div
            v-else
            class="mb-empty-hint"
          >
            暂无盲盒出货记录
          </div>
        </div>
      </template>

      <!-- 紧凑模式：最近一发记录 -->
      <div
        v-else-if="state.lastPull"
        class="mb-compact-last"
      >
        <span class="mb-compact-tag">最新</span>
        <span class="mb-compact-desc"> {{ state.lastPull.uname }} 开出 {{ state.lastPull.giftName }} </span>
        <span
          class="mb-compact-val"
          :class="state.lastPull.profit >= 0 ? 'text-gain' : 'text-loss'"
        >
          {{ formatYuan(state.lastPull.profit, true) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mb-obs-root {
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

.mb-card {
  position: relative;
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

/* 闪卡飘字 */
.mb-flash-banner {
  position: absolute;
  top: -12px;
  left: 10px;
  right: 10px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 11px;
  border-radius: 10px;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.42);
  pointer-events: none;
}

.mb-flash-banner.is-jackpot {
  background: linear-gradient(135deg, #059669, #10b981);
  border: 1px solid rgba(167, 243, 208, 0.6);
}

.mb-flash-banner.is-loss {
  background: linear-gradient(135deg, #be123c, #f43f5e);
  border: 1px solid rgba(254, 205, 211, 0.5);
}

.mb-flash-icon {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.mb-flash-text {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
  flex: 1;
}

.mb-flash-user {
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}

.mb-flash-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.94;
}

.mb-flash-profit {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.mb-flash-enter-active,
.mb-flash-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.mb-flash-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.95);
}

.mb-flash-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.96);
}

/* 顶部栏 */
.mb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mb-title-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.mb-title-icon {
  width: 16px;
  height: 16px;
  color: var(--mb-accent, #f59e0b);
  flex-shrink: 0;
}

.mb-title {
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mb-count-pill {
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.mb-profit-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.mb-profit-pill.is-gain {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.45);
}

.mb-profit-pill.is-loss {
  background: rgba(244, 63, 94, 0.2);
  color: #fb7185;
  border: 1px solid rgba(251, 113, 133, 0.45);
}

.mb-pill-icon {
  width: 13px;
  height: 13px;
}

/* KPI 行 */
.mb-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.mb-kpi-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 7px 9px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.mb-kpi-label {
  font-size: 10px;
  opacity: 0.68;
}

.mb-kpi-value {
  font-size: 15px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.15;
}

.text-gain {
  color: #34d399;
}

.text-loss {
  color: #fb7185;
}

/* 欧皇/非酋榜 */
.mb-rank-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.mb-rank-box {
  padding: 8px 9px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}

.mb-rank-head {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
}

.mb-rank-box.is-lucky .mb-rank-head {
  color: #fbbf24;
}

.mb-rank-box.is-unlucky .mb-rank-head {
  color: #93c5fd;
}

.mb-rank-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.mb-rank-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.mb-rank-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
}

.mb-rank-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.92;
}

.mb-rank-val {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

/* 出货统计 */
.mb-gifts-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.mb-section-label {
  font-size: 10px;
  font-weight: 600;
  opacity: 0.68;
  letter-spacing: 0.02em;
}

.mb-gift-chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.mb-gift-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 11px;
  min-width: 0;
}

.mb-gift-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.mb-gift-meta {
  opacity: 0.78;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.mb-empty-hint {
  font-size: 11px;
  opacity: 0.5;
}

/* 紧凑模式底部 */
.mb-compact-last {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 11px;
}

.mb-compact-tag {
  padding: 1px 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--mb-accent, #f59e0b) 25%, transparent);
  color: var(--mb-accent, #f59e0b);
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.mb-compact-desc {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.9;
}

.mb-compact-val {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

/* 4 套主题 */
.theme-card .mb-card {
  background: rgba(17, 17, 22, 0.9);
  color: #f8fafc;
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  padding: 14px 16px;
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
}

.theme-minimal .mb-card {
  color: #ffffff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85);
  padding: 8px 10px;
}

.theme-minimal .mb-kpi-cell,
.theme-minimal .mb-rank-box,
.theme-minimal .mb-gift-chip,
.theme-minimal .mb-compact-last {
  background: rgba(0, 0, 0, 0.45);
  border-color: rgba(255, 255, 255, 0.2);
}

.theme-neon .mb-card {
  background: rgba(8, 10, 18, 0.94);
  color: #f8fafc;
  border: 1.5px solid var(--mb-accent, #f59e0b);
  box-shadow: 0 0 20px color-mix(in srgb, var(--mb-accent, #f59e0b) 35%, transparent);
  padding: 14px 16px;
  border-radius: 12px;
}

.theme-glass .mb-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.06));
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(16px);
  padding: 14px 16px;
  border-radius: 16px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
}

.no-shadow .mb-card,
.no-shadow .mb-flash-banner {
  box-shadow: none !important;
  text-shadow: none !important;
}
</style>
