<script setup lang="ts">
import {
  CheckmarkCircle20Filled, CloudArrowDown20Filled,
  Mic24Filled, MicOff24Filled, Next20Filled, Pause20Filled, Play20Filled,
} from '@vicons/fluent'
import {
  NAlert, NButton, NFlex, NIcon, NPopconfirm, NSpin,
  NStatistic, NTabPane, NTabs, NTag, NText, useMessage,
} from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { EventModel } from '@/api/api-models'
import { useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useSpeechService } from '@/store/useSpeechService'
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'
import VoiceSettingsPanel from '@/apps/open-live/components/read-danmaku/VoiceSettingsPanel.vue'
import TemplateSettingsPanel from '@/apps/open-live/components/read-danmaku/TemplateSettingsPanel.vue'
import FilterSettingsPanel from '@/apps/open-live/components/read-danmaku/FilterSettingsPanel.vue'
import AdvancedSettingsPanel from '@/apps/open-live/components/read-danmaku/AdvancedSettingsPanel.vue'
import QueueList from '@/apps/open-live/components/read-danmaku/QueueList.vue'
import SpokenHistoryPanel from '@/apps/open-live/components/read-danmaku/SpokenHistoryPanel.vue'

defineProps<{ roomInfo?: any; code?: string | undefined; isOpenLive?: boolean }>()

const message = useMessage()
const accountInfo = useAccount()
const client = await useDanmakuClient().initOpenlive()
const speechService = useSpeechService()

const {
  settings, speechState, speakQueue, readedDanmaku, isPaused,
  speechSynthesisInfo, apiAudio,
} = speechService

const audioOutputDevices = ref<{ label: string; value: string }[]>([])
const audioOutputDevicesLoading = ref(false)

const queueStats = computed(() => {
  const total = speakQueue.value.length
  const gifts = speakQueue.value.filter(i => i.data.type === EventDataTypes.Gift).length
  const messages = speakQueue.value.filter(i => i.data.type === EventDataTypes.Message).length
  return { total, gifts, messages }
})

function onGetEvent(data: EventModel) { speechService.addToQueue(data) }

function onAudioCanPlay() {
  speechState.isApiAudioLoading = false
  speechService.clearLoadingTimeout()
}
function onAudioError() {
  speechService.clearLoadingTimeout()
  if (!speechState.apiAudioSrc) return
  message.error('音频加载失败')
  speechService.cancelSpeech()
}

async function fetchAudioOutputDevices() {
  audioOutputDevicesLoading.value = true
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const devices = await navigator.mediaDevices.enumerateDevices()
    audioOutputDevices.value = [
      { label: '默认设备', value: 'default' },
      ...devices.filter(d => d.kind === 'audiooutput').map(d => ({
        label: d.label || `设备 ${d.deviceId.substring(0, 8)}`,
        value: d.deviceId,
      })),
    ]
  } catch { /* ignore */ } finally { audioOutputDevicesLoading.value = false }
}

async function setAudioOutputDevice() {
  if (!apiAudio.value || !settings.value.outputDeviceId) return
  try {
    if (typeof apiAudio.value.setSinkId === 'function')
      await apiAudio.value.setSinkId(settings.value.outputDeviceId)
  } catch { /* ignore */ }
}

function onKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.key === ' ' && e.ctrlKey) { e.preventDefault(); speechService.togglePause() }
  if (e.key === 'n' && e.ctrlKey) { e.preventDefault(); speechService.skipCurrent() }
  if (e.key === 'q' && e.ctrlKey) { e.preventDefault(); speechService.clearQueue() }
}

onMounted(async () => {
  await speechService.initialize()
  client.onEvent('danmaku', onGetEvent)
  client.onEvent('sc', onGetEvent)
  client.onEvent('guard', onGetEvent)
  client.onEvent('gift', onGetEvent)
  client.onEvent('enter', onGetEvent)
  await fetchAudioOutputDevices()
  navigator.mediaDevices?.addEventListener('devicechange', fetchAudioOutputDevices)
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  client.offEvent('danmaku', onGetEvent)
  client.offEvent('sc', onGetEvent)
  client.offEvent('guard', onGetEvent)
  client.offEvent('gift', onGetEvent)
  client.offEvent('enter', onGetEvent)
  speechService.stopSpeech()
  navigator.mediaDevices?.removeEventListener('devicechange', fetchAudioOutputDevices)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <NAlert
    v-if="!speechSynthesisInfo || !speechSynthesisInfo.speechSynthesis"
    type="error" title="不支持语音功能" size="small" :bordered="false"
  >
    你的浏览器不支持语音功能，请使用现代浏览器
  </NAlert>

  <div v-else class="read-danmaku">
    <div class="topbar">
      <OpenLivePageHeader title="弹幕朗读" description="将弹幕/事件转为语音">
        <template #actions>
          <NFlex :size="6" :wrap="true">
            <NButton
              :type="speechState.canSpeech ? 'error' : 'success'"
              size="small" :loading="speechState.isApiAudioLoading"
              @click="speechState.canSpeech ? speechService.stopSpeech() : speechService.startSpeech()"
            >
              <template #icon>
                <NIcon :component="speechState.canSpeech ? MicOff24Filled : Mic24Filled" />
              </template>
              {{ speechState.canSpeech ? '停止' : '开始' }}
            </NButton>

            <NButton
              v-if="speechState.canSpeech"
              :type="isPaused ? 'warning' : 'default'"
              size="small"
              @click="speechService.togglePause()"
            >
              <template #icon>
                <NIcon :component="isPaused ? Play20Filled : Pause20Filled" />
              </template>
              {{ isPaused ? '恢复' : '暂停' }}
            </NButton>

            <NButton
              v-if="speechState.isSpeaking"
              size="small" @click="speechService.skipCurrent()"
            >
              <template #icon>
                <NIcon :component="Next20Filled" />
              </template>
              跳过
            </NButton>

            <NPopconfirm @positive-click="speechService.downloadConfig()">
              <template #trigger>
                <NButton size="small" :disabled="!accountInfo">
                  <template #icon>
                    <NIcon :component="CloudArrowDown20Filled" />
                  </template>
                  获取配置
                </NButton>
              </template>
              这将覆盖当前设置, 确定?
            </NPopconfirm>

            <NButton size="small" :disabled="!accountInfo" @click="speechService.uploadConfig()">
              <template #icon>
                <NIcon :component="CheckmarkCircle20Filled" />
              </template>
              保存配置
            </NButton>
          </NFlex>
        </template>
      </OpenLivePageHeader>
    </div>

    <div class="main">
      <aside class="settings">
        <section class="card">
          <NTabs type="line" size="small" animated class="settings-tabs">
            <NTabPane name="voice" tab="语音引擎">
              <VoiceSettingsPanel />
            </NTabPane>
            <NTabPane name="template" tab="消息模板">
              <TemplateSettingsPanel />
            </NTabPane>
            <NTabPane name="filter" tab="过滤规则">
              <FilterSettingsPanel />
            </NTabPane>
            <NTabPane name="advanced" tab="高级">
              <AdvancedSettingsPanel
                :audio-output-devices="audioOutputDevices"
                :audio-output-devices-loading="audioOutputDevicesLoading"
                @device-change="setAudioOutputDevice"
              />
            </NTabPane>
          </NTabs>
        </section>
      </aside>

      <main class="status">
        <section v-if="speechState.canSpeech" class="card status-card">
          <div class="stats">
            <NStatistic label="当前">
              <template #prefix>
                <NSpin v-if="speechState.isApiAudioLoading" :size="14" />
                <NIcon
                  v-else :component="Mic24Filled" :size="16"
                  :color="speechState.isSpeaking ? 'var(--n-success-color)' : 'var(--n-text-color-3)'"
                />
              </template>
              <NText :type="speechState.isSpeaking ? 'success' : isPaused ? 'warning' : 'default'" style="font-size: 14px">
                {{ isPaused ? '已暂停' : speechState.isSpeaking ? '朗读中' : '待机' }}
              </NText>
            </NStatistic>
            <NStatistic label="队列" :value="queueStats.total" />
            <NStatistic label="已读取" :value="readedDanmaku" />
          </div>
          <NText v-if="speechState.isSpeaking && speechState.speakingText" class="speaking-text">
            {{ speechState.speakingText }}
          </NText>
          <NFlex :size="4" :wrap="true" style="margin-top: 8px">
            <NTag v-if="isPaused" type="warning" :bordered="false" size="small">
              暂停中
            </NTag>
            <NTag v-if="queueStats.messages > 0" type="info" :bordered="false" size="small">
              弹幕 {{ queueStats.messages }}
            </NTag>
            <NTag v-if="queueStats.gifts > 0" type="success" :bordered="false" size="small">
              礼物 {{ queueStats.gifts }}
            </NTag>
          </NFlex>
        </section>

        <section class="card">
          <QueueList />
        </section>
        <section class="card">
          <SpokenHistoryPanel />
        </section>

        <audio
          v-if="settings.provider !== 'local'"
          ref="apiAudio" :src="speechState.apiAudioSrc"
          :volume="settings.speechInfo.volume" style="display: none" autoplay
          @ended="speechService.cancelSpeech()" @canplay="onAudioCanPlay"
          @error="onAudioError" @loadedmetadata="setAudioOutputDevice"
        />
      </main>
    </div>
  </div>
</template>

<style scoped>
.read-danmaku { display: flex; flex-direction: column; gap: 12px; }
.topbar {
  background: var(--n-card-color); border: 1px solid var(--n-divider-color);
  border-radius: 8px; padding: 10px 14px;
}
.main { display: grid; grid-template-columns: minmax(320px, 400px) 1fr; gap: 12px; align-items: start; }
.settings, .status { display: flex; flex-direction: column; gap: 10px; }
.card {
  background: var(--n-card-color); border: 1px solid var(--n-divider-color);
  border-radius: 8px; padding: 12px;
}
.status-card .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.speaking-text {
  display: block; margin-top: 8px; padding: 6px 8px;
  background: var(--n-color-target); border-radius: 4px;
  font-size: 12px; color: var(--n-text-color-2);
  border-left: 2px solid var(--n-success-color);
}
@media (max-width: 960px) { .main { grid-template-columns: 1fr; } }
.settings-tabs :deep(.n-tabs-tab) {
  flex: 1;
  justify-content: center;
  padding: 8px 0;
}
</style>
