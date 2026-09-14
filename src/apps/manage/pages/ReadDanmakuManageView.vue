<script setup lang="ts">
import {
  ChartMultiple24Regular,
  CloudArrowDown20Filled,
  DocumentText24Regular,
  Mic24Filled,
  MicOff24Filled,
  Next20Filled,
  Pause20Filled,
  Play20Filled,
  ShieldCheckmark24Regular,
  Speaker224Regular,
  SpeakerSettings24Regular,
} from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCard,
  NFlex,
  NGrid,
  NGridItem,
  NIcon,
  NPopconfirm,
  NSpin,
  NStatistic,
  NTabPane,
  NTabs,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import AdvancedSettingsPanel from '@/apps/open-live/components/read-danmaku/AdvancedSettingsPanel.vue'
import FilterSettingsPanel from '@/apps/open-live/components/read-danmaku/FilterSettingsPanel.vue'
import QueueList from '@/apps/open-live/components/read-danmaku/QueueList.vue'
import SpokenHistoryPanel from '@/apps/open-live/components/read-danmaku/SpokenHistoryPanel.vue'
import TemplateSettingsPanel from '@/apps/open-live/components/read-danmaku/TemplateSettingsPanel.vue'
import VoiceSettingsPanel from '@/apps/open-live/components/read-danmaku/VoiceSettingsPanel.vue'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useSpeechService } from '@/store/useSpeechService'

const props = withDefaults(
  defineProps<{
    roomInfo?: any
    code?: string | undefined
    isOpenLive?: boolean
    autoConnect?: boolean
  }>(),
  {
    autoConnect: true,
  },
)

const message = useMessage()
const accountInfo = useAccount()
const client = useDanmakuClient()
const speechService = useSpeechService()

const { settings, speechState, speakQueue, readedDanmaku, isPaused, speechSynthesisInfo, apiAudio } = speechService

const audioOutputDevices = ref<{ label: string; value: string }[]>([])
const audioOutputDevicesLoading = ref(false)
let mounted = false
let keydownBound = false

const queueStats = computed(() => {
  const total = speakQueue.value.length
  const gifts = speakQueue.value.filter((i) => i.data.type === EventDataTypes.Gift).length
  const messages = speakQueue.value.filter((i) => i.data.type === EventDataTypes.Message).length
  return { total, gifts, messages }
})

const lastEventTime = computed(() => (client.lastEventAt ? new Date(client.lastEventAt).toLocaleTimeString() : ''))
const supportsFollow = computed(() => {
  const sourceType = client.danmakuClient?.type
  return sourceType ? sourceType !== 'openlive' : !props.autoConnect
})

async function fetchAudioOutputDevices() {
  audioOutputDevicesLoading.value = true
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const devices = await navigator.mediaDevices.enumerateDevices()
    audioOutputDevices.value = [
      { label: '默认设备', value: 'default' },
      ...devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d) => ({
          label: d.label || `设备 ${d.deviceId.substring(0, 8)}`,
          value: d.deviceId,
        })),
    ]
  } catch {
    /* ignore */
  } finally {
    audioOutputDevicesLoading.value = false
  }
}

async function setAudioOutputDevice() {
  if (!apiAudio.value || !settings.value.outputDeviceId) return
  try {
    if (typeof apiAudio.value.setSinkId === 'function') await apiAudio.value.setSinkId(settings.value.outputDeviceId)
  } catch {
    /* ignore */
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.key === ' ' && e.ctrlKey) {
    e.preventDefault()
    speechService.togglePause()
  }
  if (e.key === 'n' && e.ctrlKey) {
    e.preventDefault()
    speechService.skipCurrent()
  }
  if (e.key === 'q' && e.ctrlKey) {
    e.preventDefault()
    speechService.clearQueue()
  }
}

function bindKeydown() {
  if (keydownBound) return
  document.addEventListener('keydown', onKeydown)
  keydownBound = true
}

function unbindKeydown() {
  if (!keydownBound) return
  document.removeEventListener('keydown', onKeydown)
  keydownBound = false
}

onMounted(async () => {
  mounted = true
  bindKeydown()
  await speechService.initialize()
  if (!mounted) return
  await client.ensureOpenlive({ connect: props.autoConnect })
  if (!mounted) return
  await fetchAudioOutputDevices()
  if (!mounted) return
  navigator.mediaDevices?.addEventListener('devicechange', fetchAudioOutputDevices)
})

onBeforeUnmount(() => {
  mounted = false
  navigator.mediaDevices?.removeEventListener('devicechange', fetchAudioOutputDevices)
  unbindKeydown()
})

onActivated(bindKeydown)

onDeactivated(unbindKeydown)
</script>

<template>
  <div class="read-danmaku-manage-view">
    <ManagePageHeader
      title="弹幕朗读与语音播报"
      description="实时将直播间弹幕、礼物、舰长及关注事件转换为自然语音播报，支持多引擎驱动与精细化过滤"
    >
      <template #actions>
        <NFlex align="center" :size="8">
          <NButton
            :type="speechState.canSpeech ? 'error' : 'primary'"
            size="small"
            :loading="speechState.isApiAudioLoading"
            @click="speechState.canSpeech ? speechService.stopSpeech() : speechService.startSpeech()"
          >
            <template #icon>
              <NIcon :component="speechState.canSpeech ? MicOff24Filled : Mic24Filled" />
            </template>
            {{ speechState.canSpeech ? '停止朗读' : '开启朗读' }}
          </NButton>

          <NButton
            v-if="speechState.canSpeech"
            :type="isPaused ? 'warning' : 'default'"
            size="small"
            secondary
            @click="speechService.togglePause()"
          >
            <template #icon>
              <NIcon :component="isPaused ? Play20Filled : Pause20Filled" />
            </template>
            {{ isPaused ? '恢复播报' : '暂停' }}
          </NButton>

          <NButton
            v-if="speechState.isSpeaking"
            size="small"
            secondary
            @click="speechService.skipCurrent()"
          >
            <template #icon>
              <NIcon :component="Next20Filled" />
            </template>
            跳过当前
          </NButton>

          <NPopconfirm @positive-click="speechService.downloadConfig()">
            <template #trigger>
              <NButton
                size="small"
                secondary
                :disabled="!accountInfo?.id"
              >
                <template #icon>
                  <NIcon :component="CloudArrowDown20Filled" />
                </template>
                云端同步
              </NButton>
            </template>
            这将从云端拉取配置覆盖当前本地设置，确定继续吗？
          </NPopconfirm>
        </NFlex>
      </template>
    </ManagePageHeader>

    <!-- 异常状态提示 -->
    <NAlert
      v-if="!speechSynthesisInfo || !speechSynthesisInfo.speechSynthesis"
      type="error"
      title="浏览器不支持语音能力"
      style="margin-bottom: 16px"
    >
      当前浏览器环境不支持 Web Speech API，请使用 Chrome、Edge 或最新版现代浏览器。
    </NAlert>

    <!-- 主布局网格 -->
    <NGrid :x-gap="16" :y-gap="16" :cols="12" responsive="screen">
      <!-- 左侧：参数与规则配置 (占 7 列) -->
      <NGridItem :span="7">
        <NCard size="small" style="height: 100%">
          <NTabs type="line" animated size="small">
            <NTabPane name="voice">
              <template #tab>
                <NFlex align="center" :size="4">
                  <NIcon :component="Speaker224Regular" />
                  <span>语音引擎</span>
                </NFlex>
              </template>
              <div class="tab-pane-box">
                <VoiceSettingsPanel />
              </div>
            </NTabPane>
            <NTabPane name="template">
              <template #tab>
                <NFlex align="center" :size="4">
                  <NIcon :component="DocumentText24Regular" />
                  <span>消息模板</span>
                </NFlex>
              </template>
              <div class="tab-pane-box">
                <TemplateSettingsPanel :supports-follow="supportsFollow" />
              </div>
            </NTabPane>
            <NTabPane name="filter">
              <template #tab>
                <NFlex align="center" :size="4">
                  <NIcon :component="ShieldCheckmark24Regular" />
                  <span>过滤与防刷</span>
                </NFlex>
              </template>
              <div class="tab-pane-box">
                <FilterSettingsPanel />
              </div>
            </NTabPane>
            <NTabPane name="advanced">
              <template #tab>
                <NFlex align="center" :size="4">
                  <NIcon :component="SpeakerSettings24Regular" />
                  <span>声卡与高级</span>
                </NFlex>
              </template>
              <div class="tab-pane-box">
                <AdvancedSettingsPanel
                  :audio-output-devices="audioOutputDevices"
                  :audio-output-devices-loading="audioOutputDevicesLoading"
                  @device-change="setAudioOutputDevice"
                />
              </div>
            </NTabPane>
          </NTabs>
        </NCard>
      </NGridItem>

      <!-- 右侧：实时播报状态与待播队列 (占 5 列) -->
      <NGridItem :span="5">
        <NFlex vertical :size="16">
          <!-- 运行监控卡片 -->
          <NCard size="small">
            <template #header>
              <NFlex align="center" :size="6">
                <NIcon :component="ChartMultiple24Regular" />
                <span>运行状态与统计</span>
              </NFlex>
            </template>
            <template #header-extra>
              <NTag :type="speechState.canSpeech ? 'success' : 'default'" size="tiny" round>
                {{ speechState.canSpeech ? (isPaused ? '已暂停' : '监听中') : '未启动' }}
              </NTag>
            </template>

            <NFlex vertical :size="12">
              <div class="stat-grid">
                <NStatistic label="朗读状态">
                  <template #prefix>
                    <NSpin v-if="speechState.isApiAudioLoading" :size="14" />
                    <NIcon
                      v-else
                      :component="Mic24Filled"
                      :size="16"
                      :color="speechState.isSpeaking ? 'var(--vtsuru-success)' : 'var(--vtsuru-fg-muted)'"
                    />
                  </template>
                  <NText :type="speechState.isSpeaking ? 'success' : isPaused ? 'warning' : 'default'" style="font-size: 14px">
                    {{ isPaused ? '已暂停' : speechState.isSpeaking ? '正在朗读' : '空闲待机' }}
                  </NText>
                </NStatistic>

                <NStatistic label="待播积压" :value="queueStats.total" />
                <NStatistic label="累计已读" :value="readedDanmaku" />
              </div>

              <!-- 当前正在朗读的文本 -->
              <div v-if="speechState.isSpeaking && speechState.speakingText" class="current-speech-bubble">
                <span class="bubble-label">正在播报：</span>
                <span class="bubble-content">{{ speechState.speakingText }}</span>
              </div>

              <!-- 快捷控制提示 -->
              <div class="shortcut-tip">
                快捷键：<code>Ctrl + 空格</code> 暂停/恢复 ｜ <code>Ctrl + N</code> 跳过 ｜ <code>Ctrl + Q</code> 清空队列
              </div>
            </NFlex>
          </NCard>

          <!-- 待读队列与历史卡片 -->
          <NCard size="small" style="flex: 1">
            <NTabs type="segment" size="small" animated>
              <NTabPane name="queue" :tab="`待读队列 (${queueStats.total})`">
                <div class="list-container">
                  <QueueList />
                </div>
              </NTabPane>
              <NTabPane name="history" tab="已读历史">
                <div class="list-container">
                  <SpokenHistoryPanel />
                </div>
              </NTabPane>
            </NTabs>
          </NCard>
        </NFlex>
      </NGridItem>
    </NGrid>
  </div>
</template>

<style scoped>
.read-danmaku-manage-view {
  width: 100%;
}

.tab-pane-box {
  padding-top: 16px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
}

.current-speech-bubble {
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--vtsuru-brand-tint);
  border: 1px solid var(--vtsuru-brand-soft);
  font-size: 13px;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.bubble-label {
  font-weight: 700;
  color: var(--vtsuru-brand);
  flex-shrink: 0;
}

.bubble-content {
  color: var(--vtsuru-fg);
  word-break: break-all;
}

.shortcut-tip {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  text-align: center;
}

.shortcut-tip code {
  background: var(--vtsuru-bg-muted);
  padding: 1px 4px;
  border-radius: 4px;
  font-family: monospace;
}

.list-container {
  max-height: 420px;
  overflow-y: auto;
  padding-top: 8px;
}
</style>
