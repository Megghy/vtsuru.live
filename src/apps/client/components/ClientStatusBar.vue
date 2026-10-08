<script setup lang="ts">
import {
  Board20Regular,
  Chat20Regular,
  Eye20Regular,
  Gift20Regular,
  Payment20Regular,
  PeopleCommunity20Regular,
  PlugConnected20Regular,
  ThumbLike20Regular,
} from '@vicons/fluent'
import { NButton, NDivider, NFlex, NIcon, NTag, NText, NTooltip } from 'naive-ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useFetcherRpcServer } from '@/store/useFetcherRpcServer'
import { useWebFetcher } from '@/store/useWebFetcher'

const router = useRouter()
const danmakuClient = useDanmakuClient()
const danmakuWindow = useDanmakuWindow()
const giftWindow = useGiftWindow()
const webfetcher = useWebFetcher()
const rpcServer = useFetcherRpcServer()

const liveStats = computed(() => danmakuWindow.liveStats)
const isIncomeHidden = computed(() => danmakuWindow.danmakuWindowSetting.hideIncomeAmount)

// 弹幕源连接文案
const danmakuStatusText = computed(() => {
  if (danmakuClient.phase === 'connected' || danmakuClient.hasRemoteSource) {
    if (danmakuClient.sourceType === 'direct') return '弹幕直连'
    if (danmakuClient.sourceType === 'openlive') return '开放平台'
    return '弹幕已连接'
  }
  if (danmakuClient.phase === 'connecting') return '连接弹幕中...'
  return '弹幕未连接'
})

const isDanmakuConnected = computed(() => {
  return danmakuClient.phase === 'connected' || danmakuClient.hasRemoteSource
})

function formatStatCount(num: number): string {
  if (!num || num <= 0) return '0'
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1).replace(/\.0$/, '')}w`
  }
  return num.toLocaleString()
}

function formatIncome(amount: number): string {
  if (!amount || amount <= 0) return '0'
  return amount % 1 === 0 ? String(amount) : amount.toFixed(1)
}

function goToDashboard() {
  router.push({ name: 'client-live-dashboard' })
}

function goToFetcher() {
  router.push({ name: 'client-fetcher' })
}

function toggleDanmakuWindow() {
  if (danmakuWindow.isDanmakuWindowOpen) {
    danmakuWindow.closeWindow()
  } else {
    danmakuWindow.openWindow()
  }
}

function toggleGiftWindow() {
  if (giftWindow.isWindowOpened) {
    giftWindow.closeWindow()
  } else {
    giftWindow.openWindow()
  }
}
</script>

<template>
  <footer class="client-status-bar">
    <!-- 左侧：连接与采集源状态 -->
    <div class="status-bar-section status-bar-section--left">
      <!-- 弹幕源连接状态 -->
      <NTooltip placement="top-start">
        <template #trigger>
          <div
            class="status-badge"
            :class="{ 'is-connected': isDanmakuConnected, 'is-disconnected': !isDanmakuConnected }"
            @click="goToFetcher"
          >
            <span
              class="status-indicator-dot"
              :class="{ pulse: isDanmakuConnected }"
            />
            <span class="status-badge-text">{{ danmakuStatusText }}</span>
          </div>
        </template>
        <div>
          <div><strong>弹幕连接状态：{{ danmakuClient.connectionStatus }}</strong></div>
          <div style="font-size: 11px; opacity: 0.85">
            {{ isDanmakuConnected ? '正在实时接收直播间事件流' : '点击前往 EventFetcher / 弹幕设置' }}
          </div>
        </div>
      </NTooltip>

      <!-- EventFetcher 服务状态 -->
      <NTooltip placement="top">
        <template #trigger>
          <div
            class="status-item-clickable"
            @click="goToFetcher"
          >
            <span
              class="mini-dot"
              :style="{ background: webfetcher.state === 'connected' ? 'var(--vtsuru-success, #10b981)' : 'var(--vtsuru-fg-muted, #9ca3af)' }"
            />
            <span class="status-text-subtle">上报服务</span>
          </div>
        </template>
        <div>EventFetcher 服务：{{ webfetcher.state === 'connected' ? '运行中' : '未连接' }}</div>
      </NTooltip>

      <!-- 本地 RPC 外部接入状态 -->
      <NTooltip
        v-if="rpcServer.running && rpcServer.connectionCount > 0"
        placement="top"
      >
        <template #trigger>
          <div class="status-badge status-badge--rpc">
            <NIcon
              :component="PlugConnected20Regular"
              class="badge-icon"
            />
            <span>{{ rpcServer.connectionCount }} 外部接入</span>
          </div>
        </template>
        <div>已有 {{ rpcServer.connectionCount }} 个外部网页/OBS 正在通过本地 RPC 订阅弹幕</div>
      </NTooltip>
    </div>

    <!-- 中间：实时直播互动数据指标 (点击可一键前往中控台) -->
    <div
      class="status-bar-section status-bar-section--center"
      title="点击前往「中控台」查看全景大盘"
      @click="goToDashboard"
    >
      <NFlex
        align="center"
        :size="14"
        class="stats-flex"
      >
        <!-- 观看/在看人数 -->
        <div
          class="stat-chip"
          title="累计观看/在看人数"
        >
          <NIcon
            :component="Eye20Regular"
            class="stat-chip-icon"
          />
          <span class="stat-chip-value">{{ formatStatCount(liveStats.watchedCount) }}</span>
        </div>

        <!-- 点赞互动数 -->
        <div
          class="stat-chip"
          title="本场观众点赞互动数"
        >
          <NIcon
            :component="ThumbLike20Regular"
            class="stat-chip-icon"
          />
          <span class="stat-chip-value">{{ formatStatCount(liveStats.likeCount) }}</span>
        </div>

        <!-- 实时在线人数 -->
        <div
          class="stat-chip"
          title="当前在场活跃观众数"
        >
          <NIcon
            :component="PeopleCommunity20Regular"
            class="stat-chip-icon"
          />
          <span class="stat-chip-value">{{ formatStatCount(liveStats.onlineCount) }} 在线</span>
        </div>

        <!-- 本场总收益 -->
        <div
          class="stat-chip stat-chip--income"
          title="本场总收益（打赏 + SC + 大航海）"
        >
          <NIcon
            :component="Payment20Regular"
            class="stat-chip-icon"
          />
          <span class="stat-chip-value">¥ {{ isIncomeHidden ? '***' : formatIncome(liveStats.totalIncome) }}</span>
        </div>

        <NIcon
          :component="Board20Regular"
          class="stat-jump-icon"
          title="进入中控台"
        />
      </NFlex>
    </div>

    <!-- 右侧：浮窗快捷状态与一键开关 -->
    <div class="status-bar-section status-bar-section--right">
      <!-- 弹幕机浮窗开关 -->
      <button
        type="button"
        class="float-window-toggle-btn"
        :class="{ 'is-active': danmakuWindow.isDanmakuWindowOpen }"
        :title="danmakuWindow.isDanmakuWindowOpen ? '弹幕浮窗运行中 (点击关闭)' : '弹幕浮窗已关闭 (点击打开)'"
        @click="toggleDanmakuWindow"
      >
        <NIcon
          :component="Chat20Regular"
          class="toggle-btn-icon"
        />
        <span class="toggle-btn-text">弹幕浮窗</span>
        <span
          class="window-state-pill"
          :class="danmakuWindow.isDanmakuWindowOpen ? 'is-on' : 'is-off'"
        >
          {{ danmakuWindow.isDanmakuWindowOpen ? '开' : '关' }}
        </span>
      </button>

      <!-- 礼物与排行浮窗开关 -->
      <button
        type="button"
        class="float-window-toggle-btn"
        :class="{ 'is-active': giftWindow.isWindowOpened }"
        :title="giftWindow.isWindowOpened ? '礼物与排行浮窗运行中 (点击关闭)' : '礼物与排行浮窗已关闭 (点击打开)'"
        @click="toggleGiftWindow"
      >
        <NIcon
          :component="Gift20Regular"
          class="toggle-btn-icon"
        />
        <span class="toggle-btn-text">礼物排行</span>
        <span
          class="window-state-pill"
          :class="giftWindow.isWindowOpened ? 'is-on' : 'is-off'"
        >
          {{ giftWindow.isWindowOpened ? '开' : '关' }}
        </span>
      </button>
    </div>
  </footer>
</template>

<style scoped>
.client-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 26px;
  min-height: 26px;
  padding: 0 10px;
  background: var(--vtsuru-bg-surface, #18181c);
  border-top: 1px solid var(--vtsuru-border, rgba(255, 255, 255, 0.08));
  font-size: 11px;
  line-height: 1;
  color: var(--vtsuru-fg-muted, #9ca3af);
  user-select: none;
  box-sizing: border-box;
  flex-shrink: 0;
  z-index: 100;
  gap: 12px;
}

.status-bar-section {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.status-bar-section--left {
  flex-shrink: 0;
}

.status-bar-section--center {
  flex: 1;
  justify-content: center;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.status-bar-section--center:hover {
  background: var(--vtsuru-bg-elevated, rgba(255, 255, 255, 0.04));
  color: var(--vtsuru-fg, #ffffff);
}

.status-bar-section--center:hover .stat-jump-icon {
  opacity: 0.9;
  transform: scale(1.1);
}

.status-bar-section--right {
  flex-shrink: 0;
  gap: 6px;
}

/* 状态指示胶囊 */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.status-badge:hover {
  background: rgba(255, 255, 255, 0.08);
}

.status-badge.is-connected {
  color: var(--vtsuru-success, #10b981);
}

.status-badge.is-disconnected {
  color: var(--vtsuru-error, #ef4444);
}

.status-badge--rpc {
  color: var(--vtsuru-brand, #6366f1);
  background: rgba(99, 102, 241, 0.1);
}

.status-item-clickable {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: opacity 0.15s ease;
}

.status-item-clickable:hover {
  opacity: 0.85;
}

.mini-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.status-indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-indicator-dot.pulse {
  animation: pulse-dot 2s infinite ease-in-out;
}

@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.85);
  }
}

/* 实时指标 Chip */
.stats-flex {
  display: inline-flex;
  align-items: center;
}

.stat-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  color: inherit;
}

.stat-chip-icon {
  font-size: 13px;
  opacity: 0.8;
}

.stat-chip-value {
  color: var(--vtsuru-fg, #e5e7eb);
}

.stat-chip--income .stat-chip-value {
  color: #fbbf24;
}

.stat-jump-icon {
  font-size: 13px;
  opacity: 0.4;
  transition: all 0.2s ease;
}

/* 浮窗切换按钮 */
.float-window-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 20px;
  padding: 0 6px;
  border: 1px solid var(--vtsuru-border, rgba(255, 255, 255, 0.1));
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--vtsuru-fg-muted, #9ca3af);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s ease;
  vertical-align: middle;
}

.float-window-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--vtsuru-fg, #ffffff);
}

.float-window-toggle-btn.is-active {
  border-color: rgba(16, 185, 129, 0.35);
  background: rgba(16, 185, 129, 0.1);
  color: var(--vtsuru-fg, #ffffff);
}

.toggle-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  width: 13px;
  height: 13px;
  line-height: 1;
}

.toggle-btn-text {
  display: inline-block;
  line-height: 1;
  font-size: 11px;
}

.window-state-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 14px;
  min-width: 16px;
  padding: 0 4px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
  box-sizing: border-box;
}

.window-state-pill.is-on {
  background: var(--vtsuru-success, #10b981);
  color: #ffffff;
}

.window-state-pill.is-off {
  background: rgba(255, 255, 255, 0.12);
  color: var(--vtsuru-fg-muted, #9ca3af);
}
</style>
