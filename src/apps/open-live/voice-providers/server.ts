import { TTS_API_URL } from '@/shared/config'

import type { ConfigSource, VoiceOption, VoiceProvider } from './types'

export class ServerVoiceProvider implements VoiceProvider {
  readonly description = '第三方语音渠道，不保证可用性'
  readonly isAudioProvider = true

  constructor(
    readonly id: string,
    readonly name: string,
    private getConfig: ConfigSource,
  ) {}

  async initialize(): Promise<void> {}

  async getVoices(): Promise<VoiceOption[]> {
    const response = await this.request(`voices?provider=${this.id}`)
    const voices: Array<{ id: string; name: string }> = await response.json()
    return voices.map((voice) => ({ label: voice.name, value: voice.id }))
  }

  async fetchAudio(text: string): Promise<Blob> {
    const config = this.getConfig()
    const provider = config.providers[this.id]
    const response = await this.request('synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: this.id,
        text,
        voice: provider.voice,
        language: provider.language,
        rate: config.speechInfo.rate,
      }),
    })
    return response.blob()
  }

  speak(): void {}
  stop(): void {}

  private async request(path: string, options?: RequestInit): Promise<Response> {
    const response = await fetch(`${TTS_API_URL}${path}`, { ...options, signal: AbortSignal.timeout(65_000) })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.details || error?.error || `${this.name} 请求失败: ${response.status}`)
    }
    return response
  }
}
