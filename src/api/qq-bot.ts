import { QQ_BOT_API_URL } from '@/shared/config'
import { QueryGetAPI, QueryPostAPI } from './query'

export interface QqBotStatus {
  configured: boolean
  ready: boolean
}

export interface QqBotBindCode {
  code: string
  expiresAt: string
  instruction: string
}

export interface QqBotGroupNotify {
  liveStart: boolean
  liveStop: boolean
  schedule: boolean
  lottery: boolean
  vote: boolean
  superChat: boolean
}

export interface QqBotGroup {
  id: number
  groupOpenId: string
  groupHint: string
  boundAt: string
  notify: QqBotGroupNotify
  todayPushCount: number
}

export function getQqBotStatus() {
  return QueryGetAPI<QqBotStatus>(`${QQ_BOT_API_URL}status`)
}

export function createQqBotBindCode() {
  return QueryPostAPI<QqBotBindCode>(`${QQ_BOT_API_URL}bind-code`)
}

export function getQqBotGroups() {
  return QueryGetAPI<QqBotGroup[]>(`${QQ_BOT_API_URL}groups`)
}

export function unbindQqBotGroup(groupOpenId: string) {
  return QueryPostAPI(`${QQ_BOT_API_URL}groups/unbind`, { groupOpenId })
}

export function updateQqBotGroupNotify(groupOpenId: string, liveStart: boolean) {
  return QueryPostAPI<QqBotGroup>(`${QQ_BOT_API_URL}groups/notify`, { groupOpenId, liveStart })
}
