export interface WheelSegment {
  id: string
  label: string
  color: string
  weight: number
}

export interface WheelSpinRecord {
  spinId: string
  targetIndex: number
  winnerLabel: string
  targetAngleDeg: number
  durationMs: number
  startedAt: number
}

export type WheelTheme = 'classic' | 'neon' | 'pastel'

export interface WheelState {
  title: string
  segments: WheelSegment[]
  durationMs: number
  soundEnabled: boolean
  proportionalAngles: boolean
  theme: WheelTheme
  pointerColor: string
  sizePx: number
  /** 仅用于跨端同步同一次开奖动画与落点 */
  lastSpin: WheelSpinRecord | null
}

export type WheelAction = { type: 'SPIN'; spin: WheelSpinRecord } | { type: 'RESET_ROTATION' }

export const DEFAULT_WHEEL_SEGMENTS: WheelSegment[] = [
  { id: '1', label: '再来一次', color: '#f43f5e', weight: 2 },
  { id: '2', label: '唱一首歌', color: '#3b82f6', weight: 3 },
  { id: '3', label: '猫耳佩戴 5 分钟', color: '#8b5cf6', weight: 2 },
  { id: '4', label: '表情包三连拍', color: '#10b981', weight: 2 },
  { id: '5', label: '真心话一题', color: '#f59e0b', weight: 2 },
  { id: '6', label: '水杯干杯', color: '#06b6d4', weight: 3 },
]

export const WHEEL_PRESETS: Record<string, { name: string; title: string; segments: WheelSegment[] }> = {
  punish: {
    name: '整活惩罚转盘',
    title: '惩罚大转盘',
    segments: DEFAULT_WHEEL_SEGMENTS,
  },
  song: {
    name: '歌回随机盲抽',
    title: '今天唱哪首',
    segments: [
      { id: 's1', label: '拿手曲目', color: '#ec4899', weight: 3 },
      { id: 's2', label: '二次元燃曲', color: '#6366f1', weight: 3 },
      { id: 's3', label: '抒情慢歌', color: '#14b8a6', weight: 2 },
      { id: 's4', label: '挑战高难度', color: '#f97316', weight: 1 },
      { id: 's5', label: '清唱一段', color: '#8b5cf6', weight: 2 },
    ],
  },
  gift: {
    name: '福利抽奖转盘',
    title: '舰长福利池',
    segments: [
      { id: 'g1', label: '感谢参与', color: '#64748b', weight: 5 },
      { id: 'g2', label: '手写签名卡', color: '#f43f5e', weight: 2 },
      { id: 'g3', label: '点歌特权一次', color: '#3b82f6', weight: 3 },
      { id: 'g4', label: '定制语音条', color: '#10b981', weight: 2 },
      { id: 'g5', label: '神秘周边一份', color: '#eab308', weight: 1 },
    ],
  },
}

export const DEFAULT_WHEEL_STATE: WheelState = {
  title: '整活大转盘',
  segments: DEFAULT_WHEEL_SEGMENTS,
  durationMs: 4500,
  soundEnabled: true,
  proportionalAngles: true,
  theme: 'classic',
  pointerColor: '#f43f5e',
  sizePx: 420,
  lastSpin: null,
}
