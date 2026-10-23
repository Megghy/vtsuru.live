<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { getApiLiveCurrent } from '@/api/generated/live/live'
import type { ResponseCurrentLiveModel } from '@/api/generated/model'
import { useTranscription } from '@/apps/client/store/useTranscription'
import { createTranscriptionProfile, useTranscriptionSettings } from '@/apps/client/store/useTranscriptionSettings'
import {
  clientSupportsTranscription,
  clientVersion,
  TRANSCRIPTION_MIN_CLIENT_VERSION,
} from '@/shared/config/clientVersion'
import type { TranscriptionProfile, TranscriptionProvider } from '@/shared/models/transcription'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { useWebFetcher } from '@/store/useWebFetcher'

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
  return [
    {
      state: isSupported.value ? 'ok' : 'bad',
      label: isSupported.value ? `客户端 ${version}` : `需要客户端 ${TRANSCRIPTION_MIN_CLIENT_VERSION} 或更高版本`,
    },
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

onMounted(() => {
  void settingsStore.init()
  void refreshLive()
  liveTimer = setInterval(() => void refreshLive(), 15_000)
})

onUnmounted(() => {
  if (liveTimer) clearInterval(liveTimer)
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
    const current = (await getApiLiveCurrent()) as unknown as {
      code: number
      message?: string
      data?: ResponseCurrentLiveModel
    }
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

// 动态热词输入
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
          class="text-xs"
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
          class="flex items-center gap-2 text-[13px]"
        >
          <span
            class="size-1.5 rounded-full shrink-0"
            :class="item.state === 'ok' ? 'bg-emerald-500' : 'bg-destructive'"
          />
          <span :class="item.state === 'ok' ? 'text-foreground' : 'text-muted-foreground'">
            {{ item.label }}
          </span>
        </div>
      </div>

      <div class="min-h-8 flex items-center gap-3">
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
      </div>

      <Alert
        v-if="notice"
        class="py-2 px-2.5"
        :class="notice.class"
      >
        <AlertDescription class="text-xs m-0">
          {{ notice.text }}
        </AlertDescription>
      </Alert>

      <div
        ref="transcriptEl"
        class="max-h-80 overflow-auto p-2.5 px-3 border border-border rounded-md bg-muted"
      >
        <div
          v-if="!transcription.lines.length && !transcription.partialText"
          class="text-muted-foreground text-[13px]"
        >
          开始后在这里显示本场字幕
        </div>
        <div
          v-for="(line, index) in transcription.lines"
          :key="`${line.startMs}-${index}`"
          class="flex gap-2.5 py-0.5 text-[13px] leading-relaxed"
        >
          <span class="shrink-0 w-10 text-muted-foreground tabular-nums">{{ formatOffset(line.startMs) }}</span>
          <span>{{ line.text }}</span>
        </div>
        <div
          v-if="transcription.partialText"
          class="flex gap-2.5 py-0.5 text-[13px] leading-relaxed text-muted-foreground"
        >
          <span class="shrink-0 w-10 text-muted-foreground tabular-nums">…</span>
          <span>{{ transcription.partialText }}</span>
        </div>
      </div>
    </section>

    <div class="h-px bg-border my-1" />

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
            class="h-6 text-[11px]"
            :disabled="isRunning"
            @click="addProfile('tencent')"
          >
            新增腾讯云
          </Button>
          <Button
            size="xs"
            variant="outline"
            class="h-6 text-[11px]"
            :disabled="isRunning"
            @click="addProfile('openai')"
          >
            新增 OpenAI
          </Button>
        </div>
      </div>

      <div class="min-h-8 flex items-center gap-2">
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
                class="text-xs"
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
        class="space-y-3 pt-2 text-xs"
      >
        <div class="flex items-center gap-3">
          <span class="w-24 text-muted-foreground shrink-0">配置名称</span>
          <Input
            v-model="activeProfile.name"
            :disabled="isRunning"
            placeholder="用于区分本地配置"
            class="flex-1"
          />
        </div>

        <div class="flex items-center gap-3">
          <span class="w-24 text-muted-foreground shrink-0">识别服务</span>
          <div class="flex-1">
            <Select
              :model-value="activeProfile.provider"
              :disabled="isRunning"
              @update:model-value="changeProvider"
            >
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="tencent"
                  class="text-xs"
                  >腾讯云</SelectItem
                >
                <SelectItem
                  value="openai"
                  class="text-xs"
                  >OpenAI</SelectItem
                >
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="w-24 text-muted-foreground shrink-0">识别语言</span>
          <div class="flex-1">
            <Select
              v-model="activeProfile.language"
              :disabled="isRunning"
            >
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in languageOptions"
                  :key="opt.value"
                  :value="opt.value"
                  class="text-xs"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <template v-if="activeTencentProfile">
          <div class="flex items-center gap-3">
            <span class="w-24 text-muted-foreground shrink-0">引擎模型</span>
            <div class="flex-1">
              <Select
                v-model="activeTencentProfile.engineModelType"
                :disabled="isRunning"
              >
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in tencentModelOptions"
                    :key="opt.value"
                    :value="opt.value"
                    class="text-xs"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span class="w-24 text-muted-foreground shrink-0">App ID</span>
            <Input
              v-model="activeTencentProfile.appId"
              :disabled="isRunning"
              class="flex-1"
            />
          </div>

          <div class="flex items-center gap-3">
            <span class="w-24 text-muted-foreground shrink-0">Secret ID</span>
            <Input
              v-model="activeTencentProfile.secretId"
              type="password"
              :disabled="isRunning"
              class="flex-1"
            />
          </div>

          <div class="flex items-center gap-3">
            <span class="w-24 text-muted-foreground shrink-0">Secret Key</span>
            <Input
              v-model="activeTencentProfile.secretKey"
              type="password"
              :disabled="isRunning"
              class="flex-1"
            />
          </div>
        </template>

        <template v-else-if="activeOpenAIProfile">
          <div class="flex items-center gap-3">
            <span class="w-24 text-muted-foreground shrink-0">模型</span>
            <Input
              v-model="activeOpenAIProfile.model"
              :disabled="isRunning"
              placeholder="gpt-live-transcribe"
              class="flex-1"
            />
          </div>

          <div class="flex items-center gap-3">
            <span class="w-24 text-muted-foreground shrink-0">API 地址</span>
            <Input
              v-model="activeOpenAIProfile.baseUrl"
              :disabled="isRunning"
              placeholder="wss://api.openai.com/v1/realtime"
              class="flex-1"
            />
          </div>

          <div class="flex items-center gap-3">
            <span class="w-24 text-muted-foreground shrink-0">API Key</span>
            <Input
              v-model="activeOpenAIProfile.apiKey"
              type="password"
              :disabled="isRunning"
              class="flex-1"
            />
          </div>
        </template>

        <div class="flex items-start gap-3">
          <span class="w-24 text-muted-foreground shrink-0 pt-1.5">热词</span>
          <div class="flex-1 flex flex-wrap items-center gap-1.5">
            <Badge
              v-for="(word, wIdx) in activeProfile.hotwords || []"
              :key="wIdx"
              variant="secondary"
              class="text-xs h-6 px-2 gap-1"
            >
              <span>{{ word }}</span>
              <button
                type="button"
                :disabled="isRunning"
                class="hover:text-destructive transition-colors ml-0.5 text-muted-foreground"
                @click="removeHotword(wIdx)"
              >
                ✕
              </button>
            </Badge>
            <div class="flex items-center gap-1">
              <Input
                v-model="newHotword"
                :disabled="isRunning"
                placeholder="+ 新增热词"
                class="h-6 w-24"
                @keyup.enter="addHotword"
              />
              <Button
                size="xs"
                variant="ghost"
                class="h-6 px-1.5"
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
