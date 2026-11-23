<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { useClipboard } from '@vueuse/core'
import { Download, FolderOpen, RefreshCw, RotateCcw } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { getApiLiveCurrent } from '@/api/generated/live/live'
import { useTranscription } from '@/apps/client/store/useTranscription'
import { createTranscriptionProfile, useTranscriptionSettings } from '@/apps/client/store/useTranscriptionSettings'
import { isTauri } from '@/shared/config'
import {
  clientSupportsTranscription,
  clientVersion,
  TRANSCRIPTION_MIN_CLIENT_VERSION,
} from '@/shared/config/clientVersion'
import type { TranscriptionProfile, TranscriptionProvider } from '@/shared/models/transcription'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Progress } from '@/shared/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { Tag } from '@/shared/ui/tag'
import { useWebFetcher } from '@/store/useWebFetcher'

interface FfmpegStatus {
  available: boolean
  path?: string | null
  source: 'custom' | 'local' | 'system' | 'none'
  version?: string | null
  customPath?: string | null
  canAutoDownload: boolean
  downloading: boolean
}

interface FfmpegDownloadProgress {
  downloaded: number
  total?: number | null
  percent?: number | null
}

const { copy } = useClipboard()
const settingsStore = useTranscriptionSettings()
const transcription = useTranscription()
const account = useAccount()
const webFetcher = useWebFetcher()
const activeProfile = computed(() => settingsStore.activeProfile)
const activeOpenAIProfile = computed(() =>
  settingsStore.activeProfile?.provider === 'openai' ? settingsStore.activeProfile : undefined,
)
const activeTencentProfile = computed(() =>
  settingsStore.activeProfile?.provider === 'tencent' ? settingsStore.activeProfile : undefined,
)
const isRunning = computed(() => transcription.status.running)
const isBusy = computed(() =>
  ['resolving_stream', 'connecting_provider', 'starting_ffmpeg', 'stopping'].includes(transcription.status.phase),
)
const isSupported = computed(() => clientSupportsTranscription())

// FFmpeg 状态与引导安装
const ffmpegStatus = ref<FfmpegStatus | null>(null)
const ffmpegLoading = ref(false)
const ffmpegDownloading = ref(false)
const ffmpegProgress = ref<FfmpegDownloadProgress | null>(null)
let unlistenFfmpegProgress: (() => void) | null = null

const ffmpegSourceLabel = computed(() => {
  switch (ffmpegStatus.value?.source) {
    case 'custom':
      return '自定义路径'
    case 'local':
      return '客户端内置'
    case 'system':
      return '系统 PATH'
    default:
      return '未安装'
  }
})

async function refreshFfmpegStatus() {
  if (!isTauri()) return
  ffmpegLoading.value = true
  try {
    ffmpegStatus.value = await invoke<FfmpegStatus>('get_ffmpeg_status')
  } catch (err) {
    console.warn('[Transcription] 查询 FFmpeg 状态失败:', err)
  } finally {
    ffmpegLoading.value = false
  }
}

async function handleDownloadFfmpeg() {
  if (!isTauri() || ffmpegDownloading.value) return
  ffmpegDownloading.value = true
  ffmpegProgress.value = { downloaded: 0, total: null, percent: 0 }
  try {
    ffmpegStatus.value = await invoke<FfmpegStatus>('download_ffmpeg')
    toast.success('FFmpeg 安装并校验完成')
  } catch (err) {
    toast.error(`下载 FFmpeg 失败: ${err}`)
  } finally {
    ffmpegDownloading.value = false
    ffmpegProgress.value = null
  }
}

async function handlePickCustomFfmpeg() {
  if (!isTauri()) return
  const selected = await open({
    title: '选择 FFmpeg 可执行文件',
    directory: false,
    multiple: false,
    filters: [{ name: 'FFmpeg', extensions: ['exe', 'bin', '*'] }],
  })
  if (typeof selected !== 'string') return

  try {
    ffmpegStatus.value = await invoke<FfmpegStatus>('set_custom_ffmpeg_path', { path: selected })
    settingsStore.settings.customFfmpegPath = selected
    await settingsStore.save()
    toast.success('已配置自定义 FFmpeg 路径')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

async function handleResetCustomFfmpeg() {
  if (!isTauri()) return
  try {
    ffmpegStatus.value = await invoke<FfmpegStatus>('set_custom_ffmpeg_path', { path: null })
    settingsStore.settings.customFfmpegPath = undefined
    await settingsStore.save()
    toast.success('已清除自定义 FFmpeg 路径')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : String(err))
  }
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const obsSubtitleUrl = computed(() => {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const channel = settingsStore.settings.obsSubtitleChannel
  return buildObsSourceUrl({
    path: '/obs-store/subtitle',
    host: origin,
    credential: 'public-id',
    userId: account.value.id,
    params: channel && channel !== 'default' ? { channel } : undefined,
  })
})

async function copyObsSubtitleUrl() {
  await copy(obsSubtitleUrl.value)
  toast.success('已复制 OBS 字幕条地址')
}

async function toggleObsSubtitleSync(enabled: boolean) {
  settingsStore.settings.syncObsSubtitle = enabled
  await settingsStore.save()
}
const transcriptEl = ref<HTMLElement>()
const liveState = ref<'loading' | 'ready' | 'missing' | 'unknown'>('loading')
const liveTitle = ref('')
let liveTimer: ReturnType<typeof setInterval> | undefined

const profileOptions = computed(() =>
  settingsStore.settings.profiles.map((profile) => ({
    label: `${profile.name} · ${profile.provider === 'tencent' ? '腾讯云' : 'OpenAI'}`,
    value: profile.id,
  })),
)

const languageOptions = [
  { label: '中文（普通话）', value: 'zh-CN' },
  { label: '中文', value: 'zh' },
  { label: '英语', value: 'en' },
  { label: '日语', value: 'ja' },
]

const tencentModelOptions = [
  { label: '中文通用 16k', value: '16k_zh' },
  { label: '中文增强 16k', value: '16k_zh_large' },
  { label: '英语 16k', value: '16k_en' },
  { label: '粤语 16k', value: '16k_yue' },
]

const credentialsReady = computed(() => profileReady(activeProfile.value))

const readiness = computed(() => {
  const version = clientVersion.value
  const roomId = account.value.biliRoomId
  const fetcherReady = webFetcher.state === 'connected'
  const ffmpegItem: { state: 'ok' | 'bad' | 'pending'; label: string } = !ffmpegStatus.value
    ? { state: 'pending', label: '正在检测 FFmpeg 环境' }
    : ffmpegStatus.value.available
      ? { state: 'ok', label: `FFmpeg 就绪 (${ffmpegSourceLabel.value})` }
      : { state: 'bad', label: '未检测到 FFmpeg（请在下方一键安装或指定路径）' }

  return [
    {
      state: isSupported.value ? 'ok' : 'bad',
      label: isSupported.value ? `客户端 ${version}` : `需要客户端 ${TRANSCRIPTION_MIN_CLIENT_VERSION} 或更高版本`,
    },
    ffmpegItem,
    {
      state: roomId ? 'ok' : 'bad',
      label: roomId ? `直播间 ${roomId}` : '未绑定 Bilibili 直播间',
    },
    {
      state: fetcherReady ? 'ok' : 'bad',
      label: fetcherReady ? 'EventFetcher 已连接' : 'EventFetcher 未连接',
    },
    liveReadiness(),
    {
      state: credentialsReady.value ? 'ok' : 'bad',
      label: credentialsReady.value ? '识别服务凭据已填写' : '识别服务凭据未填完',
    },
  ] as { state: 'ok' | 'bad' | 'pending'; label: string }[]
})

const startBlocked = computed(
  () => liveState.value === 'loading' || readiness.value.some((item) => item.state === 'bad'),
)

const statusMeta = computed(() => {
  switch (transcription.status.phase) {
    case 'resolving_stream':
      return { class: 'border-amber-500/40 text-amber-600 bg-amber-500/10', text: '正在获取播放流' }
    case 'connecting_provider':
      return { class: 'border-amber-500/40 text-amber-600 bg-amber-500/10', text: '正在连接识别服务' }
    case 'starting_ffmpeg':
      return { class: 'border-amber-500/40 text-amber-600 bg-amber-500/10', text: '正在启动 FFmpeg' }
    case 'running':
      return { class: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10', text: '转写中' }
    case 'reconnecting':
      return { class: 'border-amber-500/40 text-amber-600 bg-amber-500/10', text: '正在重连' }
    case 'stopping':
      return { class: 'border-amber-500/40 text-amber-600 bg-amber-500/10', text: '正在停止' }
    case 'error':
      return { class: 'border-destructive/40 text-destructive bg-destructive/10', text: '已停止' }
    default:
      return { class: 'border-border text-muted-foreground', text: '未运行' }
  }
})

const notice = computed(() => {
  if (transcription.status.phase === 'reconnecting') {
    const headline = transcription.status.message || '连接中断，正在重新连接'
    const detail = transcription.runtimeError
    return {
      class: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
      text: detail ? `${headline}：${detail}` : headline,
    }
  }
  if (transcription.runtimeError && transcription.status.phase === 'error') {
    return { class: 'border-destructive/20 bg-destructive/10 text-destructive', text: transcription.runtimeError }
  }
  if (transcription.archivePaused || transcription.uploadError) {
    return {
      class: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
      text: transcription.uploadError || '归档暂停，转写仍在继续',
    }
  }
  if (transcription.status.message)
    return {
      class: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
      text: transcription.status.message,
    }
  return undefined
})

const sourceLabel = computed(() => {
  const { sourceProtocol, sourceFormat } = transcription.status
  if (!sourceProtocol && !sourceFormat) return ''
  return [sourceProtocol, sourceFormat].filter(Boolean).join(' · ')
})

const saveSettings = useDebounceFn(() => settingsStore.save(), 300)
watch(() => settingsStore.settings, saveSettings, { deep: true })
watch(
  () => [transcription.lines.length, transcription.partialText] as const,
  async () => {
    await nextTick()
    const el = transcriptEl.value
    if (el) el.scrollTop = el.scrollHeight
  },
)

onMounted(async () => {
  await settingsStore.init()
  void refreshFfmpegStatus()
  void refreshLive()
  liveTimer = setInterval(() => void refreshLive(), 15_000)

  if (isTauri()) {
    unlistenFfmpegProgress = await listen<FfmpegDownloadProgress>('ffmpeg://download-progress', (event) => {
      ffmpegProgress.value = event.payload
    })
  }
})

onUnmounted(() => {
  if (liveTimer) clearInterval(liveTimer)
  unlistenFfmpegProgress?.()
})

function liveReadiness() {
  if (liveState.value === 'loading') return { state: 'pending' as const, label: '正在确认直播归档' }
  if (liveState.value === 'ready') return { state: 'ok' as const, label: `正在归档：${liveTitle.value}` }
  if (liveState.value === 'unknown') return { state: 'pending' as const, label: '暂时无法确认是否有正在归档的直播' }
  return { state: 'bad' as const, label: '当前没有正在归档的直播' }
}

function profileReady(profile: TranscriptionProfile | undefined) {
  if (!profile) return false
  if (profile.provider === 'tencent') return !!(profile.appId && profile.secretId && profile.secretKey)
  return !!profile.apiKey
}

async function refreshLive() {
  try {
    const current = await getApiLiveCurrent()
    const live = current.code === 200 ? current.data?.live : undefined
    if (current.code !== 200) {
      liveState.value = 'unknown'
      liveTitle.value = ''
      return
    }
    if (live && !live.isFinish) {
      liveState.value = 'ready'
      liveTitle.value = live.title || '未命名直播'
      return
    }
    liveState.value = 'missing'
    liveTitle.value = ''
  } catch {
    liveState.value = 'unknown'
    liveTitle.value = ''
  }
}

function formatOffset(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function addProfile(provider: TranscriptionProvider) {
  settingsStore.addProfile(provider)
}

function changeProvider(provider: string) {
  const current = activeProfile.value
  if (!current || current.provider === provider) return
  const replacement = createTranscriptionProfile(provider as TranscriptionProvider)
  replacement.id = current.id
  replacement.name = current.name
  const index = settingsStore.settings.profiles.findIndex((profile) => profile.id === current.id)
  settingsStore.settings.profiles[index] = replacement
}

async function start() {
  try {
    await settingsStore.save()
    await transcription.start()
    toast.success('实时转写已启动')
  } catch (error) {
    toast.error(`启动转写失败: ${error}`)
  }
}

async function stop() {
  try {
    await transcription.stop()
    toast.success('实时转写已停止')
  } catch (error) {
    toast.error(`停止转写失败: ${error}`)
  }
}

const newHotword = ref('')
function addHotword() {
  const val = newHotword.value.trim()
  if (!val || !activeProfile.value) return
  if (!activeProfile.value.hotwords) activeProfile.value.hotwords = []
  if (!activeProfile.value.hotwords.includes(val)) {
    activeProfile.value.hotwords.push(val)
  }
  newHotword.value = ''
}
function removeHotword(index: number) {
  if (!activeProfile.value?.hotwords) return
  activeProfile.value.hotwords.splice(index, 1)
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <section class="flex flex-col gap-3">
      <div class="flex justify-between items-center">
        <div>
          <span class="font-semibold text-sm text-foreground">运行状态</span>
          <div class="mt-0.5 text-xs text-muted-foreground">
            最终字幕会归档到当前直播。临时结果只在本机显示。凭据只保存在本机。
          </div>
        </div>
        <Badge
          variant="outline"
          :class="statusMeta.class"
        >
          {{ statusMeta.text }}
        </Badge>
      </div>

      <div
        v-if="!isRunning"
        class="flex flex-col gap-1.5"
      >
        <div
          v-for="item in readiness"
          :key="item.label"
          class="flex items-center gap-2 text-xs"
        >
          <span
            class="size-1.5 rounded-full shrink-0"
            :class="item.state === 'ok' ? 'bg-emerald-500' : item.state === 'pending' ? 'bg-amber-500' : 'bg-destructive'"
          />
          <span :class="item.state === 'ok' ? 'text-foreground' : 'text-muted-foreground'">
            {{ item.label }}
          </span>
        </div>
      </div>

      <!-- FFmpeg 环境与引导安装 -->
      <div
        v-if="isTauri()"
        class="p-3 rounded-md border border-border bg-muted/30 space-y-2.5"
      >
        <div class="flex-between gap-2 flex-wrap">
          <div class="space-y-0.5 min-w-0">
            <div class="flex items-center gap-2 text-xs font-medium text-foreground">
              <span>音频解码组件 (FFmpeg)</span>
              <Badge
                :variant="ffmpegStatus?.available ? 'success' : 'warning'"
                size="xs"
              >
                {{ ffmpegStatus?.available ? `已就绪 · ${ffmpegSourceLabel}` : '未安装' }}
              </Badge>
            </div>
            <div
              v-if="ffmpegStatus?.path"
              class="text-[11px] text-muted-foreground font-mono truncate max-w-[460px]"
              :title="ffmpegStatus.path"
            >
              {{ ffmpegStatus.path }}
            </div>
            <div
              v-else
              class="text-[11px] text-muted-foreground"
            >
              实时转写依赖 FFmpeg 抽取直播间 PCM 音频流，支持一键下载内置版本或手动指定本机路径。
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <Button
              v-if="ffmpegStatus?.canAutoDownload && (!ffmpegStatus.available || ffmpegStatus.source === 'none')"
              size="xs"
              class="gap-1"
              :disabled="ffmpegDownloading || isRunning"
              @click="handleDownloadFfmpeg"
            >
              <Download class="size-3" />
              <span>{{ ffmpegDownloading ? '下载中...' : '一键安装 FFmpeg' }}</span>
            </Button>

            <Button
              size="xs"
              variant="outline"
              class="gap-1"
              :disabled="ffmpegDownloading || isRunning"
              @click="handlePickCustomFfmpeg"
            >
              <FolderOpen class="size-3" />
              <span>指定本地路径</span>
            </Button>

            <Button
              v-if="ffmpegStatus?.customPath"
              size="xs"
              variant="ghost"
              class="gap-1"
              :disabled="ffmpegDownloading || isRunning"
              @click="handleResetCustomFfmpeg"
            >
              <RotateCcw class="size-3" />
              <span>恢复默认</span>
            </Button>

            <Button
              size="icon-xs"
              variant="ghost"
              aria-label="重新检测 FFmpeg"
              :disabled="ffmpegLoading || ffmpegDownloading"
              @click="refreshFfmpegStatus"
            >
              <RefreshCw
                class="size-3"
                :class="{ 'animate-spin': ffmpegLoading }"
              />
            </Button>
          </div>
        </div>

        <div
          v-if="ffmpegDownloading && ffmpegProgress"
          class="space-y-1"
        >
          <Progress :model-value="ffmpegProgress.percent ?? 0" />
          <div class="flex-between text-[11px] text-muted-foreground tabular-nums">
            <span>正在下载并校验 FFmpeg...</span>
            <span>
              {{ formatMb(ffmpegProgress.downloaded) }}
              <template v-if="ffmpegProgress.total"> / {{ formatMb(ffmpegProgress.total) }}</template>
              <template v-if="ffmpegProgress.percent != null"> ({{ Math.round(ffmpegProgress.percent) }}%)</template>
            </span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <Button
          v-if="!isRunning"
          :disabled="startBlocked || isBusy"
          @click="start"
        >
          {{ isBusy ? '启动中...' : '开始转写' }}
        </Button>
        <Button
          v-else
          variant="destructive"
          :disabled="isBusy"
          @click="stop"
        >
          {{ isBusy ? '停止中...' : '停止转写' }}
        </Button>
        <span class="text-xs text-muted-foreground">
          已归档 {{ transcription.archivedCount }} 条
          <template v-if="transcription.pendingCount"> ，待上传 {{ transcription.pendingCount }} 条 </template>
          <template v-if="sourceLabel"> · {{ sourceLabel }} </template>
        </span>
        <div class="ml-auto flex items-center gap-2 text-xs">
          <Switch
            :checked="Boolean(settingsStore.settings.syncObsSubtitle)"
            @update:checked="(v) => void toggleObsSubtitleSync(Boolean(v))"
          />
          <span class="text-muted-foreground">推送 OBS 字幕条</span>
          <Button
            v-if="settingsStore.settings.syncObsSubtitle"
            size="xs"
            variant="outline"
            @click="copyObsSubtitleUrl"
          >
            复制 OBS 地址
          </Button>
        </div>
      </div>

      <Alert
        v-if="notice"
        size="sm"
        :class="notice.class"
      >
        <AlertDescription class="m-0">
          {{ notice.text }}
        </AlertDescription>
      </Alert>

      <div
        ref="transcriptEl"
        class="max-h-80 overflow-auto scrollbar-thin p-2.5 px-3 border border-border rounded-md bg-muted"
      >
        <div
          v-if="!transcription.lines.length && !transcription.partialText"
          class="text-muted-foreground text-xs"
        >
          开始后在这里显示本场字幕
        </div>
        <div
          v-for="(line, index) in transcription.lines"
          :key="`${line.startMs}-${index}`"
          class="flex gap-2.5 py-0.5 text-xs leading-relaxed"
        >
          <span class="shrink-0 w-10 text-muted-foreground tabular-nums">{{ formatOffset(line.startMs) }}</span>
          <span>{{ line.text }}</span>
        </div>
        <div
          v-if="transcription.partialText"
          class="flex gap-2.5 py-0.5 text-xs leading-relaxed text-muted-foreground"
        >
          <span class="shrink-0 w-10 text-muted-foreground tabular-nums">…</span>
          <span>{{ transcription.partialText }}</span>
        </div>
      </div>
    </section>

    <Separator class="my-1" />

    <section class="flex flex-col gap-3">
      <div class="flex justify-between items-center">
        <div>
          <span class="font-semibold text-sm text-foreground">识别服务</span>
          <div class="mt-0.5 text-xs text-muted-foreground">可保存多个本地配置，启动时使用当前选中的配置。</div>
        </div>
        <div class="flex items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            :disabled="isRunning"
            @click="addProfile('tencent')"
          >
            新增腾讯云
          </Button>
          <Button
            size="xs"
            variant="outline"
            :disabled="isRunning"
            @click="addProfile('openai')"
          >
            新增 OpenAI
          </Button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex-1 min-w-[260px]">
          <Select
            v-model="settingsStore.settings.activeProfileId"
            :disabled="isRunning"
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择配置" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in profileOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Popconfirm
          title="确认删除"
          :disabled="settingsStore.settings.profiles.length === 1 || isRunning"
          @positive-click="settingsStore.removeActiveProfile()"
        >
          <template #trigger>
            <Button
              variant="outline"
              class="border-destructive/40 text-destructive hover:bg-destructive/10"
              :disabled="settingsStore.settings.profiles.length === 1 || isRunning"
            >
              删除
            </Button>
          </template>
          删除后本地保存的该组凭据也会一并移除。
        </Popconfirm>
      </div>

      <div
        v-if="activeProfile"
        class="space-y-1 pt-2 text-xs"
      >
        <SettingRow
          v-model="activeProfile.name"
          type="text"
          variant="line"
          title="配置名称"
          :disabled="isRunning"
          placeholder="用于区分本地配置"
          control-class="w-full flex-1"
        />

        <SettingRow
          type="select"
          variant="line"
          title="识别服务"
          :options="[
            { label: '腾讯云', value: 'tencent' },
            { label: 'OpenAI', value: 'openai' },
          ]"
          :disabled="isRunning"
          control-class="w-full flex-1"
          :model-value="activeProfile.provider"
          @change="changeProvider"
        />

        <SettingRow
          v-model="activeProfile.language"
          type="select"
          variant="line"
          title="识别语言"
          :options="languageOptions"
          :disabled="isRunning"
          control-class="w-full flex-1"
        />

        <template v-if="activeTencentProfile">
          <SettingRow
            v-model="activeTencentProfile.engineModelType"
            type="select"
            variant="line"
            title="引擎模型"
            :options="tencentModelOptions"
            :disabled="isRunning"
            control-class="w-full flex-1"
          />

          <SettingRow
            v-model="activeTencentProfile.appId"
            type="text"
            variant="line"
            title="App ID"
            :disabled="isRunning"
            control-class="w-full flex-1"
          />

          <SettingRow
            variant="line"
            title="Secret ID"
          >
            <Input
              v-model="activeTencentProfile.secretId"
              type="password"
              :disabled="isRunning"
              class="w-48"
            />
          </SettingRow>

          <SettingRow
            variant="line"
            title="Secret Key"
          >
            <Input
              v-model="activeTencentProfile.secretKey"
              type="password"
              :disabled="isRunning"
              class="w-48"
            />
          </SettingRow>
        </template>

        <template v-else-if="activeOpenAIProfile">
          <SettingRow
            v-model="activeOpenAIProfile.model"
            type="text"
            variant="line"
            title="模型"
            :disabled="isRunning"
            placeholder="gpt-live-transcribe"
            control-class="w-full flex-1"
          />

          <SettingRow
            v-model="activeOpenAIProfile.baseUrl"
            type="text"
            variant="line"
            title="API 地址"
            :disabled="isRunning"
            placeholder="wss://api.openai.com/v1/realtime"
            control-class="w-full flex-1"
          />

          <SettingRow
            variant="line"
            title="API Key"
          >
            <Input
              v-model="activeOpenAIProfile.apiKey"
              type="password"
              :disabled="isRunning"
              class="w-48"
            />
          </SettingRow>
        </template>

        <div class="flex items-start gap-3">
          <span class="w-24 text-muted-foreground shrink-0 pt-1.5">热词</span>
          <div class="flex-1 flex flex-wrap items-center gap-1.5">
            <Tag
              v-for="(word, wIdx) in activeProfile.hotwords || []"
              :key="wIdx"
              variant="secondary"
              :closable="!isRunning"
              :disabled="isRunning"
              @close="removeHotword(wIdx)"
            >
              {{ word }}
            </Tag>
            <div class="flex items-center gap-1">
              <Input
                v-model="newHotword"
                :disabled="isRunning"
                placeholder="+ 新增热词"
                size="xs"
                class="w-24"
                @keyup.enter="addHotword"
              />
              <Button
                size="xs"
                variant="ghost"
                class="px-1.5"
                :disabled="isRunning || !newHotword.trim()"
                @click="addHotword"
              >
                添加
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
