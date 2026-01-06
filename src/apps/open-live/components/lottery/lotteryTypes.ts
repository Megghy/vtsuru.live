import type { OpenLiveLotteryUserInfo } from '@/api/api-models'

export interface LotteryOption {
  resultCount: number
  lotteryType: 'single' | 'half' | 'flip' | 'wheel' | 'cards' | 'elimination'
  type: 'danmaku' | 'gift'
  danmakuFilterType: 'all' | 'contains' | 'regex'
  danmakuKeyword: string
  needFanMedal: boolean
  needWearFanMedal: boolean
  needGuard: boolean
  fanCardLevel?: number
  giftMinPrice?: number
  giftName?: string
  animationSpeed: number
}

export interface LotteryHistory {
  users: OpenLiveLotteryUserInfo[]
  time: number
}

export interface ManualUserFormModel {
  name: string
  avatar: string
  fans_medal_level: number
  fans_medal_name: string
  guard_level: number
}

