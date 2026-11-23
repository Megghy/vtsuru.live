import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'

export type MysteryBoxViewMode = 'full' | 'compact'

export interface MysteryBoxGiftStat {
  name: string
  count: number
  totalValue: number
}

export interface MysteryBoxUserStat {
  key: string
  uname: string
  uface?: string
  opens: number
  totalCost: number
  totalValue: number
  netProfit: number
}

export interface MysteryBoxLastPull {
  id: string
  uname: string
  boxName: string
  giftName: string
  num: number
  cost: number
  value: number
  profit: number
  timestamp: number
}

export interface MysteryBoxState {
  title: string
  theme: ObsWidgetTheme
  accentColor: string
  fontFamily: string
  viewMode: MysteryBoxViewMode
  /** 逗号分隔的盲盒名关键词，留空则追踪所有携带 mystery_box_name 的盲盒礼物 */
  boxKeywords: string
  /** 当礼物未携带 mystery_box_price 时的单盒成本回退值（元） */
  fallbackBoxPrice: number
  showRankings: boolean
  showGiftStats: boolean
  totalOpens: number
  totalCost: number
  totalValue: number
  giftStats: MysteryBoxGiftStat[]
  userStats: MysteryBoxUserStat[]
  lastPull: MysteryBoxLastPull | null
}

export type MysteryBoxAction = { type: 'PULL_FLASH'; pull: MysteryBoxLastPull } | { type: 'RESET' }

export const DEFAULT_MYSTERY_BOX_STATE: MysteryBoxState = {
  title: '盲盒盈亏统计',
  theme: 'card',
  accentColor: '#f59e0b',
  fontFamily: '',
  viewMode: 'full',
  boxKeywords: '',
  fallbackBoxPrice: 15,
  showRankings: true,
  showGiftStats: true,
  totalOpens: 0,
  totalCost: 0,
  totalValue: 0,
  giftStats: [],
  userStats: [],
  lastPull: null,
}

export function roundYuan(value: number): number {
  return Math.round(value * 100) / 100
}

export function formatYuan(value: number, signed = false): string {
  const rounded = roundYuan(value)
  const abs = Math.abs(rounded)
  const text = Number.isInteger(abs) ? String(abs) : abs.toFixed(2).replace(/\.?0+$/, '')
  if (signed) {
    if (rounded > 0) return `+¥${text}`
    if (rounded < 0) return `-¥${text}`
    return '¥0'
  }
  return rounded < 0 ? `-¥${text}` : `¥${text}`
}

export function applyMysteryBoxPull(
  prev: MysteryBoxState,
  input: {
    userKey: string
    uname: string
    uface?: string
    boxName: string
    giftName: string
    num: number
    cost: number
    value: number
    timestamp?: number
  },
): { patch: Partial<MysteryBoxState>; pull: MysteryBoxLastPull } {
  const num = Math.max(1, Math.trunc(input.num))
  const cost = Math.max(0, roundYuan(input.cost))
  const value = Math.max(0, roundYuan(input.value))
  const profit = roundYuan(value - cost)
  const timestamp = input.timestamp ?? Date.now()

  const pull: MysteryBoxLastPull = {
    id: `${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
    uname: input.uname.trim() || '神秘观众',
    boxName: input.boxName.trim() || '盲盒',
    giftName: input.giftName.trim() || '未知礼物',
    num,
    cost,
    value,
    profit,
    timestamp,
  }

  const nextGiftStats = prev.giftStats.map((g) => ({ ...g }))
  const existingGift = nextGiftStats.find((g) => g.name === pull.giftName)
  if (existingGift) {
    existingGift.count += num
    existingGift.totalValue = roundYuan(existingGift.totalValue + value)
  } else {
    nextGiftStats.push({
      name: pull.giftName,
      count: num,
      totalValue: value,
    })
  }
  nextGiftStats.sort((a, b) => b.totalValue - a.totalValue || b.count - a.count)

  const nextUserStats = prev.userStats.map((u) => ({ ...u }))
  const userKey = input.userKey || pull.uname
  const existingUser = nextUserStats.find((u) => u.key === userKey)
  if (existingUser) {
    existingUser.uname = pull.uname
    if (input.uface) existingUser.uface = input.uface
    existingUser.opens += num
    existingUser.totalCost = roundYuan(existingUser.totalCost + cost)
    existingUser.totalValue = roundYuan(existingUser.totalValue + value)
    existingUser.netProfit = roundYuan(existingUser.totalValue - existingUser.totalCost)
  } else {
    nextUserStats.push({
      key: userKey,
      uname: pull.uname,
      uface: input.uface,
      opens: num,
      totalCost: cost,
      totalValue: value,
      netProfit: profit,
    })
  }

  // 控制列表上限，同时保留欧皇榜与非酋榜极值用户
  let trimmedUsers = nextUserStats
  if (nextUserStats.length > 60) {
    const byProfitDesc = nextUserStats.toSorted((a, b) => b.netProfit - a.netProfit)
    const keep = new Map<string, MysteryBoxUserStat>()
    for (const u of byProfitDesc.slice(0, 30)) keep.set(u.key, u)
    for (const u of byProfitDesc.slice(-30)) keep.set(u.key, u)
    trimmedUsers = [...keep.values()]
  }

  return {
    pull,
    patch: {
      totalOpens: prev.totalOpens + num,
      totalCost: roundYuan(prev.totalCost + cost),
      totalValue: roundYuan(prev.totalValue + value),
      giftStats: nextGiftStats.slice(0, 24),
      userStats: trimmedUsers,
      lastPull: pull,
    },
  }
}
