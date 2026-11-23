<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import JSZip from 'jszip'
import {
  Activity,
  AlertTriangle,
  Download,
  FileText,
  FolderOpen,
  HardDrive,
  RefreshCw,
  RotateCw,
  Server,
  ShieldCheck,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { isTauri } from '@/shared/config'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useFetcherRpcServer } from '@/store/useFetcherRpcServer'
import { useWebFetcher } from '@/store/useWebFetcher'

interface LogFileMeta {
  name: string
  sizeBytes: number
  modifiedAt?: number | null
}

interface DiagnosticLogFile {
  name: string
  truncated: boolean
  content: string
}

interface DiagnosticsInfo {
  version: string
  os: string
  arch: string
  autostartLaunch: boolean
  logDir: string
  logFiles: LogFileMeta[]
  rpc: {
    running: boolean
    port: number
    connectionCount: number
    lastError?: string | null
  }
  heartbeat: {
    lastHeartbeat?: string | null
    elapsedSeconds?: number | null
    timeoutSeconds: number
    isMonitoring: boolean
    timeoutCount: number
    autoReloadEnabled: boolean
  }
  ffmpeg: {
    available: boolean
    path?: string | null
    source: string
    version?: string | null
    customPath?: string | null
    canAutoDownload: boolean
    downloading: boolean
  }
  activeFfmpegJobs: number
  memoryTotal: number
  memoryFree: number
}

const danmakuClient = useDanmakuClient()
const webFetcher = useWebFetcher()
const rpcServer = useFetcherRpcServer()

const loading = ref(false)
const exporting = ref(false)
const loadError = ref<string | null>(null)
const info = ref<DiagnosticsInfo | null>(null)

const memoryUsageText = computed(() => {
  if (!info.value || !info.value.memoryTotal) return '-'
  const totalGb = info.value.memoryTotal / 1024 / 1024 / 1024
  const usedGb = Math.max(0, info.value.memoryTotal - info.value.memoryFree) / 1024 / 1024 / 1024
  return `${usedGb.toFixed(1)} GB / ${totalGb.toFixed(1)} GB`
})

const ffmpegSourceLabel = computed(() => {
  switch (info.value?.ffmpeg.source) {
    case 'custom':
      return '自定义路径'
    case 'local':
      return '客户端内置'
    case 'system':
      return '系统 PATH'
    default:
      return '未检测到'
  }
})

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

async function loadDiagnostics() {
  if (!isTauri()) return
  loading.value = true
  loadError.value = null
  try {
    info.value = await invoke<DiagnosticsInfo>('get_diagnostics_info')
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
}

async function handleOpenLogDir() {
  try {
    await invoke('open_log_dir')
  } catch (err) {
    toast.error(`打开日志目录失败: ${err}`)
  }
}

async function handleReloadMainWindow() {
  try {
    await invoke('reload_main_window')
  } catch (err) {
    toast.error(`重载主界面失败: ${err}`)
  }
}

async function handleExportBundle() {
  if (!isTauri()) return
  exporting.value = true
  try {
    const [diag, logs] = await Promise.all([
      invoke<DiagnosticsInfo>('get_diagnostics_info'),
      invoke<DiagnosticLogFile[]>('read_diagnostic_logs', { maxBytesPerFile: 1024 * 1024 }),
    ])

    const zip = new JSZip()
    const summary = {
      exportedAt: new Date().toISOString(),
      native: diag,
      runtime: {
        userAgent: navigator.userAgent,
        danmakuPhase: danmakuClient.phase,
        danmakuSourceType: danmakuClient.sourceType,
        danmakuHasRemoteSource: danmakuClient.hasRemoteSource,
        webFetcherState: webFetcher.state,
        rpcRunning: rpcServer.running,
        rpcConnections: rpcServer.connections.map((c) => ({
          origin: c.origin,
          subscribed: c.subscribed,
          connectedAt: c.connectedAt,
        })),
      },
    }
    zip.file('diagnostics.json', JSON.stringify(summary, null, 2))
    for (const file of logs) {
      const header = file.truncated ? '[注意: 该日志超过大小上限，仅包含末尾最新部分，且已做敏感字段脱敏]\n\n' : ''
      zip.file(`logs/${file.name}`, `${header}${file.content}`)
    }

    const bytes = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const defaultName = `vtsuru-diagnostics-${stamp}.zip`
    const targetPath = await save({
      title: '导出脱敏诊断包',
      defaultPath: defaultName,
      filters: [{ name: 'ZIP', extensions: ['zip'] }],
    })
    if (!targetPath) return

    await writeFile(targetPath, bytes)
    toast.success('脱敏诊断包已导出')
  } catch (err) {
    toast.error(`导出诊断包失败: ${err}`)
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  void loadDiagnostics()
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <Alert
      v-if="!isTauri()"
      variant="destructive"
    >
      <AlertDescription class="m-0"> 当前为浏览器环境，原生诊断与日志功能仅在桌面客户端中可用。 </AlertDescription>
    </Alert>

    <template v-else>
      <Alert variant="info">
        <ShieldCheck class="size-4" />
        <AlertDescription class="m-0">
          导出诊断包会自动剔除日志中的 SESSDATA、bili_jct、Token 及 Authorization 凭据，可直接发送用于故障排查。
        </AlertDescription>
      </Alert>

      <Alert
        v-if="loadError"
        variant="warning"
      >
        <AlertTriangle class="size-4" />
        <AlertTitle>无法读取原生诊断信息</AlertTitle>
        <AlertDescription class="m-0">
          {{ loadError }}（若桌面端壳版本较旧，请先在「关于程序」中检查更新）
        </AlertDescription>
      </Alert>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          class="gap-1.5"
          :disabled="loading"
          @click="loadDiagnostics"
        >
          <RefreshCw
            class="size-3.5"
            :class="{ 'animate-spin': loading }"
          />
          <span>刷新状态</span>
        </Button>

        <Button
          variant="outline"
          class="gap-1.5"
          @click="handleOpenLogDir"
        >
          <FolderOpen class="size-3.5" />
          <span>打开日志目录</span>
        </Button>

        <Button
          class="gap-1.5"
          :disabled="exporting"
          @click="handleExportBundle"
        >
          <Download class="size-3.5" />
          <span>{{ exporting ? '正在打包...' : '导出脱敏诊断包 (ZIP)' }}</span>
        </Button>

        <Button
          variant="outline"
          class="gap-1.5 ml-auto"
          @click="handleReloadMainWindow"
        >
          <RotateCw class="size-3.5" />
          <span>重载主界面</span>
        </Button>
      </div>

      <div
        v-if="loading && !info"
        class="flex-center p-8 text-xs text-muted-foreground gap-2"
      >
        <Spin class="size-4" />
        <span>正在读取原生运行状态...</span>
      </div>

      <template v-else-if="info">
        <Alert
          v-if="info.rpc.lastError"
          variant="destructive"
        >
          <AlertTriangle class="size-4" />
          <AlertTitle>本地 RPC 服务绑定失败 (端口 {{ info.rpc.port }})</AlertTitle>
          <AlertDescription class="m-0">
            {{ info.rpc.lastError }}
          </AlertDescription>
        </Alert>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <CardHeader class="p-3 pb-1.5">
              <CardTitle class="flex items-center justify-between text-xs">
                <span class="flex items-center gap-1.5">
                  <Server class="size-3.5 text-primary" />
                  本地 RPC 中继
                </span>
                <Badge
                  :variant="info.rpc.running ? 'success' : 'destructive'"
                  size="xs"
                >
                  {{ info.rpc.running ? '运行中' : '未运行' }}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent class="p-3 pt-1 text-xs space-y-1 text-muted-foreground">
              <div class="flex-between">
                <span>监听端口</span>
                <span class="font-mono text-foreground">127.0.0.1:{{ info.rpc.port }}</span>
              </div>
              <div class="flex-between">
                <span>活跃连接数</span>
                <span class="font-mono text-foreground">{{ info.rpc.connectionCount }}</span>
              </div>
              <div class="flex-between">
                <span>运行环境</span>
                <span class="font-mono text-foreground">v{{ info.version }} ({{ info.os }}/{{ info.arch }})</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader class="p-3 pb-1.5">
              <CardTitle class="flex items-center justify-between text-xs">
                <span class="flex items-center gap-1.5">
                  <Activity class="size-3.5 text-primary" />
                  前端心跳看门狗
                </span>
                <Badge
                  :variant="info.heartbeat.isMonitoring ? 'success' : 'secondary'"
                  size="xs"
                >
                  {{ info.heartbeat.isMonitoring ? '监控中' : '未启动' }}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent class="p-3 pt-1 text-xs space-y-1 text-muted-foreground">
              <div class="flex-between">
                <span>距上次心跳</span>
                <span class="font-mono text-foreground">
                  {{ info.heartbeat.elapsedSeconds != null ? `${info.heartbeat.elapsedSeconds}s` : '等待中' }}
                </span>
              </div>
              <div class="flex-between">
                <span>累计超时次数</span>
                <span class="font-mono text-foreground">{{ info.heartbeat.timeoutCount }}</span>
              </div>
              <div class="flex-between">
                <span>超时自动重载</span>
                <span class="text-foreground">{{ info.heartbeat.autoReloadEnabled ? '已开启' : '未开启' }}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader class="p-3 pb-1.5">
              <CardTitle class="flex items-center justify-between text-xs">
                <span class="flex items-center gap-1.5">
                  <HardDrive class="size-3.5 text-primary" />
                  媒体与系统资源
                </span>
                <Badge
                  :variant="info.ffmpeg.available ? 'success' : 'warning'"
                  size="xs"
                >
                  FFmpeg {{ info.ffmpeg.available ? '就绪' : '未安装' }}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent class="p-3 pt-1 text-xs space-y-1 text-muted-foreground">
              <div class="flex-between">
                <span>FFmpeg 来源</span>
                <span class="text-foreground">{{ ffmpegSourceLabel }}</span>
              </div>
              <div class="flex-between">
                <span>活跃转写任务</span>
                <span class="font-mono text-foreground">{{ info.activeFfmpegJobs }}</span>
              </div>
              <div class="flex-between">
                <span>系统内存占用</span>
                <span class="font-mono text-foreground">{{ memoryUsageText }}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader class="p-3 pb-1.5">
              <CardTitle class="flex items-center justify-between text-xs">
                <span class="flex items-center gap-1.5">
                  <FileText class="size-3.5 text-primary" />
                  日志文件 ({{ info.logFiles.length }})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent class="p-3 pt-1 text-xs space-y-1.5">
              <div
                class="text-[11px] text-muted-foreground truncate"
                :title="info.logDir"
              >
                目录: {{ info.logDir }}
              </div>
              <Empty
                v-if="info.logFiles.length === 0"
                description="暂无日志文件"
                class="py-2"
              />
              <div
                v-else
                class="space-y-1 max-h-24 overflow-y-auto scrollbar-thin"
              >
                <div
                  v-for="file in info.logFiles"
                  :key="file.name"
                  class="flex-between text-[11px] text-muted-foreground"
                >
                  <span class="font-mono text-foreground truncate">{{ file.name }}</span>
                  <span class="shrink-0 ml-2 tabular-nums">{{ formatBytes(file.sizeBytes) }}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </template>
    </template>
  </div>
</template>
