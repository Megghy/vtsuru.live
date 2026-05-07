import EasySpeech from 'easy-speech'
import type { ConfigSource, VoiceOption, VoiceProvider } from './types'

export class LocalVoiceProvider implements VoiceProvider {
  readonly id = 'local'
  readonly name = '本地语音'
  readonly description = '使用浏览器内置的语音合成功能'
  readonly isAudioProvider = false

  private initialized = false

  constructor(private getConfig: ConfigSource) {}

  async initialize(): Promise<void> {
    if (this.initialized) return
    await EasySpeech.init({ maxTimeout: 5000, interval: 250 })
    this.initialized = true
  }

  getVoices(): VoiceOption[] {
    const displayNames = new Intl.DisplayNames(['zh'], { type: 'language' })
    return EasySpeech.voices().map((v) => ({
      label: `[${displayNames.of(v.lang)}] ${v.name}`,
      value: v.name,
      meta: { lang: v.lang },
    }))
  }

  speak(text: string): Promise<void> {
    const config = this.getConfig()
    const speechInfo = config.speechInfo ?? {}
    const synth = window.speechSynthesis
    if (!synth) {
      console.error('[LocalTTS] 浏览器不支持语音合成')
      return Promise.reject(new Error('浏览器不支持语音合成'))
    }

    synth.cancel()
    const u = new SpeechSynthesisUtterance()
    u.text = text

    const voices = synth.getVoices()
    const voice = voices.find((v) => v.name === speechInfo.voice)
    if (voice) u.voice = voice

    u.volume = speechInfo.volume ?? 1
    u.rate = speechInfo.rate ?? 1
    u.pitch = speechInfo.pitch ?? 1

    return new Promise<void>((resolve, reject) => {
      u.onend = () => resolve()
      u.onerror = (event) => {
        if (event.error === 'interrupted') {
          resolve()
          return
        }
        reject(new Error(event.error))
      }

      synth.speak(u)
    })
  }

  stop(): void {
    window.speechSynthesis?.cancel()
    EasySpeech.cancel()
  }
}
