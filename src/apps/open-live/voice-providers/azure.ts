import { TTS_API_URL } from '@/shared/config'
import type { ConfigSource, VoiceOption, VoiceProvider } from './types'

interface AzureProviderConfig {
  azureVoice?: string
  azureLanguage?: string
}

export class AzureVoiceProvider implements VoiceProvider {
  readonly id = 'azure'
  readonly name = 'Azure TTS'
  readonly description = '使用 Microsoft Azure 语音合成服务，混合语言输出效果好'
  readonly isAudioProvider = true

  private voiceList: VoiceOption[] = []
  private voiceListLoading = false

  constructor(private getConfig: ConfigSource) {}

  async initialize(): Promise<void> {}

  async getVoices(): Promise<VoiceOption[]> {
    if (this.voiceList.length > 0) return this.voiceList
    if (this.voiceListLoading) return []

    this.voiceListLoading = true
    try {
      const response = await fetch(`${TTS_API_URL}voices`)
      if (!response.ok) throw new Error('获取语音列表失败')

      const voices = await response.json()
      this.voiceList = voices
        .filter((v: any) => {
          const locale = v.Locale || v.locale || ''
          return locale.startsWith('zh-') || locale.startsWith('ja-') || locale.startsWith('en-')
        })
        .map((v: any) => {
          const shortName = v.ShortName || v.shortName || ''
          const localeName = v.LocaleName || v.localeName || ''
          const localName = v.LocalName || v.localName || v.DisplayName || v.displayName || ''
          const gender = v.Gender || v.gender || ''
          const isMultilingual = shortName.toLowerCase().includes('multilingual')
          return {
            label: `[${localeName}] ${localName} (${gender === 'Male' ? '男' : '女'})${isMultilingual ? ' 🌍' : ''}`,
            value: shortName,
            meta: { locale: v.Locale || v.locale || '' },
          }
        })
        .sort((a: VoiceOption, b: VoiceOption) => {
          const aMulti = String(a.value).toLowerCase().includes('multilingual')
          const bMulti = String(b.value).toLowerCase().includes('multilingual')
          if (aMulti && !bMulti) return -1
          if (!aMulti && bMulti) return 1
          const aScore = (a.meta?.locale as string)?.startsWith('zh-') ? 0 : (a.meta?.locale as string)?.startsWith('ja-') ? 1 : 2
          const bScore = (b.meta?.locale as string)?.startsWith('zh-') ? 0 : (b.meta?.locale as string)?.startsWith('ja-') ? 1 : 2
          return aScore - bScore
        })

      return this.voiceList
    } catch (error) {
      console.error('[AzureTTS] 获取语音列表失败:', error)
      return []
    } finally {
      this.voiceListLoading = false
    }
  }

  buildAudioUrl(text: string): string | null {
    const config = this.getConfig()
    const providerCfg = (config.providers as Record<string, unknown>)?.azure as AzureProviderConfig | undefined
    const speechInfo = config.speechInfo ?? {}

    const url = new URL(`${TTS_API_URL}azure`)
    url.searchParams.set('text', text)
    url.searchParams.set('voice', providerCfg?.azureVoice ?? 'zh-CN-XiaoxiaoNeural')
    url.searchParams.set('language', providerCfg?.azureLanguage ?? 'zh-CN')
    url.searchParams.set('rate', String(speechInfo.rate ?? 1))
    url.searchParams.set('pitch', String(speechInfo.pitch ?? 1))
    url.searchParams.set('streaming', 'true')
    return url.toString()
  }

  speak(): void {
    // Azure 通过 audio 元素播放，由 store 设置 src
  }

  stop(): void {
    // audio 元素的 stop 由 store 处理
  }
}
