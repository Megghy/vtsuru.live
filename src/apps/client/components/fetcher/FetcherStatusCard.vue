<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { AlertCircle, CheckCircle2, Clock, Radio, Wifi } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { useWebFetcher } from '@/store/useWebFetcher'

const webfetcher = useWebFetcher()

const uptime = ref<string>('N/A')
const networkStatus = ref<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline')
let uptimeTimer: number | undefined

const isConnected = computed(() => webfetcher.state === 'connected')

const connectionStatusText = computed(() => {
  switch (webfetcher.state) {
    case 'connected':
      return '运行中'
    case 'connecting':
      return '连接中'
    case 'disconnected':
      return '已停止'
    default:
      return '未知'
  }
})

const formattedStartedAt = computed(() =>
  webfetcher.startedAt ? new Date(webfetcher.startedAt).toLocaleString() : '—',
)

const danmakuClientStateText = computed(() => {
  switch (webfetcher.danmakuClientState) {
    case 'connected':
      return '已连接'
    case 'connecting':
      return '连接中'
    case 'stopped':
      return '已停止'
    default:
      return '未知'
  }
})

const signalRStateText = computed(() => {
  switch (webfetcher.state) {
    case 'connected':
      return '已连接'
    case 'connecting':
      return '连接中'
    case 'disconnected':
      return '已断开'
    default:
      return '未知'
  }
})

function updateUptime() {
  if (webfetcher.startedAt) {
    uptime.value = formatDistanceToNow(new Date(webfetcher.startedAt), { addSuffix: true, locale: zhCN })
  } else {
    uptime.value = '—'
    clearInterval(uptimeTimer)
    uptimeTimer = undefined
  }
}

function onNetworkChange() {
  networkStatus.value = navigator.onLine ? 'online' : 'offline'
}

onMounted(() => {
  updateUptime()
  uptimeTimer = window.setInterval(updateUptime, 60 * 1000)
  window.addEventListener('online', onNetworkChange)
  window.addEventListener('offline', onNetworkChange)
})

onUnmounted(() => {
  clearInterval(uptimeTimer)
  window.removeEventListener('online', onNetworkChange)
  window.removeEventListener('offline', onNetworkChange)
})
</script>

<template>
  <Card class="border bg-card">
    <CardHeader class="p-3 pb-2 border-b flex-row items-center justify-between space-y-0">
      <CardTitle class="text-sm font-semibold">运行状态 & 连接</CardTitle>

      <div
        class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border"
        :class="
          isConnected
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
            : webfetcher.state === 'connecting'
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              : 'bg-destructive/10 text-destructive border-destructive/30'
        "
      >
        <span
          class="size-1.5 rounded-full"
          :class="
            isConnected
              ? 'bg-emerald-500'
              : webfetcher.state === 'connecting'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-destructive'
          "
        />
        {{ connectionStatusText }}
      </div>
    </CardHeader>

    <CardContent class="p-3">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        <!-- 启动时间 -->
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock class="size-3.5" />
            <span>启动时间</span>
          </div>
          <span class="text-xs font-medium text-foreground block font-mono">
            {{ formattedStartedAt }}
          </span>
        </div>

        <!-- 运行时长 -->
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock class="size-3.5" />
            <span>运行时长</span>
          </div>
          <span class="text-xs font-medium text-foreground block font-mono">
            {{ uptime }}
          </span>
        </div>

        <!-- 网络状态 -->
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wifi class="size-3.5" />
            <span>网络状态</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span
              class="size-1.5 rounded-full"
              :class="networkStatus === 'online' ? 'bg-emerald-500' : 'bg-destructive'"
            />
            <span class="text-xs font-medium text-foreground">
              {{ networkStatus === 'online' ? '在线' : '离线' }}
            </span>
          </div>
        </div>

        <!-- SignalR 服务 -->
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Radio class="size-3.5" />
            <span>SignalR 服务</span>
          </div>
          <div class="flex items-center gap-2">
            <Badge
              variant="outline"
              class="text-[11px] px-1.5 py-0"
              :class="
                webfetcher.state === 'connected'
                  ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                  : 'border-border text-muted-foreground'
              "
            >
              {{ signalRStateText }}
            </Badge>
            <span
              class="text-xs font-mono text-muted-foreground truncate"
              :title="webfetcher.signalRId ?? undefined"
            >
              {{ webfetcher.signalRId ?? '—' }}
            </span>
          </div>
        </div>

        <!-- 弹幕服务器 -->
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1 sm:col-span-2">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Radio class="size-3.5" />
            <span>弹幕服务器</span>
          </div>
          <div class="flex items-center gap-2">
            <Badge
              variant="outline"
              class="text-[11px] px-1.5 py-0 shrink-0"
              :class="
                webfetcher.danmakuClientState === 'connected'
                  ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                  : 'border-border text-muted-foreground'
              "
            >
              {{ danmakuClientStateText }}
            </Badge>
            <span
              class="text-xs font-mono text-muted-foreground truncate"
              :title="webfetcher.danmakuServerUrl ?? undefined"
            >
              {{ webfetcher.danmakuServerUrl ?? '—' }}
            </span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
