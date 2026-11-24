<script setup lang="ts">
import {
  AlertTriangle,
  Eye,
  Gift,
  LayoutDashboard,
  MessageSquare,
  Plug,
  ThumbsUp,
  Users,
  Wallet,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useFetcherRpcServer } from '@/store/useFetcherRpcServer'
import { useWebFetcher } from '@/store/useWebFetcher'

const router = useRouter()
const danmakuClient = useDanmakuClient()
const danmakuWindow = useDanmakuWindow()
const giftWindow = useGiftWindow()
const obsStore = useOBSStore()
const vtsStore = useVtsStore()
const webfetcher = useWebFetcher()
const rpcServer = useFetcherRpcServer()

const liveStats = computed(() => danmakuWindow.liveStats)
const isIncomeHidden = computed(() => danmakuWindow.danmakuWindowSetting.hideIncomeAmount)

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

function formatOrigin(origin: string) {
  if (!origin) return '未知来源'
  try {
    return new URL(origin).host
  } catch {
    return origin
  }
}

function formatSince(connectedAt: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - connectedAt) / 1000))
  if (seconds < 60) return `${seconds} 秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  return `${hours} 小时前`
}

function goToDashboard() {
  router.push({ name: 'client-live-dashboard' })
}

function goToFetcher() {
  router.push({ name: 'client-fetcher' })
}

function goToDiagnostics() {
  router.push({ name: 'client-settings', query: { tab: 'diagnostics' } })
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
  <footer
    class="flex-between py-1 px-3 bg-card border-t border-border text-[11px] leading-none text-muted-foreground select-none box-border shrink-0 z-100 gap-3"
  >
    <!-- 左侧：连接与采集源状态 -->
    <div class="flex items-center gap-2 whitespace-nowrap shrink-0">
      <TooltipProvider>
        <!-- 弹幕源连接状态 -->
        <Tooltip>
          <TooltipTrigger as-child>
            <div
              class="inline-flex items-center gap-1.25 px-1.5 py-0.5 rounded bg-muted/40 text-[11px] cursor-pointer transition-colors hover:bg-muted/70"
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

        <!-- OBS 状态 -->
        <Tooltip>
          <TooltipTrigger as-child>
            <div
              class="inline-flex items-center gap-1 cursor-pointer px-1 py-0.5 rounded transition-opacity hover:opacity-85"
              @click="router.push({ name: 'client-tools' })"
            >
              <span
                class="size-1.25 rounded-full"
                :class="
                  obsStore.obsConnected
                    ? obsStore.obsStreamActive
                      ? 'bg-emerald-500 animate-pulse'
                      : 'bg-sky-500'
                    : 'bg-muted-foreground/60'
                "
              />
              <span>OBS</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div>
              OBS：{{
                obsStore.obsConnected
                  ? `${obsStore.obsStreamActive ? '推流中' : '已连接'} (${obsStore.currentObsScene || '无场景'})`
                  : '未连接（点击前往工具中心）'
              }}
            </div>
          </TooltipContent>
        </Tooltip>

        <!-- VTS 状态 -->
        <Tooltip>
          <TooltipTrigger as-child>
            <div
              class="inline-flex items-center gap-1 cursor-pointer px-1 py-0.5 rounded transition-opacity hover:opacity-85"
              @click="router.push({ name: 'client-vts' })"
            >
              <span
                class="size-1.25 rounded-full"
                :class="
                  vtsStore.connected
                    ? vtsStore.faceFound === false
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                    : vtsStore.connecting
                      ? 'bg-sky-500 animate-pulse'
                      : 'bg-muted-foreground/60'
                "
              />
              <span>VTS</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div>
              VTube Studio：{{
                vtsStore.connected
                  ? `${vtsStore.currentModelName || '已连接'}${vtsStore.faceFound === false ? ' · 面部丢失' : ''}`
                  : vtsStore.connecting
                    ? '等待连接/授权中'
                    : '未连接（点击前往 VTS 控制）'
              }}
            </div>
          </TooltipContent>
        </Tooltip>

        <!-- 本地 RPC 端口异常提示 -->
        <Tooltip v-if="rpcServer.lastError">
          <TooltipTrigger as-child>
            <div
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] cursor-pointer text-destructive bg-destructive/10 hover:bg-destructive/15 transition-colors"
              @click="goToDiagnostics"
            >
              <AlertTriangle class="size-3" />
              <span>RPC 异常</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div>{{ rpcServer.lastError }}（点击查看诊断）</div>
          </TooltipContent>
        </Tooltip>

        <!-- 本地 RPC 外部接入状态（可点击查看连接列表） -->
        <Popover v-else-if="rpcServer.running && rpcServer.connectionCount > 0">
          <PopoverTrigger as-child>
            <button
              type="button"
              class="inline-flex items-center gap-1.25 px-1.5 py-0.5 rounded text-[11px] cursor-pointer text-indigo-500 bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors border-0"
            >
              <Plug class="size-3" />
              <span>{{ rpcServer.connectionCount }} 外部接入</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            class="w-64 space-y-2"
          >
            <div class="font-semibold text-foreground text-xs">外部接入连接 ({{ rpcServer.connectionCount }})</div>
            <Empty
              v-if="rpcServer.connectionCount === 0"
              description="暂无外部连接"
              class="py-3"
            />
            <div
              v-for="conn in rpcServer.connections"
              v-else
              :key="conn.connId"
              class="p-2 rounded bg-muted/40 space-y-1 text-xs"
            >
              <div class="flex-between gap-2">
                <span class="font-medium text-foreground truncate">{{ formatOrigin(conn.origin) }}</span>
                <Badge
                  :variant="conn.subscribed ? 'success' : 'secondary'"
                  size="xs"
                >
                  {{ conn.subscribed ? '已订阅' : '未订阅' }}
                </Badge>
              </div>
              <div class="text-[10px] text-muted-foreground">接入于 {{ formatSince(conn.connectedAt) }}</div>
            </div>
          </PopoverContent>
        </Popover>
      </TooltipProvider>
    </div>

    <!-- 中间：实时直播互动数据指标 (点击可一键前往中控台) -->
    <div
      class="group flex-1 flex-center cursor-pointer px-2 py-0.5 rounded whitespace-nowrap transition-colors duration-150 hover:bg-popover hover:text-foreground"
      title="点击前往「中控台」查看全景大盘"
      @click="goToDashboard"
    >
      <div class="inline-flex items-center gap-3.5">
        <div
          class="inline-flex items-center gap-1 font-medium"
          title="累计观看人次"
        >
          <Eye class="size-3.5 opacity-80" />
          <span class="text-foreground">{{ liveStats.watchedText || formatStatCount(liveStats.watchedCount) }}</span>
        </div>

        <div
          class="inline-flex items-center gap-1 font-medium"
          title="本场累计点赞数"
        >
          <ThumbsUp class="size-3.5 opacity-80" />
          <span class="text-foreground">{{ formatStatCount(liveStats.likeCount) }}</span>
        </div>

        <div
          class="inline-flex items-center gap-1 font-medium"
          title="在线观众人数"
        >
          <Users class="size-3.5 opacity-80" />
          <span class="text-foreground">{{ formatStatCount(liveStats.onlineCount) }} 在线</span>
        </div>

        <div
          class="inline-flex items-center gap-1 font-medium"
          title="本场总收益（打赏 + SC + 大航海）"
        >
          <Wallet class="size-3.5 opacity-80" />
          <span class="text-amber-500 font-semibold">¥ {{ isIncomeHidden ? '***' : formatIncome(liveStats.totalIncome) }}</span>
        </div>

        <LayoutDashboard
          class="size-3.5 opacity-40 transition-transform duration-150 group-hover:opacity-90 group-hover:scale-110"
          title="进入中控台"
        />
      </div>
    </div>

    <!-- 右侧：浮窗快捷状态与一键开关 -->
    <div class="flex items-center gap-1.5 whitespace-nowrap shrink-0">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              type="button"
              size="xs"
              variant="outline"
              class="gap-1.5"
              :class="
                danmakuWindow.isDanmakuWindowOpen
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                  : 'text-muted-foreground'
              "
              :aria-label="danmakuWindow.isDanmakuWindowOpen ? '关闭弹幕浮窗' : '打开弹幕浮窗'"
              @click="toggleDanmakuWindow"
            >
              <MessageSquare class="size-3" />
              <span>弹幕浮窗</span>
              <span
                class="inline-flex-center px-1 rounded text-[9px] font-semibold leading-tight"
                :class="
                  danmakuWindow.isDanmakuWindowOpen ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'
                "
              >
                {{ danmakuWindow.isDanmakuWindowOpen ? '开' : '关' }}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{
            danmakuWindow.isDanmakuWindowOpen ? '弹幕浮窗运行中 (点击关闭)' : '弹幕浮窗已关闭 (点击打开)'
          }}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              type="button"
              size="xs"
              variant="outline"
              class="gap-1.5"
              :class="
                giftWindow.isGiftWindowOpen
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
                  : 'text-muted-foreground'
              "
              :aria-label="giftWindow.isGiftWindowOpen ? '关闭礼物排行浮窗' : '打开礼物排行浮窗'"
              @click="toggleGiftWindow"
            >
              <Gift class="size-3" />
              <span>礼物排行</span>
              <span
                class="inline-flex-center px-1 rounded text-[9px] font-semibold leading-tight"
                :class="giftWindow.isGiftWindowOpen ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'"
              >
                {{ giftWindow.isGiftWindowOpen ? '开' : '关' }}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{
            giftWindow.isGiftWindowOpen ? '礼物与排行浮窗运行中 (点击关闭)' : '礼物与排行浮窗已关闭 (点击打开)'
          }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </footer>
</template>
