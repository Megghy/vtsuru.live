import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'

export type GiftBoardTab = 'ranking' | 'thanks' | 'guards'
export type GiftBoardViewMode = GiftBoardTab | 'auto_cycle'

export interface GiftBoardRankingItem {
  id: string
  uname: string
  uface?: string
  totalPaid: number
  guardLevel?: number
}

export interface GiftBoardThanksItem {
  id: string
  uname: string
  uface?: string
  kind: 'gift' | 'sc' | 'guard'
  itemName: string
  count: number
  totalPrice: number
  guardLevel?: number
  updatedAt: number
}

export interface GiftBoardGuardItem {
  id: string
  uname: string
  uface?: string
  guardLevel: number
  count: number
  price: number
  updatedAt: number
}

export interface GiftBoardState {
  theme: ObsWidgetTheme
  viewMode: GiftBoardViewMode
  cycleIntervalSec: number
  accentColor: string
  fontFamily: string
  titleRanking: string
  titleThanks: string
  titleGuards: string
  maxItems: number
  autoScroll: boolean
  showEmptySample: boolean
  showAvatar: boolean
  showPrice: boolean
  ranking: GiftBoardRankingItem[]
  thanks: GiftBoardThanksItem[]
  guards: GiftBoardGuardItem[]
}

export type GiftBoardAction = { type: 'SWITCH_TAB'; tab: GiftBoardTab }

export const SAMPLE_GIFT_BOARD_RANKING: GiftBoardRankingItem[] = [
  { id: 'sample-r1', uname: '星海巡航官', totalPaid: 1998, guardLevel: 2 },
  { id: 'sample-r2', uname: '早安打call机', totalPaid: 520, guardLevel: 3 },
  { id: 'sample-r3', uname: '奶油泡芙控', totalPaid: 298, guardLevel: 3 },
  { id: 'sample-r4', uname: '深夜码农喵', totalPaid: 158 },
  { id: 'sample-r5', uname: '云端漫步者', totalPaid: 88 },
  { id: 'sample-r6', uname: '脆脆鲨选手', totalPaid: 52 },
]

export const SAMPLE_GIFT_BOARD_THANKS: GiftBoardThanksItem[] = [
  {
    id: 'sample-t1',
    uname: '星海巡航官',
    kind: 'guard',
    itemName: '提督',
    count: 1,
    totalPrice: 1998,
    guardLevel: 2,
    updatedAt: 1,
  },
  {
    id: 'sample-t2',
    uname: '早安打call机',
    kind: 'sc',
    itemName: '今天歌回太好听啦！',
    count: 1,
    totalPrice: 50,
    guardLevel: 3,
    updatedAt: 2,
  },
  {
    id: 'sample-t3',
    uname: '奶油泡芙控',
    kind: 'gift',
    itemName: '璀璨星河',
    count: 3,
    totalPrice: 156,
    guardLevel: 3,
    updatedAt: 3,
  },
  {
    id: 'sample-t4',
    uname: '深夜码农喵',
    kind: 'gift',
    itemName: '魔法书',
    count: 5,
    totalPrice: 99,
    updatedAt: 4,
  },
  {
    id: 'sample-t5',
    uname: '云端漫步者',
    kind: 'gift',
    itemName: '小花花',
    count: 20,
    totalPrice: 20,
    updatedAt: 5,
  },
]

export const SAMPLE_GIFT_BOARD_GUARDS: GiftBoardGuardItem[] = [
  { id: 'sample-g1', uname: '银河总司令', guardLevel: 1, count: 1, price: 19998, updatedAt: 1 },
  { id: 'sample-g2', uname: '星海巡航官', guardLevel: 2, count: 1, price: 1998, updatedAt: 2 },
  { id: 'sample-g3', uname: '早安打call机', guardLevel: 3, count: 1, price: 198, updatedAt: 3 },
  { id: 'sample-g4', uname: '奶油泡芙控', guardLevel: 3, count: 2, price: 396, updatedAt: 4 },
  { id: 'sample-g5', uname: '蓝莓芝士酱', guardLevel: 3, count: 1, price: 198, updatedAt: 5 },
]

export const DEFAULT_GIFT_BOARD_STATE: GiftBoardState = {
  theme: 'card',
  viewMode: 'ranking',
  cycleIntervalSec: 10,
  accentColor: '#f59e0b',
  fontFamily: '',
  titleRanking: '本场投喂排行',
  titleThanks: '实时感谢流',
  titleGuards: '本场大航海',
  maxItems: 8,
  autoScroll: true,
  showEmptySample: true,
  showAvatar: true,
  showPrice: true,
  ranking: [],
  thanks: [],
  guards: [],
}

export function getGuardLevelMeta(level?: number): { label: string; tone: 'zongdu' | 'tidu' | 'jianzhang' } | null {
  if (level === 1) return { label: '总督', tone: 'zongdu' }
  if (level === 2) return { label: '提督', tone: 'tidu' }
  if (level === 3) return { label: '舰长', tone: 'jianzhang' }
  return null
}

export function formatYuan(value?: number): string {
  if (!value || !Number.isFinite(value)) return '￥0'
  const fixed = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return `￥${fixed}`
}

export function getAvatarInitial(name?: string): string {
  const trimmed = (name || '').trim()
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : '?'
}
