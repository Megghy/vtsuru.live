import {
  DEFAULT_COSYVOICE_MODEL,
  DEFAULT_COSYVOICE_VOICE,
  DEFAULT_GROK_VOICE,
  DEFAULT_MIMO_VOICE,
  DEFAULT_QWEN_VOICE,
} from '@/apps/open-live/voice-providers'

import type { EventTemplateConfig, SpeechProvidersMap, SpeechSettings, TemplateRule } from './types'

export function makeDefaultTemplate(template: string): EventTemplateConfig {
  return { rules: [{ template, conditions: [] }] }
}

export const DEFAULT_TEMPLATES: Record<string, EventTemplateConfig> = {
  message: makeDefaultTemplate('{name} 说: {message}'),
  gift: makeDefaultTemplate('感谢 {name} 赠送的 {count} 个 {gift_name}'),
  joinFansClub: makeDefaultTemplate('欢迎 {name} 加入粉丝团'),
  sc: makeDefaultTemplate('{name} 发送了醒目留言: {message}'),
  guard: makeDefaultTemplate('感谢 {name} 的 {count} 个月 {guard_level}'),
  enter: makeDefaultTemplate('欢迎 {name} 进入直播间'),
  follow: makeDefaultTemplate('感谢 {name} 关注直播间'),
}

export const DEFAULT_SETTINGS: SpeechSettings = {
  provider: 'local',
  speechInfo: { volume: 1, pitch: 1, rate: 1, voice: '' },
  outputDeviceId: 'default',
  combineGiftDelay: 2,
  templates: structuredClone(DEFAULT_TEMPLATES),
  enabledEvents: { message: true, gift: true, joinFansClub: true, sc: true, guard: true, enter: true, follow: true },
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
    'grok-tts': { voice: DEFAULT_GROK_VOICE, language: 'zh' },
    'qwen-tts': { voice: DEFAULT_QWEN_VOICE },
    openai: { baseUrl: 'https://api.openai.com', apiKey: '', model: 'tts-1', voice: 'alloy', format: 'mp3' },
    cosyvoice: {
      apiKey: '',
      model: DEFAULT_COSYVOICE_MODEL,
      voice: DEFAULT_COSYVOICE_VOICE,
      customVoices: [],
      languageHint: 'zh',
    },
  },
}

export const templateConstants = {
  name: { name: '用户名', words: '{name}', regex: /\{\s*name\s*\}/gi },
  message: { name: '弹幕内容', words: '{message}', regex: /\{\s*message\s*\}/gi },
  guard_level: { name: '舰长等级', words: '{guard_level}', regex: /\{\s*guard_level\s*\}/gi },
  guard_num: { name: '上舰数量', words: '{guard_num}', regex: /\{\s*guard_num\s*\}/gi },
  fans_medal_level: { name: '粉丝勋章等级', words: '{fans_medal_level}', regex: /\{\s*fans_medal_level\s*\}/gi },
  price: { name: '价格', words: '{price}', regex: /\{\s*price\s*\}/gi },
  count: { name: '数量', words: '{count}', regex: /\{\s*count\s*\}/gi },
  gift_name: { name: '礼物名称', words: '{gift_name}', regex: /\{\s*gift_name\s*\}/gi },
}

interface LegacyRawSettings {
  templates?: Record<string, EventTemplateConfig>
  danmakuTemplate?: string
  giftTemplate?: string
  scTemplate?: string
  guardTemplate?: string
  enterTemplate?: string
  followTemplate?: string
  enterFilter?: { mode?: string; medalLevel?: number }
  voiceType?: string
  provider?: string
  speechInfo?: Partial<SpeechSettings['speechInfo']>
  outputDeviceId?: string
  combineGiftDelay?: number
  providers?: SpeechProvidersMap
  azureVoice?: string
  azureLanguage?: string
  voiceAPI?: string
  voiceAPISchemeType?: 'http' | 'https'
  useAPIDirectly?: boolean
  splitText?: boolean
  enabledEvents?: SpeechSettings['enabledEvents']
  timedBroadcast?: SpeechSettings['timedBroadcast']
  blacklistUsers?: string[]
  blacklistKeywords?: string[]
  maxTextLength?: number
  antiSpamInterval?: number
  deduplicateIdentical?: boolean
  priorityEvents?: string[]
  textReplacements?: SpeechSettings['textReplacements']
  notificationSound?: SpeechSettings['notificationSound']
  queueFullStrategy?: SpeechSettings['queueFullStrategy']
  maxQueueSize?: number
}

function asLegacyRaw(raw: unknown): LegacyRawSettings | null {
  return raw && typeof raw === 'object' ? (raw as LegacyRawSettings) : null
}

export function migrateLegacySettings(rawInput: unknown): SpeechSettings {
  const raw = asLegacyRaw(rawInput)
  if (!raw) return structuredClone(DEFAULT_SETTINGS)

  // Already new format — just ensure all fields exist
  if (raw.templates && typeof raw.templates === 'object') {
    const s = raw as unknown as SpeechSettings
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
    providers:
      raw.providers ??
      ({
        azure: { azureVoice: raw.azureVoice ?? 'zh-CN-XiaoxiaoNeural', azureLanguage: raw.azureLanguage ?? 'zh-CN' },
        api: {
          voiceAPI: raw.voiceAPI ?? DEFAULT_SETTINGS.providers.api.voiceAPI,
          voiceAPISchemeType: raw.voiceAPISchemeType ?? 'https',
          useAPIDirectly: raw.useAPIDirectly ?? false,
          splitText: raw.splitText ?? false,
        },
        mimo: { mimoVoice: DEFAULT_MIMO_VOICE, mimoStyleTag: '', mimoApiKey: '' },
        cosyvoice: { ...DEFAULT_SETTINGS.providers.cosyvoice },
      } as SpeechProvidersMap),
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

export function ensureProviderDefaults(settings: SpeechSettings) {
  if (!settings.providers) {
    settings.providers = structuredClone(DEFAULT_SETTINGS.providers)
  }
  const providersMap = settings.providers as Record<string, Record<string, unknown> | undefined>
  for (const [id, defaults] of Object.entries(DEFAULT_SETTINGS.providers)) {
    if (!defaults) continue
    const provider = (providersMap[id] ??= structuredClone(defaults))
    for (const [key, value] of Object.entries(defaults)) {
      provider[key] ??= structuredClone(value)
    }
  }
  if (!settings.providers.mimo.mimoVoice || settings.providers.mimo.mimoVoice === 'mimo_default') {
    settings.providers.mimo.mimoVoice = DEFAULT_MIMO_VOICE
  }

  settings.enabledEvents ??= { ...DEFAULT_SETTINGS.enabledEvents }
  for (const key of Object.keys(DEFAULT_SETTINGS.enabledEvents) as Array<keyof SpeechSettings['enabledEvents']>) {
    settings.enabledEvents[key] ??= DEFAULT_SETTINGS.enabledEvents[key]
  }
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

export function normalizeSettings(raw: unknown): SpeechSettings {
  const settings = migrateLegacySettings(raw)
  ensureProviderDefaults(settings)
  return settings
}
