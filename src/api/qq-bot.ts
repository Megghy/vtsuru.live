import {
  getApiQqBotGroups,
  getApiQqBotStatus,
  postApiQqBotBindCode,
  postApiQqBotGroupsNotify,
  postApiQqBotGroupsUnbind,
} from '@/api/generated/qq-bot/qq-bot'

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
  return getApiQqBotStatus()
}

export function createQqBotBindCode() {
  return postApiQqBotBindCode()
}

export function getQqBotGroups() {
  return getApiQqBotGroups()
}

export function unbindQqBotGroup(groupOpenId: string) {
  return postApiQqBotGroupsUnbind({ groupOpenId })
}

export function updateQqBotGroupNotify(groupOpenId: string, liveStart: boolean) {
  return postApiQqBotGroupsNotify({ groupOpenId, liveStart })
}
