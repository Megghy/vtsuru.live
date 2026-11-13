export type GoalMode = 'goal' | 'subathon' | 'combo'
export type GoalMetric = 'guard' | 'amount' | 'manual'
export type GoalTheme = 'minimal' | 'card' | 'neon' | 'glass'

export interface GoalState {
  title: string
  subtitle: string
  mode: GoalMode
  metric: GoalMetric
  current: number
  target: number
  unit: string
  /** 耐久加钟结束时间戳 (ms) */
  countdownEndAt: number
  /** 暂停时的剩余毫秒数 */
  pausedRemainingMs: number
  countdownPaused: boolean
  /** 每次 1 元礼物/SC 增加的耐久秒数 */
  secondsPerYuan: number
  /** 上舰（舰长/提督/总督）增加秒数 */
  secondsPerJianzhang: number
  secondsPerTidu: number
  secondsPerZongdu: number
  /** 最后一次加钟提示（用于画面飘字） */
  lastDeltaTick: number
  lastDeltaText: string
  /** 目标是否允许超出 100% 展示 */
  allowOverflow: boolean
  /** 视觉样式 */
  theme: GoalTheme
  accentColor: string
  showPercent: boolean
}

export type GoalAction =
  | { type: 'DELTA_TIME'; seconds: number; label: string }
  | { type: 'DELTA_PROGRESS'; amount: number; label: string }
  | { type: 'RESET' }

export const DEFAULT_GOAL_STATE: GoalState = {
  title: '本月舰长目标',
  subtitle: '感谢每一位支持的小伙伴',
  mode: 'combo',
  metric: 'guard',
  current: 0,
  target: 30,
  unit: '舰',
  countdownEndAt: 0,
  pausedRemainingMs: 3600 * 1000,
  countdownPaused: true,
  secondsPerYuan: 15,
  secondsPerJianzhang: 300,
  secondsPerTidu: 900,
  secondsPerZongdu: 1800,
  lastDeltaTick: 0,
  lastDeltaText: '',
  allowOverflow: true,
  theme: 'card',
  accentColor: '#f43f5e',
  showPercent: true,
}
