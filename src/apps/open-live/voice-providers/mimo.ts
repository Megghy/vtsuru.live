import { TTS_API_URL } from '@/shared/config'
import type { ConfigSource, VoiceOption, VoiceProvider } from './types'

export const DEFAULT_MIMO_VOICE = '冰糖'

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

  private voiceList: VoiceOption[] = []
  private voiceListRequest?: Promise<VoiceOption[]>

  async initialize(): Promise<void> {}

  async getVoices(): Promise<VoiceOption[]> {
    if (this.voiceList.length > 0) return this.voiceList
    this.voiceListRequest ??= this.fetchVoices()
    return this.voiceListRequest
  }

  private async fetchVoices(): Promise<VoiceOption[]> {
    try {
      const response = await fetch(`${TTS_API_URL}voices?provider=mimo`)
      if (!response.ok) throw new Error('获取 MiMo 音色列表失败')

      const voices = await response.json()
      this.voiceList = voices.map((voice: any) => {
        const id = voice.id ?? voice.Id
        const name = voice.name ?? voice.Name ?? id
        const language = voice.language ?? voice.Language
        const gender = voice.gender ?? voice.Gender
        const languageText = language === 'zh' ? '中文' : language === 'en' ? '英文' : '集群相关'
        const genderText = gender === 'Male' ? '男' : gender === 'Female' ? '女' : ''
        return {
          label: genderText ? `${name} [${languageText}/${genderText}]` : `${name} [${languageText}]`,
          value: id,
          meta: { language, gender },
        }
      })
      return this.voiceList
    } catch (error) {
      console.error('[MiMoTTS] 获取音色列表失败:', error)
      return []
    } finally {
      this.voiceListRequest = undefined
    }
  }

  buildAudioUrl(text: string): string | null {
    const config = this.getConfig()
    const providerCfg = (config.providers as Record<string, unknown>)?.mimo as MimoProviderConfig | undefined

    const url = new URL(`${TTS_API_URL}mimo`)
    url.searchParams.set('text', text)
    url.searchParams.set('voice', providerCfg?.mimoVoice ?? DEFAULT_MIMO_VOICE)
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
