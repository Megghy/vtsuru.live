<script setup lang="ts">
import { copyToClipboard } from '@/Utils'
import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import { EventDataTypes, EventModel, OpenLiveInfo } from '@/api/api-models'
import { FETCH_API } from '@/data/constants'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { Info24Filled, Mic24Filled } from '@vicons/fluent'
import { useStorage } from '@vueuse/core'
import EasySpeech from 'easy-speech'
import GraphemeSplitter from 'grapheme-splitter'
import { List } from 'linqts'
import {
  NAlert,
  NButton,
  NCheckbox,
  NCollapse,
  NCollapseItem,
  NDivider,
  NEmpty,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NLi,
  NList,
  NListItem,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSlider,
  NSpace,
  NSpin,
  NTag,
  NText,
  NTooltip,
  NUl,
  useMessage,
} from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { clearInterval, setInterval } from 'worker-timers'

const props = defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

type SpeechSettings = {
  speechInfo: SpeechInfo
  danmakuTemplate: string
  scTemplate: string
  guardTemplate: string
  giftTemplate: string
  enterTemplate: string
  voiceType: 'local' | 'api'
  voiceAPISchemeType: 'http' | 'https'
  voiceAPI: string
  splitText: boolean
  useAPIDirectly: boolean
  combineGiftDelay: number | undefined
}

type SpeechInfo = {
  volume: number
  pitch: number
  rate: number
  voice: string
}

type SpeechState = {
  isSpeaking: boolean
  speakingText: string
  isApiAudioLoading: boolean
  apiAudioSrc: string
  canSpeech: boolean
}

const speechState = reactive<SpeechState>({
  isSpeaking: false,
  speakingText: '',
  isApiAudioLoading: false,
  apiAudioSrc: '',
  canSpeech: false,
})

const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()
const client = await useDanmakuClient().initOpenlive()
const settings = useStorage<SpeechSettings>('Setting.Speech', {
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
  enterTemplate: '欢迎 {name} 进入直播间',
  voiceType: 'local',
  voiceAPISchemeType: 'https',
  voiceAPI: 'voice.vtsuru.live/voice/bert-vits2?text={{text}}&id=1&format=mp3&streaming=true',
  useAPIDirectly: false,
  splitText: false,
  combineGiftDelay: 2,
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
  return new List(EasySpeech.voices())
    .Select((v) => {
      return {
        label: `[${languageDisplayName.of(v.lang)}] ${v.name}`,
        value: v.name,
      }
    })
    .DistinctBy((v) => v.value)
    .ToArray()
})
const speakQueue = ref<{ updateAt: number; combineCount?: number; data: EventModel }[]>([])
const giftCombineMap = new Map<string, number>() // 用于快速查找礼物合并项
const MAX_QUEUE_SIZE = 50 // 最大队列长度限制
const isVtsuruVoiceAPI = computed(() => {
  return (
    settings.value.voiceType == 'api' && settings.value.voiceAPI?.toLowerCase().trim().startsWith('voice.vtsuru.live')
  )
})

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
/**
 * 根据舰长等级数字返回对应的中文名称
 * @param guardLevel 舰长等级
 */
function getGuardLevelName(guardLevel: number): string {
  switch (guardLevel) {
    case 1: return '总督'
    case 2: return '提督'
    case 3: return '舰长'
    default: return ''
  }
}
/**
 * 强制朗读指定事件, 会中断当前朗读并插队到最前面
 * @param data 事件数据
 */
function forceSpeak(data: EventModel) {
  cancelSpeech()

  speakQueue.value.splice(
    speakQueue.value.findIndex((v) => v.data == data),
    1,
  )
  speakQueue.value.unshift({
    updateAt: 0,
    data,
  })
}
async function speak() {
  if (speechState.isSpeaking || speakQueue.value.length == 0) {
    return
  }

  // 寻找可以立即播放的事件（优先非等待合并的礼物）
  let targetIndex = -1
  const now = Date.now()
  const combineDelay = (settings.value.combineGiftDelay ?? 0) * 1000

  for (let i = 0; i < speakQueue.value.length; i++) {
    const item = speakQueue.value[i]

    // 如果是礼物且还在等待合并期间，跳过
    if (item.data.type == EventDataTypes.Gift &&
        combineDelay > 0 &&
        item.updateAt > now - combineDelay) {
      continue
    }

    // 找到第一个可以播放的事件
    targetIndex = i
    break
  }

  // 如果没有找到可播放的事件，直接返回
  if (targetIndex === -1) {
    return
  }

  // 获取要播放的事件并从队列中移除
  const targetItem = speakQueue.value.splice(targetIndex, 1)[0]

  // 如果移除的不是礼物事件，需要更新礼物合并映射的索引
  if (targetItem.data.type !== EventDataTypes.Gift) {
    // 重建礼物合并映射，因为索引可能发生变化
    giftCombineMap.clear()
    speakQueue.value.forEach((item, index) => {
      if (item.data.type === EventDataTypes.Gift) {
        const giftKey = `${item.data.uid}-${item.data.msg}`
        giftCombineMap.set(giftKey, index)
      }
    })
  }

  let text = getTextFromDanmaku(targetItem.data)
  if (text) {
    speechState.isSpeaking = true
    readedDanmaku.value++
    speechState.speakingText = text
    if (checkTimer) {
      clearInterval(checkTimer)
    }
    checkTimer = setInterval(() => {
      message.error('语音播放超时')
      cancelSpeech()
    }, 30000)
    if (settings.value.voiceType == 'local') {
      speakDirect(text)
    } else {
      text = settings.value.splitText ? insertSpaces(text) : text
      speakFromAPI(text)
    }
    console.log(`[TTS] 正在朗读: ${text} ${targetIndex > 0 ? '(跳过等待合并的礼物)' : ''}`)
  }
}
function insertSpaces(sentence: string) {
  // First, insert spaces around English words and numbers
  //sentence = sentence.replace(/([a-zA-Z]+)/g, "'$1'")

  // Then, split all-caps words into single letters, each surrounded by spaces
  sentence = sentence.replace(/\b([A-Z]{2,})\b/g, function (match) {
    return match.split('').join(' ')
  })

  // Clean up any extra spaces that may have been added
  sentence = sentence.replace(/\s+/g, ' ').trim()

  return sentence
}
let checkTimer: number | undefined
/**
 * 使用浏览器本地语音合成功能朗读
 * @param text 要朗读的文本
 */
function speakDirect(text: string) {
  try {
    const synth = window.speechSynthesis
    if (!synth) {
      console.error('当前浏览器环境不支持tts')
      return
    }
    synth.cancel()
    const u = new SpeechSynthesisUtterance()
    u.text = text
    const voices = synth.getVoices()
    const voice = voices.find((v) => v.name === settings.value.speechInfo.voice)
    if (voice) {
      u.voice = voice
      u.volume = settings.value.speechInfo.volume
      u.rate = settings.value.speechInfo.rate
      u.pitch = settings.value.speechInfo.pitch
      synth.speak(u)
      u.onend = () => {
        cancelSpeech()
      }
      u.onerror = (err) => {
        if (err.error == 'interrupted') {
          return
        }
        console.log(err)
        message.error('无法播放语音: ' + err.error)
        cancelSpeech()
      }
    }
  } catch (err) {
    console.log(err)
    // 如果本地语音合成失败，确保清理定时器
    cancelSpeech()
  }
}
const apiAudio = ref<HTMLAudioElement>()
const splitter = new GraphemeSplitter()

/**
 * 构建API请求URL
 * @param text 要朗读的文本
 */
function buildApiUrl(text: string): string | null {
  if (!settings.value.voiceAPI) {
    message.error('未设置语音API')
    return null
  }
  const scheme =
    settings.value.voiceAPISchemeType === 'https'
      ? 'https://'
      : settings.value.useAPIDirectly
        ? 'http://'
        : `${FETCH_API}http://`

  const url = `${scheme}${settings.value.voiceAPI.trim().replace(/^(?:https?:\/\/)/, '')}`.replace(
    /\{\{\s*text\s*\}\}/,
    encodeURIComponent(text),
  )

  try {
    const tempURL = new URL(url)
    if (isVtsuruVoiceAPI.value) {
      tempURL.searchParams.set('vtsuruId', accountInfo.value?.id.toString() ?? '-1')
      if (splitter.countGraphemes(tempURL.searchParams.get('text') ?? '') > 100) {
        message.error(`本站提供的测试接口字数不允许超过 100 字. 内容: [${tempURL.searchParams.get('text')}]`)
        return null
      }
    }
    return tempURL.toString()
  } catch (err) {
    console.log(err)
    message.error('无效的API地址: ' + url)
    return null
  }
}

/**
 * 从API获取语音并播放
 * @param text 要朗读的文本
 */
function speakFromAPI(text: string) {
  const url = buildApiUrl(text)
  if (!url) {
    cancelSpeech()
    return
  }

  speechState.isSpeaking = true
  speechState.isApiAudioLoading = true
  speechState.apiAudioSrc = url

  nextTick(() => {
    if (apiAudio.value) {
      // 设置预加载
      apiAudio.value.preload = 'auto'

      // 播放音频
      const playPromise = apiAudio.value.play()
      if (playPromise) {
        playPromise.catch((err) => {
          if (err.toString().startsWith('AbortError')) {
            return
          }
          console.error('[speakFromAPI] 音频播放失败:', err)
          message.error('无法播放语音: ' + err.message)
          cancelSpeech()
        })
      }
    }
  })
}
function onAPIError(e: Event) {
  if (!speechState.apiAudioSrc) return
  message.error('音频加载失败, 请检查API是否可用以及网络连接')
  cancelSpeech()
}
/**
 * 取消/停止当前所有朗读
 */
function cancelSpeech() {
  speechState.isSpeaking = false
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = undefined
  }
  speechState.isApiAudioLoading = false
  pauseAPI()
  EasySpeech.cancel()
  speechState.speakingText = ''
}
function pauseAPI() {
  if (apiAudio.value && !apiAudio.value.paused) {
    apiAudio.value.pause()
  }
}
/**
 * 接收到事件, 添加到朗读队列
 * @param data 事件数据
 */
function onGetEvent(data: EventModel) {
  if (!speechState.canSpeech) {
    return
  }
  if (data.type == EventDataTypes.Message && (data.emoji || /^(?:\[\w+\])+$/.test(data.msg))) {
    // 不朗读纯表情/图片弹幕
    return
  }
  if (data.type == EventDataTypes.Enter && !settings.value.enterTemplate) {
    return
  }

  // 礼物合并逻辑 - 使用Map优化性能
  if (data.type == EventDataTypes.Gift && settings.value.combineGiftDelay) {
    const giftKey = `${data.uid}-${data.msg}` // 用户ID和礼物名称组成的唯一键
    const existIndex = giftCombineMap.get(giftKey)

    if (existIndex !== undefined && existIndex < speakQueue.value.length) {
      const exist = speakQueue.value[existIndex]
      if (exist &&
          exist.data.type == EventDataTypes.Gift &&
          exist.updateAt > Date.now() - (settings.value.combineGiftDelay * 1000)) {
        // 更新现有礼物数据
        exist.updateAt = Date.now()
        exist.data.num += data.num
        exist.data.price += data.price
        exist.combineCount = (exist.combineCount ?? 0) + data.num
        console.log(
          `[TTS] ${data.uname} 增加已存在礼物数量: ${data.msg} [${exist.data.num - data.num} => ${exist.data.num}]`,
        )
        return
      }
    }

    // 添加新的礼物到队列
    const newIndex = speakQueue.value.length
    giftCombineMap.set(giftKey, newIndex)

    // 清理过期的Map条目
    setTimeout(() => {
      if (giftCombineMap.get(giftKey) === newIndex) {
        giftCombineMap.delete(giftKey)
      }
    }, (settings.value.combineGiftDelay + 1) * 1000)
  }

  speakQueue.value.push({
    data,
    updateAt: data.type == EventDataTypes.Gift ? Date.now() : 0, // 礼物事件记录时间用于合并
  })
}
function getTextFromDanmaku(data: EventModel | undefined) {
  if (!data) {
    return
  }
  let text: string = ''
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
    case EventDataTypes.Enter:
      if (!settings.value.enterTemplate) {
        return
      }
      text = settings.value.enterTemplate
      break
  }
  text = text
    .replace(
      templateConstants.name.regex,
      settings.value.voiceType == 'api' && settings.value.splitText ? `'${data.uname}'` : data.uname,
    )
    .replace(templateConstants.count.regex, data.num.toString())
    .replace(templateConstants.price.regex, data.price.toString())
    .replace(templateConstants.message.regex, data.msg)
    .replace(
      templateConstants.guard_level.regex,
      getGuardLevelName(data.guard_level),
    )
    .replace(templateConstants.fans_medal_level.regex, data.fans_medal_level.toString())
    .trim()

  if (data.type === EventDataTypes.Message) {
    text = text.replace(/\[.*?\]/g, ' ') //删除 [表情], B站的表情是 [生气了] 这样的格式
  } else if (data.type === EventDataTypes.Gift) {
    text = text.replace(templateConstants.gift_name.regex, data.msg)
  } else if (data.type === EventDataTypes.Guard) {
    text = text.replace(templateConstants.guard_num.regex, data.num.toString())
  }
  text = fullWidthToHalfWidth(text)
    .replace(/[^0-9a-zA-Z\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF ,.:'"\s]/gi, '')
    .normalize('NFKC')
  return text
}
function fullWidthToHalfWidth(str: string) {
  // Convert full-width characters to half-width ones
  var result = str.replace(/[\uff01-\uff5e]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  })

  // Convert full-width space (u3000) to half-width one
  result = result.replace(/\u3000/g, ' ')

  return result
}
function startSpeech() {
  speechState.canSpeech = true
  message.success('服务已启动')
}
function stopSpeech() {
  speechState.canSpeech = false
  message.success('已停止监听')
}
async function uploadConfig() {
  try {
    const result = await UploadConfig('Speech', settings.value)
    if (result) {
      message.success('已保存至服务器')
    } else {
      message.error('保存失败')
    }
  } catch (error) {
    console.error('[uploadConfig] 上传配置失败:', error)
    message.error('保存失败: ' + (error instanceof Error ? error.message : '未知错误'))
  }
}
async function downloadConfig() {
  try {
    const result = await DownloadConfig<SpeechSettings>('Speech')
    if (result.status === 'success' && result.data) {
      settings.value = result.data
      message.success('已获取配置文件')
    } else if (result.status === 'notfound') {
      message.error('未上传配置文件')
    } else {
      message.error('获取失败: ' + result.msg)
    }
  } catch (error) {
    console.error('[downloadConfig] 下载配置失败:', error)
    message.error('获取失败: ' + (error instanceof Error ? error.message : '未知错误'))
  }
}

/**
 * 创建测试事件数据
 * @param type 事件类型
 * @param overrides 覆盖默认值的对象
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
 * @param type 事件类型
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

  // 如果正在监听，加入队列；否则直接播放
  if (speechState.canSpeech) {
    onGetEvent(testData)
  } else {
    forceSpeak(testData)
  }
}

function testAPI() {
  // 直接测试API，不受监听状态影响
  speakFromAPI('这是一条测试弹幕')
}

/**
 * 清理过期或无效的队列项
 */
function cleanupQueue() {
  const now = Date.now()
  const validItems: typeof speakQueue.value = []

  speakQueue.value.forEach((item, index) => {
    // 保留非礼物事件或未过期的礼物事件
    if (item.data.type !== EventDataTypes.Gift ||
        item.updateAt > now - (settings.value.combineGiftDelay ?? 0) * 1000) {
      validItems.push(item)
    } else {
      // 从Map中移除过期的礼物项
      const giftKey = `${item.data.uid}-${item.data.msg}`
      if (giftCombineMap.get(giftKey) === index) {
        giftCombineMap.delete(giftKey)
      }
    }
  })

  // 如果队列过长，保留最新的项目
  if (validItems.length > MAX_QUEUE_SIZE) {
    const removedItems = validItems.splice(0, validItems.length - MAX_QUEUE_SIZE)
    console.warn(`[TTS] 队列过长，已移除 ${removedItems.length} 个旧项目`)
  }

  speakQueue.value = validItems

  // 重建Map索引
  giftCombineMap.clear()
  speakQueue.value.forEach((item, index) => {
    if (item.data.type === EventDataTypes.Gift) {
      const giftKey = `${item.data.uid}-${item.data.msg}`
      giftCombineMap.set(giftKey, index)
    }
  })
}

let speechQueueTimer: number

onMounted(() => {
  EasySpeech.init({ maxTimeout: 5000, interval: 250 })
  speechSynthesisInfo.value = EasySpeech.detect()

  // 自动选择默认语音
  const checkAndSetDefaultVoice = () => {
    const voices = EasySpeech.voices()
    if (voices.length > 0 && !settings.value.speechInfo.voice) {
      // 优先选择中文语音
      const chineseVoice = voices.find(v => v.lang.startsWith('zh'))
      settings.value.speechInfo.voice = chineseVoice?.name || voices[0].name
      console.log(`[TTS] 自动选择默认语音: ${settings.value.speechInfo.voice}`)
    }
  }

  // 立即检查一次
  checkAndSetDefaultVoice()

  // 如果语音列表还没加载完成，等待加载完成后再检查
  if (EasySpeech.voices().length === 0) {
    const voiceCheckTimer = setInterval(() => {
      if (EasySpeech.voices().length > 0) {
        checkAndSetDefaultVoice()
        clearInterval(voiceCheckTimer)
      }
    }, 100)

    // 10秒后停止检查避免无限循环
    setTimeout(() => clearInterval(voiceCheckTimer), 10000)
  }

  // 语音播放队列处理
  speechQueueTimer = setInterval(() => {
    speak()
  }, 250)

  client.onEvent('danmaku', onGetEvent)
  client.onEvent('sc', onGetEvent)
  client.onEvent('guard', onGetEvent)
  client.onEvent('gift', onGetEvent)
  client.onEvent('enter', onGetEvent)
})
onUnmounted(() => {
  // 清理队列定时器
  if (speechQueueTimer) {
    clearInterval(speechQueueTimer)
  }

  // 清理语音超时定时器
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = undefined
  }

  // 停止当前语音播放
  cancelSpeech()

  // 清理事件监听器
  client.offEvent('danmaku', onGetEvent)
  client.offEvent('sc', onGetEvent)
  client.offEvent('guard', onGetEvent)
  client.offEvent('gift', onGetEvent)
  client.offEvent('enter', onGetEvent)

  // 清理礼物合并映射
  giftCombineMap.clear()
})
</script>

<template>
  <NAlert
    v-if="!speechSynthesisInfo || !speechSynthesisInfo.speechSynthesis"
    type="error"
  >
    你的浏览器不支持语音功能
  </NAlert>
  <template v-else>
    <NSpace vertical>
      <NAlert
        v-if="settings.voiceType == 'local'"
        type="info"
        closeable
      >
        建议在 Edge 浏览器使用
        <NTooltip>
          <template #trigger>
            <NText
              strong
              italic
              type="primary"
            >
              Microsoft 某某 Online (Nature)
            </NText>
          </template>
          例如 Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland), 各种营销号就用的这些配音
        </NTooltip>
        系列语音, 效果要好
        <NText strong>
          很多很多
        </NText>
      </NAlert>
      <NAlert
        type="info"
        closeable
      >
        当在后台运行时请关闭浏览器的 页面休眠/内存节省功能. Chrome:
        <NButton
          tag="a"
          type="info"
          href="https://support.google.com/chrome/answer/12929150?hl=zh-Hans#zippy=%2C%E5%BC%80%E5%90%AF%E6%88%96%E5%85%B3%E9%97%AD%E7%9C%81%E5%86%85%E5%AD%98%E6%A8%A1%E5%BC%8F%2C%E8%AE%A9%E7%89%B9%E5%AE%9A%E7%BD%91%E7%AB%99%E4%BF%9D%E6%8C%81%E6%B4%BB%E5%8A%A8%E7%8A%B6%E6%80%81"
          target="_blank"
          text
        >
          让特定网站保持活动状态
        </NButton>
        Edge:

        <NButton
          tag="a"
          type="info"
          href="https://support.microsoft.com/zh-cn/topic/%E4%BA%86%E8%A7%A3-microsoft-edge-%E4%B8%AD%E7%9A%84%E6%80%A7%E8%83%BD%E5%8A%9F%E8%83%BD-7b36f363-2119-448a-8de6-375cfd88ab25"
          target="_blank"
          text
        >
          永远不想进入睡眠状态的网站
        </NButton>
      </NAlert>
    </NSpace>
    <br>
    <NSpace align="center">
      <NButton
        :type="speechState.canSpeech ? 'error' : 'primary'"
        data-umami-event="Use TTS"
        :data-umami-event-uid="accountInfo?.id"
        size="large"
        @click="speechState.canSpeech ? stopSpeech() : startSpeech()"
      >
        {{ speechState.canSpeech ? '停止监听' : '开始监听' }}
      </NButton>
      <NButton
        type="primary"
        secondary
        :disabled="!accountInfo"
        size="small"
        @click="uploadConfig"
      >
        保存配置到服务器
      </NButton>
      <NPopconfirm @positive-click="downloadConfig">
        <template #trigger>
          <NButton
            type="primary"
            secondary
            :disabled="!accountInfo"
            size="small"
          >
            从服务器获取配置
          </NButton>
        </template>
        这将覆盖当前设置, 确定?
      </NPopconfirm>
    </NSpace>
    <template v-if="speechState.canSpeech">
      <NDivider> 状态 </NDivider>
      <NSpace
        vertical
        align="center"
      >
        <NTooltip v-if="settings.voiceType == 'api' && speechState.isApiAudioLoading">
          <template #trigger>
            <NButton
              circle
              @click="cancelSpeech"
            >
              <template #icon>
                <NSpin show />
              </template>
            </NButton>
          </template>
          取消
        </NTooltip>
        <NTooltip v-else>
          <template #trigger>
            <NButton
              circle
              :disabled="!speechState.isSpeaking"
              :style="`animation: ${speechState.isSpeaking ? 'animated-border 2.5s infinite;' : ''}`"
              @click="cancelSpeech"
            >
              <template #icon>
                <NIcon
                  :component="Mic24Filled"
                  :color="speechState.isSpeaking ? 'green' : 'gray'"
                />
              </template>
            </NButton>
          </template>
          {{ speechState.isSpeaking ? `正在朗读: ${speechState.speakingText}` : '未朗读' }}
        </NTooltip>
        <NText depth="3">
          队列: {{ speakQueue.length }}
          <NDivider vertical /> 已读: {{ readedDanmaku }} 条
        </NText>
        <NCollapse :default-expanded-names="['1']">
          <NCollapseItem
            title="队列"
            name="1"
          >
            <NEmpty v-if="speakQueue.length == 0">
              暂无
            </NEmpty>
            <NList
              v-else
              size="small"
              bordered
            >
              <NListItem
                v-for="item in speakQueue"
                :key="item.data.time"
              >
                <NSpace align="center">
                  <NButton
                    type="primary"
                    secondary
                    size="small"
                    @click="forceSpeak(item.data)"
                  >
                    读
                  </NButton>
                  <NButton
                    type="error"
                    secondary
                    size="small"
                    @click="speakQueue.splice(speakQueue.indexOf(item), 1)"
                  >
                    取消
                  </NButton>
                  <NTag
                    v-if="item.data.type == EventDataTypes.Gift && item.combineCount"
                    type="info"
                    size="small"
                    style="animation: animated-border 2.5s infinite"
                  >
                    连续赠送中
                  </NTag>
                  <NTag
                    v-else-if="item.data.type == EventDataTypes.Gift && settings.combineGiftDelay"
                    type="success"
                    size="small"
                  >
                    等待连续赠送检查
                  </NTag>
                  <span>
                    <NTag
                      v-if="item.data.type == EventDataTypes.Message"
                      type="success"
                      size="small"
                    > 弹幕</NTag>
                    <NTag
                      v-else-if="item.data.type == EventDataTypes.Gift"
                      type="success"
                      size="small"
                    > 礼物</NTag>
                    <NTag
                      v-else-if="item.data.type == EventDataTypes.Guard"
                      type="success"
                      size="small"
                    > 舰长</NTag>
                    <NTag
                      v-else-if="item.data.type == EventDataTypes.SC"
                      type="success"
                      size="small"
                    > SC</NTag>
                    <NTag
                      v-else-if="item.data.type == EventDataTypes.Enter"
                      type="success"
                      size="small"
                    > 进入直播间</NTag>
                  </span>
                  <NText>
                    {{ item.data.uname }}
                  </NText>
                  <NText depth="3">
                    {{ getTextFromDanmaku(item.data) }}
                  </NText>
                </NSpace>
              </NListItem>
            </NList>
          </NCollapseItem>
        </NCollapse>
      </NSpace>
    </template>
    <NDivider>
      <NRadioGroup
        v-model:value="settings.voiceType"
        size="small"
      >
        <NRadioButton value="local">
          本地
        </NRadioButton>
        <NRadioButton value="api">
          API

          <NTooltip>
            <template #trigger>
              <NIcon :component="Info24Filled" />
            </template>
            自定义语音API, 可以播放自己训练的模型或者其他tts之类的
          </NTooltip>
        </NRadioButton>
      </NRadioGroup>
    </NDivider>
    <Transition
      name="fade"
      mode="out-in"
    >
      <NSpace
        v-if="settings.voiceType == 'local'"
        vertical
      >
        <NSelect
          v-model:value="settings.speechInfo.voice"
          :options="voiceOptions"
          :fallback-option="() => ({
            label: settings.speechInfo.voice ? `已选择: ${settings.speechInfo.voice}` : '未选择, 将使用默认语音',
            value: settings.speechInfo.voice || ''
          })"
        />
        <span style="width: 100%">
          <NText> 音量 </NText>
          <NSlider
            v-model:value="settings.speechInfo.volume"
            style="min-width: 200px"
            :min="0"
            :max="1"
            :step="0.01"
          />
        </span>
        <span style="width: 100%">
          <NText> 音调 </NText>
          <NSlider
            v-model:value="settings.speechInfo.pitch"
            style="min-width: 200px"
            :min="0"
            :max="2"
            :step="0.01"
          />
        </span>
        <span style="width: 100%">
          <NText> 语速 </NText>
          <NSlider
            v-model:value="settings.speechInfo.rate"
            style="min-width: 200px"
            :min="0"
            :max="2"
            :step="0.01"
          />
        </span>
      </NSpace>
      <template v-else>
        <div>
          <NCollapse>
            <NCollapseItem
              title="要求 👀 "
              name="1"
            >
              <NUl>
                <NLi> 直接返回音频数据 (wav, mp3, m4a etc.) </NLi>
                <NLi>
                  最好使用HTTPS
                  <NTooltip>
                    <template #trigger>
                      <NIcon :component="Info24Filled" />
                    </template>
                    不使用https的话将会使用 cloudflare workers 进行代理, 会慢很多
                  </NTooltip>
                </NLi>
                <NLi> 指定API可以被外部访问 (除非你本地部署并且启用了https) </NLi>
              </NUl>
              推荐项目, 可以用于本地部署:
              <NButton
                text
                type="info"
                tag="a"
                href="https://github.com/Artrajz/vits-simple-api"
                target="_blank"
              >
                vits-simple-api
              </NButton>
            </NCollapseItem>
          </NCollapse>
          <br>
          <NSpace vertical>
            <NAlert type="info">
              地址中的
              <NButton
                size="tiny"
                :bordered="false"
                type="primary"
                secondary
                @click="copyToClipboard('{{text}}')"
              >
                {{ '\{\{ text \}\}' }}
              </NButton>
              将被替换为要念的文本
            </NAlert>
            <NAlert
              v-if="isVtsuruVoiceAPI"
              type="success"
              closable
            >
              看起来你正在使用本站提供的测试API (voice.vtsuru.live), 这个接口将会返回
              <NButton
                text
                type="info"
                tag="a"
                href="https://space.bilibili.com/5859321"
                target="_blank"
              >
                Xz乔希
              </NButton>
              训练的
              <NTooltip>
                <template #trigger>
                  Taffy
                </template>
                链接里的 id 改成 0 会变成莲莲捏🥰
              </NTooltip>
              模型结果, 不支持部分英文, 仅用于测试, 用的人多的时候会比较慢, 不保证可用性. 侵删
            </NAlert>
          </NSpace>
          <br>
          <NInputGroup>
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
              placeholder="API 地址, 例如 xxx.com/voice/bert-vits2?text={{text}}&id=0 (前面不要带https://)"
              :status="/^(?:https?:\/\/)/.test(settings.voiceAPI?.toLowerCase() ?? '') ? 'error' : 'success'"
            />
            <NButton
              type="info"
              :loading="speechState.isApiAudioLoading"
              @click="testAPI"
            >
              测试
            </NButton>
          </NInputGroup>
          <br><br>
          <NSpace vertical>
            <NAlert
              v-if="settings.voiceAPISchemeType == 'http'"
              type="info"
            >
              不使用https的话默认将会使用 cloudflare workers 进行代理, 会慢很多
              <br>
              <NCheckbox v-model:checked="settings.useAPIDirectly">
                不使用代理
                <NTooltip>
                  <template #trigger>
                    <NIcon :component="Info24Filled" />
                  </template>
                  希望你知道这样做会产生的影响, 无法使用不关我事
                </NTooltip>
              </NCheckbox>
            </NAlert>
            <span style="width: 100%">
              <NText> 音量 </NText>
              <NSlider
                v-model:value="settings.speechInfo.volume"
                style="min-width: 200px"
                :min="0"
                :max="1"
                :step="0.01"
              />
            </span>
          </NSpace>
          <audio
            ref="apiAudio"
            :src="speechState.apiAudioSrc"
            :volume="settings.speechInfo.volume"
            @ended="cancelSpeech"
            @canplay="speechState.isApiAudioLoading = false"
            @error="onAPIError"
          />
        </div>
      </template>
    </Transition>
    <NDivider>
      自定义内容
      <NTooltip>
        <template #trigger>
          <NIcon :component="Info24Filled" />
        </template>
        留空则不念
      </NTooltip>
    </NDivider>
    <NSpace vertical>
      <NSpace>
        支持的变量:
        <NButton
          v-for="item in Object.values(templateConstants)"
          :key="item.name"
          size="tiny"
          secondary
          @click="copyToClipboard(item.words)"
        >
          {{ item.words }} | {{ item.name }}
        </NButton>
      </NSpace>
      <NInputGroup>
        <NInputGroupLabel> 弹幕模板 </NInputGroupLabel>
        <NInput
          v-model:value="settings.danmakuTemplate"
          placeholder="弹幕消息"
        />
        <NButton
          type="info"
          :loading="speechState.isApiAudioLoading"
          @click="test(EventDataTypes.Message)"
        >
          测试
        </NButton>
      </NInputGroup>
      <NInputGroup>
        <NInputGroupLabel> 礼物模板 </NInputGroupLabel>
        <NInput
          v-model:value="settings.giftTemplate"
          placeholder="礼物消息"
        />
        <NButton
          type="info"
          :loading="speechState.isApiAudioLoading"
          @click="test(EventDataTypes.Gift)"
        >
          测试
        </NButton>
      </NInputGroup>
      <NInputGroup>
        <NInputGroupLabel> SC模板 </NInputGroupLabel>
        <NInput
          v-model:value="settings.scTemplate"
          placeholder="SC消息"
        />
        <NButton
          type="info"
          :loading="speechState.isApiAudioLoading"
          @click="test(EventDataTypes.SC)"
        >
          测试
        </NButton>
      </NInputGroup>
      <NInputGroup>
        <NInputGroupLabel> 上舰模板 </NInputGroupLabel>
        <NInput
          v-model:value="settings.guardTemplate"
          placeholder="上舰消息"
        />
        <NButton
          type="info"
          :loading="speechState.isApiAudioLoading"
          @click="test(EventDataTypes.Guard)"
        >
          测试
        </NButton>
      </NInputGroup>
      <NInputGroup>
        <NInputGroupLabel> 进入直播间模板 </NInputGroupLabel>
        <NInput
          v-model:value="settings.enterTemplate"
          placeholder="进入直播间消息"
        />
        <NButton
          type="info"
          :loading="speechState.isApiAudioLoading"
          @click="test(EventDataTypes.Enter)"
        >
          测试
        </NButton>
      </NInputGroup>
    </NSpace>
    <NDivider> 设置 </NDivider>
    <NSpace align="center">
      <NCheckbox
        :checked="settings.combineGiftDelay != undefined"
        @update:checked="(checked: boolean) => {
          settings.combineGiftDelay = checked ? 2 : undefined
        }
        "
      >
        是否启用礼物合并
        <NTooltip>
          <template #trigger>
            <NIcon :component="Info24Filled" />
          </template>
          在指定时间内连续送相同礼物会等停止送礼物之后才会念
          <br>
          这也会导致送的礼物会等待指定时间之后才会念, 即使没有连续赠送
        </NTooltip>
      </NCheckbox>
      <NInputGroup
        v-if="settings.combineGiftDelay"
        style="width: 200px"
      >
        <NInputGroupLabel> 送礼间隔 (秒) </NInputGroupLabel>
        <NInputNumber
          v-model:value="settings.combineGiftDelay"
          @update:value="(value) => {
            if (!value || value <= 0) settings.combineGiftDelay = undefined
          }
          "
        />
      </NInputGroup>
      <NCheckbox v-model:checked="settings.splitText">
        启用句子拆分
        <NTooltip>
          <template #trigger>
            <NIcon :component="Info24Filled" />
          </template>
          仅API方式可用, 为英文用户名用引号包裹起来, 并将所有大写单词拆分成单个单词, 以防止部分单词念不出来
          <br>
          例: 原文: Megghy 说: UPPERCASE单词,word.
          <br>
          结果: 'Megghy' 说: U P P E R C A S E 单词,word.
        </NTooltip>
      </NCheckbox>
    </NSpace>
    <NDivider />
  </template>
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
