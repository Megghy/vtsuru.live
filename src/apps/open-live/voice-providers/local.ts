import EasySpeech from 'easy-speech'
import { clearInterval, setInterval } from 'worker-timers'

import type { ConfigSource, VoiceOption, VoiceProvider } from './types'

const RESUME_CHECK_INTERVAL = 1000

export class LocalVoiceProvider implements VoiceProvider {
  readonly id = 'local'
  readonly name = '本地语音'
  readonly description = '使用浏览器内置的语音合成功能'
  readonly isAudioProvider = false

  private initialized = false
  private utterance: SpeechSynthesisUtterance | undefined
  private finishCurrent: (() => void) | undefined
  private resumeTimer: number | undefined

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

  async speak(text: string): Promise<void> {
    const config = this.getConfig()
    const speechInfo = config.speechInfo ?? {}
    const synth = window.speechSynthesis
    if (!synth) {
      console.error('[LocalTTS] 浏览器不支持语音合成')
      return Promise.reject(new Error('浏览器不支持语音合成'))
    }

    this.stop()
    const utterance = new SpeechSynthesisUtterance(text)
    this.utterance = utterance

    const voices = synth.getVoices()
    const voice = voices.find((v) => v.name === speechInfo.voice)
    if (voice) utterance.voice = voice

    utterance.volume = speechInfo.volume ?? 1
    utterance.rate = speechInfo.rate ?? 1
    utterance.pitch = speechInfo.pitch ?? 1

    return new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        if (this.utterance !== utterance) return
        this.clearCurrent()
        if (error) reject(error)
        else resolve()
      }

      this.finishCurrent = () => finish()
      utterance.onend = () => finish()
      utterance.onerror = ({ error }) => {
        finish(error === 'interrupted' || error === 'canceled' ? undefined : new Error(error))
      }

      this.resumeTimer = setInterval(this.resumeIfPaused, RESUME_CHECK_INTERVAL)
      globalThis.setTimeout(() => {
        if (this.utterance !== utterance) return
        if (synth.paused) synth.resume()
        synth.speak(utterance)
      }, 0)
    })
  }

  stop(): void {
    const finish = this.finishCurrent
    finish?.()
    window.speechSynthesis?.cancel()
  }

  private readonly resumeIfPaused = () => {
    if (this.utterance && window.speechSynthesis.paused) window.speechSynthesis.resume()
  }

  private clearCurrent() {
    if (this.resumeTimer !== undefined) {
      clearInterval(this.resumeTimer)
      this.resumeTimer = undefined
    }
    if (this.utterance) {
      this.utterance.onend = null
      this.utterance.onerror = null
      this.utterance = undefined
    }
    this.finishCurrent = undefined
  }
}
