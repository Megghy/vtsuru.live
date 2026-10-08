<script setup lang="ts">
import {
  Eye20Regular,
  LockClosed20Regular,
  LockOpen20Regular,
  Payment20Regular,
  PeopleCommunity20Regular,
  ThumbLike20Regular,
} from '@vicons/fluent'
import { NIcon, NSpin } from 'naive-ui'
import { nanoid } from 'nanoid'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import type { EventModel } from '@/api/api-models'
import { EventDataTypes, GuardLevel } from '@/api/api-models'
import ClientDanmakuItem from '@/apps/client/components/danmaku/ClientDanmakuItem.vue'
import type { DanmakuWindowBCData, DanmakuWindowSettings, LiveStatsData } from '@/apps/client/store/useDanmakuWindow'
import { DANMAKU_WINDOW_BROADCAST_CHANNEL } from '@/apps/client/store/useDanmakuWindow'
import { postBroadcastMessage } from '@/shared/utils/broadcastChannel'
import { getDanmakuWindowFilterType, removeDeletedSuperChats } from '@/shared/utils/danmakuWindowEvents'
// 添加TransitionGroup导入

type TempDanmakuType = EventModel & {
  randomId: string
  disappearAt?: number // 消失时间戳
  timestamp?: number // 添加：记录插入时间戳
}

interface ParsedColor {
  rgb: string
  alpha: number
}

function parseColorToRgba(color?: string): ParsedColor | null {
  if (!color) return null
  const value = color.trim()

  const rgbaMatch = value.match(/^rgba?\(([^)]+)\)$/i)
  if (rgbaMatch) {
    const parts = rgbaMatch[1].split(',').map((part) => part.trim())
    if (parts.length >= 3) {
      const r = Number(parts[0])
      const g = Number(parts[1])
      const b = Number(parts[2])
      const a = parts[3] !== undefined ? Number(parts[3]) : 1
      return {
        rgb: `${Number.isFinite(r) ? r : 0}, ${Number.isFinite(g) ? g : 0}, ${Number.isFinite(b) ? b : 0}`,
        alpha: Number.isFinite(a) ? Math.max(0, Math.min(1, a)) : 1,
      }
    }
    return null
  }

  if (value.startsWith('#')) {
    const hex = value.slice(1)
    const normalizeHex = (segment: string) => (segment.length === 1 ? segment + segment : segment)
    let r = 0
    let g = 0
    let b = 0
    let a = 255

    if (hex.length === 3 || hex.length === 4) {
      r = Number.parseInt(normalizeHex(hex[0]), 16)
      g = Number.parseInt(normalizeHex(hex[1]), 16)
      b = Number.parseInt(normalizeHex(hex[2]), 16)
      if (hex.length === 4) {
        a = Number.parseInt(normalizeHex(hex[3]), 16)
      }
    } else if (hex.length === 6 || hex.length === 8) {
      r = Number.parseInt(hex.slice(0, 2), 16)
      g = Number.parseInt(hex.slice(2, 4), 16)
      b = Number.parseInt(hex.slice(4, 6), 16)
      if (hex.length === 8) {
        a = Number.parseInt(hex.slice(6, 8), 16)
      }
    } else {
      return null
    }

    if ([r, g, b, a].some((component) => Number.isNaN(component))) {
      return null
    }

    return {
      rgb: `${r}, ${g}, ${b}`,
      alpha: Math.max(0, Math.min(1, a / 255)),
    }
  }

  return null
}

let bc: BroadcastChannel | undefined
let checkInterval: ReturnType<typeof setInterval> | undefined
const setting = ref<DanmakuWindowSettings>()
const danmakuList = ref<TempDanmakuType[]>([])
const pendingDanmakuQueue = ref<TempDanmakuType[]>([]) // 新增：待处理弹幕队列
const isUpdateScheduled = ref(false) // 新增：是否已安排更新
const maxItems = computed(() => setting.value?.maxDanmakuCount || 50)
const hasItems = computed(() => danmakuList.value.length > 0)
const isInBatchUpdate = ref(false) // 添加批量更新状态标志

// 实时统计状态
const liveStats = ref<LiveStatsData>({
  watchedCount: 0,
  likeCount: 0,
  totalIncome: 0,
  onlineCount: 0,
})

function toggleInteractive() {
  if (!bc) return
  postBroadcastMessage(bc, {
    type: 'toggle-interactive',
  })
}

function formatStatCount(num: number): string {
  if (!num || num <= 0) return '0'
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1).replace(/\.0$/, '')}w`
  }
  return num.toLocaleString()
}

function formatIncomeDisplay(amount: number): string {
  if (!amount || amount <= 0) return '0'
  return amount % 1 === 0 ? String(amount) : amount.toFixed(1)
}

const hasVisibleStats = computed(() => {
  if (!setting.value) return false
  const s = setting.value
  return (
    s.showWatchedCount !== false ||
    s.showLikeCount !== false ||
    s.showIncome !== false ||
    s.showOnlineCount !== false
  )
})

// 动态设置CSS变量
function updateCssVariables() {
  if (!setting.value) return

  const root = document.documentElement
  root.style.setProperty('--dw-direction', setting.value.reverseOrder ? 'column-reverse' : 'column')
  root.style.setProperty('--dw-enter-offset-y', setting.value.reverseOrder ? '8px' : '-8px')
  root.style.setProperty('--dw-leave-offset-y', setting.value.reverseOrder ? '-8px' : '8px')
  root.style.setProperty('--dw-enter-offset-x', '18px')
  root.style.setProperty('--dw-leave-offset-x', '14px')

  // 背景和文字颜色
  const bgColor = setting.value.backgroundColor || 'rgba(0,0,0,0.6)'
  root.style.setProperty('--dw-bg-color', bgColor)
  const parsedColor = parseColorToRgba(bgColor)
  if (parsedColor) {
    root.style.setProperty('--dw-bg-color-rgb', parsedColor.rgb)
    root.style.setProperty('--dw-bg-alpha', `${parsedColor.alpha}`)
  } else {
    root.style.setProperty('--dw-bg-color-rgb', '0, 0, 0')
    root.style.setProperty('--dw-bg-alpha', '0.6')
  }
  root.style.setProperty('--dw-window-bg-color', setting.value.windowBackgroundColor || 'transparent')
  root.style.setProperty('--dw-text-color', setting.value.textColor || '#ffffff')

  // 尺寸相关
  root.style.setProperty('--dw-border-radius', `${setting.value.borderRadius || 0}px`)
  root.style.setProperty('--dw-opacity', `${setting.value.opacity || 1}`)
  root.style.setProperty('--dw-font-size', `${setting.value.fontSize || 14}px`)
  root.style.setProperty('--dw-avatar-size', `${(setting.value.fontSize || 14) + 6}px`)
  root.style.setProperty('--dw-emoji-size', `${(setting.value.fontSize || 14) + 10}px`)
  root.style.setProperty('--dw-item-spacing', `${setting.value.itemSpacing || 5}px`)

  // 动画和阴影
  root.style.setProperty('--dw-animation-duration', `${setting.value.animationDuration || 300}ms`)
  root.style.setProperty('--dw-shadow', setting.value.enableShadow ? `0 0 10px ${setting.value.shadowColor}` : 'none')

  // 根据 enableAnimation 设置 data-animation-disabled 属性
  if (setting.value.enableAnimation) {
    root.removeAttribute('data-animation-disabled')
  } else {
    root.setAttribute('data-animation-disabled', 'true')
  }
}

// 新增：处理批量更新
function processBatchUpdate() {
  if (pendingDanmakuQueue.value.length === 0) {
    isUpdateScheduled.value = false
    return
  }

  isInBatchUpdate.value = true // 开始批量更新

  try {
    const itemsToAdd = pendingDanmakuQueue.value.slice() // 复制队列
    pendingDanmakuQueue.value = [] // 清空队列

    // 将新弹幕添加到列表开头
    danmakuList.value.unshift(...itemsToAdd)

    // 优化超出长度的弹幕处理
    if (danmakuList.value.length > maxItems.value) {
      danmakuList.value.splice(maxItems.value, danmakuList.value.length - maxItems.value)
    }
  } finally {
    isUpdateScheduled.value = false

    // 在下一帧 DOM 更新后结束批量更新状态
    nextTick(() => {
      isInBatchUpdate.value = false
    })
  }
}

// 新增：安排批量更新
function scheduleBatchUpdate() {
  if (!isUpdateScheduled.value) {
    isUpdateScheduled.value = true
    requestAnimationFrame(processBatchUpdate)
  }
}

function addDanmaku(data: EventModel) {
  if (!setting.value) return

  if (data.type === EventDataTypes.SCDel) {
    danmakuList.value = removeDeletedSuperChats(danmakuList.value, data)
    pendingDanmakuQueue.value = removeDeletedSuperChats(pendingDanmakuQueue.value, data)
    return
  }

  const typeStr = getDanmakuWindowFilterType(data.type)

  // Check if the type should be filtered out
  if (!typeStr || !setting.value.filterTypes.includes(typeStr)) {
    return // Don't add if filtered
  }

  // 计算消失时间
  let disappearAt: number | undefined
  if (setting.value.autoDisappearTime > 0) {
    disappearAt = Date.now() + setting.value.autoDisappearTime * 1000
  }

  // 为传入的弹幕对象添加一个随机ID和时间戳
  const dataWithId: TempDanmakuType = {
    ...data,
    randomId: nanoid(),
    disappearAt,
    timestamp: Date.now(),
  }

  // 将弹幕添加到待处理队列，并安排批量更新
  pendingDanmakuQueue.value.push(dataWithId)
  scheduleBatchUpdate()

  // console.log('[DanmakuWindow] 添加弹幕到队列:', dataWithId);
}

// 检查和移除过期弹幕 - 优化为 filter
function checkAndRemoveExpiredDanmaku() {
  if (!setting.value || setting.value.autoDisappearTime <= 0 || danmakuList.value.length === 0) return

  const now = Date.now()

  danmakuList.value = danmakuList.value.filter((item) => {
    // 如果没有 disappearAt 或 disappearAt 在未来，则保留
    return !item.disappearAt || item.disappearAt > now
  })

  // 如果有弹幕被移除，可以考虑触发一次批量状态（可选，取决于是否需要移除动画也加速）
  // if (danmakuList.value.length < originalLength) {
  //   isInBatchUpdate.value = true;
  //   nextTick(() => {
  //     isInBatchUpdate.value = false;
  //   });
  // }
}

onMounted(() => {
  bc = new BroadcastChannel(DANMAKU_WINDOW_BROADCAST_CHANNEL)
  console.log(`[DanmakuWindow] BroadcastChannel 已创建: ${DANMAKU_WINDOW_BROADCAST_CHANNEL}`)
  postBroadcastMessage(bc, {
    type: 'window-ready',
  })
  bc.onmessage = (event) => {
    const data = event.data as DanmakuWindowBCData
    switch (data.type) {
      case 'danmaku':
        addDanmaku(data.data)
        break
      case 'test-danmaku': // 处理测试弹幕
        addDanmaku(data.data)
        break
      case 'update-setting':
        setting.value = data.data
        updateCssVariables()
        console.log('[DanmakuWindow] 设置已更新:', data.data)
        break
      case 'live-stats': // 接收实时统计数据
        liveStats.value = { ...data.data }
        break
      case 'clear-danmaku': // 处理清空弹幕
        danmakuList.value = []
        console.log('[DanmakuWindow] 弹幕已清空')
        break
    }
  }

  // 初始化CSS变量
  updateCssVariables()

  // 启动定时器，定期检查过期弹幕
  checkInterval = setInterval(checkAndRemoveExpiredDanmaku, 1000)
})

onUnmounted(() => {
  if (bc) {
    bc.close()
    bc = undefined
  }
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = undefined
  }
})

// 监听设置变化
watch(
  () => setting.value,
  () => {
    updateCssVariables()
  },
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
    class="danmaku-window"
    :class="{
      'has-items': hasItems,
      'has-status-bar': setting.showStatusBar !== false && hasVisibleStats,
      'batch-update': isInBatchUpdate,
    }"
  >
    <div class="danmaku-window-bg" />

    <!-- 顶部实时数据状态栏 (类似哔哩哔哩弹幕机互动面板) -->
    <div
      v-if="setting.showStatusBar !== false && hasVisibleStats"
      class="danmaku-status-bar"
    >
      <div class="danmaku-status-items">
        <!-- 观看人数 -->
        <div
          v-if="setting.showWatchedCount !== false"
          class="status-pill"
          title="累计观看/在看人数"
        >
          <NIcon
            :component="Eye20Regular"
            class="status-icon"
          />
          <span class="status-value">{{ formatStatCount(liveStats.watchedCount) }}</span>
        </div>

        <!-- 点赞数 -->
        <div
          v-if="setting.showLikeCount !== false"
          class="status-pill"
          title="本场点赞互动数"
        >
          <NIcon
            :component="ThumbLike20Regular"
            class="status-icon"
          />
          <span class="status-value">{{ formatStatCount(liveStats.likeCount) }}</span>
        </div>

        <!-- 收益金额 (由客户端设置决定是否显示与脱敏) -->
        <div
          v-if="setting.showIncome !== false"
          class="status-pill"
          :title="setting.hideIncomeAmount ? '本场收益（已脱敏隐藏）' : `本场收益：¥${liveStats.totalIncome.toFixed(1)}`"
        >
          <NIcon
            :component="Payment20Regular"
            class="status-icon"
          />
          <span class="status-value">¥ {{ setting.hideIncomeAmount ? '***' : formatIncomeDisplay(liveStats.totalIncome) }}</span>
        </div>

        <!-- 在线人数 -->
        <div
          v-if="setting.showOnlineCount !== false"
          class="status-pill"
          title="当前在场活跃人数"
        >
          <NIcon
            :component="PeopleCommunity20Regular"
            class="status-icon"
          />
          <span class="status-value">{{ formatStatCount(liveStats.onlineCount) }} 在线</span>
        </div>
      </div>

      <!-- Mini 穿透切换按钮 (锁定/解锁) -->
      <button
        type="button"
        class="status-mini-btn"
        :class="{ 'is-locked': setting.interactive }"
        :title="setting.interactive ? '鼠标穿透：已开启（点击关闭穿透）' : '鼠标穿透：已关闭（点击开启穿透）'"
        @click="toggleInteractive"
      >
        <NIcon
          :component="setting.interactive ? LockClosed20Regular : LockOpen20Regular"
          class="mini-btn-icon"
        />
      </button>
    </div>

    <div class="danmaku-list">
      <!-- 使用TransitionGroup替代普通div -->
      <TransitionGroup
        name="danmaku-list"
        tag="div"
        class="danmaku-list-container"
      >
        <ClientDanmakuItem
          v-for="item in danmakuList"
          :key="item.randomId"
          :item="item"
          :setting="setting"
          :data-type="item.type"
          class="danmaku-item"
          :class="[{ 'batch-item': isInBatchUpdate }]"
        />
      </TransitionGroup>
    </div>
  </div>
</template>

<style>
html,
body {
  background: transparent;
  overflow: hidden;
}

.n-layout {
  background: transparent;
}

:root {
  --dw-bg-color: rgba(0, 0, 0, 0.6);
  --dw-bg-color-rgb: 0, 0, 0;
  --dw-bg-alpha: 0.6;
  --dw-window-bg-color: transparent;
  --dw-text-color: #ffffff;
  --dw-border-radius: 0px;
  --dw-opacity: 1;
  --dw-font-size: 14px;
  --dw-avatar-size: 20px;
  --dw-emoji-size: 24px;
  --dw-item-spacing: 5px;
  --dw-animation-duration: 300ms;
  --dw-enter-offset-x: 18px;
  --dw-enter-offset-y: -8px;
  --dw-leave-offset-x: 14px;
  --dw-leave-offset-y: 8px;
  --dw-shadow: none;
}

.danmaku-window {
  position: relative;
  -webkit-app-region: drag;
  overflow: hidden;
  width: 100%;
  height: 100%;
  border-radius: var(--dw-border-radius, 0);
  color: var(--dw-text-color);
  font-size: var(--dw-font-size);
  box-shadow: var(--dw-shadow);
  overflow-x: hidden;
  transition: opacity 0.3s ease;
}

.danmaku-window-bg {
  position: absolute;
  inset: 0;
  border-radius: var(--dw-border-radius, 0);
  background-color: var(--dw-window-bg-color, transparent);
  backdrop-filter: blur(0);
  pointer-events: none;
}

/* 没有弹幕且未启用状态栏时完全透明 */
.danmaku-window:not(.has-items):not(.has-status-bar) {
  opacity: 0;
}

.danmaku-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  margin: 6px 8px 2px 8px;
  background: var(--dw-bg-color, rgba(0, 0, 0, 0.6));
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: calc(var(--dw-border-radius, 8px) * 0.75 + 2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: calc(var(--dw-font-size, 14px) * 0.88);
  line-height: 1.2;
  color: var(--dw-text-color, #ffffff);
  user-select: none;
  -webkit-app-region: drag;
  box-sizing: border-box;
  flex-shrink: 0;
}

.danmaku-status-items {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  opacity: 0.92;
  transition: opacity 0.2s ease;
}

.status-pill:hover {
  opacity: 1;
}

.status-icon {
  font-size: 1.15em;
  opacity: 0.85;
}

.status-value {
  font-weight: 500;
  letter-spacing: 0.2px;
}

.status-mini-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 4px;
  border: none;
  background: rgba(255, 255, 255, 0.12);
  color: inherit;
  cursor: pointer;
  opacity: 0.75;
  transition: all 0.2s ease;
  -webkit-app-region: no-drag;
}

.status-mini-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.25);
}

.status-mini-btn.is-locked {
  background: rgba(96, 165, 250, 0.25);
  color: #60a5fa;
  opacity: 0.95;
}

.mini-btn-icon {
  font-size: 13px;
}

.danmaku-list {
  padding: 8px;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: var(--dw-direction);
  box-sizing: border-box;
}

.danmaku-list-container {
  width: 100%;
  display: flex;
  flex-direction: inherit;
  gap: var(--dw-item-spacing);
  position: relative;
  padding-bottom: 8px;
}

.danmaku-list.reverse {
  flex-direction: column-reverse;
}

.danmaku-list::-webkit-scrollbar {
  width: 4px;
}

.danmaku-list::-webkit-scrollbar-track {
  background: transparent;
}

.danmaku-list::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

/* 批量更新模式下的优化 */
.batch-update .danmaku-list-move {
  transition-duration: 160ms !important;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.batch-item {
  transition-duration: 160ms !important;
}

/* 动画相关样式 - 根据 enableAnimation 设置应用 */
.danmaku-list-move {
  transition: transform var(--dw-animation-duration) cubic-bezier(0.2, 0, 0, 1);
}

.danmaku-list-enter-active {
  transition:
    transform var(--dw-animation-duration) cubic-bezier(0.2, 0, 0, 1),
    opacity calc(var(--dw-animation-duration) * 0.8) cubic-bezier(0.2, 0, 0, 1);
  transition-delay: var(--transition-delay, 0s);
}

.danmaku-list-leave-active {
  transition:
    transform var(--dw-animation-duration) cubic-bezier(0.2, 0, 0, 1),
    opacity calc(var(--dw-animation-duration) * 0.8) cubic-bezier(0.2, 0, 0, 1);
}

/* 当禁用动画时应用的样式 */
:root[data-animation-disabled='true'] .danmaku-list-move,
:root[data-animation-disabled='true'] .danmaku-list-enter-active,
:root[data-animation-disabled='true'] .danmaku-list-leave-active {
  transition: none !important;
  animation: none !important;
}

.danmaku-list-enter-from,
.danmaku-list-leave-to {
  opacity: 0;
  transform: translate3d(var(--dw-enter-offset-x), var(--dw-enter-offset-y), 0) scale(0.98);
}

.danmaku-list-leave-to {
  transform: translate3d(var(--dw-leave-offset-x), var(--dw-leave-offset-y), 0) scale(0.98);
}

/* 3. ensure leaving items are taken out of layout flow so that moving
      animations can be calculated correctly. */
.danmaku-list-leave-active {
  position: absolute;
  width: 100%;
}

/* 根据弹幕类型提供不同的动画特性 */
[data-type='3'] {
  /* 普通弹幕 */
  --transition-delay: 0ms;
}

[data-type='2'] {
  /* 礼物 */
  --transition-delay: 15ms;
}

[data-type='1'] {
  /* SC */
  --transition-delay: 25ms;
}

.danmaku-item {
  /* 添加 will-change 提示浏览器进行优化 */
  will-change: transform, opacity;
}

@media (prefers-reduced-motion: reduce) {
  .danmaku-list-move,
  .danmaku-list-enter-active,
  .danmaku-list-leave-active {
    transition: none !important;
  }
}
</style>
