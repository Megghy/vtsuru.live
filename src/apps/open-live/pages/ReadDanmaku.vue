<script setup lang="ts">
import type { EventModel } from '@/api/api-models'
import { CheckmarkCircle20Filled, Dismiss20Filled, Info24Filled, Mic24Filled, MicOff24Filled, Play20Filled, Settings20Filled } from '@vicons/fluent'
import {
  NAlert, NButton, NCard, NCheckbox, NCollapse, NCollapseItem, NDivider, NEmpty, NGi, NGrid, NIcon, NInput, NInputGroup, NInputGroupLabel, NInputNumber, NList, NListItem, NPopconfirm, NScrollbar, NSelect, NFlex, NSpin, NStatistic, NTag, NText, NTooltip, useMessage } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { templateConstants, useSpeechService } from '@/store/useSpeechService'
import { copyToClipboard } from '@/shared/utils'
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'
import VoiceProviderSettings from '@/apps/open-live/components/VoiceProviderSettings.vue'

defineProps<{
  roomInfo?: any
  code?: string | undefined
  isOpenLive?: boolean
}>()

const message = useMessage()
const accountInfo = useAccount()
const client = await useDanmakuClient().initOpenlive()
const speechService = useSpeechService()

const {
  settings,
  speechState,
  speakQueue,
  readedDanmaku,
  speechSynthesisInfo,
  apiAudio,
} = speechService

// 音频输出设备列表
const audioOutputDevices = ref<Array<{ label: string, value: string }>>([])
const audioOutputDevicesLoading = ref(false)

const queueStats = computed(() => {
  const total = speakQueue.value.length
  const gifts = speakQueue.value.filter(item => item.data.type === EventDataTypes.Gift).length
  const messages = speakQueue.value.filter(item => item.data.type === EventDataTypes.Message).length
  const waiting = speakQueue.value.filter(
    item =>
      item.data.type === EventDataTypes.Gift
      && settings.value.combineGiftDelay
      && item.updateAt > Date.now() - settings.value.combineGiftDelay * 1000,
  ).length

  return { total, gifts, messages, waiting }
})

function onGetEvent(data: EventModel) {
  speechService.addToQueue(data)
}

function startSpeech() {
  speechService.startSpeech()
}

function stopSpeech() {
  speechService.stopSpeech()
}

function cancelSpeech() {
  speechService.cancelSpeech()
}

function forceSpeak(data: EventModel) {
  speechService.forceSpeak(data)
}

function removeFromQueue(item: any) {
  speechService.removeFromQueue(item)
}

function clearQueue() {
  speakQueue.value = []
  message.success('队列已清空')
}

async function uploadConfig() {
  await speechService.uploadConfig()
}

async function downloadConfig() {
  await speechService.downloadConfig()
}

function createTestEventData(type: EventDataTypes, overrides: Partial<EventModel>): EventModel {
  const baseData = {
    type,
    uname: accountInfo.value?.name ?? '测试用户',
    uid: accountInfo.value?.biliId ?? 0,
    msg: '',
    price: 0,
    num: 0,
    time: Date.now(),
    guard_level: 0,
    fans_medal_level: 1,
    fans_medal_name: '',
    fans_medal_wearing_status: false,
    emoji: undefined,
    uface: '',
    open_id: '00000000-0000-0000-0000-000000000000',
    ouid: '00000000-0000-0000-0000-000000000000',
  }
  return { ...baseData, ...overrides }
}

function test(type: EventDataTypes) {
  let testData: EventModel
  switch (type) {
    case EventDataTypes.Message:
      testData = createTestEventData(EventDataTypes.Message, { msg: '测试弹幕' })
      break
    case EventDataTypes.Enter:
      testData = createTestEventData(EventDataTypes.Enter, {})
      break
    case EventDataTypes.SC:
      testData = createTestEventData(EventDataTypes.SC, { msg: '测试留言', price: 30, num: 1 })
      break
    case EventDataTypes.Guard:
      testData = createTestEventData(EventDataTypes.Guard, { msg: '舰长', num: 1, guard_level: 3 })
      break
    case EventDataTypes.Gift:
      testData = createTestEventData(EventDataTypes.Gift, { msg: '测试礼物', price: 5, num: 5 })
      break
    default:
      return
  }

  if (speechState.canSpeech) {
    onGetEvent(testData)
  } else {
    forceSpeak(testData)
  }
}

function getEventTypeTag(type: EventDataTypes) {
  switch (type) {
    case EventDataTypes.Message:
      return { text: '弹幕', type: 'info' as const }
    case EventDataTypes.Gift:
      return { text: '礼物', type: 'success' as const }
    case EventDataTypes.Guard:
      return { text: '舰长', type: 'warning' as const }
    case EventDataTypes.SC:
      return { text: 'SC', type: 'error' as const }
    case EventDataTypes.Enter:
      return { text: '进入', type: 'default' as const }
    default:
      return { text: '未知', type: 'default' as const }
  }
}

function onAPIError(_e: Event) {
  if (!speechState.apiAudioSrc) return
  message.error('音频加载失败, 请检查API是否可用以及网络连接')
  cancelSpeech()
}

function onAudioCanPlay() {
  speechState.isApiAudioLoading = false
  speechService.clearLoadingTimeout()
}

function onAudioError(e: Event) {
  speechService.clearLoadingTimeout()
  onAPIError(e)
}

async function fetchAudioOutputDevices() {
  audioOutputDevicesLoading.value = true
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      message.warning('当前浏览器不支持设备枚举')
      return
    }

    const devices = await navigator.mediaDevices.enumerateDevices()
    const outputDevices = devices.filter(device => device.kind === 'audiooutput')

    audioOutputDevices.value = [
      { label: '默认设备', value: 'default' },
      ...outputDevices.map(device => ({
        label: device.label || `设备 ${device.deviceId.substring(0, 8)}`,
        value: device.deviceId,
      })),
    ]
  } catch (error) {
    console.error('[TTS] 获取音频输出设备失败:', error)
    message.error('获取音频输出设备失败，可能需要授予麦克风权限')
  } finally {
    audioOutputDevicesLoading.value = false
  }
}

async function setAudioOutputDevice() {
  if (!apiAudio.value || !settings.value.outputDeviceId) return
  try {
    if (typeof apiAudio.value.setSinkId === 'function') {
      await apiAudio.value.setSinkId(settings.value.outputDeviceId)
    }
  } catch (error) {
    console.error('[TTS] 设置输出设备失败:', error)
    message.error('设置输出设备失败')
  }
}

onMounted(async () => {
  await speechService.initialize()
  client.onEvent('danmaku', onGetEvent)
  client.onEvent('sc', onGetEvent)
  client.onEvent('guard', onGetEvent)
  client.onEvent('gift', onGetEvent)
  client.onEvent('enter', onGetEvent)
  await fetchAudioOutputDevices()
  if (navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener('devicechange', fetchAudioOutputDevices)
  }
})

onUnmounted(() => {
  client.offEvent('danmaku', onGetEvent)
  client.offEvent('sc', onGetEvent)
  client.offEvent('guard', onGetEvent)
  client.offEvent('gift', onGetEvent)
  client.offEvent('enter', onGetEvent)
  speechService.stopSpeech()
  if (navigator.mediaDevices) {
    navigator.mediaDevices.removeEventListener('devicechange', fetchAudioOutputDevices)
  }
})
</script>

<template>
  <NAlert
    v-if="!speechSynthesisInfo || !speechSynthesisInfo.speechSynthesis"
    type="error"
    title="不支持语音功能"
    size="small"
    :bordered="false"
  >
    你的浏览器不支持语音功能，请使用现代浏览器如 Chrome、Edge 等
  </NAlert>

  <template v-else>
    <NCard size="small" bordered :segmented="{ content: true }">
      <OpenLivePageHeader
        title="弹幕朗读"
        description="将弹幕/事件转为语音，支持本地与 API TTS。"
      >
        <template #actions>
          <NFlex align="center" :wrap="true" :size="10">
            <NButton
              :type="speechState.canSpeech ? 'error' : 'success'"
              size="medium"
              :loading="speechState.isApiAudioLoading"
              data-umami-event="Use TTS"
              :data-umami-event-uid="accountInfo?.id"
              @click="speechState.canSpeech ? stopSpeech() : startSpeech()"
            >
              <template #icon>
                <NIcon :component="speechState.canSpeech ? MicOff24Filled : Mic24Filled" />
              </template>
              {{ speechState.canSpeech ? '停止监听' : '开始监听' }}
            </NButton>

            <NButton
              :type="speechState.isSpeaking ? 'error' : 'default'"
              :disabled="!speechState.isSpeaking"
              size="small"
              @click="cancelSpeech"
            >
              <template #icon>
                <NIcon :component="Dismiss20Filled" />
              </template>
              取消当前
            </NButton>

            <NButton
              type="warning"
              secondary
              :disabled="speakQueue.length === 0"
              size="small"
              @click="clearQueue"
            >
              <template #icon>
                <NIcon :component="Dismiss20Filled" />
              </template>
              清空队列
            </NButton>

            <NPopconfirm @positive-click="downloadConfig">
              <template #trigger>
                <NButton
                  type="primary"
                  secondary
                  size="small"
                  class="open-live-action-btn"
                  :disabled="!accountInfo"
                >
                  <template #icon>
                    <NIcon :component="Settings20Filled" />
                  </template>
                  获取配置
                </NButton>
              </template>
              这将覆盖当前设置，确定？
            </NPopconfirm>

            <NButton
              type="primary"
              secondary
              size="small"
              class="open-live-action-btn"
              :disabled="!accountInfo"
              @click="uploadConfig"
            >
              <template #icon>
                <NIcon :component="CheckmarkCircle20Filled" />
              </template>
              保存配置
            </NButton>
          </NFlex>
        </template>
      </OpenLivePageHeader>

      <NFlex vertical :size="12">
        <NAlert
          v-if="settings.provider === 'local'"
          type="info"
          size="small"
          :bordered="false"
          closable
        >
          <template #icon>
            <NIcon :component="Info24Filled" />
          </template>
          建议在 Edge 浏览器使用
          <NTooltip>
            <template #trigger>
              <NText strong type="primary" style="cursor: help">
                Microsoft 某某 Online (Natural)
              </NText>
            </template>
            例如 Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)，各种营销号就用的这些配音
          </NTooltip>
          系列语音，效果<NText strong>好很多</NText>
        </NAlert>

        <NAlert
          type="warning"
          size="small"
          :bordered="false"
          closable
        >
          <template #icon>
            <NIcon :component="Info24Filled" />
          </template>
          <NText strong>重要：</NText> 当在后台运行时请关闭浏览器的页面休眠/内存节省功能
          <NDivider vertical />
          <NButton
            tag="a"
            type="info"
            href="https://support.google.com/chrome/answer/12929150?hl=zh-Hans"
            target="_blank"
            text
            size="small"
          >
            Chrome 设置
          </NButton>
          <NButton
            tag="a"
            type="info"
            href="https://support.microsoft.com/zh-cn/topic/%E4%BA%86%E8%A7%A3-microsoft-edge-%E4%B8%AD%E7%9A%84%E6%80%A7%E8%83%BD%E5%8A%9F%E8%83%BD-7b36f363-2119-448a-8de6-375cfd88ab25"
            target="_blank"
            text
            size="small"
          >
            Edge 设置
          </NButton>
        </NAlert>
      </NFlex>
    </NCard>

    <!-- 状态统计区域 -->
    <NCard
      v-if="speechState.canSpeech"
      title="实时状态"
      size="small"
      bordered
    >
      <NGrid :cols="4" :x-gap="12" :y-gap="12" responsive="screen">
        <NGi>
          <NStatistic label="当前状态">
            <template #prefix>
              <NTooltip v-if="speechState.isApiAudioLoading">
                <template #trigger>
                  <NSpin :size="20" />
                </template>
                加载中
              </NTooltip>
              <NIcon
                v-else
                :component="Mic24Filled"
                :color="speechState.isSpeaking ? 'var(--n-success-color)' : 'var(--n-text-color-3)'"
                :size="20"
              />
            </template>
            <NText :type="speechState.isSpeaking ? 'success' : 'default'">
              {{ speechState.isSpeaking ? '朗读中' : '待机' }}
            </NText>
          </NStatistic>
          <NText
            v-if="speechState.isSpeaking"
            depth="3"
            style="font-size: 12px; display: block; margin-top: 4px"
          >
            {{ speechState.speakingText }}
          </NText>
        </NGi>

        <NGi>
          <NStatistic label="队列长度" :value="queueStats.total">
            <template #suffix>
              <NText depth="3">条</NText>
            </template>
          </NStatistic>
        </NGi>

        <NGi>
          <NStatistic label="已读取" :value="readedDanmaku">
            <template #suffix>
              <NText depth="3">条</NText>
            </template>
          </NStatistic>
        </NGi>

        <NGi>
          <NStatistic label="队列分布">
            <NFlex :size="8" style="margin-top: 4px">
              <NTooltip v-if="queueStats.messages > 0">
                <template #trigger>
                  <NTag :bordered="false" type="info" size="small">弹幕 {{ queueStats.messages }}</NTag>
                </template>
                弹幕消息数量
              </NTooltip>
              <NTooltip v-if="queueStats.gifts > 0">
                <template #trigger>
                  <NTag :bordered="false" type="success" size="small">礼物 {{ queueStats.gifts }}</NTag>
                </template>
                礼物消息数量
              </NTooltip>
              <NTooltip v-if="queueStats.waiting > 0">
                <template #trigger>
                  <NTag :bordered="false" type="warning" size="small">等待 {{ queueStats.waiting }}</NTag>
                </template>
                等待合并的礼物
              </NTooltip>
            </NFlex>
          </NStatistic>
        </NGi>
      </NGrid>

      <NDivider style="margin: 16px 0" />
      <NCollapse>
        <NCollapseItem title="队列详情" name="queue">
          <template #header-extra>
            <NTag :bordered="false" size="small">{{ speakQueue.length }} 项</NTag>
          </template>

          <NEmpty v-if="speakQueue.length === 0" description="队列为空" size="small" />

          <NScrollbar v-else style="max-height: 300px">
            <NList size="small" bordered>
              <NListItem
                v-for="(item, index) in speakQueue"
                :key="`${item.data.time}-${index}`"
              >
                <NFlex align="center" :size="8">
                  <NButton type="primary" size="tiny" circle @click="forceSpeak(item.data)">
                    <template #icon>
                      <NIcon :component="Play20Filled" />
                    </template>
                  </NButton>

                  <NButton type="error" size="tiny" circle @click="removeFromQueue(item)">
                    <template #icon>
                      <NIcon :component="Dismiss20Filled" />
                    </template>
                  </NButton>

                  <NTag
                    v-if="item.data.type === EventDataTypes.Gift && item.combineCount"
                    type="info"
                    size="small"
                    :bordered="false"
                  >
                    连续赠送中
                  </NTag>
                  <NTag
                    v-else-if="item.data.type === EventDataTypes.Gift && settings.combineGiftDelay"
                    type="success"
                    size="small"
                    :bordered="false"
                  >
                    等待合并
                  </NTag>

                  <NTag
                    :type="getEventTypeTag(item.data.type).type"
                    size="small"
                    :bordered="false"
                  >
                    {{ getEventTypeTag(item.data.type).text }}
                  </NTag>

                  <NText strong>{{ item.data.uname }}</NText>
                  <NText depth="3">{{ speechService.getTextFromDanmaku(item.data) }}</NText>
                </NFlex>
              </NListItem>
            </NList>
          </NScrollbar>
        </NCollapseItem>
      </NCollapse>
    </NCard>

    <!-- 语音设置区域 -->
    <NCard title="语音设置" size="small" bordered>
      <NFlex vertical :size="12">
        <!-- 输出设备选择 -->
        <div>
          <NFlex justify="space-between" align="center">
            <NText strong>输出设备</NText>
            <NButton
              v-if="audioOutputDevices.length === 0"
              text
              type="primary"
              size="small"
              :loading="audioOutputDevicesLoading"
              @click="fetchAudioOutputDevices"
            >
              加载设备列表
            </NButton>
          </NFlex>
          <NSelect
            v-model:value="settings.outputDeviceId"
            :options="audioOutputDevices"
            :loading="audioOutputDevicesLoading"
            :fallback-option="() => ({
              label: settings.outputDeviceId === 'default' ? '默认设备' : `已选择: ${settings.outputDeviceId.substring(0, 16)}...`,
              value: settings.outputDeviceId || 'default',
            })"
            style="margin-top: 8px"
            @update:value="setAudioOutputDevice"
          />
          <NAlert
            v-if="audioOutputDevices.length === 1"
            type="info"
            :bordered="false"
            style="margin-top: 8px; font-size: 12px"
          >
            <template #icon>
              <NIcon :component="Info24Filled" :size="16" />
            </template>
            未检测到其他音频设备。某些浏览器需要授予麦克风权限才能列出所有设备。
          </NAlert>
        </div>

        <NDivider style="margin: 8px 0" />

        <VoiceProviderSettings />

        <!-- 隐藏的音频元素 -->
        <audio
          v-if="settings.provider !== 'local'"
          ref="apiAudio"
          :src="speechState.apiAudioSrc"
          :volume="settings.speechInfo.volume"
          style="display: none"
          autoplay
          @ended="cancelSpeech"
          @canplay="onAudioCanPlay"
          @error="onAudioError"
          @loadedmetadata="setAudioOutputDevice"
        />
      </NFlex>
    </NCard>

    <!-- 模板设置区域 -->
    <NCard title="消息模板" size="small" bordered>
      <NFlex vertical :size="12">
        <NAlert type="info" :bordered="false">
          <template #icon>
            <NIcon :component="Info24Filled" />
          </template>
          <NText>支持的变量（点击复制）：</NText>
          <NDivider style="margin: 8px 0" />
          <NFlex :size="8">
            <NButton
              v-for="item in Object.values(templateConstants)"
              :key="item.name"
              size="tiny"
              secondary
              @click="copyToClipboard(item.words)"
            >
              {{ item.words }}
              <NDivider vertical />
              {{ item.name }}
            </NButton>
          </NFlex>
        </NAlert>

        <NText depth="3" style="font-size: 12px; margin-bottom: 8px;">
          提示：模板留空则不播报对应类型的事件
        </NText>

        <div>
          <NInputGroup>
            <NInputGroupLabel style="min-width: 120px">弹幕模板</NInputGroupLabel>
            <NInput v-model:value="settings.danmakuTemplate" />
            <NButton type="info" :loading="speechState.isApiAudioLoading" @click="test(EventDataTypes.Message)">
              测试
            </NButton>
          </NInputGroup>
        </div>

        <div>
          <NInputGroup>
            <NInputGroupLabel style="min-width: 120px">礼物模板</NInputGroupLabel>
            <NInput v-model:value="settings.giftTemplate" />
            <NButton type="info" :loading="speechState.isApiAudioLoading" @click="test(EventDataTypes.Gift)">
              测试
            </NButton>
          </NInputGroup>
        </div>

        <div>
          <NInputGroup>
            <NInputGroupLabel style="min-width: 120px">SC 模板</NInputGroupLabel>
            <NInput v-model:value="settings.scTemplate" />
            <NButton type="info" :loading="speechState.isApiAudioLoading" @click="test(EventDataTypes.SC)">
              测试
            </NButton>
          </NInputGroup>
        </div>

        <div>
          <NInputGroup>
            <NInputGroupLabel style="min-width: 120px">上舰模板</NInputGroupLabel>
            <NInput v-model:value="settings.guardTemplate" />
            <NButton type="info" :loading="speechState.isApiAudioLoading" @click="test(EventDataTypes.Guard)">
              测试
            </NButton>
          </NInputGroup>
        </div>

        <div>
          <NInputGroup>
            <NInputGroupLabel style="min-width: 120px">进入直播间模板</NInputGroupLabel>
            <NInput v-model:value="settings.enterTemplate" />
            <NButton type="info" :loading="speechState.isApiAudioLoading" @click="test(EventDataTypes.Enter)">
              测试
            </NButton>
          </NInputGroup>
        </div>
      </NFlex>
    </NCard>

    <!-- 高级设置区域 -->
    <NCard title="高级设置" size="small" bordered>
      <NFlex vertical :size="12">
        <NFlex align="center">
          <NCheckbox
            :checked="settings.combineGiftDelay != null"
            @update:checked="(checked: boolean) => {
              settings.combineGiftDelay = checked ? 2 : undefined
            }"
          >
            <NFlex :size="4" align="center">
              <span>礼物合并</span>
              <NTooltip>
                <template #trigger>
                  <NIcon :component="Info24Filled" :size="16" />
                </template>
                在指定时间内连续送相同礼物会等停止送礼物之后才会念。
                <br>
                这也会导致送的礼物会等待指定时间之后才会念，即使没有连续赠送。
              </NTooltip>
            </NFlex>
          </NCheckbox>

          <NInputGroup v-if="settings.combineGiftDelay != null" style="width: 200px">
            <NInputGroupLabel>延迟（秒）</NInputGroupLabel>
            <NInputNumber
              v-model:value="settings.combineGiftDelay"
              :min="1"
              :max="10"
              @update:value="(value) => {
                if (!value || value <= 0) settings.combineGiftDelay = undefined
              }"
            />
          </NInputGroup>
        </NFlex>

        <NCheckbox
          v-if="settings.provider === 'api'"
          v-model:checked="settings.providers.api.splitText"
        >
          <NFlex :size="4" align="center">
            <span>启用句子拆分</span>
            <NTooltip>
              <template #trigger>
                <NIcon :component="Info24Filled" :size="16" />
              </template>
              仅 API 方式可用，为英文用户名用引号包裹起来，并将所有大写单词拆分成单个单词，以防止部分单词念不出来。
              <br>
              例：原文: Megghy 说: UPPERCASE单词
              <br>
              结果: 'Megghy' 说: U P P E R C A S E 单词
            </NTooltip>
          </NFlex>
        </NCheckbox>
      </NFlex>
    </NCard>
  </template>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from {
  opacity: 0;
}
.fade-leave-to {
  opacity: 0;
}
</style>
