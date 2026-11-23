import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'

export type VoiceAvatarsLayout = 'row' | 'column' | 'grid'
export type VoiceAvatarShape = 'circle' | 'rounded'

export const MAX_VOICE_MEMBERS = 8

export interface VoiceAvatarMember {
  id: string
  name: string
  avatarUrl: string
  accentColor: string
  bindMic: boolean
}

export interface VoiceAvatarsState {
  theme: ObsWidgetTheme
  fontFamily: string
  layout: VoiceAvatarsLayout
  shape: VoiceAvatarShape
  avatarSize: number
  gap: number
  hideMuted: boolean
  showName: boolean
  /** 麦克风 VAD 触发阈值（1 - 60） */
  vadThreshold: number
  members: VoiceAvatarMember[]
}

export type VoiceAvatarsAction =
  | { type: 'SPEAKING_STATE'; memberId: string; speaking: boolean; level: number }
  | { type: 'RESET_ALL_SPEAKING' }

export const DEFAULT_VOICE_AVATARS_STATE: VoiceAvatarsState = {
  theme: 'minimal',
  fontFamily: '',
  layout: 'row',
  shape: 'circle',
  avatarSize: 78,
  gap: 20,
  hideMuted: false,
  showName: true,
  vadThreshold: 12,
  members: [
    {
      id: 'member-1',
      name: '主播',
      avatarUrl: '',
      accentColor: '#38bdf8',
      bindMic: true,
    },
    {
      id: 'member-2',
      name: '嘉宾 A',
      avatarUrl: '',
      accentColor: '#f43f5e',
      bindMic: false,
    },
    {
      id: 'member-3',
      name: '嘉宾 B',
      avatarUrl: '',
      accentColor: '#10b981',
      bindMic: false,
    },
  ],
}

export function getMemberMonogram(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '?'
}
