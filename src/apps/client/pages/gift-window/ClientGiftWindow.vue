<script setup lang="ts">
import {
  Gift20Regular,
  PeopleCommunity20Regular,
  Trophy20Regular,
  VehicleShip20Regular,
} from '@vicons/fluent'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { NIcon, NSpin } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { EventDataTypes, GuardLevel } from '@/api/api-models'
import type {
  GiftEntry,
  GiftWindowBCData,
  GiftWindowSettings,
  OnlineGuardEntry,
  RankEntry,
  RankViewMode,
  ThankSummaryItem,
} from '@/apps/client/store/useGiftWindow'
import { GIFT_WINDOW_BROADCAST_CHANNEL } from '@/apps/client/store/useGiftWindow'
import { postBroadcastMessage } from '@/shared/utils/broadcastChannel'

let bc: BroadcastChannel | undefined
const setting = ref<GiftWindowSettings>()
const giftList = ref<GiftEntry[]>([])
const rankList = ref<RankEntry[]>([])
const onlineGuardList = ref<OnlineGuardEntry[]>([])
const activeRankTab = ref<RankViewMode>('thank_summary')

const hasContent = computed(
  () => giftList.value.length > 0 || rankList.value.length > 0 || onlineGuardList.value.length > 0,
)

const thankSummaryList = computed<ThankSummaryItem[]>(() => {
  const ranked = rankList.value
  const guards = onlineGuardList.value
  const rankedIds = new Set(ranked.map((r) => r.id))

  const items: ThankSummaryItem[] = ranked.map((r, idx) => ({
    id: r.id,
    uid: r.uid,
    uname: r.uname,
    uface: r.uface,
    totalPaid: r.totalPaid,
    guardLevel: r.guardLevel,
    isOnline: r.isOnline,
    lastActiveTime: r.lastActiveTime,
    isTopRank: true,
    rankIndex: idx + 1,
    isGuardOnly: false,
  }))

  const extraGuards = guards.filter((g) => !rankedIds.has(g.id))
  for (const g of extraGuards) {
    items.push({
      id: g.id,
      uid: g.uid,
      uname: g.uname,
      uface: g.uface,
      totalPaid: g.totalPaid,
      guardLevel: g.guardLevel,
      isOnline: true,
      lastActiveTime: g.lastActiveTime,
      isTopRank: false,
      isGuardOnly: true,
    })
  }

  return items
})

function updateCssVariables() {
  if (!setting.value) return
  const root = document.documentElement
  root.style.setProperty('--gw-bg-color', setting.value.backgroundColor)
  root.style.setProperty('--gw-window-bg-color', setting.value.windowBackgroundColor)
  root.style.setProperty('--gw-text-color', setting.value.textColor)
  root.style.setProperty('--gw-highlight-color', setting.value.highlightColor)
  root.style.setProperty('--gw-border-radius', `${setting.value.borderRadius}px`)
  root.style.setProperty('--gw-opacity', `${setting.value.opacity}`)
  root.style.setProperty('--gw-font-size', `${setting.value.fontSize}px`)
  root.style.setProperty('--gw-item-spacing', `${setting.value.itemSpacing}px`)
  root.style.setProperty('--gw-avatar-size', `${setting.value.fontSize + 10}px`)
}

function formatPrice(price: number): string {
  if (price >= 100000) return `¥${(price / 1000).toFixed(0)}`
  if (price >= 1000) return `¥${(price / 1000).toFixed(1)}`
  if (price >= 100) return `¥${(price / 100).toFixed(1)}`
  return `${price}瓜子`
}

function getTimeDiff(time: number): string {
  const diff = Math.floor((Date.now() - time) / 1000)
  if (diff < 5) return '刚刚'
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
}

function getGuardLabel(level: GuardLevel): string {
  switch (level) {
    case GuardLevel.Zongdu:
      return '总督'
    case GuardLevel.Tidu:
      return '提督'
    case GuardLevel.Jianzhang:
      return '舰长'
    default:
      return ''
  }
}

async function startResize() {
  const win = getCurrentWindow()
  await win.startResizeDragging('SouthEast')
}

function formatRankScore(score: number): string {
  return `¥${score.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

onMounted(() => {
  bc = new BroadcastChannel(GIFT_WINDOW_BROADCAST_CHANNEL)
  postBroadcastMessage(bc, { type: 'window-ready' })
  bc.onmessage = (event) => {
    const data = event.data as GiftWindowBCData
    switch (data.type) {
      case 'gift-list':
        giftList.value = data.data
        break
      case 'rank-list':
        rankList.value = data.data
        break
      case 'online-guard-list':
        onlineGuardList.value = data.data
        break
      case 'update-setting':
        setting.value = data.data
        if (data.data.rankViewMode) {
          activeRankTab.value = data.data.rankViewMode
        }
        updateCssVariables()
        break
      case 'clear':
        giftList.value = []
        rankList.value = []
        onlineGuardList.value = []
        break
    }
  }
  updateCssVariables()
  onUnmounted(() => {
    bc?.close()
    bc = undefined
  })
})

watch(
  () => setting.value,
  () => updateCssVariables(),
  { deep: true },
)
</script>

<template>
  <NSpin
    v-if="!setting"
    show
  />
  <div
    v-else
    class="gw"
    :class="{
      compact: setting.compactMode,
      'has-scrollbar': setting.showScrollbar,
    }"
  >
    <div class="gw-header">
      <span class="gw-header__title">礼物与排行</span>
      <div class="gw-header__status">
        <span
          v-if="onlineGuardList.length > 0"
          class="gw-guard-badge"
          title="当前在场大航海人数"
        >
          <NIcon :component="VehicleShip20Regular" />
          <span>在场 {{ onlineGuardList.length }}</span>
        </span>
      </div>
    </div>
    <div class="gw-body">
      <!-- 礼物列表 -->
      <template v-if="setting.showGiftList">
        <TransitionGroup
          v-if="giftList.length > 0"
          name="gw-anim"
          tag="div"
          class="gw-list"
        >
          <div
            v-for="item in giftList"
            :key="item.id"
            class="gw-item"
            :class="{
              'gw-item--sc': item.type === EventDataTypes.SC,
              'gw-item--guard': item.type === EventDataTypes.Guard,
            }"
          >
            <div class="gw-item__icon">
              <img
                v-if="item.giftIcon"
                :src="item.giftIcon"
                class="gw-item__gift-img"
                alt=""
              />
              <div
                v-else-if="item.type === EventDataTypes.SC"
                class="gw-item__type-icon gw-item__type-icon--sc"
              >
                SC
              </div>
              <div
                v-else-if="item.type === EventDataTypes.Guard"
                class="gw-item__type-icon gw-item__type-icon--guard"
              >
                {{ getGuardLabel(item.guardLevel).charAt(0) }}
              </div>
              <div
                v-else
                class="gw-item__type-icon gw-item__type-icon--gift"
              >
                礼
              </div>
            </div>
            <div class="gw-item__body">
              <div class="gw-item__top">
                <span class="gw-item__name">{{ item.uname }}</span>
                <span
                  v-if="setting.showTime"
                  class="gw-item__time"
                  >{{ getTimeDiff(item.firstTime) }}</span
                >
              </div>
              <div class="gw-item__bottom">
                <span class="gw-item__gift">{{ item.giftName }}</span>
                <span
                  v-if="item.totalNum > 1"
                  class="gw-item__num"
                  >×{{ item.totalNum }}</span
                >
              </div>
            </div>
            <div
              v-if="setting.showPrice && item.totalPrice > 0"
              class="gw-item__price"
            >
              {{ formatPrice(item.totalPrice) }}
            </div>
          </div>
        </TransitionGroup>
      </template>

      <!-- 排行榜与在线舰长 -->
      <template v-if="setting.showRanking && (rankList.length > 0 || onlineGuardList.length > 0)">
        <div
          v-if="setting.showGiftList && giftList.length > 0"
          class="gw-divider"
        />

        <!-- 排行榜顶部模式切换器 -->
        <div class="gw-rank-nav">
          <button
            type="button"
            class="gw-rank-tab"
            :class="{ active: activeRankTab === 'thank_summary' }"
            @click="activeRankTab = 'thank_summary'"
          >
            <NIcon
              :component="Gift20Regular"
              class="gw-tab-icon"
            />
            <span>下播感谢</span>
          </button>
          <button
            type="button"
            class="gw-rank-tab"
            :class="{ active: activeRankTab === 'rank' }"
            @click="activeRankTab = 'rank'"
          >
            <NIcon
              :component="Trophy20Regular"
              class="gw-tab-icon"
            />
            <span>打赏榜 ({{ rankList.length }})</span>
          </button>
          <button
            type="button"
            class="gw-rank-tab"
            :class="{ active: activeRankTab === 'online_guard' }"
            @click="activeRankTab = 'online_guard'"
          >
            <NIcon
              :component="VehicleShip20Regular"
              class="gw-tab-icon"
            />
            <span>在场舰长 ({{ onlineGuardList.length }})</span>
          </button>
        </div>

        <!-- 视图 1: 下播感谢合集 (Top 50 + 在场舰长) -->
        <div
          v-if="activeRankTab === 'thank_summary'"
          class="gw-rank-list"
        >
          <div
            v-for="(r, idx) in thankSummaryList"
            :key="r.id"
            class="gw-rank-item"
            :class="{
              'gw-rank-top': r.isTopRank && idx < 3,
              'gw-rank-guard-only': r.isGuardOnly,
            }"
          >
            <div class="gw-rank-left">
              <span
                v-if="r.isTopRank"
                class="gw-rank-idx"
                :class="`gw-rank-idx--${idx < 3 ? idx + 1 : 'n'}`"
              >
                {{ r.rankIndex }}
              </span>
              <span
                v-else
                class="gw-rank-guard-icon"
              >
                <NIcon :component="VehicleShip20Regular" />
              </span>

              <div class="gw-avatar-wrap">
                <img
                  v-if="setting.showAvatar && r.uface"
                  :src="r.uface"
                  class="gw-avatar"
                  alt=""
                />
                <span
                  class="gw-online-dot"
                  :class="{ online: r.isOnline }"
                  :title="r.isOnline ? '在场活跃' : '离线'"
                />
              </div>

              <div class="gw-user-info">
                <div class="gw-user-name-row">
                  <span class="gw-rank-name">{{ r.uname }}</span>
                  <span
                    v-if="r.guardLevel > 0"
                    class="gw-guard-tag"
                    :class="`gw-guard-tag--${r.guardLevel}`"
                  >
                    {{ getGuardLabel(r.guardLevel) }}
                  </span>
                </div>
                <span
                  v-if="r.isGuardOnly"
                  class="gw-sub-info"
                >
                  在场大航海 · {{ getTimeDiff(r.lastActiveTime) }}前活跃
                </span>
              </div>
            </div>

            <div class="gw-rank-right">
              <span
                v-if="r.totalPaid > 0"
                class="gw-rank-score"
              >
                {{ formatRankScore(r.totalPaid) }}
              </span>
              <span
                v-else
                class="gw-online-badge"
              >
                在场
              </span>
            </div>
          </div>
        </div>

        <!-- 视图 2: 纯打赏榜单 -->
        <div
          v-else-if="activeRankTab === 'rank'"
          class="gw-rank-list"
        >
          <div
            v-for="(r, idx) in rankList"
            :key="r.id"
            class="gw-rank-item"
            :class="{ 'gw-rank-top': idx < 3 }"
          >
            <div class="gw-rank-left">
              <span
                class="gw-rank-idx"
                :class="`gw-rank-idx--${idx < 3 ? idx + 1 : 'n'}`"
              >
                {{ idx + 1 }}
              </span>
              <div class="gw-avatar-wrap">
                <img
                  v-if="setting.showAvatar && r.uface"
                  :src="r.uface"
                  class="gw-avatar"
                  alt=""
                />
                <span
                  class="gw-online-dot"
                  :class="{ online: r.isOnline }"
                  :title="r.isOnline ? '在场活跃' : '离线'"
                />
              </div>
              <div class="gw-user-info">
                <div class="gw-user-name-row">
                  <span class="gw-rank-name">{{ r.uname }}</span>
                  <span
                    v-if="r.guardLevel > 0"
                    class="gw-guard-tag"
                    :class="`gw-guard-tag--${r.guardLevel}`"
                  >
                    {{ getGuardLabel(r.guardLevel) }}
                  </span>
                </div>
              </div>
            </div>
            <span class="gw-rank-score">{{ formatRankScore(r.score) }}</span>
          </div>
        </div>

        <!-- 视图 3: 在场舰长 -->
        <div
          v-else-if="activeRankTab === 'online_guard'"
          class="gw-rank-list"
        >
          <div
            v-if="onlineGuardList.length === 0"
            class="gw-sub-empty"
          >
            当前直播间暂无在场舰长活跃记录
          </div>
          <div
            v-for="g in onlineGuardList"
            :key="g.id"
            class="gw-rank-item gw-rank-guard-item"
          >
            <div class="gw-rank-left">
              <span
                class="gw-guard-tag gw-guard-tag--badge"
                :class="`gw-guard-tag--${g.guardLevel}`"
              >
                {{ getGuardLabel(g.guardLevel) }}
              </span>
              <div class="gw-avatar-wrap">
                <img
                  v-if="setting.showAvatar && g.uface"
                  :src="g.uface"
                  class="gw-avatar"
                  alt=""
                />
                <span class="gw-online-dot online" />
              </div>
              <div class="gw-user-info">
                <span class="gw-rank-name">{{ g.uname }}</span>
                <span class="gw-sub-info">{{ g.lastAction }} · {{ getTimeDiff(g.lastActiveTime) }}前</span>
              </div>
            </div>
            <div class="gw-rank-right">
              <span
                v-if="g.totalPaid > 0"
                class="gw-rank-score"
              >
                {{ formatRankScore(g.totalPaid) }}
              </span>
              <span
                v-else
                class="gw-online-badge"
              >
                在场
              </span>
            </div>
          </div>
        </div>
      </template>

      <div
        v-if="!hasContent"
        class="gw-empty"
      >
        等待中...
      </div>
    </div>
    <div
      class="gw-resize"
      @mousedown="startResize"
    />
  </div>
</template>

<style>
html,
body {
  background: transparent;
  overflow: hidden;
  margin: 0;
}

.n-layout {
  background: transparent;
}
.n-layout-content {
  overflow: hidden !important;
  background: transparent !important;
}
.n-element {
  background: transparent !important;
}

:root {
  --gw-bg-color: rgba(20, 20, 30, 0.85);
  --gw-window-bg-color: rgba(10, 10, 20, 0.6);
  --gw-text-color: #fff;
  --gw-highlight-color: #fbbf24;
  --gw-border-radius: 10px;
  --gw-opacity: 0.95;
  --gw-font-size: 14px;
  --gw-item-spacing: 8px;
  --gw-avatar-size: 24px;
}

.gw {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: var(--gw-border-radius);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: var(--gw-window-bg-color);
  backdrop-filter: blur(16px);
  color: var(--gw-text-color);
  font-size: var(--gw-font-size);
  opacity: var(--gw-opacity);
  overflow: hidden;
  -webkit-app-region: drag;
}

.gw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}
.gw-header__title {
  font-weight: 600;
  font-size: 0.85em;
  opacity: 0.7;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.gw-header__status {
  display: flex;
  align-items: center;
  gap: 6px;
}
.gw-guard-badge {
  font-size: 0.75em;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 1px 7px;
  border-radius: 12px;
  font-weight: 500;
}

.gw-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 8px;
  -webkit-app-region: no-drag;
}

/* 优雅半透明细滚动条 */
.gw.has-scrollbar .gw-body {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent;
}
.gw.has-scrollbar .gw-body::-webkit-scrollbar {
  width: 5px;
  display: block;
}
.gw.has-scrollbar .gw-body::-webkit-scrollbar-track {
  background: transparent;
}
.gw.has-scrollbar .gw-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
  transition: background 0.2s ease;
}
.gw.has-scrollbar .gw-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.45);
}

.gw:not(.has-scrollbar) .gw-body {
  scrollbar-width: none;
}
.gw:not(.has-scrollbar) .gw-body::-webkit-scrollbar {
  display: none;
}

.gw-empty {
  text-align: center;
  opacity: 0.3;
  padding: 20px;
  font-size: 0.9em;
}
.gw-sub-empty {
  text-align: center;
  opacity: 0.4;
  padding: 16px 0;
  font-size: 0.82em;
}

.gw-list {
  display: flex;
  flex-direction: column;
  gap: var(--gw-item-spacing);
}

.gw-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--gw-bg-color);
  border-radius: var(--gw-border-radius);
  border-left: 3px solid #34d399;
  will-change: transform, opacity;
}
.compact .gw-item {
  padding: 6px 10px;
}
.gw-item--sc {
  border-left-color: #f59e0b;
}
.gw-item--guard {
  border-left-color: #ec4899;
}

.gw-item__icon {
  flex-shrink: 0;
  width: var(--gw-avatar-size);
  height: var(--gw-avatar-size);
  display: flex;
  align-items: center;
  justify-content: center;
}
.gw-item__gift-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.gw-item__type-icon {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7em;
  font-weight: 700;
  color: #fff;
}
.gw-item__type-icon--sc {
  background: #f59e0b;
}
.gw-item__type-icon--guard {
  background: #ec4899;
}
.gw-item__type-icon--gift {
  background: #34d399;
}

.gw-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.gw-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.gw-item__name {
  font-weight: 600;
  font-size: 0.9em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gw-item__time {
  font-size: 0.75em;
  opacity: 0.5;
  flex-shrink: 0;
  margin-left: 6px;
}
.gw-item__bottom {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85em;
  opacity: 0.8;
}
.gw-item__gift {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gw-item__num {
  color: var(--gw-highlight-color);
  font-weight: 700;
}
.gw-item__price {
  flex-shrink: 0;
  font-weight: 700;
  color: var(--gw-highlight-color);
  font-size: 0.9em;
}

.gw-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 10px 0;
}

/* 排行榜 Tab 导航 */
.gw-rank-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(0, 0, 0, 0.25);
  padding: 3px;
  border-radius: 8px;
  margin-bottom: 8px;
}
.gw-rank-tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 6px;
  font-size: 0.75em;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
  text-align: center;
}
.gw-tab-icon {
  font-size: 1.15em;
}
.gw-rank-tab.active {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.gw-rank-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gw-rank-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  font-size: 0.85em;
  transition: background 0.15s ease;
}
.gw-rank-item:hover {
  background: rgba(255, 255, 255, 0.07);
}
.gw-rank-top {
  background: rgba(251, 191, 36, 0.08);
  border: 1px solid rgba(251, 191, 36, 0.15);
}
.gw-rank-guard-only {
  background: rgba(56, 189, 248, 0.06);
  border: 1px dashed rgba(56, 189, 248, 0.2);
}

.gw-rank-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.gw-rank-idx {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75em;
  font-weight: 700;
  flex-shrink: 0;
}
.gw-rank-idx--1 {
  background: #fbbf24;
  color: #1a1a2e;
}
.gw-rank-idx--2 {
  background: #cbd5e1;
  color: #1a1a2e;
}
.gw-rank-idx--3 {
  background: #d97706;
  color: #ffffff;
}
.gw-rank-idx--n {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
}
.gw-rank-guard-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85em;
  flex-shrink: 0;
}

.gw-avatar-wrap {
  position: relative;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
.gw-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.gw-online-dot {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #94a3b8;
  border: 1.5px solid var(--gw-window-bg-color);
}
.gw-online-dot.online {
  background: #22c55e;
  box-shadow: 0 0 4px #22c55e;
}

.gw-user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.gw-user-name-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.gw-rank-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.gw-guard-tag {
  font-size: 0.65em;
  padding: 0 4px;
  border-radius: 4px;
  font-weight: 700;
  line-height: 1.4;
  flex-shrink: 0;
}
.gw-guard-tag--1 {
  background: #dc2626;
  color: #fff;
} /* 总督 */
.gw-guard-tag--2 {
  background: #f59e0b;
  color: #1a1a2e;
} /* 提督 */
.gw-guard-tag--3 {
  background: #38bdf8;
  color: #1a1a2e;
} /* 舰长 */
.gw-guard-tag--badge {
  font-size: 0.72em;
  padding: 2px 6px;
  border-radius: 6px;
}

.gw-sub-info {
  font-size: 0.7em;
  color: rgba(255, 255, 255, 0.45);
}

.gw-rank-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 8px;
}
.gw-rank-score {
  font-weight: 600;
  color: var(--gw-highlight-color);
  font-size: 0.9em;
}
.gw-online-badge {
  font-size: 0.72em;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  padding: 0 5px;
  border-radius: 10px;
}

.gw-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 14px;
  height: 14px;
  cursor: se-resize;
  -webkit-app-region: no-drag;
}
.gw-resize::after {
  content: '';
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 6px;
  height: 6px;
  border-right: 2px solid rgba(255, 255, 255, 0.3);
  border-bottom: 2px solid rgba(255, 255, 255, 0.3);
}

/* 动效 */
.gw-anim-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.gw-anim-leave-active {
  transition: all 0.25s ease-in;
}
.gw-anim-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}
.gw-anim-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
