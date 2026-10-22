import { getApiCheckinRanking } from '@/api/generated/check-in/check-in'
import { getApiForumGetForum } from '@/api/generated/forum/forum'
import { getApiLiveRequestGetActiveAndSettings } from '@/api/generated/live-request/live-request'
import { getApiPointGetGoods } from '@/api/generated/point/point'
import { getApiSongListGet } from '@/api/generated/song-list/song-list'
import {
  getApiUserPagesGetMy,
  getApiUserPagesGetUser,
  postApiUserPagesClearDraft,
  postApiUserPagesPublish,
  postApiUserPagesRollback,
  postApiUserPagesSaveDraft,
} from '@/api/generated/user-pages/user-pages'
import { getApiUserInfo } from '@/api/generated/user/user'
import { getApiVideoCollectGetActive } from '@/api/generated/video-collect/video-collect'
import type { QueryRequestOptions } from '@/api/query'
import { unwrapOk } from '@/api/query'
import { resolveFileUrl, VTSURU_API_URL } from '@/shared/config'

import { migrateUserPagesSettings } from './normalize'
import type { BiliProfile, UserPagesSettings } from './types'

function parseUserPagesSettings(raw: string): UserPagesSettings {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw, (_key, value) => (typeof value === 'string' ? resolveFileUrl(value) : value))
  } catch {
    throw new Error('用户页面配置不是合法 JSON')
  }

  return migrateUserPagesSettings(parsed)
}

export async function fetchPublicUserInfo(routeId: string, options?: QueryRequestOptions) {
  const resp = await getApiUserInfo({ id: routeId }, options)
  if (resp.code === 404) return null
  return unwrapOk(resp, '无法获取用户信息')
}

export async function fetchBiliProfile(biliId: number, signal?: AbortSignal): Promise<BiliProfile | null> {
  const response = await fetch(`${VTSURU_API_URL}bili-user-info/${biliId}`, { signal })
  if (!response.ok) throw new Error(`B站资料请求失败：HTTP ${response.status}`)
  const payload = (await response.json()) as {
    code?: number
    data?: { card?: BiliProfile }
  }
  return payload.code === 0 ? (payload.data?.card ?? null) : null
}

export async function fetchPublicForumExists(owner: number, options?: QueryRequestOptions) {
  const response = await getApiForumGetForum({ owner: String(owner) }, options)
  if (response.code === 404) return false
  unwrapOk(response, '无法获取讨论区信息')
  return true
}

export async function fetchPublicSongList(userId: number, options?: QueryRequestOptions) {
  return unwrapOk(await getApiSongListGet({ id: String(userId) }, options), '无法获取歌单') ?? []
}

export async function fetchPublicSongRequestSettings(userId: number, options?: QueryRequestOptions) {
  return (await fetchPublicSongRequestState(userId, options)).setting
}

export async function fetchPublicSongRequestState(userId: number, options?: QueryRequestOptions) {
  return unwrapOk(await getApiLiveRequestGetActiveAndSettings({ id: userId }, options), '无法获取当前点歌状态')
}

export async function fetchPublicCheckInRanking(userId: number, count: 3 | 10, options?: QueryRequestOptions) {
  return unwrapOk(await getApiCheckinRanking({ vId: userId, count }, options), '无法获取签到排行') ?? []
}

export async function fetchPublicPointGoods(userId: number, options?: QueryRequestOptions) {
  return unwrapOk(await getApiPointGetGoods({ id: String(userId) }, options), '无法获取积分商品') ?? []
}

export async function fetchPublicActiveVideoCollect(userId: number, options?: QueryRequestOptions) {
  return unwrapOk(await getApiVideoCollectGetActive({ id: String(userId) }, options), '无法获取视频征集活动') ?? []
}

export async function fetchUserPagesSettingsByUserId(
  userId: number,
  options?: QueryRequestOptions,
): Promise<UserPagesSettings | null> {
  const resp = await getApiUserPagesGetUser({ id: userId }, options)
  if (resp.code === 404) return null
  return parseUserPagesSettings(unwrapOk(resp, '无法获取用户页面配置'))
}

export async function fetchMyUserPagesState(): Promise<{
  draft: UserPagesSettings | null
  published: UserPagesSettings | null
  rollback: UserPagesSettings | null
}> {
  const data = unwrapOk(await getApiUserPagesGetMy(), '无法获取用户页面配置')
  return {
    draft: data.draftJson ? parseUserPagesSettings(data.draftJson) : null,
    published: data.publishedJson ? parseUserPagesSettings(data.publishedJson) : null,
    rollback: data.rollbackJson ? parseUserPagesSettings(data.rollbackJson) : null,
  }
}

export async function saveMyUserPagesDraft(settings: UserPagesSettings) {
  return parseUserPagesSettings(
    unwrapOk(await postApiUserPagesSaveDraft({ json: JSON.stringify(settings) }), '保存草稿失败'),
  )
}

export async function clearMyUserPagesDraft() {
  unwrapOk(await postApiUserPagesClearDraft(), '清空草稿失败')
}

export async function publishMyUserPagesSettings(settings: UserPagesSettings) {
  return parseUserPagesSettings(unwrapOk(await postApiUserPagesPublish({ json: JSON.stringify(settings) }), '发布失败'))
}

export async function rollbackMyUserPagesPublished() {
  unwrapOk(await postApiUserPagesRollback(), '回滚失败')
}
