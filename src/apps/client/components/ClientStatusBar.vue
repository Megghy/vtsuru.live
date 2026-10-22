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
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
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
  if (giftWindow.isGiftWindowOpen) {
    giftWindow.closeWindow()
  } else {
    giftWindow.openWindow()
  }
}
</script>

<template>
  <footer class="flex items-center justify-between h-6.5 min-h-6.5 px-2.5 bg-card border-t border-border text-[11px] leading-none text-muted-foreground select-none box-border shrink-0 z-100 gap-3">
    <!-- 左侧：连接与采集源状态 -->
    <div class="flex items-center gap-2 whitespace-nowrap shrink-0">
      <TooltipProvider>
        <!-- 弹幕源连接状态 -->
        <Tooltip>
          <TooltipTrigger as-child>
            <div
              class="inline-flex items-center gap-1.25 px-1.5 py-0.5 rounded bg-white/4 text-[11px] cursor-pointer transition-colors hover:bg-white/8"
              :class="isDanmakuConnected ? 'text-emerald-500' : 'text-rose-500'"
              @click="goToFetcher"
            >
              <span
                class="size-1.5 rounded-full bg-current"
                :class="{ 'animate-pulse': isDanmakuConnected }"
              />
              <span class="status-badge-text">{{ danmakuStatusText }}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent
            side="top"
            align="start"
          >
            <div>
              <div>
                <strong>弹幕连接状态：{{ danmakuClient.connectionStatus }}</strong>
              </div>
              <div class="text-[11px] opacity-85">
                {{ isDanmakuConnected ? '正在实时接收直播间事件流' : '点击前往 EventFetcher / 弹幕设置' }}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>

        <!-- EventFetcher 服务状态 -->
        <Tooltip>
          <TooltipTrigger as-child>
            <div
              class="inline-flex items-center gap-1 cursor-pointer px-1 py-0.5 rounded transition-opacity hover:opacity-85"
              @click="goToFetcher"
            >
              <span
                class="size-1.25 rounded-full"
                :class="webfetcher.state === 'connected' ? 'bg-emerald-500' : 'bg-muted-foreground'"
              />
              <span>上报服务</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div>EventFetcher 服务：{{ webfetcher.state === 'connected' ? '运行中' : '未连接' }}</div>
          </TooltipContent>
        </Tooltip>

        <!-- 本地 RPC 外部接入状态 -->
        <Tooltip v-if="rpcServer.running && rpcServer.connectionCount > 0">
          <TooltipTrigger as-child>
            <div class="inline-flex items-center gap-1.25 px-1.5 py-0.5 rounded text-[11px] cursor-pointer text-indigo-500 bg-indigo-500/10">
              <component
                :is="PlugConnected20Regular"
                class="size-3.5"
              />
              <span>{{ rpcServer.connectionCount }} 外部接入</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div>已有 {{ rpcServer.connectionCount }} 个外部网页/OBS 正在通过本地 RPC 订阅弹幕</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>

    <!-- 中间：实时直播互动数据指标 (点击可一键前往中控台) -->
    <div
      class="group flex-1 flex items-center justify-center cursor-pointer px-2 py-0.5 rounded whitespace-nowrap transition-all duration-200 hover:bg-popover hover:text-foreground"
      title="点击前往「中控台」查看全景大盘"
      @click="goToDashboard"
    >
      <div class="inline-flex items-center gap-3.5">
        <!-- 观看/在看人数 -->
        <div
          class="inline-flex items-center gap-1 font-medium color-inherit"
          title="累计观看人次"
        >
          <component
            :is="Eye20Regular"
            class="size-3.5 opacity-80"
          />
          <span class="text-foreground">{{ liveStats.watchedText || formatStatCount(liveStats.watchedCount) }}</span>
        </div>

        <!-- 点赞互动数 -->
        <div
          class="inline-flex items-center gap-1 font-medium color-inherit"
          title="本场累计点赞数"
        >
          <component
            :is="ThumbLike20Regular"
            class="size-3.5 opacity-80"
          />
          <span class="text-foreground">{{ formatStatCount(liveStats.likeCount) }}</span>
        </div>

        <!-- 实时在线人数 -->
        <div
          class="inline-flex items-center gap-1 font-medium color-inherit"
          title="在线观众人数"
        >
          <component
            :is="PeopleCommunity20Regular"
            class="size-3.5 opacity-80"
          />
          <span class="text-foreground">{{ formatStatCount(liveStats.onlineCount) }} 在线</span>
        </div>

        <!-- 本场总收益 -->
        <div
          class="inline-flex items-center gap-1 font-medium color-inherit"
          title="本场总收益（打赏 + SC + 大航海）"
        >
          <component
            :is="Payment20Regular"
            class="size-3.5 opacity-80"
          />
          <span class="text-amber-400 font-semibold">¥ {{ isIncomeHidden ? '***' : formatIncome(liveStats.totalIncome) }}</span>
        </div>

        <component
          :is="Board20Regular"
          class="size-3.5 opacity-40 transition-all duration-200 group-hover:opacity-90 group-hover:scale-110"
          title="进入中控台"
        />
      </div>
    </div>

    <!-- 右侧：浮窗快捷状态与一键开关 -->
    <div class="flex items-center gap-1.5 whitespace-nowrap shrink-0">
      <!-- 弹幕机浮窗开关 -->
      <button
        type="button"
        class="inline-flex items-center justify-center gap-1.25 h-5 px-1.5 border rounded text-[11px] leading-none cursor-pointer transition-all duration-150 align-middle hover:bg-white/8 hover:text-foreground"
        :class="
          danmakuWindow.isDanmakuWindowOpen
            ? 'border-emerald-500/35 bg-emerald-500/10 text-foreground'
            : 'border-border bg-white/3 text-muted-foreground'
        "
        :title="danmakuWindow.isDanmakuWindowOpen ? '弹幕浮窗运行中 (点击关闭)' : '弹幕浮窗已关闭 (点击打开)'"
        @click="toggleDanmakuWindow"
      >
        <component
          :is="Chat20Regular"
          class="size-3.25"
        />
        <span>弹幕浮窗</span>
        <span
          class="inline-flex items-center justify-center h-3.5 min-w-4 px-1 rounded text-[9px] font-semibold leading-none box-border"
          :class="danmakuWindow.isDanmakuWindowOpen ? 'bg-emerald-500 text-white' : 'bg-white/12 text-muted-foreground'"
        >
          {{ danmakuWindow.isDanmakuWindowOpen ? '开' : '关' }}
        </span>
      </button>

      <!-- 礼物与排行浮窗开关 -->
      <button
        type="button"
        class="inline-flex items-center justify-center gap-1.25 h-5 px-1.5 border rounded text-[11px] leading-none cursor-pointer transition-all duration-150 align-middle hover:bg-white/8 hover:text-foreground"
        :class="
          giftWindow.isGiftWindowOpen
            ? 'border-emerald-500/35 bg-emerald-500/10 text-foreground'
            : 'border-border bg-white/3 text-muted-foreground'
        "
        :title="giftWindow.isGiftWindowOpen ? '礼物与排行浮窗运行中 (点击关闭)' : '礼物与排行浮窗已关闭 (点击打开)'"
        @click="toggleGiftWindow"
      >
        <component
          :is="Gift20Regular"
          class="size-3.25"
        />
        <span>礼物排行</span>
        <span
          class="inline-flex items-center justify-center h-3.5 min-w-4 px-1 rounded text-[9px] font-semibold leading-none box-border"
          :class="giftWindow.isGiftWindowOpen ? 'bg-emerald-500 text-white' : 'bg-white/12 text-muted-foreground'"
        >
          {{ giftWindow.isGiftWindowOpen ? '开' : '关' }}
        </span>
      </button>
    </div>
  </footer>
</template>
