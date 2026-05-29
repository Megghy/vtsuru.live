import EasySpeech from 'easy-speech'
import { useMessage } from 'naive-ui'
import { nextTick, reactive, ref, watch } from 'vue'
import { clearInterval, clearTimeout, setInterval, setTimeout } from 'worker-timers'
import { createVoiceProvider, DEFAULT_MIMO_VOICE, hasVoiceProvider } from '@/apps/open-live/voice-providers'
import type { EventModel } from '@/api/api-models'
import { DownloadConfig, isLoggedIn, UploadConfig, useAccount } from '@/api/account'
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

export type ConditionField = 'price' | 'count' | 'guard_level' | 'fans_medal_level' | 'message_length' | 'message' | 'gift_name'
export type ConditionOp = '>=' | '<=' | '==' | 'contains' | 'regex'

export interface TemplateCondition {
  field: ConditionField
  op: ConditionOp
  value: string | number
}

export interface TemplateRule {
  template: string
  conditions: TemplateCondition[]
}

export interface EventTemplateConfig {
  rules: TemplateRule[]
}

export interface SpeechSettings {
  provider: string
  speechInfo: SpeechInfo
  outputDeviceId: string
  combineGiftDelay: number | undefined
  templates: Record<string, EventTemplateConfig>
  providers: Record<string, any>

  enabledEvents: {
    message: boolean
    gift: boolean
    sc: boolean
    guard: boolean
    enter: boolean
    follow: boolean
  }

  timedBroadcast: {
    enabled: boolean
    intervalMinutes: number
    texts: string[]
  }

  blacklistUsers: string[]
  blacklistKeywords: string[]
  maxTextLength: number
  antiSpamInterval: number
  deduplicateIdentical: boolean
  priorityEvents: string[]
  textReplacements: Array<{ pattern: string; replacement: string; isRegex: boolean }>

  notificationSound: {
    enabled: boolean
    events: string[]
    volume: number
  }

  queueFullStrategy: 'drop-oldest' | 'reject-new'
  maxQueueSize: number
}


export function makeDefaultTemplate(template: string): EventTemplateConfig {
  return { rules: [{ template, conditions: [] }] }
}

export const DEFAULT_TEMPLATES: Record<string, EventTemplateConfig> = {
  message: makeDefaultTemplate('{name} 说: {message}'),
  gift: makeDefaultTemplate('感谢 {name} 赠送的 {count} 个 {gift_name}'),
  sc: makeDefaultTemplate('{name} 发送了醒目留言: {message}'),
  guard: makeDefaultTemplate('感谢 {name} 的 {count} 个月 {guard_level}'),
  enter: makeDefaultTemplate('欢迎 {name} 进入直播间'),
  follow: makeDefaultTemplate('感谢 {name} 关注直播间'),
}

const DEFAULT_SETTINGS: SpeechSettings = {
  provider: 'local',
  speechInfo: { volume: 1, pitch: 1, rate: 1, voice: '' },
  outputDeviceId: 'default',
  combineGiftDelay: 2,
  templates: structuredClone(DEFAULT_TEMPLATES),
  enabledEvents: { message: true, gift: true, sc: true, guard: true, enter: true, follow: true },
  timedBroadcast: { enabled: false, intervalMinutes: 10, texts: [] },
  blacklistUsers: [],
  blacklistKeywords: [],
  maxTextLength: 0,
  antiSpamInterval: 0,
  deduplicateIdentical: true,
  priorityEvents: ['sc', 'guard'],
  textReplacements: [],
  notificationSound: { enabled: false, events: ['sc', 'guard'], volume: 0.5 },
  queueFullStrategy: 'drop-oldest',
  maxQueueSize: 50,
  providers: {
    azure: { azureVoice: 'zh-CN-XiaoxiaoNeural', azureLanguage: 'zh-CN' },
    api: {
      voiceAPI: 'voice.vtsuru.live/voice/bert-vits2?text={{text}}&id=1&format=mp3&streaming=true',
      voiceAPISchemeType: 'https',
      useAPIDirectly: false,
      splitText: false,
    },
    mimo: { mimoVoice: DEFAULT_MIMO_VOICE, mimoStyleTag: '', mimoApiKey: '' },
    openai: { baseUrl: 'https://api.openai.com', apiKey: '', model: 'tts-1', voice: 'alloy', format: 'mp3' },
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
  if (!raw) return structuredClone(DEFAULT_SETTINGS)

  // Already new format — just ensure all fields exist
  if (raw.templates && typeof raw.templates === 'object') {
    const s = raw as SpeechSettings
    s.enabledEvents ??= { ...DEFAULT_SETTINGS.enabledEvents }
    s.timedBroadcast ??= { ...DEFAULT_SETTINGS.timedBroadcast }
    s.notificationSound ??= { ...DEFAULT_SETTINGS.notificationSound }
    s.textReplacements ??= []
    s.blacklistUsers ??= []
    s.blacklistKeywords ??= []
    s.maxTextLength ??= 0
    s.antiSpamInterval ??= 0
    s.deduplicateIdentical ??= true
    s.priorityEvents ??= ['sc', 'guard']
    s.queueFullStrategy ??= 'drop-oldest'
    s.maxQueueSize ??= 50
    return s
  }

  // Migrate from old single-string templates
  const templates: Record<string, EventTemplateConfig> = {}
  const templateMap: Record<string, string> = {
    message: raw.danmakuTemplate ?? DEFAULT_TEMPLATES.message.rules[0].template,
    gift: raw.giftTemplate ?? DEFAULT_TEMPLATES.gift.rules[0].template,
    sc: raw.scTemplate ?? DEFAULT_TEMPLATES.sc.rules[0].template,
    guard: raw.guardTemplate ?? DEFAULT_TEMPLATES.guard.rules[0].template,
    enter: raw.enterTemplate ?? DEFAULT_TEMPLATES.enter.rules[0].template,
    follow: raw.followTemplate ?? DEFAULT_TEMPLATES.follow.rules[0].template,
  }
  for (const [key, tpl] of Object.entries(templateMap)) {
    const rules: TemplateRule[] = []
    if (tpl) rules.push({ template: tpl, conditions: [] })
    templates[key] = { rules }
  }

  // Migrate enterFilter to conditions on enter template
  if (raw.enterFilter && raw.enterFilter.mode !== 'all' && templates.enter.rules.length > 0) {
    const rule = templates.enter.rules[0]
    switch (raw.enterFilter.mode) {
      case 'medal':
        rule.conditions.push({ field: 'fans_medal_level', op: '>=', value: raw.enterFilter.medalLevel || 1 })
        break
      case 'guard-3':
        rule.conditions.push({ field: 'guard_level', op: '>=', value: 3 })
        break
      case 'guard-2':
        rule.conditions.push({ field: 'guard_level', op: '>=', value: 2 })
        break
      case 'guard-1':
        rule.conditions.push({ field: 'guard_level', op: '==', value: 1 })
        break
    }
  }

  return {
    provider: raw.voiceType ?? raw.provider ?? 'local',
    speechInfo: {
      volume: raw.speechInfo?.volume ?? 1,
      pitch: raw.speechInfo?.pitch ?? 1,
      rate: raw.speechInfo?.rate ?? 1,
      voice: raw.speechInfo?.voice ?? '',
    },
    outputDeviceId: raw.outputDeviceId ?? 'default',
    combineGiftDelay: raw.combineGiftDelay ?? 2,
    templates,
    providers: raw.providers ?? {
      azure: { azureVoice: raw.azureVoice ?? 'zh-CN-XiaoxiaoNeural', azureLanguage: raw.azureLanguage ?? 'zh-CN' },
      api: { voiceAPI: raw.voiceAPI ?? DEFAULT_SETTINGS.providers.api.voiceAPI, voiceAPISchemeType: raw.voiceAPISchemeType ?? 'https', useAPIDirectly: raw.useAPIDirectly ?? false, splitText: raw.splitText ?? false },
      mimo: { mimoVoice: DEFAULT_MIMO_VOICE, mimoStyleTag: '', mimoApiKey: '' },
    },
    enabledEvents: raw.enabledEvents ?? { ...DEFAULT_SETTINGS.enabledEvents },
    timedBroadcast: raw.timedBroadcast ?? { ...DEFAULT_SETTINGS.timedBroadcast },
    blacklistUsers: raw.blacklistUsers ?? [],
    blacklistKeywords: raw.blacklistKeywords ?? [],
    maxTextLength: raw.maxTextLength ?? 0,
    antiSpamInterval: raw.antiSpamInterval ?? 0,
    deduplicateIdentical: raw.deduplicateIdentical ?? true,
    priorityEvents: raw.priorityEvents ?? ['sc', 'guard'],
    textReplacements: raw.textReplacements ?? [],
    notificationSound: raw.notificationSound ?? { ...DEFAULT_SETTINGS.notificationSound },
    queueFullStrategy: raw.queueFullStrategy ?? 'drop-oldest',
    maxQueueSize: raw.maxQueueSize ?? 50,
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
  settings.providers.mimo.mimoApiKey ??= ''
  if (!settings.providers.openai) {
    settings.providers.openai = { ...DEFAULT_SETTINGS.providers.openai }
  } else {
    settings.providers.openai.baseUrl ??= DEFAULT_SETTINGS.providers.openai.baseUrl
    settings.providers.openai.model ??= DEFAULT_SETTINGS.providers.openai.model
    settings.providers.openai.voice ??= DEFAULT_SETTINGS.providers.openai.voice
    settings.providers.openai.format ??= DEFAULT_SETTINGS.providers.openai.format
    settings.providers.openai.apiKey ??= ''
  }

  // 新增字段迁移
  settings.enabledEvents ??= { ...DEFAULT_SETTINGS.enabledEvents }
  settings.enabledEvents.follow ??= true
  settings.templates ??= structuredClone(DEFAULT_TEMPLATES)
  for (const key of Object.keys(DEFAULT_TEMPLATES)) {
    settings.templates[key] ??= structuredClone(DEFAULT_TEMPLATES[key])
  }
  settings.timedBroadcast ??= { ...DEFAULT_SETTINGS.timedBroadcast }
  settings.blacklistUsers ??= []
  settings.blacklistKeywords ??= []
  settings.maxTextLength ??= 0
  settings.antiSpamInterval ??= 0
  settings.deduplicateIdentical ??= true
  settings.priorityEvents ??= ['sc', 'guard']
  settings.textReplacements ??= []
  settings.notificationSound ??= { ...DEFAULT_SETTINGS.notificationSound }
  settings.queueFullStrategy ??= 'drop-oldest'
  settings.maxQueueSize ??= 50
}

let speechServiceInstance: ReturnType<typeof createSpeechService> | null = null

function createSpeechService() {
  const message = useMessage()
  const accountInfo = useAccount()
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

  const settings = usePersistedStorage<SpeechSettings>('Setting.Speech', DEFAULT_SETTINGS)
  watch(settings, (value) => {
    const normalized = normalizeSettings(value)
    if (normalized !== value) settings.value = normalized
  }, { immediate: true, flush: 'sync' })

  // 云端自动同步
  let _cloudSyncSuppressed = false
  let _initComplete = false
  let _cloudSaveTimer: ReturnType<typeof globalThis.setTimeout> | undefined

  async function syncFromCloud() {
    if (!isLoggedIn.value) return
    try {
      const result = await DownloadConfig<SpeechSettings>('Speech')
      if (result.status === 'success' && result.data) {
        _cloudSyncSuppressed = true
        settings.value = migrateLegacySettings(result.data)
        await nextTick()
        _cloudSyncSuppressed = false
      }
    } catch (e) {
      console.warn('[TTS] 云端配置同步失败:', e)
    }
  }

  function debouncedSaveToCloud() {
    if (_cloudSyncSuppressed || !isLoggedIn.value || !_initComplete) return
    if (_cloudSaveTimer) globalThis.clearTimeout(_cloudSaveTimer)
    _cloudSaveTimer = globalThis.setTimeout(() => {
      UploadConfig('Speech', settings.value)
    }, 3000)
  }

  watch(settings, debouncedSaveToCloud, { deep: true })

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
  const spokenHistory = ref<Array<{ text: string; uname: string; type: string; time: number }>>([])
  const rejectedHistory = ref<Array<{ uname: string; type: string; reason: string; time: number }>>([])
  const isPaused = ref(false)
  const lastSpeakTimeByUser = new Map<string, number>()
  const recentMessages = new Set<string>()

  const apiAudio = ref<HTMLAudioElement>()
  let checkTimer: number | undefined
  let loadingTimeoutTimer: number | undefined
  let speechQueueTimer: number | undefined
  let timedBroadcastTimer: number | undefined
  let timedBroadcastIndex = 0
  let pendingObjectUrl: string | undefined

  function revokePendingObjectUrl() {
    if (pendingObjectUrl) {
      URL.revokeObjectURL(pendingObjectUrl)
      pendingObjectUrl = undefined
    }
  }

  const speechSynthesisInfo = ref<{
    speechSynthesis: SpeechSynthesis | undefined
    speechSynthesisUtterance: SpeechSynthesisUtterance | undefined
    speechSynthesisVoice: SpeechSynthesisVoice | undefined
    onvoiceschanged: boolean
  }>()

  let _cachedProvider: { id: string; instance: ReturnType<typeof createVoiceProvider> } | undefined

  function getCurrentProvider() {
    const id = settings.value.provider
    if (!hasVoiceProvider(id)) return undefined
    if (_cachedProvider?.id === id) return _cachedProvider.instance
    const instance = createVoiceProvider(id, () => settings.value)
    _cachedProvider = { id, instance }
    return instance
  }

  async function initialize() {
    if (speechState.isInitialized) return

    await syncFromCloud()

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
      _initComplete = true
      console.log('[TTS] 语音服务初始化完成')
    } catch (error) {
      console.error('[TTS] 初始化失败:', error)
      message.error('语音服务初始化失败')
    }
  }

  watch(
    () => [
      settings.value.timedBroadcast.enabled,
      settings.value.timedBroadcast.intervalMinutes,
      settings.value.timedBroadcast.texts.filter(t => t.trim()).join('\n'),
      speechState.canSpeech,
    ],
    () => { startTimedBroadcast() },
  )

  function destroy() {
    if (speechQueueTimer) {
      clearInterval(speechQueueTimer)
      speechQueueTimer = undefined
    }
    if (checkTimer) {
      clearTimeout(checkTimer)
      checkTimer = undefined
    }
    if (loadingTimeoutTimer) {
      clearTimeout(loadingTimeoutTimer)
      loadingTimeoutTimer = undefined
    }
    stopTimedBroadcast()
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

  function evaluateCondition(cond: TemplateCondition, data: EventModel): boolean {
    let fieldValue: number | string
    switch (cond.field) {
      case 'price': fieldValue = data.price ?? 0; break
      case 'count': fieldValue = data.num ?? 0; break
      case 'guard_level': fieldValue = data.guard_level ?? 0; break
      case 'fans_medal_level': fieldValue = data.fans_medal_level ?? 0; break
      case 'message_length': fieldValue = (data.msg ?? '').length; break
      case 'message': fieldValue = data.msg ?? ''; break
      case 'gift_name': fieldValue = data.msg ?? ''; break
      default: return false
    }
    const numVal = typeof fieldValue === 'number' ? fieldValue : Number.parseFloat(fieldValue)
    const condNum = typeof cond.value === 'number' ? cond.value : Number.parseFloat(String(cond.value))
    switch (cond.op) {
      case '>=': return numVal >= condNum
      case '<=': return numVal <= condNum
      case '==': return numVal === condNum
      case 'contains': return String(fieldValue).includes(String(cond.value))
      case 'regex':
        try { return new RegExp(String(cond.value), 'i').test(String(fieldValue)) }
        catch { return false }
      default: return false
    }
  }

  function selectTemplate(config: EventTemplateConfig | undefined, data: EventModel): string | undefined {
    if (!config || config.rules.length === 0) return undefined
    const conditional: TemplateRule[] = []
    const unconditional: TemplateRule[] = []
    for (const rule of config.rules) {
      if (!rule.template) continue
      if (rule.conditions.length > 0) conditional.push(rule)
      else unconditional.push(rule)
    }
    for (const rule of conditional) {
      if (rule.conditions.every(c => evaluateCondition(c, data))) return rule.template
    }
    if (unconditional.length > 0) {
      return unconditional[Math.floor(Math.random() * unconditional.length)].template
    }
    return undefined
  }

  function getTextFromDanmaku(data: EventModel | undefined): string | undefined {
    if (!data) return

    const eventKey = getEventKey(data.type)
    if (!eventKey) return
    const config = settings.value.templates[eventKey]
    const template = selectTemplate(config, data)
    if (!template) return

    const isApiWithSplit = settings.value.provider === 'api'
      && (settings.value.providers.api?.splitText as boolean)

    let text = template
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

    if (settings.value.textReplacements.length > 0) {
      for (const rule of settings.value.textReplacements) {
        if (!rule.pattern) continue
        try {
          if (rule.isRegex) {
            text = text.replace(new RegExp(rule.pattern, 'gi'), rule.replacement)
          } else {
            text = text.replaceAll(rule.pattern, rule.replacement)
          }
        } catch { /* invalid regex, skip */ }
      }
    }

    if (settings.value.maxTextLength > 0 && text.length > settings.value.maxTextLength) {
      text = text.slice(0, settings.value.maxTextLength)
    }

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
        if ([...segmenter.segment(tempURL.searchParams.get('text') ?? '')].length > 100) {
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

    if (checkTimer) clearTimeout(checkTimer)
    checkTimer = setTimeout(() => {
      message.error('语音播放超时')
      cancelSpeech()
    }, 30000)

    if (provider.isAudioProvider) {
      speechState.isApiAudioLoading = true
      speechState.apiAudioSrc = ''

      if (loadingTimeoutTimer) clearTimeout(loadingTimeoutTimer)
      loadingTimeoutTimer = setTimeout(() => {
        if (speechState.isApiAudioLoading) {
          console.error('[TTS] 音频加载超时 (25秒)')
          message.error('音频加载超时，请检查网络连接或API状态')
          cancelSpeech()
        }
      }, 25000)

      if (provider.fetchAudio) {
        provider
          .fetchAudio(text)
          .then((blob) => {
            const url = URL.createObjectURL(blob)
            revokePendingObjectUrl()
            pendingObjectUrl = url
            setTimeout(() => {
              speechState.apiAudioSrc = url
            }, 0)
          })
          .catch((error) => {
            console.error('[TTS] 获取音频失败:', error)
            message.error(`语音合成失败: ${error instanceof Error ? error.message : '未知错误'}`)
            cancelSpeech()
          })
      } else if (provider.buildAudioUrl) {
        const url = provider.buildAudioUrl(text)
        if (!url) {
          cancelSpeech()
          return
        }
        setTimeout(() => {
          speechState.apiAudioSrc = url
        }, 0)
      } else {
        message.error('当前语音提供商未实现音频获取')
        cancelSpeech()
      }
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
    if (isPaused.value) return

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

      // 已播报历史
      spokenHistory.value.unshift({
        text,
        uname: targetItem.data.uname,
        type: String(targetItem.data.type),
        time: Date.now(),
      })
      if (spokenHistory.value.length > 50) spokenHistory.value.length = 50

      // 提示音
      const eventKey = getEventKey(targetItem.data.type)
      if (settings.value.notificationSound.enabled
        && eventKey
        && settings.value.notificationSound.events.includes(eventKey)) {
        await playNotificationSound()
      }

      if (settings.value.provider === 'api' && settings.value.providers.api?.splitText) {
        text = insertSpaces(text)
      }

      doSpeak(text)
    }
  }

  async function playNotificationSound(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        osc.type = 'sine'
        gain.gain.value = settings.value.notificationSound.volume ?? 0.3
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
        osc.start()
        osc.stop(ctx.currentTime + 0.3)
        osc.onended = () => { ctx.close(); resolve() }
      } catch { resolve() }
    })
  }

  function cancelSpeech() {
    speechState.isSpeaking = false

    if (checkTimer) {
      clearTimeout(checkTimer)
      checkTimer = undefined
    }
    if (loadingTimeoutTimer) {
      clearTimeout(loadingTimeoutTimer)
      loadingTimeoutTimer = undefined
    }

    speechState.isApiAudioLoading = false

    if (apiAudio.value && !apiAudio.value.paused) {
      apiAudio.value.pause()
    }
    speechState.apiAudioSrc = ''
    revokePendingObjectUrl()

    getCurrentProvider()?.stop()
    EasySpeech.cancel()
    speechState.speakingText = ''
  }

  function clearLoadingTimeout() {
    if (loadingTimeoutTimer) {
      clearTimeout(loadingTimeoutTimer)
      loadingTimeoutTimer = undefined
    }
  }

  function reject(data: EventModel, reason: string) {
    rejectedHistory.value.unshift({ uname: data.uname, type: String(data.type), reason, time: Date.now() })
    if (rejectedHistory.value.length > 50) rejectedHistory.value.length = 50
  }

  function addToQueue(data: EventModel) {
    if (!speechState.canSpeech) return

    const eventKey = getEventKey(data.type)
    if (eventKey && !settings.value.enabledEvents[eventKey]) {
      reject(data, '事件类型已关闭')
      return
    }

    if (data.type === EventDataTypes.Message && (data.emoji || /^(?:\[\w+\])+$/.test(data.msg))) {
      reject(data, '纯表情弹幕')
      return
    }

    if (settings.value.blacklistUsers.length > 0) {
      const lowerName = data.uname.toLowerCase()
      if (settings.value.blacklistUsers.some(u => lowerName === u.toLowerCase())) {
        reject(data, '用户黑名单')
        return
      }
    }

    if (settings.value.blacklistKeywords.length > 0 && data.msg) {
      const lowerMsg = data.msg.toLowerCase()
      if (settings.value.blacklistKeywords.some(kw => lowerMsg.includes(kw.toLowerCase()))) {
        reject(data, '关键词黑名单')
        return
      }
    }

    if (settings.value.antiSpamInterval > 0) {
      const userKey = String(data.uid)
      const lastTime = lastSpeakTimeByUser.get(userKey)
      const now = Date.now()
      if (lastTime && now - lastTime < settings.value.antiSpamInterval * 1000) {
        reject(data, '防刷屏间隔')
        return
      }
      lastSpeakTimeByUser.set(userKey, now)
    }

    if (settings.value.deduplicateIdentical && data.msg) {
      const dedupKey = `${data.uid}:${data.msg}`
      if (recentMessages.has(dedupKey)) {
        reject(data, '重复内容')
        return
      }
      recentMessages.add(dedupKey)
      setTimeout(() => recentMessages.delete(dedupKey), 10000)
    }

    // 模板条件匹配预检
    if (eventKey) {
      const config = settings.value.templates[eventKey]
      const template = selectTemplate(config, data)
      if (!template) {
        reject(data, '无匹配模板规则')
        return
      }
    }

    const maxSize = settings.value.maxQueueSize || 50
    if (speakQueue.value.length >= maxSize) {
      if (settings.value.queueFullStrategy === 'reject-new') {
        reject(data, '队列已满')
        return
      }
      speakQueue.value.splice(0, speakQueue.value.length - maxSize + 1)
    }

    // 礼物合并
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
          return
        }
      }

      const newIndex = speakQueue.value.length
      giftCombineMap.set(giftKey, newIndex)
      setTimeout(() => {
        if (giftCombineMap.get(giftKey) === newIndex) giftCombineMap.delete(giftKey)
      }, (settings.value.combineGiftDelay + 1) * 1000)
    }

    const item: QueueItem = {
      data,
      updateAt: data.type === EventDataTypes.Gift ? Date.now() : 0,
    }

    // 优先级插队
    const isPriority = settings.value.priorityEvents.includes(eventKey ?? '')
    if (isPriority) {
      speakQueue.value.unshift(item)
    } else {
      speakQueue.value.push(item)
    }
  }

  function getEventKey(type: EventDataTypes): keyof SpeechSettings['enabledEvents'] | null {
    switch (type) {
      case EventDataTypes.Message: return 'message'
      case EventDataTypes.Gift: return 'gift'
      case EventDataTypes.SC: return 'sc'
      case EventDataTypes.Guard: return 'guard'
      case EventDataTypes.Enter: return 'enter'
      case EventDataTypes.Follow: return 'follow'
      default: return null
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

  function moveQueueItem(from: number, to: number) {
    if (from === to) return
    const len = speakQueue.value.length
    if (from < 0 || from >= len || to < 0 || to >= len) return
    const [moved] = speakQueue.value.splice(from, 1)
    speakQueue.value.splice(to, 0, moved)
  }

  function pinToTop(item: QueueItem) {
    const index = speakQueue.value.indexOf(item)
    if (index <= 0) return
    speakQueue.value.splice(index, 1)
    speakQueue.value.unshift(item)
  }

  function startSpeech() {
    speechState.canSpeech = true
    message.success('服务已启动')
  }

  function startTimedBroadcast() {
    stopTimedBroadcast()
    if (!speechState.canSpeech) return
    const { enabled, intervalMinutes, texts } = settings.value.timedBroadcast
    const validTexts = texts.filter(t => t.trim())
    if (!enabled || validTexts.length === 0 || intervalMinutes <= 0) return
    timedBroadcastTimer = setInterval(() => {
      if (!speechState.canSpeech || isPaused.value) return
      if (speechState.isSpeaking || speechState.isApiAudioLoading) return
      const text = validTexts[timedBroadcastIndex % validTexts.length]
      timedBroadcastIndex++
      doSpeak(text.trim())
    }, intervalMinutes * 60 * 1000)
  }

  function stopTimedBroadcast() {
    if (timedBroadcastTimer) {
      clearInterval(timedBroadcastTimer)
      timedBroadcastTimer = undefined
    }
  }

  function stopSpeech() {
    speechState.canSpeech = false
    speakQueue.value = []
    cancelSpeech()
    stopTimedBroadcast()
    message.success('已停止监听')
  }

  async function downloadConfig() {
    try {
      const result = await DownloadConfig<SpeechSettings>('Speech')
      if (result.status === 'success' && result.data) {
        _cloudSyncSuppressed = true
        settings.value = migrateLegacySettings(result.data)
        await nextTick()
        _cloudSyncSuppressed = false
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

  async function previewVoice(text = '你好，这是一段试听'): Promise<void> {
    const provider = getCurrentProvider()
    if (!provider) {
      message.error('未选择语音提供商')
      return
    }

    if (!provider.isAudioProvider) {
      try {
        await provider.speak(text)
      } catch (error) {
        message.error(`试听失败: ${error instanceof Error ? error.message : '未知错误'}`)
      }
      return
    }

    let audioUrl: string | null = null
    let createdObjectUrl = false
    try {
      if (provider.fetchAudio) {
        const blob = await provider.fetchAudio(text)
        audioUrl = URL.createObjectURL(blob)
        createdObjectUrl = true
      } else if (provider.buildAudioUrl) {
        audioUrl = provider.buildAudioUrl(text)
      }
      if (!audioUrl) throw new Error('无法构造音频地址')

      const audio = new Audio(audioUrl)
      audio.volume = settings.value.speechInfo.volume ?? 1
      const cleanup = () => {
        if (createdObjectUrl) URL.revokeObjectURL(audioUrl)
      }
      audio.addEventListener('ended', cleanup, { once: true })
      audio.addEventListener('error', cleanup, { once: true })
      await audio.play()
    } catch (error) {
      if (createdObjectUrl && audioUrl) URL.revokeObjectURL(audioUrl)
      console.error('[TTS] 试听失败:', error)
      message.error(`试听失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  return {
    settings,
    speechState,
    speakQueue,
    readedDanmaku,
    spokenHistory,
    rejectedHistory,
    isPaused,
    speechSynthesisInfo,
    apiAudio,
    initialize,
    destroy,
    addToQueue,
    forceSpeak,
    removeFromQueue,
    moveQueueItem,
    pinToTop,
    clearQueue: () => {
      speakQueue.value = []
      giftCombineMap.clear()
    },
    startSpeech,
    stopSpeech,
    cancelSpeech,
    clearLoadingTimeout,
    downloadConfig,
    getTextFromDanmaku,
    getAvailableVoices,
    previewVoice,
    buildApiUrl,
    getCurrentProvider,
    togglePause: () => { isPaused.value = !isPaused.value },
    skipCurrent: () => { cancelSpeech() },
  }
}

export function useSpeechService() {
  if (!speechServiceInstance) {
    speechServiceInstance = createSpeechService()
  }
  return speechServiceInstance
}
