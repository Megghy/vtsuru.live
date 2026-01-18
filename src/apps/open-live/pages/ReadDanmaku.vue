<script setup lang="ts">
import type { EventModel } from '@/api/api-models'
import { CheckmarkCircle20Filled, Dismiss20Filled, Info24Filled, Mic24Filled, MicOff24Filled, Play20Filled, Settings20Filled, } from '@vicons/fluent'
import {
  NAlert, NButton, NCard, NCheckbox, NCollapse, NCollapseItem, NDivider, NEmpty, NGi, NGrid, NIcon, NInput, NInputGroup, NInputGroupLabel, NInputNumber, NList, NListItem, NPopconfirm, NRadioButton, NRadioGroup, NScrollbar, NSelect, NSlider, NFlex, NSpin, NStatistic, NTag, NText, NTooltip, useMessage } from 'naive-ui';
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { templateConstants, useSpeechService } from '@/store/useSpeechService'
import { copyToClipboard } from '@/shared/utils'
import { TTS_API_URL } from '@/shared/config'
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'

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

// Azure 语音列表
const azureVoices = ref<Array<{ label: string, value: string, locale: string }>>([])
const azureVoicesLoading = ref(false)

// 音频输出设备列表
const audioOutputDevices = ref<Array<{ label: string, value: string }>>([])
const audioOutputDevicesLoading = ref(false)

// 计算属性
const isVtsuruVoiceAPI = computed(() => {
  return (
    settings.value.voiceType == 'api'
    && settings.value.voiceAPI?.toLowerCase().trim().startsWith('voice.vtsuru.live')
  )
})

const voiceOptions = computed(() => {
  return speechService.getAvailableVoices()
})

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

// 方法
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

/**
 * 创建测试事件数据
 */
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

/**
 * 测试不同类型的事件
 */
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

function testAPI() {
  const url = speechService.buildApiUrl('这是一条测试弹幕')
  if (url) {
    speechState.isSpeaking = true
    speechState.isApiAudioLoading = true
    speechState.apiAudioSrc = url
  }
}

/**
 * 获取 Azure 语音列表
 */
async function fetchAzureVoices() {
  if (azureVoices.value.length > 0) {
    return
  }

  azureVoicesLoading.value = true
  try {
    const response = await fetch(`${TTS_API_URL}voices`)
    if (!response.ok) {
      throw new Error('获取语音列表失败')
    }

    const voices = await response.json()

    azureVoices.value = voices
      .filter((v: any) => {
        const locale = v.Locale || v.locale || ''
        return locale.startsWith('zh-') || locale.startsWith('ja-') || locale.startsWith('en-')
      })
      .map((v: any) => {
        const shortName = v.ShortName || v.shortName || ''
        const localeName = v.LocaleName || v.localeName || ''
        const localName = v.LocalName || v.localName || v.DisplayName || v.displayName || ''
        const gender = v.Gender || v.gender || ''
        const isMultilingual = shortName.toLowerCase().includes('multilingual')

        return {
          label: `[${localeName}] ${localName} (${gender === 'Male' ? '男' : '女'})${isMultilingual ? ' 🌍' : ''}`,
          value: shortName,
          locale: v.Locale || v.locale || '',
        }
      })
      .sort((a: any, b: any) => {
        // 多语言模型优先
        const aMulti = a.value.toLowerCase().includes('multilingual')
        const bMulti = b.value.toLowerCase().includes('multilingual')
        if (aMulti && !bMulti) return -1
        if (!aMulti && bMulti) return 1

        // 然后按语言排序：中文排前面，日文其次，英文最后
        const aScore = a.locale.startsWith('zh-') ? 0 : a.locale.startsWith('ja-') ? 1 : 2
        const bScore = b.locale.startsWith('zh-') ? 0 : b.locale.startsWith('ja-') ? 1 : 2
        return aScore - bScore
      })
  } catch (error) {
    console.error('[Azure TTS] 获取语音列表失败:', error)
    message.error('获取 Azure 语音列表失败')
  } finally {
    azureVoicesLoading.value = false
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

/**
 * 获取音频输出设备列表
 */
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

    console.log('[TTS] 音频输出设备列表:', audioOutputDevices.value)
  } catch (error) {
    console.error('[TTS] 获取音频输出设备失败:', error)
    message.error('获取音频输出设备失败，可能需要授予麦克风权限')
  } finally {
    audioOutputDevicesLoading.value = false
  }
}

/**
 * 设置音频元素的输出设备
 */
async function setAudioOutputDevice() {
  if (!apiAudio.value || !settings.value.outputDeviceId) {
    return
  }

  try {
    if (typeof apiAudio.value.setSinkId === 'function') {
      await apiAudio.value.setSinkId(settings.value.outputDeviceId)
      console.log(`[TTS] 已切换到输出设备: ${settings.value.outputDeviceId}`)
    } else {
      console.warn('[TTS] 当前浏览器不支持选择输出设备')
    }
  } catch (error) {
    console.error('[TTS] 设置输出设备失败:', error)
    message.error('设置输出设备失败')
  }
}

// 生命周期
onMounted(async () => {
  await speechService.initialize()

  client.onEvent('danmaku', onGetEvent)
  client.onEvent('sc', onGetEvent)
  client.onEvent('guard', onGetEvent)
  client.onEvent('gift', onGetEvent)
  client.onEvent('enter', onGetEvent)

  // 如果默认使用 Azure TTS，则预加载语音列表
  if (settings.value.voiceType === 'azure') {
    fetchAzureVoices()
  }

  // 获取音频输出设备列表
  await fetchAudioOutputDevices()

  // 监听输出设备变化
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

  // 移除设备变化监听器
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
          v-if="settings.voiceType === 'local'"
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
              <NText
                strong
                type="primary"
                style="cursor: help"
              >
                Microsoft 某某 Online (Natural)
              </NText>
            </template>
            例如 Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)，各种营销号就用的这些配音
          </NTooltip>
          系列语音，效果<NText strong>
            好很多
          </NText>
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
          <NText strong>
            重要：
          </NText> 当在后台运行时请关闭浏览器的页面休眠/内存节省功能
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
      <NGrid
        :cols="4"
        :x-gap="12"
        :y-gap="12"
        responsive="screen"
      >
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
          <NStatistic
            label="队列长度"
            :value="queueStats.total"
          >
            <template #suffix>
              <NText depth="3">
                条
              </NText>
            </template>
          </NStatistic>
        </NGi>

        <NGi>
          <NStatistic
            label="已读取"
            :value="readedDanmaku"
          >
            <template #suffix>
              <NText depth="3">
                条
              </NText>
            </template>
          </NStatistic>
        </NGi>

        <NGi>
          <NStatistic label="队列分布">
            <NFlex
              :size="8"
              style="margin-top: 4px"
            >
              <NTooltip v-if="queueStats.messages > 0">
                <template #trigger>
                  <NTag
                    :bordered="false"
                    type="info"
                    size="small"
                  >
                    弹幕 {{ queueStats.messages }}
                  </NTag>
                </template>
                弹幕消息数量
              </NTooltip>
              <NTooltip v-if="queueStats.gifts > 0">
                <template #trigger>
                  <NTag
                    :bordered="false"
                    type="success"
                    size="small"
                  >
                    礼物 {{ queueStats.gifts }}
                  </NTag>
                </template>
                礼物消息数量
              </NTooltip>
              <NTooltip v-if="queueStats.waiting > 0">
                <template #trigger>
                  <NTag
                    :bordered="false"
                    type="warning"
                    size="small"
                  >
                    等待 {{ queueStats.waiting }}
                  </NTag>
                </template>
                等待合并的礼物
              </NTooltip>
            </NFlex>
          </NStatistic>
        </NGi>
      </NGrid>

      <!-- 队列详情 -->
      <NDivider style="margin: 16px 0" />
      <NCollapse>
        <NCollapseItem
          title="队列详情"
          name="queue"
        >
          <template #header-extra>
            <NTag
              :bordered="false"
              size="small"
            >
              {{ speakQueue.length }} 项
            </NTag>
          </template>

          <NEmpty
            v-if="speakQueue.length === 0"
            description="队列为空"
            size="small"
          />

          <NScrollbar
            v-else
            style="max-height: 300px"
          >
            <NList
              size="small"
              bordered
            >
              <NListItem
                v-for="(item, index) in speakQueue"
                :key="`${item.data.time}-${index}`"
              >
                <NFlex
                  align="center"
                  :size="8"
                >
                  <NButton
                    type="primary"
                    size="tiny"
                    circle
                    @click="forceSpeak(item.data)"
                  >
                    <template #icon>
                      <NIcon :component="Play20Filled" />
                    </template>
                  </NButton>

                  <NButton
                    type="error"
                    size="tiny"
                    circle
                    @click="removeFromQueue(item)"
                  >
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

                  <NText strong>
                    {{ item.data.uname }}
                  </NText>

                  <NText depth="3">
                    {{ speechService.getTextFromDanmaku(item.data) }}
                  </NText>
                </NFlex>
              </NListItem>
            </NList>
          </NScrollbar>
        </NCollapseItem>
      </NCollapse>
    </NCard>

    <!-- 语音设置区域 -->
    <NCard
      title="语音设置"
      size="small"
      bordered
    >
      <NFlex
        vertical
        :size="12"
      >
        <!-- 输出设备选择 -->
        <div>
          <NFlex justify="space-between" align="center">
            <NText strong>
              输出设备
            </NText>
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

        <NRadioGroup
          v-model:value="settings.voiceType"
          size="large"
        >
          <NRadioButton value="local">
            <NFlex :size="4">
              <span>本地语音</span>
              <NTooltip>
                <template #trigger>
                  <NIcon
                    :component="Info24Filled"
                    :size="16"
                  />
                </template>
                使用浏览器内置的语音合成功能
              </NTooltip>
            </NFlex>
          </NRadioButton>

          <NRadioButton value="azure">
            <NFlex :size="4">
              <span>Azure TTS</span>
              <NTooltip>
                <template #trigger>
                  <NIcon
                    :component="Info24Filled"
                    :size="16"
                  />
                </template>
                使用 Microsoft Azure 语音合成服务, 混合语言输出效果和音质好, 略有延迟
              </NTooltip>
            </NFlex>
          </NRadioButton>

          <NRadioButton value="api">
            <NFlex :size="4">
              <span>API 语音</span>
              <NTooltip>
                <template #trigger>
                  <NIcon
                    :component="Info24Filled"
                    :size="16"
                  />
                </template>
                自定义语音API，可以播放自己训练的模型或其他TTS
              </NTooltip>
            </NFlex>
          </NRadioButton>
        </NRadioGroup>

        <Transition
          name="fade"
          mode="out-in"
        >
          <!-- 本地语音设置 -->
          <NFlex
            v-if="settings.voiceType === 'local'"
            vertical
            :size="16"
          >
            <div>
              <NText strong>
                选择语音
              </NText>
              <NSelect
                v-model:value="settings.speechInfo.voice"
                :options="voiceOptions"
                :fallback-option="() => ({
                  label: settings.speechInfo.voice ? `已选择: ${settings.speechInfo.voice}` : '未选择, 将使用默认语音',
                  value: settings.speechInfo.voice || '',
                })"
                style="margin-top: 8px"
                filterable
              />
            </div>

            <div>
              <NFlex
                justify="space-between"
                align="center"
              >
                <NText>音量</NText>
                <NText depth="3">
                  {{ (settings.speechInfo.volume * 100).toFixed(0) }}%
                </NText>
              </NFlex>
              <NSlider
                v-model:value="settings.speechInfo.volume"
                :min="0"
                :max="1"
                :step="0.01"
                style="margin-top: 8px"
              />
            </div>

            <div>
              <NFlex
                justify="space-between"
                align="center"
              >
                <NText>音调</NText>
                <NText depth="3">
                  {{ settings.speechInfo.pitch.toFixed(2) }}
                </NText>
              </NFlex>
              <NSlider
                v-model:value="settings.speechInfo.pitch"
                :min="0"
                :max="2"
                :step="0.01"
                style="margin-top: 8px"
              />
            </div>

            <div>
              <NFlex
                justify="space-between"
                align="center"
              >
                <NText>语速</NText>
                <NText depth="3">
                  {{ settings.speechInfo.rate.toFixed(2) }}
                </NText>
              </NFlex>
              <NSlider
                v-model:value="settings.speechInfo.rate"
                :min="0"
                :max="2"
                :step="0.01"
                style="margin-top: 8px"
              />
            </div>
          </NFlex>

          <!-- Azure TTS 设置 -->
          <NFlex
            v-else-if="settings.voiceType === 'azure'"
            vertical
            :size="16"
          >
            <NAlert
              type="success"
              :bordered="false"
            >
              <template #icon>
                <NIcon :component="Info24Filled" />
              </template>
              使用本站提供的 Microsoft Azure 语音合成服务，效果最好
            </NAlert>

            <div>
              <NFlex justify="space-between" align="center">
                <NText strong>
                  语音选择
                </NText>
                <NButton
                  v-if="azureVoices.length === 0"
                  text
                  type="primary"
                  size="small"
                  :loading="azureVoicesLoading"
                  @click="fetchAzureVoices"
                >
                  加载语音列表
                </NButton>
                <NText v-else depth="3" style="font-size: 12px">
                  共 {{ azureVoices.length }} 个语音
                </NText>
              </NFlex>
              <NSelect
                v-model:value="settings.azureVoice"
                :options="azureVoices.length > 0 ? azureVoices : [
                  { label: '中文(普通话)女 - 晓晓', value: 'zh-CN-XiaoxiaoNeural' },
                  { label: '中文(普通话)女 - 晓伊', value: 'zh-CN-XiaoyiNeural' },
                  { label: '中文(普通话)女 - 晓梦', value: 'zh-CN-XiaomengNeural' },
                  { label: '中文(普通话)女 - 晓莫', value: 'zh-CN-XiaomoNeural' },
                  { label: '中文(普通话)女 - 晓秋', value: 'zh-CN-XiaoqiuNeural' },
                  { label: '中文(普通话)女 - 晓双', value: 'zh-CN-XiaoshuangNeural' },
                  { label: '中文(普通话)女 - 晓纯', value: 'zh-CN-XiaochenNeural' },
                  { label: '中文(普通话)女 - 晓翔', value: 'zh-CN-XiaoxiangNeural' },
                  { label: '中文(普通话)女 - 晓蕾', value: 'zh-CN-XiaorouNeural' },
                  { label: '中文(普通话)女 - 晓瑶', value: 'zh-CN-XiaoyouNeural' },
                  { label: '中文(普通话)男 - 云希', value: 'zh-CN-YunxiNeural' },
                  { label: '中文(普通话)男 - 云扬', value: 'zh-CN-YunyangNeural' },
                  { label: '中文(普通话)男 - 云健', value: 'zh-CN-YunjianNeural' },
                  { label: '中文(普通话)儿童 - 晓晋', value: 'zh-CN-XiaozhenNeural' },
                  { label: '中文(普通话)儿童 - 云夏', value: 'zh-CN-YunxiaNeural' },
                ]"
                :loading="azureVoicesLoading"
                :fallback-option="() => ({
                  label: settings.azureVoice ? `已选择: ${settings.azureVoice}` : '未选择',
                  value: settings.azureVoice || '',
                })"
                style="margin-top: 8px"
                filterable
                @focus="fetchAzureVoices"
              />
            </div>

            <div>
              <NFlex
                justify="space-between"
                align="center"
              >
                <NText>音量</NText>
                <NText depth="3">
                  {{ (settings.speechInfo.volume * 100).toFixed(0) }}%
                </NText>
              </NFlex>
              <NSlider
                v-model:value="settings.speechInfo.volume"
                :min="0"
                :max="1"
                :step="0.01"
                style="margin-top: 8px"
              />
            </div>

            <div>
              <NFlex
                justify="space-between"
                align="center"
              >
                <NText>音调</NText>
                <NText depth="3">
                  {{ settings.speechInfo.pitch.toFixed(2) }}
                </NText>
              </NFlex>
              <NSlider
                v-model:value="settings.speechInfo.pitch"
                :min="0.5"
                :max="2"
                :step="0.01"
                style="margin-top: 8px"
              />
            </div>

            <div>
              <NFlex
                justify="space-between"
                align="center"
              >
                <NText>语速</NText>
                <NText depth="3">
                  {{ settings.speechInfo.rate.toFixed(2) }}
                </NText>
              </NFlex>
              <NSlider
                v-model:value="settings.speechInfo.rate"
                :min="0.5"
                :max="2"
                :step="0.01"
                style="margin-top: 8px"
              />
            </div>
          </NFlex>

          <!-- API 语音设置 -->
          <NFlex
            v-else
            vertical
            :size="16"
          >
            <NCollapse>
              <NCollapseItem
                title="📖 使用说明"
                name="requirements"
              >
                <NFlex
                  vertical
                  :size="8"
                >
                  <NText>API 要求：</NText>
                  <ul style="margin: 0; padding-left: 24px">
                    <li>直接返回音频数据（wav, mp3, m4a 等）</li>
                    <li>建议使用 HTTPS（HTTP 将通过 Cloudflare Workers 代理，会较慢）</li>
                    <li>确保 API 可以被外部访问</li>
                  </ul>
                  <NDivider style="margin: 8px 0" />
                  <NText>推荐项目（可本地部署）：</NText>
                  <NButton
                    text
                    type="info"
                    tag="a"
                    href="https://github.com/Artrajz/vits-simple-api"
                    target="_blank"
                  >
                    vits-simple-api
                  </NButton>
                </NFlex>
              </NCollapseItem>
            </NCollapse>

            <NAlert
              v-if="isVtsuruVoiceAPI"
              type="success"
              closable
            >
              <template #icon>
                <NIcon :component="Info24Filled" />
              </template>
              你正在使用本站提供的测试 API (voice.vtsuru.live)，仅用于测试，不保证可用性
            </NAlert>

            <NAlert type="info">
              地址中的
              <NButton
                size="tiny"
                type="primary"
                text
                @click="copyToClipboard('{{text}}')"
              >
                <span v-text="'{{ text }}'" />
              </NButton>
              将被替换为要念的文本
            </NAlert>

            <div>
              <NText strong>
                API 地址
              </NText>
              <NInputGroup style="margin-top: 8px">
                <NSelect
                  v-model:value="settings.voiceAPISchemeType"
                  :options="[
                    { label: 'https://', value: 'https' },
                    { label: 'http://', value: 'http' },
                  ]"
                  style="width: 110px"
                />
                <NInput
                  v-model:value="settings.voiceAPI"
                  placeholder="例如: xxx.com/voice/bert-vits2?text={{text}}&id=0"
                  :status="/^(?:https?:\/\/)/.test(settings.voiceAPI?.toLowerCase() ?? '') ? 'error' : undefined"
                />
                <NButton
                  type="info"
                  :loading="speechState.isApiAudioLoading"
                  @click="testAPI"
                >
                  测试
                </NButton>
              </NInputGroup>
            </div>

            <NAlert
              v-if="settings.voiceAPISchemeType === 'http'"
              type="warning"
            >
              <template #icon>
                <NIcon :component="Info24Filled" />
              </template>
              <NFlex
                vertical
                :size="8"
              >
                <NText>不使用 HTTPS 将通过 Cloudflare Workers 代理，速度会慢很多</NText>
                <NCheckbox v-model:checked="settings.useAPIDirectly">
                  不使用代理（需要了解可能产生的影响）
                </NCheckbox>
              </NFlex>
            </NAlert>

            <div>
              <NFlex
                justify="space-between"
                align="center"
              >
                <NText>音量</NText>
                <NText depth="3">
                  {{ (settings.speechInfo.volume * 100).toFixed(0) }}%
                </NText>
              </NFlex>
              <NSlider
                v-model:value="settings.speechInfo.volume"
                :min="0"
                :max="1"
                :step="0.01"
                style="margin-top: 8px"
              />
            </div>
          </NFlex>
        </Transition>

        <!-- 隐藏的音频元素 - 用于 API 和 Azure TTS -->
        <audio
          v-if="settings.voiceType !== 'local'"
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
    <NCard
      title="消息模板"
      size="small"
      bordered
    >
      <NFlex
        vertical
        :size="12"
      >
        <NAlert
          type="info"
          :bordered="false"
        >
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
            <NInputGroupLabel style="min-width: 120px">
              弹幕模板
            </NInputGroupLabel>
            <NInput
              v-model:value="settings.danmakuTemplate"
            />
            <NButton
              type="info"
              :loading="speechState.isApiAudioLoading"
              @click="test(EventDataTypes.Message)"
            >
              测试
            </NButton>
          </NInputGroup>
        </div>

        <div>
          <NInputGroup>
            <NInputGroupLabel style="min-width: 120px">
              礼物模板
            </NInputGroupLabel>
            <NInput
              v-model:value="settings.giftTemplate"
            />
            <NButton
              type="info"
              :loading="speechState.isApiAudioLoading"
              @click="test(EventDataTypes.Gift)"
            >
              测试
            </NButton>
          </NInputGroup>
        </div>

        <div>
          <NInputGroup>
            <NInputGroupLabel style="min-width: 120px">
              SC 模板
            </NInputGroupLabel>
            <NInput
              v-model:value="settings.scTemplate"
            />
            <NButton
              type="info"
              :loading="speechState.isApiAudioLoading"
              @click="test(EventDataTypes.SC)"
            >
              测试
            </NButton>
          </NInputGroup>
        </div>

        <div>
          <NInputGroup>
            <NInputGroupLabel style="min-width: 120px">
              上舰模板
            </NInputGroupLabel>
            <NInput
              v-model:value="settings.guardTemplate"
            />
            <NButton
              type="info"
              :loading="speechState.isApiAudioLoading"
              @click="test(EventDataTypes.Guard)"
            >
              测试
            </NButton>
          </NInputGroup>
        </div>

        <div>
          <NInputGroup>
            <NInputGroupLabel style="min-width: 120px">
              进入直播间模板
            </NInputGroupLabel>
            <NInput
              v-model:value="settings.enterTemplate"
            />
            <NButton
              type="info"
              :loading="speechState.isApiAudioLoading"
              @click="test(EventDataTypes.Enter)"
            >
              测试
            </NButton>
          </NInputGroup>
        </div>
      </NFlex>
    </NCard>

    <!-- 高级设置区域 -->
    <NCard
      title="高级设置"
      size="small"
      bordered
    >
      <NFlex
        vertical
        :size="12"
      >
        <NFlex align="center">
          <NCheckbox
            :checked="settings.combineGiftDelay !== undefined"
            @update:checked="(checked: boolean) => {
              settings.combineGiftDelay = checked ? 2 : undefined
            }"
          >
            <NFlex
              :size="4"
              align="center"
            >
              <span>礼物合并</span>
              <NTooltip>
                <template #trigger>
                  <NIcon
                    :component="Info24Filled"
                    :size="16"
                  />
                </template>
                在指定时间内连续送相同礼物会等停止送礼物之后才会念。
                <br>
                这也会导致送的礼物会等待指定时间之后才会念，即使没有连续赠送。
              </NTooltip>
            </NFlex>
          </NCheckbox>

          <NInputGroup
            v-if="settings.combineGiftDelay !== undefined"
            style="width: 200px"
          >
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
          v-if="settings.voiceType === 'api'"
          v-model:checked="settings.splitText"
        >
          <NFlex
            :size="4"
            align="center"
          >
            <span>启用句子拆分</span>
            <NTooltip>
              <template #trigger>
                <NIcon
                  :component="Info24Filled"
                  :size="16"
                />
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
