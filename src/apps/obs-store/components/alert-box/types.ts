import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'

export type AlertEventKind = 'guard' | 'sc' | 'gift' | 'point_redeem' | 'checkin' | 'follow'

export type AlertAnimation = 'slide' | 'scale' | 'pop'

export interface AlertRuleConfig {
  enabled: boolean
  title: string
  template: string
  accentColor: string
  mediaUrl: string
}

export interface AlertPayload {
  id: string
  kind: AlertEventKind
  user: string
  avatar?: string
  item?: string
  count?: number
  price?: number
  extra?: string
  timestamp: number
}

export interface AlertBoxState {
  theme: ObsWidgetTheme
  animation: AlertAnimation
  durationMs: number
  playSound: boolean
  soundVolume: number
  minGiftYuan: number
  showAvatar: boolean
  showProgressBar: boolean
  fontFamily: string
  rules: Record<AlertEventKind, AlertRuleConfig>
}

export type AlertBoxAction =
  | { type: 'TRIGGER_ALERT'; payload: AlertPayload }
  | { type: 'CLEAR_QUEUE' }

export interface AlertKindMeta {
  kind: AlertEventKind
  label: string
  shortLabel: string
  badge: string
  defaultRule: AlertRuleConfig
}

export const ALERT_KIND_LIST: AlertKindMeta[] = [
  {
    kind: 'guard',
    label: '新上舰 / 续费',
    shortLabel: '模拟上舰',
    badge: '大航海',
    defaultRule: {
      enabled: true,
      title: '欢迎登船 · 大航海成员',
      template: '感谢 {user} 开通了 {item} ×{count}！{extra}',
      accentColor: '#38bdf8',
      mediaUrl: '',
    },
  },
  {
    kind: 'sc',
    label: '醒目留言 SC',
    shortLabel: '模拟 SC',
    badge: 'SUPER CHAT',
    defaultRule: {
      enabled: true,
      title: '收到醒目留言',
      template: '{user} 发送了 ￥{price} 醒目留言：{extra}',
      accentColor: '#f59e0b',
      mediaUrl: '',
    },
  },
  {
    kind: 'gift',
    label: '礼物投喂',
    shortLabel: '模拟大礼物',
    badge: '投喂礼物',
    defaultRule: {
      enabled: true,
      title: '收到豪华投喂',
      template: '感谢 {user} 投喂 {item} ×{count}（￥{price}）',
      accentColor: '#f43f5e',
      mediaUrl: '',
    },
  },
  {
    kind: 'point_redeem',
    label: '积分商城兑换',
    shortLabel: '模拟积分兑换',
    badge: '积分兑换',
    defaultRule: {
      enabled: true,
      title: '积分商城新订单',
      template: '{user} 兑换了 {item} ×{count}（消耗 {price} 积分）{extra}',
      accentColor: '#a855f7',
      mediaUrl: '',
    },
  },
  {
    kind: 'checkin',
    label: '弹幕签到',
    shortLabel: '模拟签到',
    badge: '每日签到',
    defaultRule: {
      enabled: true,
      title: '弹幕签到成功',
      template: '{user} 签到成功！获得 {price} 积分 · {extra}',
      accentColor: '#10b981',
      mediaUrl: '',
    },
  },
  {
    kind: 'follow',
    label: '新增关注',
    shortLabel: '模拟关注',
    badge: '新粉丝',
    defaultRule: {
      enabled: true,
      title: '感谢新关注',
      template: '欢迎 {user} 关注直播间！{extra}',
      accentColor: '#ec4899',
      mediaUrl: '',
    },
  },
]

export const ALERT_KIND_MAP: Record<AlertEventKind, AlertKindMeta> = Object.fromEntries(
  ALERT_KIND_LIST.map((item) => [item.kind, item]),
) as Record<AlertEventKind, AlertKindMeta>

export const DEFAULT_ALERT_RULES: Record<AlertEventKind, AlertRuleConfig> = Object.fromEntries(
  ALERT_KIND_LIST.map((item) => [item.kind, { ...item.defaultRule }]),
) as Record<AlertEventKind, AlertRuleConfig>

export const DEFAULT_ALERT_BOX_STATE: AlertBoxState = {
  theme: 'card',
  animation: 'pop',
  durationMs: 4500,
  playSound: true,
  soundVolume: 45,
  minGiftYuan: 10,
  showAvatar: true,
  showProgressBar: true,
  fontFamily: '',
  rules: structuredClone(DEFAULT_ALERT_RULES),
}

export function getAlertRule(state: AlertBoxState, kind: AlertEventKind): AlertRuleConfig {
  const fallback = DEFAULT_ALERT_RULES[kind]
  const current = state.rules?.[kind]
  if (!current) return fallback
  return {
    ...fallback,
    ...current,
  }
}

export function formatAlertPrice(price?: number): string {
  if (price === undefined || price === null || Number.isNaN(price)) return '0'
  return Number.isInteger(price) ? String(price) : price.toFixed(1)
}

export function renderAlertTemplate(template: string, payload: AlertPayload): string {
  const vars: Record<string, string> = {
    '{user}': payload.user || '神秘观众',
    '{item}': payload.item || '',
    '{count}': String(payload.count ?? 1),
    '{price}': formatAlertPrice(payload.price),
    '{extra}': payload.extra || '',
  }
  let output = template
  for (const [token, value] of Object.entries(vars)) {
    output = output.split(token).join(value)
  }
  return output.replace(/\s+/g, ' ').trim()
}

export function createSampleAlertPayload(kind: AlertEventKind): AlertPayload {
  const id = `sim-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const timestamp = Date.now()
  switch (kind) {
    case 'guard':
      return {
        id,
        kind,
        user: '星野观测员',
        item: '舰长',
        count: 1,
        price: 198,
        extra: '欢迎加入大航海！',
        timestamp,
      }
    case 'sc':
      return {
        id,
        kind,
        user: '深夜打call机',
        item: '醒目留言',
        count: 1,
        price: 50,
        extra: '主播今天状态超棒，辛苦啦，注意多喝热水！',
        timestamp,
      }
    case 'gift':
      return {
        id,
        kind,
        user: '甜筒批发商',
        item: '璀璨星河',
        count: 2,
        price: 104,
        extra: '',
        timestamp,
      }
    case 'point_redeem':
      return {
        id,
        kind,
        user: '积分大富翁',
        item: '指定点歌券',
        count: 1,
        price: 300,
        extra: '备注：想听一首轻快的歌',
        timestamp,
      }
    case 'checkin':
      return {
        id,
        kind,
        user: '早起打卡酱',
        item: '每日签到',
        count: 1,
        price: 20,
        extra: '连续签到 14 天 · 今日第 3 名',
        timestamp,
      }
    case 'follow':
      return {
        id,
        kind,
        user: '路过的小狐狸',
        item: '关注',
        count: 1,
        price: 0,
        extra: '感谢支持',
        timestamp,
      }
  }
}
