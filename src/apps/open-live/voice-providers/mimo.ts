import { TTS_API_URL } from '@/shared/config'
import { ACCOUNT } from '@/api/account'
import type { ConfigSource, VoiceOption, VoiceProvider } from './types'
import { createMimoClient, synthesizeMimoTts, type MimoTtsRequest } from './ai-client'
import { ensureVoiceAudio } from './mimo-voice-store'

export const DEFAULT_MIMO_VOICE = '冰糖'

export interface MimoCustomVoiceInfo {
  id: number
  name: string
  type: 'clone' | 'design'
  description?: string
  directorNote?: string
  audioUrl?: string
}

interface MimoProviderConfig {
  mimoVoice?: string
  mimoStyleTag?: string
  mimoApiKey?: string
}

export class MimoVoiceProvider implements VoiceProvider {
  readonly id = 'mimo'
  readonly name = 'MiMo TTS'
  readonly description = '使用小米 MiMo 语音合成服务，支持风格标签控制'
  readonly isAudioProvider = true

  constructor(private getConfig: ConfigSource) {}

  private voiceList: VoiceOption[] = []
  private voiceListRequest?: Promise<VoiceOption[]>
  private _customVoices = new Map<string, MimoCustomVoiceInfo>()

  setCustomVoices(voices: MimoCustomVoiceInfo[]) {
    this._customVoices.clear()
    for (const v of voices) this._customVoices.set(String(v.id), v)
  }

  async initialize(): Promise<void> {}

  async getVoices(): Promise<VoiceOption[]> {
    if (this.voiceList.length > 0) return this.voiceList
    this.voiceListRequest ??= this.fetchVoiceList()
    return this.voiceListRequest
  }

  private async fetchVoiceList(): Promise<VoiceOption[]> {
    try {
      const response = await fetch(`${TTS_API_URL}voices?provider=mimo`)
      if (!response.ok) throw new Error('获取 MiMo 音色列表失败')

      const voices = await response.json()
      this.voiceList = voices.map((voice: any) => {
        const id = voice.id ?? voice.Id
        const name = voice.name ?? voice.Name ?? id
        const language = voice.language ?? voice.Language
        const gender = voice.gender ?? voice.Gender
        const langText = language === 'zh' ? '中' : language === 'en' ? '英' : ''
        const genderText = gender === 'Male' ? '男' : gender === 'Female' ? '女' : ''
        const tags = [langText, genderText].filter(Boolean).join('·')
        return {
          label: tags ? `${name}  ${tags}` : name,
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

  get fetchAudio(): ((text: string) => Promise<Blob>) | undefined {
    const cfg = this.readConfig()
    if (!cfg.mimoApiKey) return undefined
    return async (text: string) => this._directSynthesize(text, cfg)
  }

  private async _directSynthesize(text: string, cfg: MimoProviderConfig): Promise<Blob> {
    const client = createMimoClient(cfg.mimoApiKey)
    const voice = cfg.mimoVoice ?? DEFAULT_MIMO_VOICE

    let req: MimoTtsRequest
    if (voice.startsWith('custom:')) {
      req = await this._buildCustomRequest(text, voice, cfg)
    } else {
      const content = `${cfg.mimoStyleTag ?? ''}${text}`
      req = {
        model: 'mimo-v2.5-tts',
        messages: [{ role: 'assistant', content }],
        audio: { format: 'wav', voice },
      }
    }

    return synthesizeMimoTts(client, req)
  }

  private async _buildCustomRequest(text: string, voice: string, _cfg: MimoProviderConfig): Promise<MimoTtsRequest> {
    const voiceId = voice.replace('custom:', '')
    const voiceInfo = this._customVoices.get(voiceId)
    if (!voiceInfo) throw new Error(`未找到自定义音色 (id=${voiceId})`)

    if (voiceInfo.type === 'design') {
      if (!voiceInfo.description) throw new Error('音色描述为空')
      const userContent = voiceInfo.directorNote
        ? `${voiceInfo.description}\n${voiceInfo.directorNote}`
        : voiceInfo.description
      return {
        model: 'mimo-v2.5-tts-voicedesign',
        messages: [
          { role: 'user', content: userContent },
          { role: 'assistant', content: text },
        ],
        audio: { format: 'wav' },
      }
    }

    if (!voiceInfo.audioUrl) throw new Error('音色缺少音频 URL')
    const stored = await ensureVoiceAudio(voiceId, voiceInfo.audioUrl, voiceInfo.name)

    const arrayBuf = await stored.blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuf)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
    }
    const audioDataUrl = `data:${stored.mimeType};base64,${btoa(binary)}`

    const messages: Array<{ role: string; content: string }> = []
    if (voiceInfo.directorNote) messages.push({ role: 'user', content: voiceInfo.directorNote })
    messages.push({ role: 'assistant', content: text })

    return {
      model: 'mimo-v2.5-tts-voiceclone',
      messages,
      audio: { format: 'wav', voice: audioDataUrl },
    }
  }

  buildAudioUrl(text: string): string | null {
    const cfg = this.readConfig()
    if (cfg.mimoApiKey) return null

    const voice = cfg.mimoVoice ?? DEFAULT_MIMO_VOICE

    if (voice.startsWith('custom:')) {
      const voiceId = voice.replace('custom:', '')
      const url = new URL(`${TTS_API_URL}mimo/custom`)
      url.searchParams.set('text', text)
      url.searchParams.set('voiceId', voiceId)
      if (ACCOUNT.value?.token) url.searchParams.set('token', ACCOUNT.value.token)
      return url.toString()
    }

    const url = new URL(`${TTS_API_URL}mimo`)
    url.searchParams.set('text', text)
    url.searchParams.set('voice', voice)
    if (cfg.mimoStyleTag) url.searchParams.set('styleTag', cfg.mimoStyleTag)
    return url.toString()
  }

  speak(): void {}
  stop(): void {}

  private readConfig(): MimoProviderConfig {
    return (this.getConfig().providers?.mimo ?? {}) as MimoProviderConfig
  }
}
