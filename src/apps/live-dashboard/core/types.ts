import type { EventModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'

/** 中控台内部统一事件：来源字段归一化 + 已读标记，本地库与内存列表共用 */
export interface DashboardEvent {
  /** 稳定事件 ID，重连/跨标签页重放时用于去重 */
  key: string
  type: EventDataTypes
  /** Unix 毫秒 */
  time: number
  uid: number
  ouid: string
  uname: string
  uface: string
  msg: string
  emoji?: string
  /** 人民币元；免费礼物为 0 */
  price: number
  num: number
  guardLevel: number
  medalLevel: number
  medalName: string
  medalWearing: boolean
  giftIcon?: string
  /** SC message_id，用于 SC 删除事件 */
  scId?: number
  read: boolean
  deleted: boolean
}

/** 顺序即快捷键 Alt+1..n */
export const PANEL_IDS = ['danmaku', 'sc', 'gift', 'vote'] as const
export type PanelId = (typeof PANEL_IDS)[number]

export const PANEL_TITLES: Record<PanelId, string> = {
  danmaku: '弹幕',
  sc: '醒目留言',
  gift: '礼物',
  vote: '投票',
}

/** 付费事件（参与已读、按价格排序） */
export const PAID_TYPES = new Set([EventDataTypes.SC, EventDataTypes.Gift, EventDataTypes.Guard])
/** 互动事件（弹幕面板下方的互动区） */
export const INTERACTION_TYPES = new Set([EventDataTypes.Enter, EventDataTypes.Follow, EventDataTypes.Like])

export const EVENT_TYPE_KEYWORDS: Record<string, EventDataTypes> = {
  message: EventDataTypes.Message,
  superchat: EventDataTypes.SC,
  sc: EventDataTypes.SC,
  gift: EventDataTypes.Gift,
  toast: EventDataTypes.Guard,
  guard: EventDataTypes.Guard,
  enter: EventDataTypes.Enter,
  follow: EventDataTypes.Follow,
  like: EventDataTypes.Like,
}

export const EVENT_TYPE_LABELS: Partial<Record<EventDataTypes, string>> = {
  [EventDataTypes.Message]: '弹幕',
  [EventDataTypes.SC]: '醒目留言',
  [EventDataTypes.Gift]: '礼物',
  [EventDataTypes.Guard]: '大航海',
  [EventDataTypes.Enter]: '进场',
  [EventDataTypes.Follow]: '关注',
  [EventDataTypes.Like]: '点赞',
}

export const GUARD_NAMES: Record<number, string> = { 1: '总督', 2: '提督', 3: '舰长' }

export function panelOf(type: EventDataTypes): 'danmaku' | 'sc' | 'gift' | 'interaction' {
  if (type === EventDataTypes.SC) return 'sc'
  if (type === EventDataTypes.Gift || type === EventDataTypes.Guard) return 'gift'
  if (INTERACTION_TYPES.has(type)) return 'interaction'
  return 'danmaku'
}

/** 来源边界归一化：开放平台 timestamp 为秒，直连为毫秒 */
export function normalizeEvent(event: EventModel): DashboardEvent {
  const time = event.time < 1e12 ? event.time * 1000 : event.time
  return {
    key: event.eventId ?? `${event.type}:${event.ouid || event.uid}:${time}:${event.msg}:${event.num}`,
    type: event.type,
    time,
    uid: event.uid,
    ouid: event.ouid,
    uname: event.uname,
    uface: event.uface,
    msg: event.msg ?? '',
    emoji: event.emoji || undefined,
    price: Math.max(0, event.price ?? 0),
    num: event.num ?? 1,
    guardLevel: event.guard_level ?? 0,
    medalLevel: event.fans_medal_level ?? 0,
    medalName: event.fans_medal_name ?? '',
    medalWearing: !!event.fans_medal_wearing_status,
    giftIcon: event.gift_icon,
    scId: event.type === EventDataTypes.SC ? event.id : undefined,
    read: false,
    deleted: false,
  }
}

/** 用户身份：直连有 uid，开放平台只有 ouid */
export function userKeyOf(event: Pick<DashboardEvent, 'uid' | 'ouid'>) {
  return event.uid > 0 ? `u:${event.uid}` : `o:${event.ouid}`
}

/** 回到站内通用事件模型，供读弹幕等复用服务消费 */
export function toEventModel(event: DashboardEvent): EventModel {
  return {
    eventId: event.key,
    type: event.type,
    uname: event.uname,
    uface: event.uface,
    uid: event.uid,
    open_id: '',
    ouid: event.ouid,
    msg: event.msg,
    time: event.time,
    num: event.num,
    price: event.price,
    guard_level: event.guardLevel,
    fans_medal_level: event.medalLevel,
    fans_medal_name: event.medalName,
    fans_medal_wearing_status: event.medalWearing,
    emoji: event.emoji,
    gift_icon: event.giftIcon,
  }
}
