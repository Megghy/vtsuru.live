import type { EventModel } from '@/api/client-types'

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
  eventKey?: SpeechEventKey
  data: EventModel
}

export type ConditionField =
  | 'price'
  | 'count'
  | 'guard_level'
  | 'fans_medal_level'
  | 'message_length'
  | 'message'
  | 'gift_name'

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

export type AzureProviderSettings = {
  azureVoice: string
  azureLanguage: string
}

export type CustomApiProviderSettings = {
  voiceAPI: string
  voiceAPISchemeType: 'http' | 'https'
  useAPIDirectly: boolean
  splitText: boolean
}

export type MimoProviderSettings = {
  mimoVoice: string
  mimoStyleTag: string
  mimoApiKey: string
}

export type ServerVoiceProviderSettings = {
  voice: string
  language?: string
}

export type OpenAIProviderSettings = {
  baseUrl: string
  apiKey: string
  model: string
  voice: string
  format: string
}

export type CosyVoiceProviderSettings = {
  apiKey: string
  model: string
  voice: string
  customVoices: unknown[]
  languageHint: string
}

export type SpeechProvidersMap = {
  azure: AzureProviderSettings
  api: CustomApiProviderSettings
  mimo: MimoProviderSettings
  'grok-tts': ServerVoiceProviderSettings
  'qwen-tts': ServerVoiceProviderSettings
  openai: OpenAIProviderSettings
  cosyvoice: CosyVoiceProviderSettings
  [key: string]: Record<string, unknown> | undefined
}

export interface SpeechSettings {
  provider: string
  speechInfo: SpeechInfo
  outputDeviceId: string
  combineGiftDelay: number | undefined
  templates: Record<string, EventTemplateConfig>
  providers: SpeechProvidersMap

  enabledEvents: {
    message: boolean
    gift: boolean
    joinFansClub: boolean
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

export type SpeechEventKey = keyof SpeechSettings['enabledEvents']
