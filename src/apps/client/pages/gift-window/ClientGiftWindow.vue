<script setup lang="ts">
import type { GiftEntry, GiftWindowBCData, GiftWindowSettings, RankEntry } from '@/apps/client/store/useGiftWindow'
import { NSpin } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { EventDataTypes, GuardLevel } from '@/api/api-models'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { GIFT_WINDOW_BROADCAST_CHANNEL } from '@/apps/client/store/useGiftWindow'

let bc: BroadcastChannel | undefined
const setting = ref<GiftWindowSettings>()
const giftList = ref<GiftEntry[]>([])
const rankList = ref<RankEntry[]>([])
const hasContent = computed(() => giftList.value.length > 0 || rankList.value.length > 0)

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
    case GuardLevel.Zongdu: return '总督'
    case GuardLevel.Tidu: return '提督'
    case GuardLevel.Jianzhang: return '舰长'
    default: return ''
  }
}

async function startResize() {
  const win = getCurrentWindow()
  await win.startResizeDragging('SouthEast')
}

function formatRankScore(score: number): string {
  if (score >= 100000) return `${(score / 1000).toFixed(0)}k`
  if (score >= 1000) return `${(score / 1000).toFixed(1)}k`
  return `${score}`
}

onMounted(() => {
  bc = new BroadcastChannel(GIFT_WINDOW_BROADCAST_CHANNEL)
  bc.postMessage({ type: 'window-ready' })
  bc.onmessage = (event) => {
    const data = event.data as GiftWindowBCData
    switch (data.type) {
      case 'gift-list': giftList.value = data.data; break
      case 'rank-list': rankList.value = data.data; break
      case 'update-setting': setting.value = data.data; updateCssVariables(); break
      case 'clear': giftList.value = []; rankList.value = []; break
    }
  }
  updateCssVariables()
  onUnmounted(() => { bc?.close(); bc = undefined })
})

watch(() => setting.value, () => updateCssVariables(), { deep: true })
</script>

<template>
  <NSpin v-if="!setting" show />
  <div v-else class="gw" :class="{ compact: setting.compactMode }">
    <div class="gw-header">
      <span class="gw-header__title">礼物与排行</span>
    </div>
    <div class="gw-body">
      <!-- 礼物列表 -->
      <template v-if="setting.showGiftList">
        <TransitionGroup v-if="giftList.length > 0" name="gw-anim" tag="div" class="gw-list">
          <div
            v-for="item in giftList"
            :key="item.id"
            class="gw-item"
            :class="{ 'gw-item--sc': item.type === EventDataTypes.SC, 'gw-item--guard': item.type === EventDataTypes.Guard }"
          >
            <div class="gw-item__icon">
              <img v-if="item.giftIcon" :src="item.giftIcon" class="gw-item__gift-img" alt="">
              <div v-else-if="item.type === EventDataTypes.SC" class="gw-item__type-icon gw-item__type-icon--sc">SC</div>
              <div v-else-if="item.type === EventDataTypes.Guard" class="gw-item__type-icon gw-item__type-icon--guard">{{ getGuardLabel(item.guardLevel).charAt(0) }}</div>
              <div v-else class="gw-item__type-icon gw-item__type-icon--gift">礼</div>
            </div>
            <div class="gw-item__body">
              <div class="gw-item__top">
                <span class="gw-item__name">{{ item.uname }}</span>
                <span v-if="setting.showTime" class="gw-item__time">{{ getTimeDiff(item.firstTime) }}</span>
              </div>
              <div class="gw-item__bottom">
                <span class="gw-item__gift">{{ item.giftName }}</span>
                <span v-if="item.totalNum > 1" class="gw-item__num">×{{ item.totalNum }}</span>
              </div>
            </div>
            <div v-if="setting.showPrice && item.totalPrice > 0" class="gw-item__price">
              {{ formatPrice(item.totalPrice) }}
            </div>
          </div>
        </TransitionGroup>
      </template>
      <!-- 排行榜 -->
      <template v-if="setting.showRanking && rankList.length > 0">
        <div v-if="setting.showGiftList && giftList.length > 0" class="gw-divider" />
        <div class="gw-rank-header">排行榜</div>
        <div class="gw-rank-list">
          <div v-for="(r, idx) in rankList" :key="r.uid" class="gw-rank-item" :class="{ 'gw-rank-top': idx < 3 }">
            <span class="gw-rank-idx" :class="`gw-rank-idx--${idx < 3 ? idx + 1 : 'n'}`">{{ idx + 1 }}</span>
            <span class="gw-rank-name">{{ r.uname }}</span>
            <span class="gw-rank-score">{{ formatRankScore(r.score) }}</span>
          </div>
        </div>
      </template>
      <div v-if="!hasContent" class="gw-empty">等待中...</div>
    </div>
    <div class="gw-resize" @mousedown="startResize" />
  </div>
</template>

<style>
html, body { background: transparent; overflow: hidden; margin: 0; }
html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
* { scrollbar-width: none; }
*::-webkit-scrollbar { display: none; }
.n-layout { background: transparent; }
.n-layout-content { overflow: hidden !important; background: transparent !important; }
.n-element { background: transparent !important; }

:root {
  --gw-bg-color: rgba(20,20,30,0.85);
  --gw-window-bg-color: rgba(10,10,20,0.6);
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
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  border-radius: var(--gw-border-radius);
  border: 1px solid rgba(255,255,255,0.1);
  background: var(--gw-window-bg-color);
  backdrop-filter: blur(16px);
  color: var(--gw-text-color);
  font-size: var(--gw-font-size);
  opacity: var(--gw-opacity);
  overflow: hidden;
  -webkit-app-region: drag;
}

.gw-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.gw-header__title { font-weight: 600; font-size: 0.85em; opacity: 0.6; letter-spacing: 1px; text-transform: uppercase; }
.gw-header__count { font-size: 0.75em; opacity: 0.4; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 10px; }

.gw-body { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 8px; scrollbar-width: none; }
.gw-body::-webkit-scrollbar { display: none; }
.gw-empty { text-align: center; opacity: 0.3; padding: 20px; font-size: 0.9em; }
.gw-list { display: flex; flex-direction: column; gap: var(--gw-item-spacing); }

.gw-item {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  background: var(--gw-bg-color);
  border-radius: var(--gw-border-radius);
  border-left: 3px solid #34d399;
  will-change: transform, opacity;
}
.compact .gw-item { padding: 6px 10px; gap: 8px; }
.gw-item--sc { border-left-color: #f59e0b; background: linear-gradient(135deg, rgba(245,158,11,0.12) 0%, var(--gw-bg-color) 50%); }
.gw-item--guard { border-left-color: #a78bfa; background: linear-gradient(135deg, rgba(167,139,250,0.12) 0%, var(--gw-bg-color) 50%); }

.gw-item__icon { flex-shrink: 0; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.compact .gw-item__icon { width: 24px; height: 24px; }
.gw-item__gift-img { width: 100%; height: 100%; object-fit: contain; border-radius: 4px; }
.gw-item__type-icon {
  width: 100%; height: 100%; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.7em; font-weight: 700; color: #fff;
}
.gw-item__type-icon--gift { background: linear-gradient(135deg, #34d399, #059669); }
.gw-item__type-icon--sc { background: linear-gradient(135deg, #fbbf24, #d97706); }
.gw-item__type-icon--guard { background: linear-gradient(135deg, #a78bfa, #7c3aed); }

.gw-item__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.gw-item__top { display: flex; align-items: center; gap: 6px; }
.gw-item__name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
.gw-item__time { font-size: 0.75em; opacity: 0.4; flex-shrink: 0; }
.gw-item__bottom { display: flex; align-items: center; gap: 4px; opacity: 0.75; font-size: 0.9em; }
.gw-item__gift { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gw-item__num { opacity: 0.7; }

.gw-item__price { font-weight: 700; color: var(--gw-highlight-color); font-size: 1.05em; flex-shrink: 0; white-space: nowrap; }

.gw-anim-move { transition: transform 300ms cubic-bezier(0.2, 0, 0, 1); }
.gw-anim-enter-active { transition: transform 300ms cubic-bezier(0.2, 0, 0, 1), opacity 250ms ease; }
.gw-anim-leave-active { transition: transform 300ms cubic-bezier(0.2, 0, 0, 1), opacity 250ms ease; position: absolute; width: calc(100% - 16px); }
.gw-anim-enter-from { opacity: 0; transform: translateY(-10px) scale(0.96); }
.gw-anim-leave-to { opacity: 0; transform: translateX(16px) scale(0.96); }

.gw-resize {
  position: absolute; bottom: 0; right: 0;
  width: 16px; height: 16px;
  cursor: nwse-resize;
  -webkit-app-region: no-drag;
  z-index: 10;
}
.gw-resize::after {
  content: '';
  position: absolute; bottom: 4px; right: 4px;
  width: 8px; height: 8px;
  border-right: 2px solid rgba(255,255,255,0.2);
  border-bottom: 2px solid rgba(255,255,255,0.2);
}
.gw-resize:hover::after {
  border-color: rgba(255,255,255,0.5);
}

.gw-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 8px 0; }
.gw-rank-header { font-size: 0.8em; font-weight: 600; opacity: 0.5; padding: 4px 0 6px; letter-spacing: 0.5px; }
.gw-rank-list { display: flex; flex-direction: column; gap: 3px; }
.gw-rank-item { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 6px; background: rgba(255,255,255,0.03); }
.gw-rank-top { background: rgba(255,255,255,0.06); }
.gw-rank-idx { width: 18px; text-align: center; font-weight: 600; font-size: 0.85em; opacity: 0.5; }
.gw-rank-idx--1 { color: #ffd700; opacity: 1; }
.gw-rank-idx--2 { color: #c0c0c0; opacity: 1; }
.gw-rank-idx--3 { color: #cd7f32; opacity: 1; }
.gw-rank-name { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9em; }
.gw-rank-score { font-weight: 600; color: var(--gw-highlight-color); font-size: 0.9em; flex-shrink: 0; }
</style>