import { GoodsSalePhase, GoodsStatus, GoodsTypes, GuardLevel } from '@/api/generated/model'
import type { ResponseBasePointGoodsModel, ResponseUserCheckInModel } from '@/api/generated/model'
import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'

export type PointShowcaseMode = 'goods' | 'checkin' | 'cycle'

export interface PointShowcaseState {
  mode: PointShowcaseMode
  title: string
  ctaText: string
  rotateIntervalSeconds: number
  maxItems: number
  theme: ObsWidgetTheme
  accentColor: string
  fontFamily: string
  useSampleData: boolean
}

export type PointShowcaseAction = { type: 'REFRESH' } | { type: 'NEXT_SLIDE' }

export const POINT_SHOWCASE_MODE_OPTIONS: { label: string; value: PointShowcaseMode }[] = [
  { label: '自动轮播', value: 'cycle' },
  { label: '积分商品', value: 'goods' },
  { label: '签到排行', value: 'checkin' },
]

export const DEFAULT_POINT_SHOWCASE_STATE: PointShowcaseState = {
  mode: 'cycle',
  title: '积分商城 · 签到榜',
  ctaText: '直播间发送「签到」领积分兑换好礼',
  rotateIntervalSeconds: 8,
  maxItems: 5,
  theme: 'card',
  accentColor: '#f59e0b',
  fontFamily: '',
  useSampleData: false,
}

export const SAMPLE_POINT_GOODS: ResponseBasePointGoodsModel[] = [
  {
    id: -1,
    name: '限定亚克力立牌（签名版）',
    description: '高透双面印刷 15cm 桌面立牌，含主播手写寄语卡片',
    count: 12,
    price: 1200,
    originalPrice: 1500,
    discountPrice: 1200,
    isOnDiscount: true,
    salePhase: GoodsSalePhase.Active,
    tags: ['热门', '限量'],
    images: [],
    status: GoodsStatus.Normal,
    type: GoodsTypes.Physical,
    isPinned: true,
    isAllowRebuy: false,
    maxBuyCount: 1,
    createAt: 0,
    canFreeBuy: false,
    hasGuardFreePrivilege: false,
    allowGuardLevel: GuardLevel.None,
    purchasedCount: 0,
    soldCount: 28,
    hasPurchased: false,
    canPurchase: true,
  },
  {
    id: -2,
    name: '定制专属起床铃声语音',
    description: '可指定称呼与 30 秒内台词，主播亲自录制发送',
    count: null,
    price: 680,
    originalPrice: 680,
    discountPrice: null,
    isOnDiscount: false,
    salePhase: GoodsSalePhase.Active,
    tags: ['语音', '常驻'],
    images: [],
    status: GoodsStatus.Normal,
    type: GoodsTypes.Virtual,
    isPinned: false,
    isAllowRebuy: true,
    maxBuyCount: 0,
    createAt: 0,
    canFreeBuy: false,
    hasGuardFreePrivilege: false,
    allowGuardLevel: GuardLevel.None,
    purchasedCount: 0,
    soldCount: 64,
    hasPurchased: false,
    canPurchase: true,
  },
  {
    id: -3,
    name: '直播间点歌插队券',
    description: '核销后当场直播优先安排一首你想听的曲目',
    count: 5,
    price: 300,
    originalPrice: 400,
    discountPrice: 300,
    isOnDiscount: true,
    salePhase: GoodsSalePhase.Active,
    tags: ['互动'],
    images: [],
    status: GoodsStatus.Normal,
    type: GoodsTypes.Virtual,
    isPinned: false,
    isAllowRebuy: true,
    maxBuyCount: 2,
    createAt: 0,
    canFreeBuy: false,
    hasGuardFreePrivilege: false,
    allowGuardLevel: GuardLevel.None,
    purchasedCount: 0,
    soldCount: 41,
    hasPurchased: false,
    canPurchase: true,
  },
]

export const SAMPLE_CHECKIN_RANKING: ResponseUserCheckInModel[] = [
  {
    name: '星尘观测者',
    consecutiveDays: 42,
    points: 3860,
    lastCheckInTime: Date.now(),
    isAuthed: true,
    monthlyCheckInCount: 26,
    totalCheckInCount: 118,
  },
  {
    name: '夜航船长',
    consecutiveDays: 31,
    points: 2940,
    lastCheckInTime: Date.now(),
    isAuthed: true,
    monthlyCheckInCount: 24,
    totalCheckInCount: 95,
  },
  {
    name: '柚子茶加冰',
    consecutiveDays: 19,
    points: 2150,
    lastCheckInTime: Date.now(),
    isAuthed: true,
    monthlyCheckInCount: 20,
    totalCheckInCount: 73,
  },
  {
    name: '白日梦游指南',
    consecutiveDays: 14,
    points: 1620,
    lastCheckInTime: Date.now(),
    isAuthed: false,
    monthlyCheckInCount: 18,
    totalCheckInCount: 54,
  },
  {
    name: '云端小猫咪',
    consecutiveDays: 9,
    points: 1180,
    lastCheckInTime: Date.now(),
    isAuthed: false,
    monthlyCheckInCount: 14,
    totalCheckInCount: 39,
  },
]
