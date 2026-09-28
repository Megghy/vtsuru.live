import { formatDistanceToNowStrict } from 'date-fns'
import { zhCN } from 'date-fns/locale'

import { EventDataTypes } from '@/api/api-models'
import { AVATAR_URL } from '@/shared/config'
import { formatDanmakuPrice } from '@/shared/utils/danmakuGiftDisplay'

import type { DashboardEvent } from './types'
import { GUARD_NAMES } from './types'

export function avatarUrl(uface: string, size = 48) {
  if (!uface) return ''
  return uface.startsWith(AVATAR_URL) ? `${uface}?size=${size}` : `${uface}@${size}w`
}

export function formatPrice(price: number) {
  return `¥${formatDanmakuPrice(price) ?? '0'}`
}

export function formatClock(time: number) {
  return new Date(time).toLocaleTimeString('zh-CN', { hour12: false })
}

export function formatRelative(time: number) {
  return formatDistanceToNowStrict(time, { locale: zhCN, addSuffix: true })
}

export function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/** 礼物 / 大航海卡片正文 */
export function paidSummary(event: DashboardEvent) {
  if (event.type === EventDataTypes.Guard) {
    const name = GUARD_NAMES[event.guardLevel] ?? event.msg
    return event.num > 1 ? `开通 ${name} × ${event.num} 月` : `开通 ${name}`
  }
  if (event.type === EventDataTypes.Gift) return event.num > 1 ? `${event.msg} × ${event.num}` : event.msg
  return event.msg
}

/** B 站 SC 价格档位配色 */
export function superChatTier(price: number) {
  if (price >= 2000) return { header: '#ab1a32', body: '#e54d4d' }
  if (price >= 1000) return { header: '#c35a1d', body: '#e09443' }
  if (price >= 500) return { header: '#c9811a', body: '#e2b52b' }
  if (price >= 100) return { header: '#3f7d9c', body: '#427d9e' }
  if (price >= 50) return { header: '#5c93bb', body: '#6ea3cf' }
  return { header: '#2a60b2', body: '#4671b6' }
}
