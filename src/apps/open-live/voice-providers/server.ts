import { cookie } from '@/api/auth'
import { getTtsApiUrl } from '@/shared/config'

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
    const voices = await response.json()
    if (!Array.isArray(voices)) {
      throw new Error(voices?.message || `${this.name} 获取音色列表失败`)
    }
    return voices.map((voice: { id: string; name: string }) => ({ label: voice.name, value: voice.id }))
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
    if (response.headers?.get('content-type')?.includes('application/json')) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.details || error?.error || error?.message || `${this.name} 请求失败`)
    }
    return response.blob()
  }

  speak(): void {}
  stop(): void {}

  private async request(path: string, options?: RequestInit): Promise<Response> {
    const headers = new Headers(options?.headers)
    if (!headers.has('Authorization') && cookie.value?.cookie) {
      headers.set('Authorization', `Bearer ${cookie.value.cookie}`)
    }
    const response = await fetch(`${getTtsApiUrl()}${path}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(65_000),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.details || error?.error || `${this.name} 请求失败: ${response.status}`)
    }
    return response
  }
}
