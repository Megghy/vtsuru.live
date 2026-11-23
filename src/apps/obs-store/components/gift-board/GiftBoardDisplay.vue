<script setup lang="ts">
import { Award, Crown, Gift, HeartHandshake, MessageSquareQuote, Shield, Sparkles } from 'lucide-vue-next'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

import {
  DEFAULT_GIFT_BOARD_STATE,
  SAMPLE_GIFT_BOARD_GUARDS,
  SAMPLE_GIFT_BOARD_RANKING,
  SAMPLE_GIFT_BOARD_THANKS,
  formatYuan,
  getAvatarInitial,
  getGuardLevelMeta,
} from './types'
import type { GiftBoardAction, GiftBoardState, GiftBoardTab } from './types'

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

const { state, onAction } = useObsBridge<GiftBoardState, GiftBoardAction>({
  componentId: 'gift-board',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_GIFT_BOARD_STATE,
  role: 'viewer',
})

useGoogleFont(computed(() => state.value.fontFamily || undefined))
const customFontCss = computed(() => resolveFontFamilyCss(state.value.fontFamily))

const TAB_ORDER: GiftBoardTab[] = ['ranking', 'thanks', 'guards']
const cycleTab = ref<GiftBoardTab>('ranking')
let cycleTimer: ReturnType<typeof setInterval> | undefined

function resetCycleTimer() {
  if (cycleTimer) {
    clearInterval(cycleTimer)
    cycleTimer = undefined
  }
  if (state.value.viewMode !== 'auto_cycle') return
  const intervalMs = Math.max(3, Math.min(60, state.value.cycleIntervalSec || 10)) * 1000
  cycleTimer = setInterval(() => {
    const idx = TAB_ORDER.indexOf(cycleTab.value)
    cycleTab.value = TAB_ORDER[(idx + 1) % TAB_ORDER.length]
  }, intervalMs)
}

watch(
  () => [state.value.viewMode, state.value.cycleIntervalSec],
  () => {
    resetCycleTimer()
  },
  { immediate: true },
)

const unbindAction = onAction((action) => {
  if (action.type === 'SWITCH_TAB') {
    cycleTab.value = action.tab
  }
})

onUnmounted(() => {
  if (cycleTimer) clearInterval(cycleTimer)
  unbindAction()
})

const activeTab = computed<GiftBoardTab>(() =>
  state.value.viewMode === 'auto_cycle' ? cycleTab.value : state.value.viewMode,
)

const maxItems = computed(() => Math.max(3, Math.min(30, state.value.maxItems || 8)))

const isShowingSample = computed(() => {
  if (!state.value.showEmptySample) return false
  if (activeTab.value === 'ranking') return (state.value.ranking?.length ?? 0) === 0
  if (activeTab.value === 'thanks') return (state.value.thanks?.length ?? 0) === 0
  return (state.value.guards?.length ?? 0) === 0
})

const rankingList = computed(() => {
  const src =
    (state.value.ranking?.length ?? 0) > 0
      ? state.value.ranking
      : state.value.showEmptySample
        ? SAMPLE_GIFT_BOARD_RANKING
        : []
  return src.slice(0, maxItems.value)
})

const topBoss = computed(() => rankingList.value[0] ?? null)
const restRanking = computed(() => rankingList.value.slice(1))

const thanksList = computed(() => {
  const src =
    (state.value.thanks?.length ?? 0) > 0
      ? state.value.thanks
      : state.value.showEmptySample
        ? SAMPLE_GIFT_BOARD_THANKS
        : []
  return src.slice(0, maxItems.value)
})

const guardsList = computed(() => {
  const src =
    (state.value.guards?.length ?? 0) > 0
      ? state.value.guards
      : state.value.showEmptySample
        ? SAMPLE_GIFT_BOARD_GUARDS
        : []
  return src
    .toSorted((a, b) => (a.guardLevel || 9) - (b.guardLevel || 9) || b.updatedAt - a.updatedAt)
    .slice(0, maxItems.value)
})

const currentTitle = computed(() => {
  if (activeTab.value === 'ranking') return state.value.titleRanking || '本场投喂排行'
  if (activeTab.value === 'thanks') return state.value.titleThanks || '实时感谢流'
  return state.value.titleGuards || '本场大航海'
})

const headerIcon = computed(() => {
  if (activeTab.value === 'ranking') return Crown
  if (activeTab.value === 'thanks') return HeartHandshake
  return Shield
})

const shouldMarqueeThanks = computed(() => state.value.autoScroll && thanksList.value.length >= 5)
const shouldMarqueeGuards = computed(() => state.value.autoScroll && guardsList.value.length >= 6)
const shouldMarqueeRanking = computed(() => state.value.autoScroll && restRanking.value.length >= 5)
</script>

<template>
  <div
    class="gift-board-root"
    :class="[
      `theme-${state.theme}`,
      {
        'is-inline': props.inlineMode,
        'is-no-shadow': props.noShadow,
      },
    ]"
    :style="{
      '--board-accent': state.accentColor || '#f59e0b',
      fontFamily: customFontCss,
    }"
  >
    <div class="board-shell">
      <div class="board-header">
        <div class="board-title-group">
          <span class="board-title-icon">
            <component :is="headerIcon" class="size-4" />
          </span>
          <span class="board-title-text">{{ currentTitle }}</span>
        </div>

        <div class="board-header-right">
          <span
            v-if="isShowingSample"
            class="board-demo-tag"
          >
            DEMO
          </span>
          <div
            v-if="state.viewMode === 'auto_cycle'"
            class="board-cycle-dots"
          >
            <span
              v-for="tab in TAB_ORDER"
              :key="tab"
              class="board-cycle-dot"
              :class="{ active: activeTab === tab }"
            />
          </div>
        </div>
      </div>

      <div class="board-body">
        <Transition name="board-fade" mode="out-in">
          <!-- 视图 1: 投喂排行 -->
          <div
            v-if="activeTab === 'ranking'"
            key="ranking"
            class="board-pane"
          >
            <template v-if="topBoss">
              <div class="boss-card">
                <div class="boss-crown-badge">
                  <Crown class="size-3.5" />
                  <span>TOP 1 · BOSS</span>
                </div>
                <div class="boss-row">
                  <div
                    v-if="state.showAvatar"
                    class="avatar-circle is-boss"
                  >
                    <img
                      v-if="topBoss.uface"
                      :src="topBoss.uface"
                      alt=""
                      class="avatar-img"
                    >
                    <span v-else>{{ getAvatarInitial(topBoss.uname) }}</span>
                  </div>
                  <div class="row-main">
                    <div class="row-name-line">
                      <span class="boss-name">{{ topBoss.uname }}</span>
                      <span
                        v-if="getGuardLevelMeta(topBoss.guardLevel)"
                        class="guard-pill"
                        :class="`tone-${getGuardLevelMeta(topBoss.guardLevel)?.tone}`"
                      >
                        {{ getGuardLevelMeta(topBoss.guardLevel)?.label }}
                      </span>
                    </div>
                  </div>
                  <span
                    v-if="state.showPrice"
                    class="boss-price"
                  >
                    {{ formatYuan(topBoss.totalPaid) }}
                  </span>
                </div>
              </div>

              <div class="scroll-viewport">
                <div
                  class="scroll-track"
                  :class="{ 'is-scrolling': shouldMarqueeRanking }"
                  :style="{ '--scroll-duration': `${Math.max(10, restRanking.length * 2.4)}s` }"
                >
                  <div
                    v-for="(item, idx) in restRanking"
                    :key="item.id"
                    class="board-row"
                  >
                    <span
                      class="rank-badge"
                      :class="idx === 0 ? 'rank-2' : idx === 1 ? 'rank-3' : 'rank-other'"
                    >
                      <Award
                        v-if="idx < 2"
                        class="size-3"
                      />
                      <span v-else>{{ idx + 2 }}</span>
                    </span>
                    <div
                      v-if="state.showAvatar"
                      class="avatar-circle"
                    >
                      <img
                        v-if="item.uface"
                        :src="item.uface"
                        alt=""
                        class="avatar-img"
                      >
                      <span v-else>{{ getAvatarInitial(item.uname) }}</span>
                    </div>
                    <div class="row-main">
                      <div class="row-name-line">
                        <span class="row-name">{{ item.uname }}</span>
                        <span
                          v-if="getGuardLevelMeta(item.guardLevel)"
                          class="guard-pill"
                          :class="`tone-${getGuardLevelMeta(item.guardLevel)?.tone}`"
                        >
                          {{ getGuardLevelMeta(item.guardLevel)?.label }}
                        </span>
                      </div>
                    </div>
                    <span
                      v-if="state.showPrice"
                      class="row-price"
                    >
                      {{ formatYuan(item.totalPaid) }}
                    </span>
                  </div>
                </div>
              </div>
            </template>

            <div
              v-else
              class="board-empty"
            >
              <Sparkles class="size-5 opacity-50" />
              <span>暂无本场投喂排行数据</span>
            </div>
          </div>

          <!-- 视图 2: 实时感谢流 -->
          <div
            v-else-if="activeTab === 'thanks'"
            key="thanks"
            class="board-pane"
          >
            <div
              v-if="thanksList.length > 0"
              class="scroll-viewport"
            >
              <div
                class="scroll-track"
                :class="{ 'is-scrolling': shouldMarqueeThanks }"
                :style="{ '--scroll-duration': `${Math.max(12, thanksList.length * 2.6)}s` }"
              >
                <div
                  v-for="item in thanksList"
                  :key="item.id"
                  class="thanks-row"
                  :class="`kind-${item.kind}`"
                >
                  <div class="thanks-kind-icon">
                    <Crown
                      v-if="item.kind === 'guard'"
                      class="size-3.5"
                    />
                    <MessageSquareQuote
                      v-else-if="item.kind === 'sc'"
                      class="size-3.5"
                    />
                    <Gift
                      v-else
                      class="size-3.5"
                    />
                  </div>

                  <div class="row-main">
                    <div class="row-name-line">
                      <span class="row-name">{{ item.uname }}</span>
                      <span
                        v-if="getGuardLevelMeta(item.guardLevel)"
                        class="guard-pill"
                        :class="`tone-${getGuardLevelMeta(item.guardLevel)?.tone}`"
                      >
                        {{ getGuardLevelMeta(item.guardLevel)?.label }}
                      </span>
                    </div>
                    <div class="thanks-sub">
                      <span class="thanks-item-name">
                        {{ item.kind === 'sc' ? `SC: ${item.itemName}` : item.itemName }}
                      </span>
                      <span
                        v-if="item.count > 1"
                        class="thanks-count"
                      >
                        ×{{ item.count }}
                      </span>
                    </div>
                  </div>

                  <span
                    v-if="state.showPrice && item.totalPrice > 0"
                    class="row-price"
                  >
                    {{ formatYuan(item.totalPrice) }}
                  </span>
                </div>
              </div>
            </div>

            <div
              v-else
              class="board-empty"
            >
              <HeartHandshake class="size-5 opacity-50" />
              <span>等待直播间投喂与感谢记录</span>
            </div>
          </div>

          <!-- 视图 3: 本场大航海 / 舰长墙 -->
          <div
            v-else
            key="guards"
            class="board-pane"
          >
            <div
              v-if="guardsList.length > 0"
              class="scroll-viewport"
            >
              <div
                class="scroll-track"
                :class="{ 'is-scrolling': shouldMarqueeGuards }"
                :style="{ '--scroll-duration': `${Math.max(12, guardsList.length * 2.5)}s` }"
              >
                <div
                  v-for="item in guardsList"
                  :key="item.id"
                  class="guard-row"
                  :class="`guard-level-${item.guardLevel}`"
                >
                  <div
                    v-if="state.showAvatar"
                    class="avatar-circle"
                  >
                    <img
                      v-if="item.uface"
                      :src="item.uface"
                      alt=""
                      class="avatar-img"
                    >
                    <span v-else>{{ getAvatarInitial(item.uname) }}</span>
                  </div>

                  <div class="row-main">
                    <div class="row-name-line">
                      <span class="row-name">{{ item.uname }}</span>
                    </div>
                    <div class="guard-meta-line">
                      <span
                        v-if="getGuardLevelMeta(item.guardLevel)"
                        class="guard-pill"
                        :class="`tone-${getGuardLevelMeta(item.guardLevel)?.tone}`"
                      >
                        {{ getGuardLevelMeta(item.guardLevel)?.label }}
                      </span>
                      <span
                        v-if="item.count > 1"
                        class="guard-months"
                      >
                        ×{{ item.count }} 月
                      </span>
                    </div>
                  </div>

                  <span
                    v-if="state.showPrice && item.price > 0"
                    class="row-price"
                  >
                    {{ formatYuan(item.price) }}
                  </span>
                </div>
              </div>
            </div>

            <div
              v-else
              class="board-empty"
            >
              <Shield class="size-5 opacity-50" />
              <span>本场暂无新上舰成员</span>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gift-board-root {
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

.board-shell {
  width: 100%;
  max-width: 360px;
  height: 100%;
  min-height: 360px;
  max-height: 440px;
  border-radius: 16px;
  padding: 14px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
  transition: opacity 180ms ease, transform 180ms ease, background-color 180ms ease, border-color 180ms ease;
}

.board-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  flex-shrink: 0;
}

.board-title-group {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.board-title-icon {
  width: 24px;
  height: 24px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--board-accent, #f59e0b) 20%, transparent);
  color: var(--board-accent, #f59e0b);
  flex-shrink: 0;
}

.board-title-text {
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.board-header-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.board-demo-tag {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  opacity: 0.85;
}

.board-cycle-dots {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.board-cycle-dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.25);
  transition: transform 180ms ease, background-color 180ms ease;
}

.board-cycle-dot.active {
  background: var(--board-accent, #f59e0b);
  transform: scale(1.3);
}

.board-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.board-pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Top 1 Boss Card */
.boss-card {
  border-radius: 12px;
  padding: 10px 12px;
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--board-accent, #f59e0b) 26%, rgba(255, 255, 255, 0.06)),
    rgba(255, 255, 255, 0.04)
  );
  border: 1px solid color-mix(in srgb, var(--board-accent, #f59e0b) 55%, transparent);
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.boss-crown-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #fbbf24;
}

.boss-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.boss-name {
  font-size: 15px;
  font-weight: 800;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.boss-price {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 15px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #fbbf24;
}

/* 滚动视口 */
.scroll-viewport {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.scroll-track {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scroll-track.is-scrolling {
  animation: board-gentle-scroll var(--scroll-duration, 14s) ease-in-out infinite alternate;
}

@keyframes board-gentle-scroll {
  0%, 15% {
    transform: translateY(0);
  }
  85%, 100% {
    transform: translateY(-28%);
  }
}

.board-row,
.thanks-row,
.guard-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  min-width: 0;
}

.rank-badge {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.rank-2 {
  background: rgba(226, 232, 240, 0.2);
  color: #e2e8f0;
  border: 1px solid rgba(226, 232, 240, 0.45);
}

.rank-3 {
  background: rgba(217, 119, 6, 0.22);
  color: #fdba74;
  border: 1px solid rgba(251, 146, 60, 0.45);
}

.rank-other {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.72);
}

.avatar-circle {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background: color-mix(in srgb, var(--board-accent, #f59e0b) 25%, rgba(255, 255, 255, 0.1));
  color: #ffffff;
  flex-shrink: 0;
}

.avatar-circle.is-boss {
  width: 34px;
  height: 34px;
  border: 1.5px solid #fbbf24;
  font-size: 13px;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row-name-line {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.row-name {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-price {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--board-accent, #f59e0b);
}

/* 舰长等级标签 */
.guard-pill {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  line-height: 1.3;
}

.guard-pill.tone-zongdu {
  background: rgba(250, 204, 21, 0.24);
  color: #fde047;
  border: 1px solid rgba(250, 204, 21, 0.55);
}

.guard-pill.tone-tidu {
  background: rgba(192, 132, 252, 0.24);
  color: #e9d5ff;
  border: 1px solid rgba(192, 132, 252, 0.55);
}

.guard-pill.tone-jianzhang {
  background: rgba(56, 189, 248, 0.22);
  color: #bae6fd;
  border: 1px solid rgba(56, 189, 248, 0.5);
}

/* 感谢流 */
.thanks-kind-icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.1);
  color: var(--board-accent, #f59e0b);
}

.thanks-row.kind-guard .thanks-kind-icon {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
}

.thanks-row.kind-sc .thanks-kind-icon {
  background: rgba(245, 158, 11, 0.2);
  color: #fbbf24;
}

.thanks-row.kind-gift .thanks-kind-icon {
  background: rgba(244, 63, 94, 0.2);
  color: #fb7185;
}

.thanks-sub {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  opacity: 0.8;
  min-width: 0;
}

.thanks-item-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thanks-count {
  flex-shrink: 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--board-accent, #f59e0b);
}

/* 舰长墙 */
.guard-row.guard-level-1 {
  border-color: rgba(250, 204, 21, 0.4);
  background: rgba(250, 204, 21, 0.08);
}

.guard-row.guard-level-2 {
  border-color: rgba(192, 132, 252, 0.36);
  background: rgba(192, 132, 252, 0.08);
}

.guard-row.guard-level-3 {
  border-color: rgba(56, 189, 248, 0.32);
}

.guard-meta-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.guard-months {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.78;
  font-variant-numeric: tabular-nums;
}

.board-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  opacity: 0.65;
}

/* 主题 1: card */
.theme-card .board-shell {
  background: rgba(16, 18, 26, 0.9);
  color: #f8fafc;
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
}

/* 主题 2: minimal */
.theme-minimal .board-shell {
  background: rgba(12, 14, 20, 0.48);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.16);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.85);
}

/* 主题 3: neon */
.theme-neon .board-shell {
  background: rgba(8, 10, 18, 0.94);
  color: #f8fafc;
  border: 1.5px solid var(--board-accent, #f59e0b);
  box-shadow: 0 0 20px color-mix(in srgb, var(--board-accent, #f59e0b) 38%, transparent);
}

.theme-neon .boss-price {
  text-shadow: 0 0 10px rgba(251, 191, 36, 0.65);
}

/* 主题 4: glass */
.theme-glass .board-shell {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.06));
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(18px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.26);
}

/* noShadow */
.is-no-shadow .board-shell,
.is-no-shadow .boss-price {
  box-shadow: none !important;
  text-shadow: none !important;
}

/* 页签切换动效 */
.board-fade-enter-active,
.board-fade-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.board-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.board-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
