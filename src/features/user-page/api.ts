import { QueryGetAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import { USER_CONFIG_API_URL } from '@/shared/config'
import { USER_PAGES_CONFIG_NAME } from './constants'
import type { UserPagesSettingsV1 } from './types'

function parseUserPagesSettings(raw: string): UserPagesSettingsV1 {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('用户页面配置不是合法 JSON')
  }

  if (!parsed || typeof parsed !== 'object') throw new Error('用户页面配置格式错误')
  const v = (parsed as any).version
  if (v !== 1) throw new Error(`用户页面配置 version 不支持: ${String(v)}`)
  return parsed as UserPagesSettingsV1
}

export async function fetchUserPagesSettingsByUserId(userId: number): Promise<UserPagesSettingsV1 | null> {
  const resp = await QueryGetAPI<string>(`${USER_CONFIG_API_URL}get-user`, {
    name: USER_PAGES_CONFIG_NAME,
    id: userId,
  })
  if (resp.code === 404) return null
  const raw = unwrapOk(resp, '无法获取用户页面配置')
  return parseUserPagesSettings(raw)
}

export async function fetchMyUserPagesSettings(): Promise<UserPagesSettingsV1 | null> {
  const resp = await QueryGetAPI<string>(`${USER_CONFIG_API_URL}get`, {
    name: USER_PAGES_CONFIG_NAME,
  })
  if (resp.code === 404) return null
  const raw = unwrapOk(resp, '无法获取用户页面配置')
  return parseUserPagesSettings(raw)
}

export async function saveMyUserPagesSettings(settings: UserPagesSettingsV1, isPublic: boolean = true) {
  const resp = await QueryPostAPI<unknown>(`${USER_CONFIG_API_URL}set`, {
    name: USER_PAGES_CONFIG_NAME,
    json: JSON.stringify(settings),
    public: isPublic,
  })
  unwrapOk(resp, '保存用户页面配置失败')
}
