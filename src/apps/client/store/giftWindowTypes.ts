import type { EventDataTypes, GuardLevel } from '@/api/generated/model'

export type GiftSortBy = 'time' | 'price' | 'num'
export type GiftFilterType = 'Gift' | 'SC' | 'Guard'
export type RankViewMode = 'thank_summary' | 'rank' | 'online_guard' | 'online_viewers'

export interface GiftWindowSettings {
  width: number
  height: number
  x: number
  y: number
  opacity: number
  fontSize: number
  fontFamily?: string
  backgroundColor: string
  windowBackgroundColor: string
  textColor: string
  highlightColor: string
  alwaysOnTop: boolean
  interactive: boolean
  borderRadius: number
  itemSpacing: number
  maxItemCount: number
  autoDisappearTime: number
  mergeWindowSeconds: number
  showAvatar: boolean
  showPrice: boolean
  showTime: boolean
  filterTypes: GiftFilterType[]
  sortBy: GiftSortBy
  minPrice: number
  reverseOrder: boolean
  compactMode: boolean
  showGiftList: boolean
  showRanking: boolean
  rankDisplayCount: number
  rankViewMode: RankViewMode
  showScrollbar: boolean
  onlineThresholdMinutes: number
  contentProtected?: boolean
}

export interface GiftEntry {
  id: string
  uid: number
  uname: string
  uface: string
  giftName: string
  giftIcon?: string
  totalNum: number
  totalPrice: number // 单位：人民币元
  type: EventDataTypes
  guardLevel: GuardLevel
  firstTime: number
  lastUpdateTime: number
  disappearAt?: number
}

export const GIFT_WINDOW_BROADCAST_CHANNEL = 'channel.gift.window'

export interface RankEntry {
  id: string
  uid: number
  uname: string
  uface: string
  totalPaid: number // 单位：人民币元
  score: number
  guardLevel: GuardLevel
  isOnline: boolean
  lastActiveTime: number
}

export interface OnlineGuardEntry {
  id: string
  uid: number
  uname: string
  uface: string
  guardLevel: GuardLevel
  lastActiveTime: number
  lastAction: string
  totalPaid: number
  rankIndex?: number
}

export interface OnlineViewerEntry {
  id: string
  uid: number
  uname: string
  uface: string
  guardLevel: GuardLevel
  isFormerGuard: boolean
  medalName?: string
  medalLevel?: number
  score?: number
  isOnline: boolean
  lastActiveTime: number
  lastAction: string
}

export interface ThankSummaryItem {
  id: string
  uid: number
  uname: string
  uface: string
  totalPaid: number
  guardLevel: GuardLevel
  isOnline: boolean
  lastActiveTime: number
  isTopRank: boolean
  rankIndex?: number
  isGuardOnly: boolean
}

export type GiftWindowBCData =
  | { type: 'gift-list'; data: GiftEntry[] }
  | { type: 'rank-list'; data: RankEntry[] }
  | { type: 'online-guard-list'; data: OnlineGuardEntry[] }
  | { type: 'online-viewer-list'; data: OnlineViewerEntry[] }
  | { type: 'update-setting'; data: GiftWindowSettings }
  | { type: 'window-ready' }
  | { type: 'clear' }

export interface UserActivityState {
  id: string
  uid: number
  uname: string
  uface: string
  guardLevel: GuardLevel
  isFormerGuard?: boolean
  medalName?: string
  medalLevel?: number
  score?: number
  lastActiveTime: number
  lastAction: string
}

export const DEFAULT_GIFT_WINDOW_SETTINGS: GiftWindowSettings = {
  width: 340,
  height: 560,
  x: 100,
  y: 100,
  opacity: 0.95,
  fontSize: 14,
  fontFamily: '',
  backgroundColor: 'rgba(20,20,30,0.85)',
  windowBackgroundColor: 'rgba(10,10,20,0.6)',
  textColor: '#ffffff',
  highlightColor: '#fbbf24',
  alwaysOnTop: true,
  interactive: false,
  borderRadius: 10,
  itemSpacing: 8,
  maxItemCount: 30,
  autoDisappearTime: 60,
  mergeWindowSeconds: 10,
  showAvatar: true,
  showPrice: true,
  showTime: true,
  filterTypes: ['Gift', 'SC', 'Guard'],
  sortBy: 'time',
  minPrice: 0,
  reverseOrder: false,
  compactMode: false,
  showGiftList: true,
  showRanking: true,
  rankDisplayCount: 50,
  rankViewMode: 'thank_summary',
  showScrollbar: true,
  onlineThresholdMinutes: 20,
  contentProtected: false,
}
