import type { ConfigSource, VoiceOption, VoiceProvider } from './types'
import { createOpenAIClient, synthesizeSpeech } from './ai-client'

interface OpenAIProviderConfig {
  baseUrl?: string
  apiKey?: string
  model?: string
  voice?: string
  format?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'
}

const PRESET_OPENAI_VOICES: VoiceOption[] = [
  { label: 'alloy', value: 'alloy' },
  { label: 'echo', value: 'echo' },
  { label: 'fable', value: 'fable' },
  { label: 'onyx', value: 'onyx' },
  { label: 'nova', value: 'nova' },
  { label: 'shimmer', value: 'shimmer' },
]

export class OpenAICompatibleVoiceProvider implements VoiceProvider {
  readonly id = 'openai'
  readonly name = 'OpenAI 兼容 TTS'
  readonly description = '通用 OpenAI Audio API 兼容入口，可填写自定义 base_url 与 API Key（直连服务方，不经过 VTsuru）'
  readonly isAudioProvider = true

  constructor(private getConfig: ConfigSource) {}

  async initialize(): Promise<void> {}

  getVoices(): VoiceOption[] {
    return PRESET_OPENAI_VOICES
  }

  async fetchAudio(text: string): Promise<Blob> {
    const cfg = this.readConfig()
    if (!cfg.apiKey) throw new Error('未填写 API Key')
    if (!cfg.voice) throw new Error('未选择音色')

    const baseUrl = (cfg.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')
    const speechInfo = this.getConfig().speechInfo ?? {}
    const speed = Math.min(4, Math.max(0.25, speechInfo.rate ?? 1))

    const client = createOpenAIClient({ apiKey: cfg.apiKey, baseURL: `${baseUrl}/v1` })
    return synthesizeSpeech(client, {
      model: cfg.model || 'tts-1',
      input: text,
      voice: cfg.voice,
      responseFormat: cfg.format || 'mp3',
      speed,
    })
  }

  speak(): void {}
  stop(): void {}

  private readConfig(): OpenAIProviderConfig {
    const cfg = this.getConfig().providers?.openai
    return (cfg ?? {}) as OpenAIProviderConfig
  }
}

export const OPENAI_PRESET_VOICES = PRESET_OPENAI_VOICES
