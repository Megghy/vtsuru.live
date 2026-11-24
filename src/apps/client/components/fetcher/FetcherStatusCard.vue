<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { platform, type, version } from '@tauri-apps/plugin-os'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  Flame,
  Layers,
  Plug,
  Radio,
  Server,
  UploadCloud,
  Wifi,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { isLiveStreaming, liveStartTimeMs, roomInfo } from '@/apps/client/data/info'
import { isTauri } from '@/shared/config'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'
import { useFetcherRpcServer } from '@/store/useFetcherRpcServer'
import { useWebFetcher } from '@/store/useWebFetcher'

const webfetcher = useWebFetcher()
const rpcServer = useFetcherRpcServer()

const nowMs = ref(Date.now())
let nowTimer: number | undefined
const networkStatus = ref<'online' | 'offline'>(navigator.onLine ? 'online' : 'offline')
const osInfo = ref<string>('未知')
const memoryInfo = ref<{ total: number; free: number; used: number } | null>(null)

function formatElapsed(startMs: number, endMs: number): string {
  const diffSec = Math.max(0, Math.floor((endMs - startMs) / 1000))
  const days = Math.floor(diffSec / 86400)
  const hours = Math.floor((diffSec % 86400) / 3600)
  const mins = Math.floor((diffSec % 3600) / 60)
  const secs = diffSec % 60
  const hms = [hours, mins, secs].map((v) => String(v).padStart(2, '0')).join(':')
  return days > 0 ? `${days}天 ${hms}` : hms
}

const uptimeText = computed(() => {
  if (!webfetcher.startedAt) return '—'
  return formatElapsed(new Date(webfetcher.startedAt).getTime(), nowMs.value)
})

const formattedStartedAt = computed(() =>
  webfetcher.startedAt ? new Date(webfetcher.startedAt).toLocaleString() : '—',
)

const liveDurationText = computed(() => {
  if (!isLiveStreaming.value) return '未开播'
  if (liveStartTimeMs.value) {
    return formatElapsed(liveStartTimeMs.value, nowMs.value)
  }
  return '直播中'
})

const lastUploadText = computed(() => {
  if (!webfetcher.lastUploadAt) return '暂无'
  return formatDistanceToNow(webfetcher.lastUploadAt, { addSuffix: true, locale: zhCN })
})

const signalRBadge = computed(() => {
  switch (webfetcher.state) {
    case 'connected':
      return { variant: 'success' as const, label: '已连接' }
    case 'connecting':
      return { variant: 'warning' as const, label: '连接中' }
    default:
      return { variant: 'destructive' as const, label: '已断开' }
  }
})

const danmakuBadge = computed(() => {
  switch (webfetcher.danmakuClientState) {
    case 'connected':
      return { variant: 'success' as const, label: '已连接' }
    case 'connecting':
      return { variant: 'warning' as const, label: '连接中' }
    default:
      return { variant: 'secondary' as const, label: '已停止' }
  }
})

const rpcBadge = computed(() => {
  if (rpcServer.lastError) {
    return { variant: 'destructive' as const, label: '异常' }
  }
  if (rpcServer.running) {
    return { variant: 'success' as const, label: `${rpcServer.connectionCount} 个连接` }
  }
  return { variant: 'secondary' as const, label: '未运行' }
})

const diagnosticError = computed(
  () => webfetcher.serverDisconnectReason || webfetcher.lastUploadError || rpcServer.lastError,
)

function onNetworkChange() {
  networkStatus.value = navigator.onLine ? 'online' : 'offline'
}

async function loadHostInfo() {
  if (!isTauri()) {
    osInfo.value = navigator.platform || 'Web Browser'
    return
  }
  try {
    osInfo.value = `${type()} (${platform()} ${version()})`
  } catch {
    osInfo.value = navigator.userAgent
  }
  try {
    const mem = await invoke<{ total: number; free: number }>('get_memory_info')
    memoryInfo.value = { total: mem.total, free: mem.free, used: mem.total - mem.free }
  } catch {
    memoryInfo.value = null
  }
}

onMounted(() => {
  nowTimer = window.setInterval(() => {
    nowMs.value = Date.now()
  }, 1000)
  window.addEventListener('online', onNetworkChange)
  window.addEventListener('offline', onNetworkChange)
  void loadHostInfo()
})

onUnmounted(() => {
  if (nowTimer !== undefined) {
    clearInterval(nowTimer)
  }
  window.removeEventListener('online', onNetworkChange)
  window.removeEventListener('offline', onNetworkChange)
})
</script>

<template>
  <Card class="w-full">
    <CardHeader class="p-3 border-b flex-row items-center justify-between space-y-0">
      <CardTitle>连接状态与诊断</CardTitle>
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <span class="inline-flex items-center gap-1.5">
          <span
            class="size-1.5 rounded-full"
            :class="networkStatus === 'online' ? 'bg-emerald-500' : 'bg-destructive'"
          />
          <span>{{ networkStatus === 'online' ? '网络在线' : '网络离线' }}</span>
        </span>
        <span class="opacity-40">·</span>
        <span> 模式：{{ webfetcher.webfetcherType === 'direct' ? '直接连接' : '开放平台' }} </span>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <!-- 异常诊断提示 -->
      <Alert
        v-if="diagnosticError"
        size="sm"
        variant="destructive"
      >
        <template #icon>
          <AlertTriangle class="size-4" />
        </template>
        <AlertTitle>检测到连接或上传异常</AlertTitle>
        <AlertDescription class="m-0 font-mono break-all">
          {{ diagnosticError }}
        </AlertDescription>
      </Alert>

      <!-- 链路与房间摘要 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        <!-- 运行时长 -->
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1 min-w-0">
          <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock class="size-3.5 shrink-0" />
            <span>运行时长</span>
          </div>
          <div
            class="text-xs font-medium text-foreground font-mono tabular-nums"
            :title="`启动于 ${formattedStartedAt}`"
          >
            {{ uptimeText }}
          </div>
          <div class="text-[11px] text-muted-foreground truncate tabular-nums">启动于 {{ formattedStartedAt }}</div>
        </div>

        <!-- 直播间实时状态（单真源） -->
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1 min-w-0">
          <div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span class="inline-flex items-center gap-1.5">
              <Flame class="size-3.5 shrink-0" />
              <span>直播状态</span>
            </span>
            <Badge
              :variant="isLiveStreaming ? 'success' : 'secondary'"
              size="xs"
            >
              {{ isLiveStreaming ? '直播中' : '未开播' }}
            </Badge>
          </div>
          <div
            class="text-xs font-medium text-foreground truncate"
            :title="roomInfo?.title || undefined"
          >
            {{ roomInfo?.title || '暂无房间标题' }}
          </div>
          <div class="text-[11px] text-muted-foreground tabular-nums flex items-center gap-2">
            <span>时长: {{ liveDurationText }}</span>
            <span v-if="roomInfo?.online != null">· 人气 {{ roomInfo.online.toLocaleString() }}</span>
          </div>
        </div>

        <!-- 本地 RPC 开放服务 -->
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1 min-w-0">
          <div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span class="inline-flex items-center gap-1.5">
              <Plug class="size-3.5 shrink-0" />
              <span>本地 RPC 服务</span>
            </span>
            <Badge
              :variant="rpcBadge.variant"
              size="xs"
            >
              {{ rpcBadge.label }}
            </Badge>
          </div>
          <div class="text-xs font-mono text-foreground tabular-nums">127.0.0.1:29304</div>
          <div class="text-[11px] text-muted-foreground truncate">
            {{ rpcServer.lastError || (rpcServer.running ? '向外部网页/插件提供本地事件分发' : '当前未启用 RPC 监听') }}
          </div>
        </div>

        <!-- SignalR 服务 -->
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1 min-w-0">
          <div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span class="inline-flex items-center gap-1.5">
              <Radio class="size-3.5 shrink-0" />
              <span>SignalR 枢纽</span>
            </span>
            <Badge
              :variant="signalRBadge.variant"
              size="xs"
            >
              {{ signalRBadge.label }}
            </Badge>
          </div>
          <div
            class="text-xs font-mono text-muted-foreground truncate"
            :title="webfetcher.signalRId ?? undefined"
          >
            {{ webfetcher.signalRId ?? '—' }}
          </div>
        </div>

        <!-- 弹幕服务器 -->
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1 min-w-0 sm:col-span-2">
          <div class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span class="inline-flex items-center gap-1.5">
              <Wifi class="size-3.5 shrink-0" />
              <span>弹幕服务器</span>
            </span>
            <Badge
              :variant="danmakuBadge.variant"
              size="xs"
            >
              {{ danmakuBadge.label }}
            </Badge>
          </div>
          <div
            class="text-xs font-mono text-muted-foreground truncate"
            :title="webfetcher.danmakuServerUrl ?? undefined"
          >
            {{ webfetcher.danmakuServerUrl ?? '—' }}
          </div>
        </div>
      </div>

      <Separator />

      <!-- 上传链路诊断指标 -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-0.5 min-w-0">
          <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <UploadCloud class="size-3.5 shrink-0" />
            <span>上传成功</span>
          </div>
          <div class="text-sm font-semibold text-foreground font-mono tabular-nums">
            {{ webfetcher.successfulUploads.toLocaleString() }}
          </div>
        </div>

        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-0.5 min-w-0">
          <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <AlertTriangle class="size-3.5 shrink-0" />
            <span>上传失败</span>
          </div>
          <div
            class="text-sm font-semibold font-mono tabular-nums"
            :class="webfetcher.failedUploads > 0 ? 'text-destructive' : 'text-foreground'"
          >
            {{ webfetcher.failedUploads.toLocaleString() }}
          </div>
        </div>

        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-0.5 min-w-0">
          <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Layers class="size-3.5 shrink-0" />
            <span>待发送积压</span>
          </div>
          <div
            class="text-sm font-semibold font-mono tabular-nums"
            :class="webfetcher.queueSize > 100 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'"
          >
            {{ webfetcher.queueSize.toLocaleString() }}
          </div>
        </div>

        <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-0.5 min-w-0">
          <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Activity class="size-3.5 shrink-0" />
            <span>最近上传</span>
          </div>
          <div class="text-xs font-medium text-foreground truncate pt-0.5">
            {{ lastUploadText }}
          </div>
        </div>
      </div>

      <!-- 精简宿主环境摘要 -->
      <div class="flex items-center justify-between flex-wrap gap-2 pt-1 text-[11px] text-muted-foreground">
        <span class="inline-flex items-center gap-1.5 min-w-0">
          <Server class="size-3.5 shrink-0" />
          <span class="truncate font-mono">宿主: {{ osInfo }}</span>
        </span>
        <span
          v-if="memoryInfo"
          class="inline-flex items-center gap-1.5 font-mono tabular-nums"
        >
          <Cpu class="size-3.5 shrink-0" />
          <span>
            内存: {{ (memoryInfo.used / 1024 / 1024 / 1024).toFixed(2) }} /
            {{ (memoryInfo.total / 1024 / 1024 / 1024).toFixed(2) }} GB
          </span>
        </span>
      </div>
    </CardContent>
  </Card>
</template>
