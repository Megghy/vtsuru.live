<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import EasySpeech from 'easy-speech'
import { NAlert, NButton, NDivider, NIcon, NInput, NInputGroup, NInputGroupLabel, NPopconfirm, NSelect, NSlider, NSpace, NTag, NText, NTooltip, useMessage } from 'naive-ui'
import { useRoute } from 'vue-router'
import { useStorage } from '@vueuse/core'
import { Queue } from 'queue-typescript'
import DanmakuClient, { DanmakuInfo, RoomAuthInfo } from '@/data/DanmakuClient'
import { EventDataTypes, EventModel } from '@/api/api-models'
import { useAccount } from '@/api/account'
import { Mic24Filled } from '@vicons/fluent'
import { copyToClipboard } from '@/Utils'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { VTSURU_API_URL } from '@/data/constants'

const props = defineProps<{
  client: DanmakuClient
  roomInfo: RoomAuthInfo
  code: string | undefined
  isOpenLive?: boolean
}>()

type SpeechSettings = {
  speechInfo: SpeechInfo
  danmakuTemplate: string
  scTemplate: string
  guardTemplate: string
  giftTemplate: string
}
type SpeechInfo = {
  volume: number
  pitch: number
  rate: number
  voice: string
}

const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()
const settings = useStorage<SpeechSettings>('Setting.Speech.Settings', {
  speechInfo: {
    volume: 1,
    pitch: 1,
    rate: 1,
    voice: '',
  },
  danmakuTemplate: '{name} 说: {message}',
  scTemplate: '{name} 发送了醒目留言: {message}',
  guardTemplate: '感谢 {name} 的 {count} 个月 {guard_level}',
  giftTemplate: '感谢 {name} 赠送的 {count} 个 {gift_name}',
})
const speechSynthesisInfo = ref<{
  speechSynthesis: SpeechSynthesis | undefined
  speechSynthesisUtterance: SpeechSynthesisUtterance | undefined
  speechSynthesisVoice: SpeechSynthesisVoice | undefined
  speechSynthesisEvent: SpeechSynthesisEvent | undefined
  speechSynthesisErrorEvent: SpeechSynthesisErrorEvent | undefined
  onvoiceschanged: boolean
  onboundary: boolean
  onend: boolean
  onerror: boolean
  onmark: boolean
  onpause: boolean
  onresume: boolean
  onstart: boolean
}>()
const languageDisplayName = new Intl.DisplayNames(['zh'], { type: 'language' })
const voiceOptions = computed(() => {
  return EasySpeech.voices().map((v) => {
    return {
      label: `[${languageDisplayName.of(v.lang)}] ${v.name}`,
      value: v.name,
    }
  })
})
const isSpeaking = ref(false)
const speakQueue = new Queue<string>()

const canSpeech = ref(false)
const readedDanmaku = ref(0)

const templateConstants = {
  name: {
    name: '用户名',
    words: '{name}',
    regex: /\{\s*name\s*\}/gi,
  },
  message: {
    name: '弹幕内容',
    words: '{message}',
    regex: /\{\s*message\s*\}/gi,
  },
  guard_level: {
    name: '舰长等级',
    words: '{guard_level}',
    regex: /\{\s*guard_level\s*\}/gi,
  },
  guard_num: {
    name: '上舰数量',
    words: '{guard_num}',
    regex: /\{\s*guard_num\s*\}/gi,
  },
  fans_medal_level: {
    name: '粉丝勋章等级',
    words: '{fans_medal_level}',
    regex: /\{\s*fans_medal_level\s*\}/gi,
  },
  price: {
    name: '价格',
    words: '{price}',
    regex: /\{\s*price\s*\}/gi,
  },
  count: {
    name: '数量',
    words: '{count}',
    regex: /\{\s*count\s*\}/gi,
  },
  gift_name: {
    name: '礼物名称',
    words: '{gift_name}',
    regex: /\{\s*gift_name\s*\}/gi,
  },
}
const speechCount = ref(0)
async function speak() {
  if (isSpeaking.value) {
    return
  }
  const text = speakQueue.dequeue()
  if (text) {
    isSpeaking.value = true
    speechCount.value--
    readedDanmaku.value++
    console.log(`[TTS] 正在朗读: ${text}`)
    await EasySpeech.speak({
      text: text,
      volume: settings.value.speechInfo.volume,
      pitch: settings.value.speechInfo.pitch,
      rate: settings.value.speechInfo.rate,
      voice: EasySpeech.voices().find((v) => v.name == settings.value.speechInfo.voice) ?? undefined,
    })
      .then(() => {})
      .catch((error) => {
        if (error.error == 'interrupted') {
          //被中断
          return
        }
        console.log(error)
        message.error('无法播放语音: ' + error.error)
      })
      .finally(() => {
        isSpeaking.value = false
      })
  }
}
function onGetEvent(data: EventModel) {
  if (!canSpeech.value) {
    return
  }
  if (data.type == EventDataTypes.Message && (data.emoji || /^(?:\[\w+\])+$/.test(data.msg))) {
    // 不支持表情
    return
  }
  onGetEventInternal(data)
}
function onGetEventInternal(data: EventModel) {
  let text: string
  switch (data.type) {
    case EventDataTypes.Message:
      if (!settings.value.danmakuTemplate) {
        return
      }
      text = settings.value.danmakuTemplate
      break
    case EventDataTypes.SC:
      if (!settings.value.scTemplate) {
        return
      }
      text = settings.value.scTemplate
      break
    case EventDataTypes.Guard:
      if (!settings.value.guardTemplate) {
        return
      }
      text = settings.value.guardTemplate
      break
    case EventDataTypes.Gift:
      if (!settings.value.giftTemplate) {
        return
      }
      text = settings.value.giftTemplate
      break
  }
  text = text
    .replace(templateConstants.name.regex, data.name)
    .replace(templateConstants.count.regex, data.num.toString())
    .replace(templateConstants.price.regex, data.price.toString())
    .replace(templateConstants.message.regex, data.msg)
    .replace(templateConstants.guard_level.regex, data.guard_level == 1 ? '总督' : data.guard_level == 2 ? '提督' : data.guard_level == 3 ? '舰长' : '')
    .replace(templateConstants.fans_medal_level.regex, data.fans_medal_level.toString())

  if (data.type === EventDataTypes.Message) {
    text = text.replace(/\[.*?\]/g, ' ') //删除表情
  } else if (data.type === EventDataTypes.Gift) {
    text = text.replace(templateConstants.gift_name.regex, data.msg)
  } else if (data.type === EventDataTypes.Guard) {
    text = text.replace(templateConstants.guard_num.regex, data.num.toString())
  }
  speakQueue.enqueue(text)
  speechCount.value++
}
function startSpeech() {
  canSpeech.value = true
  message.success('服务已启动')
}
function stopSpeech() {
  canSpeech.value = false
  message.success('已停止监听')
}
function cancelSpeech() {
  EasySpeech.cancel()
}
async function uploadConfig() {
  await QueryPostAPI(VTSURU_API_URL + 'set-config', {
    name: 'Speech',
    json: JSON.stringify(settings.value),
  })
    .then((data) => {
      if (data.code == 200) {
        message.success('已保存至服务器')
      } else {
        message.error('保存失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('保存失败')
    })
}
async function downloadConfig() {
  await QueryGetAPI<string>(VTSURU_API_URL + 'get-config', {
    name: 'Speech',
  })
    .then((data) => {
      if (data.code == 200) {
        settings.value = JSON.parse(data.data)
        message.success('已获取配置文件')
      } else if (data.code == 404) {
        message.error('未上传配置文件')
      } else {
        message.error('获取失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('获取失败')
    })
}

function test(type: EventDataTypes) {
  switch (type) {
    case EventDataTypes.Message:
      onGetEventInternal({
        type: EventDataTypes.Message,
        name: accountInfo.value?.name ?? '未知用户',
        uid: accountInfo.value?.biliId ?? 0,
        msg: '测试弹幕',
        price: 0,
        num: 0,
        time: Date.now(),
        guard_level: 0,
        fans_medal_level: 1,
        fans_medal_name: '',
        fans_medal_wearing_status: false,
        emoji: undefined,
        avatar: '',
      })
      break
    case EventDataTypes.SC:
      onGetEventInternal({
        type: EventDataTypes.SC,
        name: accountInfo.value?.name ?? '未知用户',
        uid: accountInfo.value?.biliId ?? 0,
        msg: '测试sc',
        price: 30,
        num: 1,
        time: Date.now(),
        guard_level: 0,
        fans_medal_level: 1,
        fans_medal_name: '',
        fans_medal_wearing_status: false,
        emoji: undefined,
        avatar: '',
      })
      break
    case EventDataTypes.Guard:
      onGetEventInternal({
        type: EventDataTypes.Guard,
        name: accountInfo.value?.name ?? '未知用户',
        uid: accountInfo.value?.biliId ?? 0,
        msg: '舰长',
        price: 0,
        num: 1,
        time: Date.now(),
        guard_level: 3,
        fans_medal_level: 1,
        fans_medal_name: '',
        fans_medal_wearing_status: false,
        emoji: undefined,
        avatar: '',
      })
      break
    case EventDataTypes.Gift:
      onGetEventInternal({
        type: EventDataTypes.Gift,
        name: accountInfo.value?.name ?? '未知用户',
        uid: accountInfo.value?.biliId ?? 0,
        msg: '测试礼物',
        price: 5,
        num: 5,
        time: Date.now(),
        guard_level: 0,
        fans_medal_level: 1,
        fans_medal_name: '',
        fans_medal_wearing_status: false,
        emoji: undefined,
        avatar: '',
      })
      break
  }
}

let speechQueueTimer: any
onMounted(() => {
  speechSynthesisInfo.value = EasySpeech.detect()
  speechQueueTimer = setInterval(() => {
    speak()
  }, 100)

  props.client.onEvent('danmaku', onGetEvent)
  props.client.onEvent('sc', onGetEvent)
  props.client.onEvent('guard', onGetEvent)
  props.client.onEvent('gift', onGetEvent)
})
onUnmounted(() => {
  clearInterval(speechQueueTimer)
  props.client.offEvent('danmaku', onGetEvent)
  props.client.offEvent('sc', onGetEvent)
  props.client.offEvent('guard', onGetEvent)
  props.client.offEvent('gift', onGetEvent)
})
</script>

<template>
  <NAlert v-if="!speechSynthesisInfo || !speechSynthesisInfo.speechSynthesis" type="error"> 你的浏览器不支持语音功能 </NAlert>
  <NSpace v-else>
    <NButton @click="canSpeech ? stopSpeech() : startSpeech()" :type="canSpeech ? 'error' : 'primary'"> {{ canSpeech ? '停止监听' : '开始监听' }} </NButton>
    <NButton @click="uploadConfig" type="primary" secondary> 保存配置到服务器 </NButton>
    <NPopconfirm @positive-click="downloadConfig">
      <template #trigger>
        <NButton type="primary" secondary> 从服务器获取配置 </NButton>
      </template>
      这将覆盖当前设置, 确定?
    </NPopconfirm>
  </NSpace>
  <template v-if="canSpeech">
    <NDivider> 状态 </NDivider>
    <NSpace vertical align="center">
      <NTooltip>
        <template #trigger>
          <NButton circle :disabled="!isSpeaking" @click="cancelSpeech" :style="`animation: ${isSpeaking ? 'animated-border 2.5s infinite;' : ''}`">
            <template #icon>
              <NIcon :component="Mic24Filled" :color="isSpeaking ? 'green' : 'gray'" />
            </template>
          </NButton>
        </template>
        {{ isSpeaking ? '取消朗读' : '未朗读' }}
      </NTooltip>
      <NText depth="3"> 队列: {{ speechCount }} <NDivider vertical /> 已读: {{ readedDanmaku }} 条 </NText>
    </NSpace>
  </template>
  <NDivider />
  <NSpace vertical>
    <NSelect v-model:value="settings.speechInfo.voice" :options="voiceOptions" :fallback-option="() => ({ label: '未选择, 将使用默认语音', value: '' })" />
    <span style="width: 100%">
      <NText> 音量 </NText>
      <NSlider style="min-width: 200px" v-model:value="settings.speechInfo.volume" :min="0" :max="1" :step="0.01" />
    </span>
    <span style="width: 100%">
      <NText> 音调 </NText>
      <NSlider style="min-width: 200px" v-model:value="settings.speechInfo.pitch" :min="0" :max="2" :step="0.01" />
    </span>
    <span style="width: 100%">
      <NText> 语速 </NText>
      <NSlider style="min-width: 200px" v-model:value="settings.speechInfo.rate" :min="0" :max="2" :step="0.01" />
    </span>
  </NSpace>
  <NDivider> 自定义内容 </NDivider>
  <NSpace vertical>
    <NSpace>
      支持的变量:
      <NButton size="tiny" secondary v-for="item in Object.values(templateConstants)" :key="item.name" @click="copyToClipboard(item.words)"> {{ item.words }} | {{ item.name }} </NButton>
    </NSpace>
    <NInputGroup>
      <NInputGroupLabel> 弹幕模板 </NInputGroupLabel>
      <NInput v-model:value="settings.danmakuTemplate" placeholder="弹幕消息" />
      <NButton @click="test(EventDataTypes.Message)" type="info"> 测试 </NButton>
    </NInputGroup>
    <NInputGroup>
      <NInputGroupLabel> 礼物模板 </NInputGroupLabel>
      <NInput v-model:value="settings.giftTemplate" placeholder="礼物消息" />
      <NButton @click="test(EventDataTypes.Gift)" type="info"> 测试 </NButton>
    </NInputGroup>
    <NInputGroup>
      <NInputGroupLabel> SC模板 </NInputGroupLabel>
      <NInput v-model:value="settings.scTemplate" placeholder="SC消息" />
      <NButton @click="test(EventDataTypes.SC)" type="info"> 测试 </NButton>
    </NInputGroup>
    <NInputGroup>
      <NInputGroupLabel> 上舰模板 </NInputGroupLabel>
      <NInput v-model:value="settings.guardTemplate" placeholder="上舰消息" />
      <NButton @click="test(EventDataTypes.Guard)" type="info"> 测试 </NButton>
    </NInputGroup>
  </NSpace>
  <NDivider> 设置 </NDivider>
  <NText depth="3"> 没想好需要什么, 有建议的话可以和我说 </NText>
</template>

<style>
@keyframes animated-border {
  0% {
    box-shadow: 0 0 0px #589580;
  }

  100% {
    box-shadow: 0 0 0 4px rgba(255, 255, 255, 0);
  }
}
</style>
