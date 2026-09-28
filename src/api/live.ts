import type { EventDataTypes, EventModel, ResponseCurrentLiveModel, ResponseLiveRankingEntryModel } from '@/api/api-models'
import { QueryGetAPI, unwrapOk } from '@/api/query'
import { EVENT_API_URL, LIVE_API_URL } from '@/shared/config'

// 直播场次与云端事件接口：均要求已认证哔哩哔哩账号，失败抛出后端消息

export async function getCurrentLive() {
  return unwrapOk(await QueryGetAPI<ResponseCurrentLiveModel>(`${LIVE_API_URL}current`), '获取当前场次失败').live
}

export async function getLiveRanking(liveId: string, limit: number) {
  return unwrapOk(await QueryGetAPI<ResponseLiveRankingEntryModel[]>(`${LIVE_API_URL}ranking`, { liveId, limit }), '获取场次排行失败')
}

/** 后端事件记录：无 ouid/eventId，uid 可能为空，id 为库内主键 */
export type CloudEventModel = Omit<EventModel, 'eventId' | 'ouid' | 'uid' | 'id'> & { id: number; uid: number | null }

export interface CloudEventQuery {
  type: EventDataTypes
  /** Unix 毫秒 */
  start: number
  end: number
  offset: number
  /** 1-100 */
  limit: number
}

/** 按时间倒序返回 */
export async function getCloudEvents(query: CloudEventQuery) {
  return unwrapOk(await QueryGetAPI<CloudEventModel[]>(`${EVENT_API_URL}get`, { ...query }), '获取云端事件失败')
}
