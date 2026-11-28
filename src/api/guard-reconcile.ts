import type { EventModel } from '@/api/generated/model'
import { getApiBaseUrl } from '@/shared/config'

import { QueryPostAPI, unwrapOk } from './query'

function api(path: string): string {
  const base = getApiBaseUrl().replace(/\/+$/, '')
  return `${base}/${path.replace(/^\/+/, '')}`
}

export interface GuardStreamItemPayload {
  streamKey: string
  uid: number
  uname: string
  face?: string
  guardLevel: number // 1 总督, 2 提督, 3 舰长
  msg: '舰长' | '提督' | '总督'
  time: number // Unix ms
  num: number
  price: number
  hamster: number
}

export type GuardReconcileStatus = 'matched' | 'needs_confirm' | 'missing'

export type GuardReconcileMatchReason =
  | 'uid'
  | 'auth_openid'
  | 'uname_time'
  | 'time_level_match_name_diff'
  | 'not_found'
  | string

export interface GuardReconcileEntry {
  streamItem: GuardStreamItemPayload
  status: GuardReconcileStatus
  matchReason: GuardReconcileMatchReason
  timeDiffSeconds: number | null
  matchedEvent: EventModel | null
}

export interface GuardReconcileResponse {
  existingCount: number
  timeWindowSeconds: number
  matched: GuardReconcileEntry[]
  needsConfirm: GuardReconcileEntry[]
  missing: GuardReconcileEntry[]
}

export interface GuardReconcileSyncItem {
  uid: number
  uname: string
  msg: '舰长' | '提督' | '总督'
  time: number // Unix ms
  num: number
  price?: number
}

export interface GuardReconcileSyncResponse {
  insertedCount: number
  skippedCount: number
  guardMembersRefreshedCount: number
  pointsGrantedCount: number
  rewardsGrantedCount: number
  insertedEvents: EventModel[]
}

export async function reconcileGuardEvents(payload: {
  start: number
  end: number
  timeWindowSeconds?: number
  items: GuardStreamItemPayload[]
}): Promise<GuardReconcileResponse> {
  const resp = await QueryPostAPI<GuardReconcileResponse>(api('event/guard/reconcile'), payload)
  return unwrapOk(resp, '舰长事件对账失败')
}

export async function syncReconciledGuardEvents(payload: {
  items: GuardReconcileSyncItem[]
  grantPoints?: boolean
  grantRewards?: boolean
}): Promise<GuardReconcileSyncResponse> {
  const resp = await QueryPostAPI<GuardReconcileSyncResponse>(api('event/guard/reconcile-sync'), payload)
  return unwrapOk(resp, '同步舰长事件失败')
}
