import EasySpeech from 'easy-speech'
import GraphemeSplitter from 'grapheme-splitter'
import { useMessage } from 'naive-ui'
import { reactive, ref, watch } from 'vue'
import { clearInterval, setInterval } from 'worker-timers'
import { createVoiceProvider, DEFAULT_MIMO_VOICE, hasVoiceProvider } from '@/apps/open-live/voice-providers'
import type { EventModel } from '@/api/api-models'
import { DownloadConfig, UploadConfig, useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import { usePersistedStorage } from '@/shared/storage/persist'

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

export interface SpeechSettings {
  provider: string
  speechInfo: SpeechInfo
  outputDeviceId: string
  combineGiftDelay: number | undefined
  danmakuTemplate: string
  scTemplate: string
  guardTemplate: string
  giftTemplate: string
  enterTemplate: string
  providers: Record<string, any>
}

const MAX_QUEUE_SIZE = 50

const DEFAULT_SETTINGS: SpeechSettings = {
  provider: 'local',
  speechInfo: {
    volume: 1,
    pitch: 1,
    rate: 1,
    voice: '',
  },
  outputDeviceId: 'default',
  combineGiftDelay: 2,
  danmakuTemplate: '{name} 说: {message}',
  scTemplate: '{name} 发送了醒目留言: {message}',
  guardTemplate: '感谢 {name} 的 {count} 个月 {guard_level}',
  giftTemplate: '感谢 {name} 赠送的 {count} 个 {gift_name}',
  enterTemplate: '欢迎 {name} 进入直播间',
  providers: {
    azure: {
      azureVoice: 'zh-CN-XiaoxiaoNeural',
      azureLanguage: 'zh-CN',
    },
    api: {
      voiceAPI: 'voice.vtsuru.live/voice/bert-vits2?text={{text}}&id=1&format=mp3&streaming=true',
      voiceAPISchemeType: 'https',
      useAPIDirectly: false,
      splitText: false,
    },
    mimo: {
      mimoVoice: DEFAULT_MIMO_VOICE,
      mimoStyleTag: '',
    },
  },
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

function migrateLegacySettings(raw: any): SpeechSettings {
  if (!raw) return DEFAULT_SETTINGS
  if (raw.providers && typeof raw.provider === 'string') return raw as SpeechSettings

  return {
    provider: raw.voiceType ?? 'local',
    speechInfo: {
      volume: raw.speechInfo?.volume ?? 1,
      pitch: raw.speechInfo?.pitch ?? 1,
      rate: raw.speechInfo?.rate ?? 1,
      voice: raw.speechInfo?.voice ?? '',
    },
    outputDeviceId: raw.outputDeviceId ?? 'default',
    combineGiftDelay: raw.combineGiftDelay ?? 2,
    danmakuTemplate: raw.danmakuTemplate ?? DEFAULT_SETTINGS.danmakuTemplate,
    scTemplate: raw.scTemplate ?? DEFAULT_SETTINGS.scTemplate,
    guardTemplate: raw.guardTemplate ?? DEFAULT_SETTINGS.guardTemplate,
    giftTemplate: raw.giftTemplate ?? DEFAULT_SETTINGS.giftTemplate,
    enterTemplate: raw.enterTemplate ?? DEFAULT_SETTINGS.enterTemplate,
    providers: {
      azure: {
        azureVoice: raw.azureVoice ?? 'zh-CN-XiaoxiaoNeural',
        azureLanguage: raw.azureLanguage ?? 'zh-CN',
      },
      api: {
        voiceAPI: raw.voiceAPI ?? DEFAULT_SETTINGS.providers.api.voiceAPI,
        voiceAPISchemeType: raw.voiceAPISchemeType ?? 'https',
        useAPIDirectly: raw.useAPIDirectly ?? false,
        splitText: raw.splitText ?? false,
      },
      mimo: {
        mimoVoice: DEFAULT_MIMO_VOICE,
        mimoStyleTag: '',
      },
    },
  }
}

function normalizeSettings(raw: any): SpeechSettings {
  const settings = migrateLegacySettings(raw)
  ensureProviderDefaults(settings)
  return settings
}

function ensureProviderDefaults(settings: SpeechSettings) {
  if (!settings.providers) settings.providers = {}
  if (!settings.providers.azure) {
    settings.providers.azure = { ...DEFAULT_SETTINGS.providers.azure }
  }
  if (!settings.providers.api) {
    settings.providers.api = { ...DEFAULT_SETTINGS.providers.api }
  }
  if (!settings.providers.mimo) {
    settings.providers.mimo = { ...DEFAULT_SETTINGS.providers.mimo }
  }
  if (!settings.providers.mimo.mimoVoice || settings.providers.mimo.mimoVoice === 'mimo_default') {
    settings.providers.mimo.mimoVoice = DEFAULT_MIMO_VOICE
  }
  settings.providers.mimo.mimoStyleTag ??= ''
}

let speechServiceInstance: ReturnType<typeof createSpeechService> | null = null

function createSpeechService() {
  const message = useMessage()
  const accountInfo = useAccount()
  const splitter = new GraphemeSplitter()

  const settings = usePersistedStorage<SpeechSettings>('Setting.Speech', DEFAULT_SETTINGS)
  watch(settings, (value) => {
    const normalized = normalizeSettings(value)
    if (normalized !== value) settings.value = normalized
  }, { immediate: true })

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
  let loadingTimeoutTimer: number | undefined
  let speechQueueTimer: number | undefined

  const speechSynthesisInfo = ref<{
    speechSynthesis: SpeechSynthesis | undefined
    speechSynthesisUtterance: SpeechSynthesisUtterance | undefined
    speechSynthesisVoice: SpeechSynthesisVoice | undefined
    onvoiceschanged: boolean
  }>()

  function getCurrentProvider() {
    const id = settings.value.provider
    if (!hasVoiceProvider(id)) return undefined
    return createVoiceProvider(id, () => settings.value)
  }

  async function initialize() {
    if (speechState.isInitialized) return

    try {
      await EasySpeech.init({ maxTimeout: 5000, interval: 250 })
      speechSynthesisInfo.value = EasySpeech.detect() as any

      const voices = EasySpeech.voices()
      if (voices.length > 0 && !settings.value.speechInfo.voice) {
        const chineseVoice = voices.find((v) => v.lang.startsWith('zh'))
        settings.value.speechInfo.voice = chineseVoice?.name || voices[0].name
      }

      const provider = getCurrentProvider()
      if (provider) await provider.initialize()

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

  function getGuardLevelName(guardLevel: number): string {
    switch (guardLevel) {
      case 1: return '总督'
      case 2: return '提督'
      case 3: return '舰长'
      default: return ''
    }
  }

  function getTextFromDanmaku(data: EventModel | undefined): string | undefined {
    if (!data) return

    let text = ''
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
        return
    }

    const isApiWithSplit = settings.value.provider === 'api'
      && (settings.value.providers.api?.splitText as boolean)

    text = text
      .replace(templateConstants.name.regex, isApiWithSplit ? `'${data.uname || ''}'` : (data.uname || ''))
      .replace(templateConstants.count.regex, (data.num ?? 0).toString())
      .replace(templateConstants.price.regex, (data.price ?? 0).toString())
      .replace(templateConstants.message.regex, data.msg || '')
      .replace(templateConstants.guard_level.regex, getGuardLevelName(data.guard_level))
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

  function insertSpaces(sentence: string) {
    sentence = sentence.replace(/\b[A-Z]{2,}\b/g, (match) => match.split('').join(' '))
    sentence = sentence.replace(/\s+/g, ' ').trim()
    return sentence
  }

  function buildApiUrl(text: string): string | null {
    const provider = getCurrentProvider()
    if (!provider || !provider.buildAudioUrl) {
      message.error('当前语音提供商不支持音频 URL 构建')
      return null
    }

    const url = provider.buildAudioUrl(text)
    if (!url) return null

    // vtsuru 测试 API 特殊检查
    try {
      const tempURL = new URL(url)
      const isVtsuruAPI = tempURL.hostname.toLowerCase().includes('voice.vtsuru.live')
      if (isVtsuruAPI) {
        tempURL.searchParams.set('vtsuruId', accountInfo.value?.id.toString() ?? '-1')
        if (splitter.countGraphemes(tempURL.searchParams.get('text') ?? '') > 100) {
          message.error('本站提供的测试接口字数不允许超过 100 字')
          return null
        }
        return tempURL.toString()
      }
    } catch {
      // 非标准 URL，跳过检查
    }

    return url
  }

  function doSpeak(text: string) {
    const provider = getCurrentProvider()
    if (!provider) {
      cancelSpeech()
      return
    }

    speechState.isSpeaking = true
    speechState.speakingText = text

    if (checkTimer) clearInterval(checkTimer)
    checkTimer = setInterval(() => {
      message.error('语音播放超时')
      cancelSpeech()
    }, 30000)

    if (provider.isAudioProvider && provider.buildAudioUrl) {
      const url = provider.buildAudioUrl(text)
      if (!url) {
        cancelSpeech()
        return
      }

      speechState.isApiAudioLoading = true
      speechState.apiAudioSrc = ''
      setTimeout(() => {
        speechState.apiAudioSrc = url
      }, 0)

      if (loadingTimeoutTimer) clearInterval(loadingTimeoutTimer)
      loadingTimeoutTimer = setInterval(() => {
        if (speechState.isApiAudioLoading) {
          console.error('[TTS] 音频加载超时 (10秒)')
          message.error('音频加载超时，请检查网络连接或API状态')
          cancelSpeech()
        }
      }, 10000)
    } else {
      Promise.resolve(provider.speak(text))
        .then(() => {
          if (speechState.isSpeaking) cancelSpeech()
        })
        .catch((error) => {
          console.error('[TTS] 播放错误:', error)
          message.error(`无法播放语音: ${error instanceof Error ? error.message : '未知错误'}`)
          cancelSpeech()
        })
    }

    console.log(`[TTS] 正在朗读: ${text}`)
  }

  async function processQueue() {
    if (speechState.isSpeaking || speakQueue.value.length === 0) return

    const now = Date.now()
    const combineDelay = (settings.value.combineGiftDelay ?? 0) * 1000

    let targetIndex = -1
    for (let i = 0; i < speakQueue.value.length; i++) {
      const item = speakQueue.value[i]
      if (item.data.type === EventDataTypes.Gift
        && combineDelay > 0
        && item.updateAt > now - combineDelay) {
        continue
      }
      targetIndex = i
      break
    }

    if (targetIndex === -1) return

    const targetItem = speakQueue.value.splice(targetIndex, 1)[0]

    if (targetItem.data.type !== EventDataTypes.Gift) {
      giftCombineMap.clear()
      speakQueue.value.forEach((item, index) => {
        if (item.data.type === EventDataTypes.Gift) {
          giftCombineMap.set(`${item.data.uid}-${item.data.msg}`, index)
        }
      })
    }

    let text = getTextFromDanmaku(targetItem.data)
    if (text) {
      readedDanmaku.value++

      if (settings.value.provider === 'api' && settings.value.providers.api?.splitText) {
        text = insertSpaces(text)
      }

      doSpeak(text)
    }
  }

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
    speechState.apiAudioSrc = ''

    getCurrentProvider()?.stop()
    EasySpeech.cancel()
    speechState.speakingText = ''
  }

  function clearLoadingTimeout() {
    if (loadingTimeoutTimer) {
      clearInterval(loadingTimeoutTimer)
      loadingTimeoutTimer = undefined
    }
  }

  function addToQueue(data: EventModel) {
    if (!speechState.canSpeech) return

    if (data.type === EventDataTypes.Message && (data.emoji || /^(?:\[\w+\])+$/.test(data.msg))) {
      return
    }
    if (data.type === EventDataTypes.Enter && !settings.value.enterTemplate) {
      return
    }

    if (data.type === EventDataTypes.Gift && settings.value.combineGiftDelay) {
      const giftKey = `${data.uid}-${data.msg}`
      const existIndex = giftCombineMap.get(giftKey)

      if (existIndex !== undefined && existIndex < speakQueue.value.length) {
        const exist = speakQueue.value[existIndex]
        if (exist
          && exist.data.type === EventDataTypes.Gift
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
      updateAt: data.type === EventDataTypes.Gift ? Date.now() : 0,
    })

    if (speakQueue.value.length > MAX_QUEUE_SIZE) {
      const removed = speakQueue.value.splice(0, speakQueue.value.length - MAX_QUEUE_SIZE)
      console.warn(`[TTS] 队列过长，已移除 ${removed.length} 个旧项目`)
    }
  }

  function forceSpeak(data: EventModel) {
    cancelSpeech()
    const index = speakQueue.value.findIndex((v) => v.data === data)
    if (index !== -1) {
      speakQueue.value.splice(index, 1)
    }
    speakQueue.value.unshift({
      updateAt: 0,
      data,
    })
  }

  function removeFromQueue(item: QueueItem) {
    const index = speakQueue.value.indexOf(item)
    if (index !== -1) {
      speakQueue.value.splice(index, 1)
    }
  }

  function startSpeech() {
    speechState.canSpeech = true
    message.success('服务已启动')
  }

  function stopSpeech() {
    speechState.canSpeech = false
    speakQueue.value = []
    cancelSpeech()
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
      console.error('[TTS] 上传配置失败:', error)
      message.error(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  async function downloadConfig() {
    try {
      const result = await DownloadConfig<SpeechSettings>('Speech')
      if (result.status === 'success' && result.data) {
        const migrated = migrateLegacySettings(result.data)
        settings.value = migrated
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

  function getAvailableVoices() {
    const provider = getCurrentProvider()
    if (!provider) return []
    const voices = provider.getVoices()
    return voices instanceof Promise ? [] : voices
  }

  return {
    settings,
    speechState,
    speakQueue,
    readedDanmaku,
    speechSynthesisInfo,
    apiAudio,
    initialize,
    destroy,
    addToQueue,
    forceSpeak,
    removeFromQueue,
    clearQueue: () => {
      speakQueue.value = []
      giftCombineMap.clear()
    },
    startSpeech,
    stopSpeech,
    cancelSpeech,
    clearLoadingTimeout,
    uploadConfig,
    downloadConfig,
    getTextFromDanmaku,
    getAvailableVoices,
    buildApiUrl,
    getCurrentProvider,
  }
}

export function useSpeechService() {
  if (!speechServiceInstance) {
    speechServiceInstance = createSpeechService()
  }
  return speechServiceInstance
}
