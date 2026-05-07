import { TTS_API_URL } from '@/shared/config'
import type { ConfigSource, VoiceOption, VoiceProvider } from './types'

export const MIMO_VOICES: VoiceOption[] = [
  { value: 'mimo_default', label: 'mimo_default (默认)' },
  { value: 'Chloe', label: 'Chloe' },
  { value: 'Mia', label: 'Mia' },
  { value: 'Milo', label: 'Milo' },
  { value: 'Dean', label: 'Dean' },
  { value: '冰糖', label: '冰糖' },
  { value: '茉莉', label: '茉莉' },
  { value: '苏打', label: '苏打' },
  { value: '白桦', label: '白桦' },
]

interface MimoProviderConfig {
  mimoVoice?: string
  mimoStyleTag?: string
}

export class MimoVoiceProvider implements VoiceProvider {
  readonly id = 'mimo'
  readonly name = 'MiMo TTS'
  readonly description = '使用小米 MiMo 语音合成服务，支持风格标签控制'
  readonly isAudioProvider = true

  constructor(private getConfig: ConfigSource) {}

  async initialize(): Promise<void> {}

  getVoices(): VoiceOption[] {
    return MIMO_VOICES
  }

  buildAudioUrl(text: string): string | null {
    const config = this.getConfig()
    const providerCfg = (config.providers as Record<string, unknown>)?.mimo as MimoProviderConfig | undefined

    const url = new URL(`${TTS_API_URL}mimo`)
    url.searchParams.set('text', text)
    url.searchParams.set('voice', providerCfg?.mimoVoice ?? 'mimo_default')
    if (providerCfg?.mimoStyleTag) {
      url.searchParams.set('styleTag', providerCfg.mimoStyleTag)
    }
    return url.toString()
  }

  speak(): void {
    // 通过 audio 元素播放
  }

  stop(): void {
    // audio 元素的 stop 由 store 处理
  }
}
