<script setup lang="ts">
import type { EventModel } from '@/api/api-models'
import {
  CheckmarkCircle20Filled,
  Dismiss20Filled,
  Info24Filled,
  Mic24Filled,
  MicOff24Filled,
  Play20Filled,
  Settings20Filled,
  Speaker124Filled,
} from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NCollapse,
  NCollapseItem,
  NDivider,
  NEmpty,
  NGrid,
  NGi,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NList,
  NListItem,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NSelect,
  NSlider,
  NSpace,
  NSpin,
  NStatistic,
  NTag,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import { copyToClipboard } from '@/Utils'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { templateConstants, useSpeechService } from '@/store/useSpeechService'

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

// 音频输出设备相关
const availableDevices = ref<MediaDeviceInfo[]>([])
const selectedDeviceId = ref<string>('default')
const isLoadingDevices = ref(false)

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

const deviceOptions = computed(() => {
  return [
    { label: '默认设备', value: 'default' },
    ...availableDevices.value.map(device => ({
      label: device.label || `设备 ${device.deviceId.substring(0, 8)}`,
      value: device.deviceId,
    })),
  ]
})

// 获取音频输出设备列表
async function loadAudioDevices() {
  try {
    isLoadingDevices.value = true

    // 请求权限
    await navigator.mediaDevices.getUserMedia({ audio: true })

    // 获取设备列表
    const devices = await navigator.mediaDevices.enumerateDevices()
    availableDevices.value = devices.filter(device => device.kind === 'audiooutput')

    console.log('[TTS] 已加载音频输出设备:', availableDevices.value.length)
  } catch (error) {
    console.error('[TTS] 获取音频设备失败:', error)
    message.warning('无法获取音频设备列表，将使用默认设备')
  } finally {
    isLoadingDevices.value = false
  }
}

// 切换音频输出设备
async function changeAudioDevice(deviceId: string) {
  if (!apiAudio.value) return

  try {
    // @ts-ignore - setSinkId 可能在某些浏览器中不可用
    if (typeof apiAudio.value.setSinkId === 'function') {
      // @ts-ignore
      await apiAudio.value.setSinkId(deviceId)
      message.success(`已切换到: ${deviceOptions.value.find(d => d.value === deviceId)?.label}`)
      console.log('[TTS] 音频输出设备已切换:', deviceId)
    } else {
      message.warning('当前浏览器不支持切换音频输出设备')
    }
  } catch (error) {
    console.error('[TTS] 切换音频设备失败:', error)
    message.error('切换音频设备失败')
  }
}

// 监听设备选择变化
watch(selectedDeviceId, (newDeviceId) => {
  changeAudioDevice(newDeviceId)
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

// 生命周期
onMounted(async () => {
  await speechService.initialize()
  await loadAudioDevices()

  client.onEvent('danmaku', onGetEvent)
  client.onEvent('sc', onGetEvent)
  client.onEvent('guard', onGetEvent)
  client.onEvent('gift', onGetEvent)
  client.onEvent('enter', onGetEvent)

  // 监听设备变化
  navigator.mediaDevices.addEventListener('devicechange', loadAudioDevices)
})

onUnmounted(() => {
  client.offEvent('danmaku', onGetEvent)
  client.offEvent('sc', onGetEvent)
  client.offEvent('guard', onGetEvent)
  client.offEvent('gift', onGetEvent)
  client.offEvent('enter', onGetEvent)

  speechService.stopSpeech()

  // 移除设备变化监听
  navigator.mediaDevices.removeEventListener('devicechange', loadAudioDevices)
})
</script>

<template>
  <div class="read-danmaku-container">
    <NAlert
      v-if="!speechSynthesisInfo || !speechSynthesisInfo.speechSynthesis"
      type="error"
      title="不支持语音功能"
    >
      你的浏览器不支持语音功能，请使用现代浏览器如 Chrome、Edge 等
    </NAlert>

    <template v-else>
      <!-- 顶部提示区域 -->
      <NSpace
        vertical
        :size="12"
      >
        <NAlert
          v-if="settings.voiceType == 'local'"
          type="info"
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
          系列语音，效果<NText strong>好很多</NText>
        </NAlert>

        <NAlert
          type="warning"
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
      </NSpace>

      <!-- 主控制区域 -->
      <NCard
        :bordered="false"
        style="margin-top: 16px"
      >
        <NSpace
          vertical
          :size="16"
        >
          <NSpace
            align="center"
            justify="space-between"
            :wrap="false"
          >
            <NSpace align="center">
              <NButton
                :type="speechState.canSpeech ? 'error' : 'primary'"
                size="large"
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

              <NDivider vertical />

              <NButton
                :type="speechState.isSpeaking ? 'error' : 'default'"
                :disabled="!speechState.isSpeaking"
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
                @click="clearQueue"
              >
                <template #icon>
                  <NIcon :component="Dismiss20Filled" />
                </template>
                清空队列
              </NButton>
            </NSpace>

            <NSpace align="center">
              <NPopconfirm @positive-click="downloadConfig">
                <template #trigger>
                  <NButton
                    type="primary"
                    secondary
                    size="small"
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
                :disabled="!accountInfo"
                @click="uploadConfig"
              >
                <template #icon>
                  <NIcon :component="CheckmarkCircle20Filled" />
                </template>
                保存配置
              </NButton>
            </NSpace>
          </NSpace>

          <!-- 音频输出设备选择 -->
          <NDivider style="margin: 8px 0">
            音频输出设置
          </NDivider>
          <NSpace
            align="center"
            :size="12"
          >
            <NIcon
              :component="Speaker124Filled"
              :size="20"
            />
            <NText>输出设备：</NText>
            <NSelect
              v-model:value="selectedDeviceId"
              :options="deviceOptions"
              :loading="isLoadingDevices"
              style="min-width: 250px; flex: 1"
              :disabled="availableDevices.length === 0"
            />
            <NButton
              :loading="isLoadingDevices"
              @click="loadAudioDevices"
            >
              刷新设备
            </NButton>
          </NSpace>
          <NAlert
            v-if="availableDevices.length === 0 && !isLoadingDevices"
            type="warning"
            :bordered="false"
          >
            <template #icon>
              <NIcon :component="Info24Filled" />
            </template>
            未检测到音频输出设备或浏览器不支持设备选择功能
          </NAlert>
        </NSpace>
      </NCard>

      <!-- 状态统计区域 -->
      <NCard
        v-if="speechState.canSpeech"
        title="实时状态"
        :bordered="false"
        style="margin-top: 16px"
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
                  :color="speechState.isSpeaking ? '#18a058' : '#d0d0d0'"
                  :size="20"
                  :style="`animation: ${speechState.isSpeaking ? 'pulse 2s infinite' : 'none'}`"
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
              <NSpace
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
                      style="animation: pulse 2s infinite"
                    >
                      等待 {{ queueStats.waiting }}
                    </NTag>
                  </template>
                  等待合并的礼物
                </NTooltip>
              </NSpace>
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
                  <NSpace
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
                      v-if="item.data.type == EventDataTypes.Gift && item.combineCount"
                      type="info"
                      size="small"
                      :bordered="false"
                      style="animation: pulse 2s infinite"
                    >
                      连续赠送中
                    </NTag>
                    <NTag
                      v-else-if="item.data.type == EventDataTypes.Gift && settings.combineGiftDelay"
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
                  </NSpace>
                </NListItem>
              </NList>
            </NScrollbar>
          </NCollapseItem>
        </NCollapse>
      </NCard>

      <!-- 语音设置区域 -->
      <NCard
        title="语音设置"
        :bordered="false"
        style="margin-top: 16px"
      >
        <NSpace
          vertical
          :size="16"
        >
          <NRadioGroup
            v-model:value="settings.voiceType"
            size="large"
          >
            <NRadioButton value="local">
              <NSpace :size="4">
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
              </NSpace>
            </NRadioButton>

            <NRadioButton value="api">
              <NSpace :size="4">
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
              </NSpace>
            </NRadioButton>
          </NRadioGroup>

          <Transition
            name="fade"
            mode="out-in"
          >
            <!-- 本地语音设置 -->
            <NSpace
              v-if="settings.voiceType === 'local'"
              vertical
              :size="16"
            >
              <div>
                <NText strong>选择语音</NText>
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
                <NSpace
                  justify="space-between"
                  align="center"
                >
                  <NText>音量</NText>
                  <NText depth="3">
                    {{ (settings.speechInfo.volume * 100).toFixed(0) }}%
                  </NText>
                </NSpace>
                <NSlider
                  v-model:value="settings.speechInfo.volume"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  style="margin-top: 8px"
                />
              </div>

              <div>
                <NSpace
                  justify="space-between"
                  align="center"
                >
                  <NText>音调</NText>
                  <NText depth="3">
                    {{ settings.speechInfo.pitch.toFixed(2) }}
                  </NText>
                </NSpace>
                <NSlider
                  v-model:value="settings.speechInfo.pitch"
                  :min="0"
                  :max="2"
                  :step="0.01"
                  style="margin-top: 8px"
                />
              </div>

              <div>
                <NSpace
                  justify="space-between"
                  align="center"
                >
                  <NText>语速</NText>
                  <NText depth="3">
                    {{ settings.speechInfo.rate.toFixed(2) }}
                  </NText>
                </NSpace>
                <NSlider
                  v-model:value="settings.speechInfo.rate"
                  :min="0"
                  :max="2"
                  :step="0.01"
                  style="margin-top: 8px"
                />
              </div>
            </NSpace>

            <!-- API 语音设置 -->
            <NSpace
              v-else
              vertical
              :size="16"
            >
              <NCollapse>
                <NCollapseItem
                  title="📖 使用说明"
                  name="requirements"
                >
                  <NSpace
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
                      href="https://github.com/fishaudio/Bert-VITS2"
                      target="_blank"
                    >
                      Bert-VITS2
                    </NButton>
                  </NSpace>
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
                  v-text="'{{ text }}'"
                />
                将被替换为要念的文本
              </NAlert>

              <div>
                <NText strong>API 地址</NText>
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
                <NSpace
                  vertical
                  :size="8"
                >
                  <NText>不使用 HTTPS 将通过 Cloudflare Workers 代理，速度会慢很多</NText>
                  <NCheckbox v-model:checked="settings.useAPIDirectly">
                    不使用代理（需要了解可能产生的影响）
                  </NCheckbox>
                </NSpace>
              </NAlert>

              <div>
                <NSpace
                  justify="space-between"
                  align="center"
                >
                  <NText>音量</NText>
                  <NText depth="3">
                    {{ (settings.speechInfo.volume * 100).toFixed(0) }}%
                  </NText>
                </NSpace>
                <NSlider
                  v-model:value="settings.speechInfo.volume"
                  :min="0"
                  :max="1"
                  :step="0.01"
                  style="margin-top: 8px"
                />
              </div>

              <!-- 隐藏的音频元素 -->
              <audio
                ref="apiAudio"
                :src="speechState.apiAudioSrc"
                :volume="settings.speechInfo.volume"
                style="display: none"
                @ended="cancelSpeech"
                @canplay="speechState.isApiAudioLoading = false"
                @error="onAPIError"
              />
            </NSpace>
          </Transition>
        </NSpace>
      </NCard>

      <!-- 模板设置区域 -->
      <NCard
        title="消息模板"
        :bordered="false"
        style="margin-top: 16px"
      >
        <NSpace
          vertical
          :size="16"
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
            <NSpace :size="8">
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
            </NSpace>
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
        </NSpace>
      </NCard>

      <!-- 高级设置区域 -->
      <NCard
        title="高级设置"
        :bordered="false"
        style="margin-top: 16px"
      >
        <NSpace
          vertical
          :size="16"
        >
          <NSpace align="center">
            <NCheckbox
              :checked="settings.combineGiftDelay !== undefined"
              @update:checked="(checked: boolean) => {
                settings.combineGiftDelay = checked ? 2 : undefined
              }"
            >
              <NSpace
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
              </NSpace>
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
          </NSpace>

          <NCheckbox v-model:checked="settings.splitText">
            <NSpace
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
            </NSpace>
          </NCheckbox>
        </NSpace>
      </NCard>
    </template>
  </div>
</template>

<style scoped>
.read-danmaku-container {
  width: 100%;
  padding: 16px;
  background: var(--n-color);
  border-radius: 8px;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(0.95);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .read-danmaku-container {
    padding: 12px;
  }
}

/* 暗色模式优化 */
@media (prefers-color-scheme: dark) {
  .read-danmaku-container {
    background: var(--n-color);
  }
}
</style>
