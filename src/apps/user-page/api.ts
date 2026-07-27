import type { QueryRequestOptions } from '@/api/query'
import type { UserInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import { USER_API_URL, USER_PAGES_API_URL } from '@/shared/config'
import { migrateUserPagesSettings } from './normalize'
import type { UserPagesMyStateResponse, UserPagesSettingsV1 } from './types'

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
  const resp = await QueryPostAPI<unknown>(`${USER_PAGES_API_URL}save-draft`, {
    json: JSON.stringify(settings),
  })
  unwrapOk(resp, '保存草稿失败')
}

export async function clearMyUserPagesDraft() {
  const resp = await QueryPostAPI<unknown>(`${USER_PAGES_API_URL}clear-draft`, undefined)
  unwrapOk(resp, '清空草稿失败')
}

export async function publishMyUserPagesSettings(settings: UserPagesSettingsV1) {
  const resp = await QueryPostAPI<unknown>(`${USER_PAGES_API_URL}publish`, {
    json: JSON.stringify(settings),
  })
  unwrapOk(resp, '发布失败')
}

export async function rollbackMyUserPagesPublished() {
  const resp = await QueryPostAPI<unknown>(`${USER_PAGES_API_URL}rollback`, {})
  unwrapOk(resp, '回滚失败')
}
