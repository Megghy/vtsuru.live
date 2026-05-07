export interface VoiceOption {
  label: string
  value: string | number
  meta?: Record<string, unknown>
  type?: string
  key?: string | number
  children?: VoiceOption[]
  disabled?: boolean
  render?: (props: { node: any; option: any; selected: boolean }) => any
  [key: string]: unknown
}

export interface BaseProviderConfig {
  volume: number
  rate: number
  pitch: number
  voice?: string
}

/** Provider 配置来源：返回当前全局配置快照 */
export type ConfigSource = () => Record<string, any>

export interface VoiceProvider {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly isAudioProvider: boolean

  initialize(): Promise<void>
  getVoices(): Promise<VoiceOption[]> | VoiceOption[]
  speak(text: string, audioRef?: HTMLAudioElement): Promise<void> | void
  stop(): void
  buildAudioUrl?(text: string): string | null
}
