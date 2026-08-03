<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'
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

const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}
const accountInfo = useAccount()
const client = useDanmakuClient()
const speechService = useSpeechService()

const { settings, speechState, speakQueue, readedDanmaku, isPaused, speechSynthesisInfo, apiAudio } = speechService

const audioOutputDevices = ref<{ label: string; value: string }[]>([])
const audioOutputDevicesLoading = ref(false)
let mounted = false

const queueStats = computed(() => {
  const total = speakQueue.value.length
  const gifts = speakQueue.value.filter((i) => i.data.type === EventDataTypes.Gift).length
  const messages = speakQueue.value.filter((i) => i.data.type === EventDataTypes.Message).length
  return { total, gifts, messages }
})
const lastEventTime = computed(() => (client.lastEventAt ? new Date(client.lastEventAt).toLocaleTimeString() : ''))

function onAudioCanPlay() {
  speechState.isApiAudioLoading = false
  speechService.clearLoadingTimeout()
}
function onAudioError() {
  speechService.clearLoadingTimeout()
  if (!speechState.apiAudioSrc) return
  feedback('error', '音频加载失败')
  speechService.cancelSpeech()
}

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

onMounted(async () => {
  mounted = true
  await speechService.initialize()
  if (!mounted) return
  await client.ensureOpenlive({ connect: props.autoConnect })
  if (!mounted) return
  await fetchAudioOutputDevices()
  if (!mounted) return
  navigator.mediaDevices?.addEventListener('devicechange', fetchAudioOutputDevices)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  mounted = false
  navigator.mediaDevices?.removeEventListener('devicechange', fetchAudioOutputDevices)
  document.removeEventListener('keydown', onKeydown)
})

onActivated(() => {
  document.addEventListener('keydown', onKeydown)
})

onDeactivated(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <UAlert
    v-if="!speechSynthesisInfo || !speechSynthesisInfo.speechSynthesis"
    type="error"
    title="不支持语音功能"
    size="small"
    :bordered="false"
  >
    你的浏览器不支持语音功能，请使用现代浏览器
  </UAlert>

  <div
    v-else
    class="read-danmaku"
  >
    <div class="topbar">
      <OpenLivePageHeader
        title="弹幕朗读"
        description="将弹幕/事件转为语音"
      >
        <template #footers>
          <div
            :size="6"
            :wrap="true"
          >
            <UButton
              :color="speechState.canSpeech ? 'error' : 'success'"
              size="small"
              :loading="speechState.isApiAudioLoading"
              :class="{ 'start-ripple': !speechState.canSpeech && !speechState.isApiAudioLoading }"
              @click="speechState.canSpeech ? speechService.stopSpeech() : speechService.startSpeech()"
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
              {{ speechState.canSpeech ? '停止' : '开始' }}
            </UButton>

            <UButton
              v-if="speechState.canSpeech"
              :color="isPaused ? 'warning' : 'neutral'"
              size="small"
              @click="speechService.togglePause()"
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
              {{ isPaused ? '恢复' : '暂停' }}
            </UButton>

            <UButton
              v-if="speechState.isSpeaking"
              size="small"
              @click="speechService.skipCurrent()"
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
              跳过
            </UButton>

            <UPopover>
              <UButton
                size="sm"
                :disabled="!accountInfo?.id"
              >
                <template #leading>
                  <UIcon name="i-lucide-circle" />
                </template>
                从云端同步
              </UButton>
              <template #content="{ close }">
                <div class="space-y-3 p-3">
                  <div>这将覆盖当前设置, 确定?</div>
                  <div class="flex justify-end gap-2">
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="close"
                      >取消</UButton
                    >
                    <UButton
                      size="xs"
                      color="primary"
                      @click="(close(), speechService.downloadConfig())"
                      >确认</UButton
                    >
                  </div>
                </div>
              </template>
            </UPopover>
          </div>
        </template>
      </OpenLivePageHeader>
    </div>

    <div class="main">
      <aside class="settings">
        <section class="card">
          <div
            type="line"
            size="small"
            animated
            class="settings-tabs"
          >
            <section
              name="voice"
              tab="语音引擎"
            >
              <VoiceSettingsPanel />
            </section>
            <section
              name="template"
              tab="消息模板"
            >
              <TemplateSettingsPanel />
            </section>
            <section
              name="filter"
              tab="过滤规则"
            >
              <FilterSettingsPanel />
            </section>
            <section
              name="advanced"
              tab="高级"
            >
              <AdvancedSettingsPanel
                :audio-output-devices="audioOutputDevices"
                :audio-output-devices-loading="audioOutputDevicesLoading"
                @device-change="setAudioOutputDevice"
              />
            </section>
          </div>
        </section>
      </aside>

      <main class="status">
        <section
          v-if="speechState.canSpeech"
          class="card status-card"
        >
          <div class="stats">
            <div label="当前">
              <span class="status-prefix">
                <div
                  v-if="speechState.isApiAudioLoading"
                  :size="14"
                />
                <UIcon
                  name="i-lucide-circle"
                  v-else
                  :size="16"
                  :color="speechState.isSpeaking ? 'var(--vtsuru-success)' : 'var(--vtsuru-fg-muted)'"
                />
              </span>
              <span
                :type="speechState.isSpeaking ? 'success' : isPaused ? 'warning' : 'default'"
                style="font-size: 14px"
              >
                {{ isPaused ? '已暂停' : speechState.isSpeaking ? '朗读中' : '待机' }}
              </span>
            </div>
            <div
              label="队列"
              :value="queueStats.total"
            />
            <div
              label="已读取"
              :value="readedDanmaku"
            />
          </div>
          <span
            v-if="speechState.isSpeaking && speechState.speakingText"
            class="speaking-text"
          >
            {{ speechState.speakingText }}
          </span>
          <div
            :size="4"
            :wrap="true"
            style="margin-top: 8px"
          >
            <UBadge
              :type="client.connected ? 'success' : 'warning'"
              :bordered="false"
              size="small"
            >
              {{ client.connectionStatus }}
            </UBadge>
            <UBadge
              v-if="lastEventTime"
              :bordered="false"
              size="small"
            >
              最近收到 {{ lastEventTime }}
            </UBadge>
            <UBadge
              v-if="client.reconnectCount"
              type="warning"
              :bordered="false"
              size="small"
            >
              已重连 {{ client.reconnectCount }} 次
            </UBadge>
            <UBadge
              v-if="isPaused"
              type="warning"
              :bordered="false"
              size="small"
            >
              暂停中
            </UBadge>
            <UBadge
              v-if="queueStats.messages > 0"
              type="info"
              :bordered="false"
              size="small"
            >
              弹幕 {{ queueStats.messages }}
            </UBadge>
            <UBadge
              v-if="queueStats.gifts > 0"
              type="success"
              :bordered="false"
              size="small"
            >
              礼物 {{ queueStats.gifts }}
            </UBadge>
          </div>
        </section>

        <section class="card">
          <QueueList />
        </section>
        <section class="card">
          <SpokenHistoryPanel />
        </section>

        <audio
          v-if="settings.provider !== 'local'"
          ref="apiAudio"
          :src="speechState.apiAudioSrc"
          :volume="settings.speechInfo.volume"
          style="display: none"
          autoplay
          @ended="speechService.cancelSpeech()"
          @canplay="onAudioCanPlay"
          @error="onAudioError"
          @loadedmetadata="setAudioOutputDevice"
        />
      </main>
    </div>
  </div>
</template>

<style scoped>
.read-danmaku {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.topbar {
  background: var(--vtsuru-bg-surface);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  padding: 10px 14px;
}
.main {
  display: grid;
  grid-template-columns: minmax(320px, 400px) 1fr;
  gap: 12px;
  align-items: start;
}
.settings,
.status {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card {
  background: var(--vtsuru-bg-surface);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  padding: 12px;
}
.status-card .stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.speaking-text {
  display: block;
  margin-top: 8px;
  padding: 6px 8px;
  background: var(--vtsuru-bg-muted);
  border-radius: 4px;
  font-size: 12px;
  color: var(--vtsuru-fg);
  border-left: 2px solid var(--vtsuru-success);
}
@media (max-width: 960px) {
  .main {
    grid-template-columns: 1fr;
  }
}
.settings-tabs :deep(.u-tabs-tab) {
  flex: 1;
  justify-content: center;
  padding: 8px 0;
}

/* 开始按钮水波纹提示动效 */
.start-ripple {
  position: relative;
  z-index: 0;
  /* 留出外边距, 避免波纹扩散时盖住相邻按钮 */
  margin-right: 8px;
  animation: start-breathe 2s ease-in-out infinite;
}
.start-ripple::before,
.start-ripple::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  border: 2px solid var(--vtsuru-success, #18a058);
  opacity: 0;
  animation: start-wave 2s ease-out infinite;
  pointer-events: none;
}
.start-ripple::after {
  animation-delay: 1s;
}
@keyframes start-wave {
  0% {
    transform: scale(1);
    opacity: 0.55;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
}
@keyframes start-breathe {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(24, 160, 88, 0.35);
  }
  50% {
    box-shadow: 0 0 10px 2px rgba(24, 160, 88, 0.45);
  }
}
@media (prefers-reduced-motion: reduce) {
  .start-ripple,
  .start-ripple::before,
  .start-ripple::after {
    animation: none;
  }
}
</style>
