import { FETCH_API } from '@/shared/config'
import type { ConfigSource, VoiceOption, VoiceProvider } from './types'

interface CustomApiProviderConfig {
  voiceAPI?: string
  voiceAPISchemeType?: 'http' | 'https'
  useAPIDirectly?: boolean
}

export class CustomApiVoiceProvider implements VoiceProvider {
  readonly id = 'api'
  readonly name = 'API 语音'
  readonly description = '自定义语音 API，可播放自己训练的模型或其他 TTS'
  readonly isAudioProvider = true

  constructor(private getConfig: ConfigSource) {}

  async initialize(): Promise<void> {}

  getVoices(): VoiceOption[] {
    return []
  }

  buildAudioUrl(text: string): string | null {
    const config = this.getConfig()
    const providerCfg = (config.providers as Record<string, unknown>)?.api as CustomApiProviderConfig | undefined

    const apiUrl = providerCfg?.voiceAPI?.trim()
    if (!apiUrl) {
      console.error('[CustomApiTTS] 未设置语音 API')
      return null
    }

    const scheme = providerCfg?.voiceAPISchemeType === 'https'
      ? 'https://'
      : providerCfg?.useAPIDirectly
        ? 'http://'
        : `${FETCH_API}http://`

    try {
      return `${scheme}${apiUrl.replace(/^https?:\/\//, '')}`.replace(
        /\{\{\s*text\s*\}\}/,
        encodeURIComponent(text),
      )
    } catch {
      console.error(`[CustomApiTTS] 无效的 API 地址`)
      return null
    }
  }

  speak(): void {
    // 通过 audio 元素播放
  }

  stop(): void {
    // audio 元素的 stop 由 store 处理
  }
}
