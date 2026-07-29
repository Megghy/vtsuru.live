import type { QueryRequestOptions } from '@/api/query'
import type { CheckInRankingInfo, ResponsePointGoodModel, Setting_LiveRequest, SongRequestInfo, SongsInfo, UserInfo, VideoCollectTable } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import { CHECKIN_API_URL, FORUM_API_URL, POINT_API_URL, SONG_API_URL, SONG_REQUEST_API_URL, USER_API_URL, USER_PAGES_API_URL, VIDEO_COLLECT_API_URL, VTSURU_API_URL } from '@/shared/config'
import { migrateUserPagesSettings } from './normalize'
import type { BiliProfile, UserPagesMyStateResponse, UserPagesSettingsV1 } from './types'

function parseUserPagesSettings(raw: string): UserPagesSettingsV1 {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('用户页面配置不是合法 JSON')
  }

  return migrateUserPagesSettings(parsed)
}

export async function fetchPublicUserInfo(
  routeId: string,
  options?: QueryRequestOptions,
): Promise<UserInfo | null> {
  const resp = await QueryGetAPI<UserInfo>(`${USER_API_URL}info`, { id: routeId }, undefined, options)
  if (resp.code === 404) return null
  return unwrapOk(resp, '无法获取用户信息')
}

export async function fetchBiliProfile(biliId: number, signal?: AbortSignal): Promise<BiliProfile | null> {
  const response = await fetch(`${VTSURU_API_URL}bili-user-info/${biliId}`, { signal })
  if (!response.ok) throw new Error(`B站资料请求失败：HTTP ${response.status}`)
  const payload = await response.json() as {
    code?: number
    data?: { card?: BiliProfile }
  }
  return payload.code === 0 ? payload.data?.card ?? null : null
}

export async function fetchPublicForumExists(owner: number, options?: QueryRequestOptions) {
  const response = await QueryGetAPI<unknown>(`${FORUM_API_URL}get-forum`, { owner }, undefined, options)
  if (response.code === 404) return false
  unwrapOk(response, '无法获取讨论区信息')
  return true
}

export async function fetchPublicSongList(userId: number, options?: QueryRequestOptions) {
  const response = await QueryGetAPI<SongsInfo[]>(`${SONG_API_URL}get`, { id: userId }, undefined, options)
  return unwrapOk(response, '无法获取歌单') ?? []
}

export async function fetchPublicSongRequestSettings(userId: number, options?: QueryRequestOptions) {
  return (await fetchPublicSongRequestState(userId, options)).setting
}

export async function fetchPublicSongRequestState(userId: number, options?: QueryRequestOptions) {
  const response = await QueryGetAPI<{ songs: SongRequestInfo[], setting: Setting_LiveRequest }>(
    `${SONG_REQUEST_API_URL}get-active-and-settings`,
    { id: userId },
    undefined,
    options,
  )
  return unwrapOk(response, '无法获取当前点歌状态')
}

export async function fetchPublicCheckInRanking(userId: number, count: 3 | 10, options?: QueryRequestOptions) {
  const response = await QueryGetAPI<CheckInRankingInfo[]>(`${CHECKIN_API_URL}ranking`, { vId: userId, count }, undefined, options)
  return unwrapOk(response, '无法获取签到排行') ?? []
}

export async function fetchPublicPointGoods(userId: number, options?: QueryRequestOptions) {
  const response = await QueryGetAPI<ResponsePointGoodModel[]>(`${POINT_API_URL}get-goods`, { id: userId }, undefined, options)
  return unwrapOk(response, '无法获取积分商品') ?? []
}

export async function fetchPublicActiveVideoCollect(userId: number, options?: QueryRequestOptions) {
  const response = await QueryGetAPI<VideoCollectTable[]>(`${VIDEO_COLLECT_API_URL}get-active`, { id: userId }, undefined, options)
  return unwrapOk(response, '无法获取视频征集活动') ?? []
}

export async function fetchUserPagesSettingsByUserId(
  userId: number,
  options?: QueryRequestOptions,
): Promise<UserPagesSettingsV1 | null> {
  const resp = await QueryGetAPI<string>(`${USER_PAGES_API_URL}get-user`, { id: userId, _ts: Date.now() }, undefined, options)
  if (resp.code === 404) return null
  const raw = unwrapOk(resp, '无法获取用户页面配置')
  return parseUserPagesSettings(raw)
}

export async function fetchMyUserPagesState(): Promise<{
  draft: UserPagesSettingsV1 | null
  published: UserPagesSettingsV1 | null
  rollback: UserPagesSettingsV1 | null
}> {
  const resp = await QueryGetAPI<UserPagesMyStateResponse>(`${USER_PAGES_API_URL}get-my`, { _ts: Date.now() })
  const data = unwrapOk(resp, '无法获取用户页面配置')
  return {
    draft: data.draftJson ? parseUserPagesSettings(data.draftJson) : null,
    published: data.publishedJson ? parseUserPagesSettings(data.publishedJson) : null,
    rollback: data.rollbackJson ? parseUserPagesSettings(data.rollbackJson) : null,
  }
}

export async function saveMyUserPagesDraft(settings: UserPagesSettingsV1) {
  const resp = await QueryPostAPI<string>(`${USER_PAGES_API_URL}save-draft`, {
    json: JSON.stringify(settings),
  })
  return parseUserPagesSettings(unwrapOk(resp, '保存草稿失败'))
}

export async function clearMyUserPagesDraft() {
  const resp = await QueryPostAPI<unknown>(`${USER_PAGES_API_URL}clear-draft`, undefined)
  unwrapOk(resp, '清空草稿失败')
}

export async function publishMyUserPagesSettings(settings: UserPagesSettingsV1) {
  const resp = await QueryPostAPI<string>(`${USER_PAGES_API_URL}publish`, {
    json: JSON.stringify(settings),
  })
  return parseUserPagesSettings(unwrapOk(resp, '发布失败'))
}

export async function rollbackMyUserPagesPublished() {
  const resp = await QueryPostAPI<unknown>(`${USER_PAGES_API_URL}rollback`, {})
  unwrapOk(resp, '回滚失败')
}
