import { useStorage } from '@vueuse/core'
import EasySpeech from 'easy-speech'
import GraphemeSplitter from 'grapheme-splitter'
import { useMessage } from 'naive-ui'
import { reactive, ref } from 'vue'
import { clearInterval, setInterval } from 'worker-timers'
import type { EventModel } from '@/api/api-models'
import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import { FETCH_API, TTS_API_URL } from '@/data/constants'

export interface SpeechSettings {
  speechInfo: SpeechInfo
  danmakuTemplate: string
  scTemplate: string
  guardTemplate: string
  giftTemplate: string
  enterTemplate: string
  voiceType: 'local' | 'api' | 'azure'
  voiceAPISchemeType: 'http' | 'https'
  voiceAPI: string
  splitText: boolean
  useAPIDirectly: boolean
  combineGiftDelay: number | undefined
  azureVoice: string
  azureLanguage: string
  outputDeviceId: string
}

export interface SpeechInfo {
  volume: number
  pitch: number
  rate: number
  voice: string
}

export interface SpeechState {
  isSpeaking: boolean
  speakingText: string
  isApiAudioLoading: boolean
  apiAudioSrc: string
  canSpeech: boolean
  isInitialized: boolean
}

export interface QueueItem {
  updateAt: number
  combineCount?: number
  data: EventModel
}

const MAX_QUEUE_SIZE = 50
const DEFAULT_SETTINGS: SpeechSettings = {
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
  azureVoice: 'zh-CN-XiaoxiaoNeural',
  azureLanguage: 'zh-CN',
  outputDeviceId: 'default',
}

export const templateConstants = {
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

// Singleton state
let speechServiceInstance: ReturnType<typeof createSpeechService> | null = null

function createSpeechService() {
  const message = useMessage()
  const accountInfo = useAccount()
  const splitter = new GraphemeSplitter()

  const settings = useStorage<SpeechSettings>('Setting.Speech', DEFAULT_SETTINGS)
  const speechState = reactive<SpeechState>({
    isSpeaking: false,
    speakingText: '',
    isApiAudioLoading: false,
    apiAudioSrc: '',
    canSpeech: false,
    isInitialized: false,
  })

  const speakQueue = ref<QueueItem[]>([])
  const giftCombineMap = new Map<string, number>()
  const readedDanmaku = ref(0)

  const apiAudio = ref<HTMLAudioElement>()
  let checkTimer: number | undefined
  let loadingTimeoutTimer: number | undefined // 音频加载超时计时器
  let speechQueueTimer: number | undefined

  const speechSynthesisInfo = ref<{
    speechSynthesis: SpeechSynthesis | undefined
    speechSynthesisUtterance: SpeechSynthesisUtterance | undefined
    speechSynthesisVoice: SpeechSynthesisVoice | undefined
    onvoiceschanged: boolean
  }>()

  /**
   * 初始化语音服务
   */
  async function initialize() {
    if (speechState.isInitialized) {
      return
    }

    try {
      await EasySpeech.init({ maxTimeout: 5000, interval: 250 })
      speechSynthesisInfo.value = EasySpeech.detect() as any

      // 自动选择默认语音
      const checkAndSetDefaultVoice = () => {
        const voices = EasySpeech.voices()
        if (voices.length > 0 && !settings.value.speechInfo.voice) {
          const chineseVoice = voices.find(v => v.lang.startsWith('zh'))
          settings.value.speechInfo.voice = chineseVoice?.name || voices[0].name
          console.log(`[TTS] 自动选择默认语音: ${settings.value.speechInfo.voice}`)
        }
      }

      checkAndSetDefaultVoice()

      if (EasySpeech.voices().length === 0) {
        const voiceCheckTimer = setInterval(() => {
          if (EasySpeech.voices().length > 0) {
            checkAndSetDefaultVoice()
            clearInterval(voiceCheckTimer)
          }
        }, 100)
        setTimeout(() => clearInterval(voiceCheckTimer), 10000)
      }

      // 启动队列处理
      speechQueueTimer = setInterval(() => {
        processQueue()
      }, 250)

      speechState.isInitialized = true
      console.log('[TTS] 语音服务初始化完成')
    } catch (error) {
      console.error('[TTS] 初始化失败:', error)
      message.error('语音服务初始化失败')
    }
  }

  /**
   * 销毁语音服务
   */
  function destroy() {
    if (speechQueueTimer) {
      clearInterval(speechQueueTimer)
      speechQueueTimer = undefined
    }

    if (checkTimer) {
      clearInterval(checkTimer)
      checkTimer = undefined
    }

    if (loadingTimeoutTimer) {
      clearInterval(loadingTimeoutTimer)
      loadingTimeoutTimer = undefined
    }

    cancelSpeech()
    giftCombineMap.clear()
    speakQueue.value = []
    speechState.isInitialized = false
    console.log('[TTS] 语音服务已销毁')
  }

  /**
   * 根据舰长等级数字返回对应的中文名称
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
   * 全角转半角
   */
  function fullWidthToHalfWidth(str: string) {
    let result = str.replace(/[\uFF01-\uFF5E]/g, (ch) => {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
    })
    result = result.replace(/\u3000/g, ' ')
    return result
  }

  /**
   * 从事件数据生成要朗读的文本
   */
  function getTextFromDanmaku(data: EventModel | undefined): string | undefined {
    if (!data) {
      return
    }

    let text: string = ''
    switch (data.type) {
      case EventDataTypes.Message:
        if (!settings.value.danmakuTemplate) return
        text = settings.value.danmakuTemplate
        break
      case EventDataTypes.SC:
        if (!settings.value.scTemplate) return
        text = settings.value.scTemplate
        break
      case EventDataTypes.Guard:
        if (!settings.value.guardTemplate) return
        text = settings.value.guardTemplate
        break
      case EventDataTypes.Gift:
        if (!settings.value.giftTemplate) return
        text = settings.value.giftTemplate
        break
      case EventDataTypes.Enter:
        if (!settings.value.enterTemplate) return
        text = settings.value.enterTemplate
        break
      case EventDataTypes.Like:
      case EventDataTypes.SCDel:
      case EventDataTypes.Follow:
        // 这些事件类型不需要语音播报
        return
    }

    text = text
      .replace(
        templateConstants.name.regex,
        settings.value.voiceType == 'api' && settings.value.splitText ? `'${data.uname || ''}'` : (data.uname || ''),
      )
      .replace(templateConstants.count.regex, (data.num ?? 0).toString())
      .replace(templateConstants.price.regex, (data.price ?? 0).toString())
      .replace(templateConstants.message.regex, data.msg || '')
      .replace(
        templateConstants.guard_level.regex,
        getGuardLevelName(data.guard_level),
      )
      .replace(templateConstants.fans_medal_level.regex, (data.fans_medal_level ?? 0).toString())
      .trim()

    if (data.type === EventDataTypes.Message) {
      text = text.replace(/\[.*?\]/g, ' ')
    } else if (data.type === EventDataTypes.Gift) {
      text = text.replace(templateConstants.gift_name.regex, data.msg || '')
    } else if (data.type === EventDataTypes.Guard) {
      text = text.replace(templateConstants.guard_num.regex, (data.num ?? 0).toString())
    }

    console.log(text)
    return text
  }

  /**
   * 插入空格（用于拆分文本）
   */
  function insertSpaces(sentence: string) {
    sentence = sentence.replace(/\b[A-Z]{2,}\b/g, (match) => {
      return match.split('').join(' ')
    })
    sentence = sentence.replace(/\s+/g, ' ').trim()
    return sentence
  }

  /**
   * 使用本地TTS朗读
   */
  function speakDirect(text: string) {
    try {
      const synth = window.speechSynthesis
      if (!synth) {
        console.error('[TTS] 当前浏览器不支持语音合成')
        return
      }

      synth.cancel()
      const u = new SpeechSynthesisUtterance()
      u.text = text
      const voices = synth.getVoices()
      const voice = voices.find(v => v.name === settings.value.speechInfo.voice)

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
          console.error('[TTS] 播放错误:', err)
          message.error(`无法播放语音: ${err.error}`)
          cancelSpeech()
        }
      }
    } catch (err) {
      console.error('[TTS] 本地语音合成失败:', err)
      cancelSpeech()
    }
  }

  /**
   * 构建API请求URL
   */
  function buildApiUrl(text: string): string | null {
    // Azure TTS
    if (settings.value.voiceType === 'azure') {
      const apiUrl = `${TTS_API_URL}azure?text=${encodeURIComponent(text)}`
      return apiUrl
    }

    // 自定义 API
    if (!settings.value.voiceAPI) {
      message.error('未设置语音API')
      return null
    }

    const scheme
      = settings.value.voiceAPISchemeType === 'https'
        ? 'https://'
        : settings.value.useAPIDirectly
          ? 'http://'
          : `${FETCH_API}http://`

    const url = `${scheme}${settings.value.voiceAPI.trim().replace(/^https?:\/\//, '')}`.replace(
      /\{\{\s*text\s*\}\}/,
      encodeURIComponent(text),
    )

    try {
      const tempURL = new URL(url)
      const isVtsuruAPI = settings.value.voiceAPI.toLowerCase().trim().startsWith('voice.vtsuru.live')

      if (isVtsuruAPI) {
        tempURL.searchParams.set('vtsuruId', accountInfo.value?.id.toString() ?? '-1')
        if (splitter.countGraphemes(tempURL.searchParams.get('text') ?? '') > 100) {
          message.error(`本站提供的测试接口字数不允许超过 100 字`)
          return null
        }
      }

      return tempURL.toString()
    } catch (err) {
      console.error('[TTS] 无效的API地址:', err)
      message.error(`无效的API地址: ${url}`)
      return null
    }
  }

  /**
   * 使用API TTS朗读
   */
  function speakFromAPI(text: string) {
    let url = buildApiUrl(text)
    if (!url) {
      cancelSpeech()
      return
    }

    // 如果是 Azure TTS，添加额外参数
    if (settings.value.voiceType === 'azure') {
      const azureUrl = new URL(url)
      azureUrl.searchParams.set('voice', settings.value.azureVoice)
      azureUrl.searchParams.set('language', settings.value.azureLanguage)
      azureUrl.searchParams.set('rate', settings.value.speechInfo.rate.toString())
      azureUrl.searchParams.set('pitch', settings.value.speechInfo.pitch.toString())
      azureUrl.searchParams.set('streaming', 'true')
      url = azureUrl.toString()
    }

    speechState.isSpeaking = true
    speechState.isApiAudioLoading = true

    // 先清空 apiAudioSrc，确保 audio 元素能够正确重新加载
    // 这样可以避免连续播放时 src 更新不触发加载的问题
    speechState.apiAudioSrc = ''

    // 使用 nextTick 确保 DOM 更新后再设置新的 src
    // 但由于这是在 store 中，我们使用 setTimeout 来模拟
    setTimeout(() => {
      speechState.apiAudioSrc = url
    }, 0)

    // 设置 10 秒加载超时
    if (loadingTimeoutTimer) {
      clearInterval(loadingTimeoutTimer)
    }
    loadingTimeoutTimer = setInterval(() => {
      if (speechState.isApiAudioLoading) {
        console.error('[TTS] 音频加载超时 (10秒)')
        message.error('音频加载超时，请检查网络连接或API状态')
        cancelSpeech()
      }
    }, 10000) // 10 秒超时
  }

  /**
   * 处理队列中的下一个事件
   */
  async function processQueue() {
    if (speechState.isSpeaking || speakQueue.value.length == 0) {
      return
    }

    let targetIndex = -1
    const now = Date.now()
    const combineDelay = (settings.value.combineGiftDelay ?? 0) * 1000

    for (let i = 0; i < speakQueue.value.length; i++) {
      const item = speakQueue.value[i]

      if (item.data.type == EventDataTypes.Gift
        && combineDelay > 0
        && item.updateAt > now - combineDelay) {
        continue
      }

      targetIndex = i
      break
    }

    if (targetIndex === -1) {
      return
    }

    const targetItem = speakQueue.value.splice(targetIndex, 1)[0]

    if (targetItem.data.type !== EventDataTypes.Gift) {
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
        // 只有自定义 API 且启用了 splitText 才进行文本拆分
        if (settings.value.voiceType === 'api' && settings.value.splitText) {
          text = insertSpaces(text)
        }
        speakFromAPI(text)
      }

      console.log(`[TTS] 正在朗读: ${text}`)
    }
  }

  /**
   * 取消当前语音播放
   */
  function cancelSpeech() {
    speechState.isSpeaking = false

    if (checkTimer) {
      clearInterval(checkTimer)
      checkTimer = undefined
    }

    if (loadingTimeoutTimer) {
      clearInterval(loadingTimeoutTimer)
      loadingTimeoutTimer = undefined
    }

    speechState.isApiAudioLoading = false

    if (apiAudio.value && !apiAudio.value.paused) {
      apiAudio.value.pause()
    }

    // 清空音频源，确保下次播放时能正确加载新的音频
    speechState.apiAudioSrc = ''

    EasySpeech.cancel()
    speechState.speakingText = ''
  }

  /**
   * 清除音频加载超时计时器
   */
  function clearLoadingTimeout() {
    if (loadingTimeoutTimer) {
      clearInterval(loadingTimeoutTimer)
      loadingTimeoutTimer = undefined
    }
  }

  /**
   * 接收事件并添加到队列
   */
  function addToQueue(data: EventModel) {
    if (!speechState.canSpeech) {
      return
    }

    if (data.type == EventDataTypes.Message && (data.emoji || /^(?:\[\w+\])+$/.test(data.msg))) {
      return
    }

    if (data.type == EventDataTypes.Enter && !settings.value.enterTemplate) {
      return
    }

    // 礼物合并逻辑
    if (data.type == EventDataTypes.Gift && settings.value.combineGiftDelay) {
      const giftKey = `${data.uid}-${data.msg}`
      const existIndex = giftCombineMap.get(giftKey)

      if (existIndex !== undefined && existIndex < speakQueue.value.length) {
        const exist = speakQueue.value[existIndex]
        if (exist
          && exist.data.type == EventDataTypes.Gift
          && exist.updateAt > Date.now() - (settings.value.combineGiftDelay * 1000)) {
          exist.updateAt = Date.now()
          exist.data.num += data.num
          exist.data.price += data.price
          exist.combineCount = (exist.combineCount ?? 0) + data.num
          console.log(`[TTS] ${data.uname} 增加礼物数量: ${data.msg} [${exist.data.num - data.num} => ${exist.data.num}]`)
          return
        }
      }

      const newIndex = speakQueue.value.length
      giftCombineMap.set(giftKey, newIndex)

      setTimeout(() => {
        if (giftCombineMap.get(giftKey) === newIndex) {
          giftCombineMap.delete(giftKey)
        }
      }, (settings.value.combineGiftDelay + 1) * 1000)
    }

    speakQueue.value.push({
      data,
      updateAt: data.type == EventDataTypes.Gift ? Date.now() : 0,
    })

    // 队列清理
    if (speakQueue.value.length > MAX_QUEUE_SIZE) {
      const removed = speakQueue.value.splice(0, speakQueue.value.length - MAX_QUEUE_SIZE)
      console.warn(`[TTS] 队列过长，已移除 ${removed.length} 个旧项目`)
    }
  }

  /**
   * 强制播放指定事件（插队）
   */
  function forceSpeak(data: EventModel) {
    cancelSpeech()

    const index = speakQueue.value.findIndex(v => v.data == data)
    if (index !== -1) {
      speakQueue.value.splice(index, 1)
    }

    speakQueue.value.unshift({
      updateAt: 0,
      data,
    })
  }

  /**
   * 从队列中移除指定项
   */
  function removeFromQueue(item: QueueItem) {
    const index = speakQueue.value.indexOf(item)
    if (index !== -1) {
      speakQueue.value.splice(index, 1)
    }
  }

  /**
   * 清空队列
   */
  function clearQueue() {
    speakQueue.value = []
    giftCombineMap.clear()
  }

  /**
   * 开始监听
   */
  function startSpeech() {
    speechState.canSpeech = true
    message.success('服务已启动')
  }

  /**
   * 停止监听
   */
  function stopSpeech() {
    speechState.canSpeech = false
    // 清空队列
    speakQueue.value = []
    // 取消当前正在播放的语音
    cancelSpeech()
    message.success('已停止监听')
  }

  /**
   * 上传配置到服务器
   */
  async function uploadConfig() {
    try {
      const result = await UploadConfig('Speech', settings.value)
      if (result) {
        message.success('已保存至服务器')
      } else {
        message.error('保存失败')
      }
    } catch (error) {
      console.error('[TTS] 上传配置失败:', error)
      message.error(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 从服务器下载配置
   */
  async function downloadConfig() {
    try {
      const result = await DownloadConfig<SpeechSettings>('Speech')
      if (result.status === 'success' && result.data) {
        settings.value = result.data
        message.success('已获取配置文件')
      } else if (result.status === 'notfound') {
        message.error('未上传配置文件')
      } else {
        message.error(`获取失败: ${result.msg}`)
      }
    } catch (error) {
      console.error('[TTS] 下载配置失败:', error)
      message.error(`获取失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 获取可用的语音列表
   */
  function getAvailableVoices() {
    const languageDisplayName = new Intl.DisplayNames(['zh'], { type: 'language' })
    return EasySpeech.voices().map((v) => {
      return {
        label: `[${languageDisplayName.of(v.lang)}] ${v.name}`,
        value: v.name,
      }
    })
  }

  return {
    // State
    settings,
    speechState,
    speakQueue,
    readedDanmaku,
    speechSynthesisInfo,
    apiAudio,

    // Methods
    initialize,
    destroy,
    addToQueue,
    forceSpeak,
    removeFromQueue,
    clearQueue,
    startSpeech,
    stopSpeech,
    cancelSpeech,
    clearLoadingTimeout,
    uploadConfig,
    downloadConfig,
    getTextFromDanmaku,
    getAvailableVoices,
    buildApiUrl,
  }
}

/**
 * 使用语音服务（单例模式）
 */
export function useSpeechService() {
  if (!speechServiceInstance) {
    speechServiceInstance = createSpeechService()
  }
  return speechServiceInstance
}
