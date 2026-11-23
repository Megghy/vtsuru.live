export type GoalMode = 'goal' | 'subathon' | 'combo'
export type GoalMetric = 'guard' | 'amount' | 'gift_count' | 'fans' | 'likes' | 'manual'
export type GoalTheme = 'minimal' | 'card' | 'neon' | 'glass'

export interface GoalMilestone {
  id: string
  target: number
  label: string
}

export interface GoalState {
  title: string
  subtitle: string
  mode: GoalMode
  metric: GoalMetric
  current: number
  target: number
  unit: string
  /** 单品礼物计数模式下的礼物名称关键词（留空则统计全部礼物个数） */
  targetGiftName: string
  /** 阶段里程碑节点 */
  milestones: GoalMilestone[]
  showMilestones: boolean
  /** OBS 侧已登录时是否直接订阅本地弹幕流作为保活补充 */
  directTrackOnObs: boolean
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
  fontFamily?: string
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
  targetGiftName: '小花花',
  milestones: [
    { id: 'ms-1', target: 10, label: '解锁歌回加场' },
    { id: 'ms-2', target: 20, label: '解锁新服装展示' },
    { id: 'ms-3', target: 30, label: '解锁限定舰长礼' },
  ],
  showMilestones: true,
  directTrackOnObs: false,
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
  fontFamily: '',
  showPercent: true,
}
