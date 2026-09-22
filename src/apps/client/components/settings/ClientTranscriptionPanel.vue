<script setup lang="ts">
import {
  NAlert,
  NButton,
  NDivider,
  NDynamicTags,
  NFlex,
  NForm,
  NFormItem,
  NInput,
  NPopconfirm,
  NSelect,
  NTag,
  NText,
} from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponseCurrentLiveModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { useTranscription } from '@/apps/client/store/useTranscription'
import { createTranscriptionProfile, useTranscriptionSettings } from '@/apps/client/store/useTranscriptionSettings'
import { LIVE_API_URL } from '@/shared/config'
import {
  clientSupportsTranscription,
  clientVersion,
  TRANSCRIPTION_MIN_CLIENT_VERSION,
} from '@/shared/config/clientVersion'
import type { TranscriptionProfile, TranscriptionProvider } from '@/shared/models/transcription'
import { useWebFetcher } from '@/store/useWebFetcher'

const settingsStore = useTranscriptionSettings()
const transcription = useTranscription()
const account = useAccount()
const webFetcher = useWebFetcher()
const activeProfile = computed(() => settingsStore.activeProfile)
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
      label: isSupported.value
        ? `客户端 ${version}`
        : `需要客户端 ${TRANSCRIPTION_MIN_CLIENT_VERSION} 或更高版本`,
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
      return { type: 'warning' as const, text: '正在获取播放流' }
    case 'connecting_provider':
      return { type: 'warning' as const, text: '正在连接识别服务' }
    case 'starting_ffmpeg':
      return { type: 'warning' as const, text: '正在启动 FFmpeg' }
    case 'running':
      return { type: 'success' as const, text: '转写中' }
    case 'reconnecting':
      return { type: 'warning' as const, text: '正在重连' }
    case 'stopping':
      return { type: 'warning' as const, text: '正在停止' }
    case 'error':
      return { type: 'error' as const, text: '已停止' }
    default:
      return { type: 'default' as const, text: '未运行' }
  }
})

const notice = computed(() => {
  if (transcription.status.phase === 'reconnecting') {
    const headline = transcription.status.message || '连接中断，正在重新连接'
    const detail = transcription.runtimeError
    return { type: 'warning' as const, text: detail ? `${headline}：${detail}` : headline }
  }
  if (transcription.runtimeError && transcription.status.phase === 'error') {
    return { type: 'error' as const, text: transcription.runtimeError }
  }
  if (transcription.archivePaused || transcription.uploadError) {
    return { type: 'warning' as const, text: transcription.uploadError || '归档暂停，转写仍在继续' }
  }
  if (transcription.status.message) return { type: 'info' as const, text: transcription.status.message }
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
    const current = await QueryGetAPI<ResponseCurrentLiveModel>(`${LIVE_API_URL}current`)
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

function changeProvider(provider: TranscriptionProvider) {
  const current = activeProfile.value
  if (!current || current.provider === provider) return
  const replacement = createTranscriptionProfile(provider)
  replacement.id = current.id
  replacement.name = current.name
  const index = settingsStore.settings.profiles.findIndex((profile) => profile.id === current.id)
  settingsStore.settings.profiles[index] = replacement
}

async function start() {
  try {
    await settingsStore.save()
    await transcription.start()
    window.$message.success('实时转写已启动')
  } catch (error) {
    window.$message.error(`启动转写失败: ${error}`)
  }
}

async function stop() {
  try {
    await transcription.stop()
    window.$message.success('实时转写已停止')
  } catch (error) {
    window.$message.error(`停止转写失败: ${error}`)
  }
}
</script>

<template>
  <NFlex
    vertical
    :size="16"
  >
    <section class="setting-section">
      <NFlex
        justify="space-between"
        align="center"
      >
        <div>
          <NText strong>
            运行状态
          </NText>
          <div class="section-description">
            最终字幕会归档到当前直播。临时结果只在本机显示。凭据只保存在本机。
          </div>
        </div>
        <NTag
          :type="statusMeta.type"
          :bordered="false"
        >
          {{ statusMeta.text }}
        </NTag>
      </NFlex>

      <div
        v-if="!isRunning"
        class="readiness"
      >
        <div
          v-for="item in readiness"
          :key="item.label"
          class="readiness-item"
        >
          <span
            class="readiness-dot"
            :data-state="item.state"
          />
          <NText :depth="item.state === 'ok' ? undefined : 3">
            {{ item.label }}
          </NText>
        </div>
      </div>

      <NFlex
        class="runtime-actions"
        align="center"
      >
        <NButton
          v-if="!isRunning"
          type="primary"
          size="small"
          :loading="isBusy"
          :disabled="startBlocked"
          @click="start"
        >
          开始转写
        </NButton>
        <NButton
          v-else
          type="error"
          size="small"
          :loading="isBusy"
          @click="stop"
        >
          停止转写
        </NButton>
        <NText depth="3">
          已归档 {{ transcription.archivedCount }} 条
          <template v-if="transcription.pendingCount">
            ，待上传 {{ transcription.pendingCount }} 条
          </template>
          <template v-if="sourceLabel">
            · {{ sourceLabel }}
          </template>
        </NText>
      </NFlex>

      <NAlert
        v-if="notice"
        :type="notice.type"
        size="small"
        :bordered="false"
      >
        {{ notice.text }}
      </NAlert>

      <div
        ref="transcriptEl"
        class="transcript"
      >
        <div
          v-if="!transcription.lines.length && !transcription.partialText"
          class="transcript-empty"
        >
          开始后在这里显示本场字幕
        </div>
        <div
          v-for="(line, index) in transcription.lines"
          :key="`${line.startMs}-${index}`"
          class="transcript-line"
        >
          <span class="transcript-time">{{ formatOffset(line.startMs) }}</span>
          <span>{{ line.text }}</span>
        </div>
        <div
          v-if="transcription.partialText"
          class="transcript-line transcript-line--partial"
        >
          <span class="transcript-time">…</span>
          <span>{{ transcription.partialText }}</span>
        </div>
      </div>
    </section>

    <NDivider />

    <section class="setting-section">
      <NFlex
        justify="space-between"
        align="center"
      >
        <div>
          <NText strong>
            识别服务
          </NText>
          <div class="section-description">
            可保存多个本地配置，启动时使用当前选中的配置。
          </div>
        </div>
        <NFlex>
          <NButton
            size="tiny"
            :disabled="isRunning"
            @click="addProfile('tencent')"
          >
            新增腾讯云
          </NButton>
          <NButton
            size="tiny"
            :disabled="isRunning"
            @click="addProfile('openai')"
          >
            新增 OpenAI
          </NButton>
        </NFlex>
      </NFlex>

      <NFlex
        align="center"
        class="profile-picker"
      >
        <NSelect
          v-model:value="settingsStore.settings.activeProfileId"
          :options="profileOptions"
          :disabled="isRunning"
          style="min-width: 260px; flex: 1"
        />
        <NPopconfirm
          :disabled="settingsStore.settings.profiles.length === 1 || isRunning"
          @positive-click="settingsStore.removeActiveProfile()"
        >
          <template #trigger>
            <NButton
              size="small"
              type="error"
              secondary
              :disabled="settingsStore.settings.profiles.length === 1 || isRunning"
            >
              删除
            </NButton>
          </template>
          删除后本地保存的该组凭据也会一并移除。
        </NPopconfirm>
      </NFlex>

      <NForm
        v-if="activeProfile"
        label-placement="left"
        label-width="120"
        size="small"
        :disabled="isRunning"
      >
        <NFormItem label="配置名称">
          <NInput
            v-model:value="activeProfile.name"
            placeholder="用于区分本地配置"
          />
        </NFormItem>
        <NFormItem label="识别服务">
          <NSelect
            :value="activeProfile.provider"
            :options="[
              { label: '腾讯云', value: 'tencent' },
              { label: 'OpenAI', value: 'openai' },
            ]"
            @update:value="changeProvider"
          />
        </NFormItem>
        <NFormItem label="识别语言">
          <NSelect
            v-model:value="activeProfile.language"
            filterable
            tag
            :options="languageOptions"
          />
        </NFormItem>

        <template v-if="activeProfile.provider === 'tencent'">
          <NFormItem label="引擎模型">
            <NSelect
              v-model:value="activeProfile.engineModelType"
              filterable
              tag
              :options="tencentModelOptions"
            />
          </NFormItem>
          <NFormItem label="App ID">
            <NInput v-model:value="activeProfile.appId" />
          </NFormItem>
          <NFormItem label="Secret ID">
            <NInput
              v-model:value="activeProfile.secretId"
              type="password"
              show-password-on="click"
            />
          </NFormItem>
          <NFormItem label="Secret Key">
            <NInput
              v-model:value="activeProfile.secretKey"
              type="password"
              show-password-on="click"
            />
          </NFormItem>
        </template>

        <template v-else>
          <NFormItem label="模型">
            <NInput
              v-model:value="activeProfile.model"
              placeholder="gpt-live-transcribe"
            />
          </NFormItem>
          <NFormItem label="API 地址">
            <NInput
              v-model:value="activeProfile.baseUrl"
              placeholder="wss://api.openai.com/v1/realtime"
            />
          </NFormItem>
          <NFormItem label="API Key">
            <NInput
              v-model:value="activeProfile.apiKey"
              type="password"
              show-password-on="click"
            />
          </NFormItem>
        </template>

        <NFormItem label="热词">
          <NDynamicTags v-model:value="activeProfile.hotwords" />
        </NFormItem>
      </NForm>
    </section>
  </NFlex>
</template>

<style scoped>
.setting-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-description {
  margin-top: 2px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.runtime-actions,
.profile-picker {
  min-height: 32px;
}

.readiness {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.readiness-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.readiness-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vtsuru-fg-muted);
  flex: none;
}

.readiness-dot[data-state='ok'] {
  background: var(--vtsuru-success, #18a058);
}

.readiness-dot[data-state='bad'] {
  background: var(--vtsuru-error, #d03050);
}

.transcript {
  max-height: 320px;
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  background: var(--vtsuru-bg-muted);
}

.transcript-empty {
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}

.transcript-line {
  display: flex;
  gap: 10px;
  padding: 3px 0;
  font-size: 13px;
  line-height: 1.5;
}

.transcript-line--partial {
  color: var(--vtsuru-fg-muted);
}

.transcript-time {
  flex: none;
  width: 42px;
  color: var(--vtsuru-fg-muted);
  font-variant-numeric: tabular-nums;
}
</style>
