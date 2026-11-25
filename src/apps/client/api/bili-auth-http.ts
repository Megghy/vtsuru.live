import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import { useBiliAccountManager } from '../store/useBiliAccountManager'
import { useBiliCookie } from '../store/useBiliCookie'
import { useBiliFunction } from '../store/useBiliFunction'

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

export interface BiliAuthCredential {
  cookie: string
  csrf: string
  uid: number
}

export interface BiliApiEnvelope<T = unknown> {
  code: number
  message?: string
  msg?: string
  data?: T
}

export function extractCookieField(cookie: string, key: string): string {
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`))
  return match ? match[1] : ''
}

/**
 * 获取主播主账号凭证（用于直播间场控、预约、动态、天选、大航海管理等需主播权限的接口）
 */
export async function getMainBiliAuth(): Promise<BiliAuthCredential> {
  const accountMgr = useBiliAccountManager()
  let cookie = accountMgr.mainAccount?.cookie || ''
  if (!cookie) {
    cookie = (await useBiliCookie().getBiliCookie()) || ''
  }
  if (!cookie) {
    throw new Error('未登录 B 站主播账号，请先在「账号与凭据」扫码登录')
  }
  const csrf = extractCookieField(cookie, 'bili_jct')
  if (!csrf) {
    throw new Error('主播账号 Cookie 缺少 bili_jct (CSRF)，请重新扫码登录')
  }
  const uid = Number(accountMgr.mainAccount?.mid || extractCookieField(cookie, 'DedeUserID') || 0)
  return { cookie, csrf, uid }
}

async function buildUrl(
  baseUrl: string,
  query?: Record<string, string | number | undefined | null>,
  useWbi?: boolean,
): Promise<string> {
  const cleanParams: Record<string, string | number> = {}
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) cleanParams[k] = v
    }
  }
  if (useWbi) {
    const biliFunc = useBiliFunction()
    const signed = await biliFunc.encWbi(cleanParams)
    return baseUrl.includes('?') ? `${baseUrl}&${signed}` : `${baseUrl}?${signed}`
  }
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(cleanParams)) {
    sp.set(k, String(v))
  }
  const qs = sp.toString()
  if (!qs) return baseUrl
  return baseUrl.includes('?') ? `${baseUrl}&${qs}` : `${baseUrl}?${qs}`
}

async function unwrapResponse<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`B 站接口 HTTP ${resp.status}${text ? `: ${text.slice(0, 120)}` : ''}`)
  }
  const json = (await resp.json()) as BiliApiEnvelope<T>
  if (json.code !== 0) {
    throw new Error(`${json.message || json.msg || 'B 站接口返回错误'} (code: ${json.code})`)
  }
  return json.data as T
}

export async function biliGetJson<T>(
  url: string,
  options?: {
    query?: Record<string, string | number | undefined | null>
    useWbi?: boolean
    referer?: string
    origin?: string
    auth?: BiliAuthCredential
  },
): Promise<T> {
  const auth = options?.auth ?? (await getMainBiliAuth())
  const fullUrl = await buildUrl(url, options?.query, options?.useWbi)
  const resp = await tauriFetch(fullUrl, {
    method: 'GET',
    headers: {
      Cookie: auth.cookie,
      'User-Agent': DEFAULT_UA,
      Referer: options?.referer ?? 'https://live.bilibili.com/',
      Origin: options?.origin ?? 'https://live.bilibili.com',
    },
  })
  return unwrapResponse<T>(resp)
}

export async function biliPostFormJson<T>(
  url: string,
  form: Record<string, string | number | undefined | null>,
  options?: {
    query?: Record<string, string | number | undefined | null>
    useWbi?: boolean
    referer?: string
    origin?: string
    auth?: BiliAuthCredential
    includeCsrf?: boolean
  },
): Promise<T> {
  const auth = options?.auth ?? (await getMainBiliAuth())
  const fullUrl = await buildUrl(url, options?.query, options?.useWbi)
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(form)) {
    if (v !== undefined && v !== null) body.set(k, String(v))
  }
  if (options?.includeCsrf !== false) {
    if (!body.has('csrf')) body.set('csrf', auth.csrf)
    if (!body.has('csrf_token')) body.set('csrf_token', auth.csrf)
  }
  const resp = await tauriFetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: auth.cookie,
      'User-Agent': DEFAULT_UA,
      Referer: options?.referer ?? 'https://live.bilibili.com/',
      Origin: options?.origin ?? 'https://live.bilibili.com',
    },
    body,
  })
  return unwrapResponse<T>(resp)
}

export async function biliPostJson<T>(
  url: string,
  payload: unknown,
  options?: {
    query?: Record<string, string | number | undefined | null>
    useWbi?: boolean
    referer?: string
    origin?: string
    auth?: BiliAuthCredential
    appendCsrfToQuery?: boolean
  },
): Promise<T> {
  const auth = options?.auth ?? (await getMainBiliAuth())
  const query = { ...(options?.query ?? {}) }
  if (options?.appendCsrfToQuery !== false && query.csrf === undefined) {
    query.csrf = auth.csrf
  }
  const fullUrl = await buildUrl(url, query, options?.useWbi)
  const resp = await tauriFetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: auth.cookie,
      'User-Agent': DEFAULT_UA,
      Referer: options?.referer ?? 'https://t.bilibili.com/',
      Origin: options?.origin ?? 'https://t.bilibili.com',
    },
    body: JSON.stringify(payload),
  })
  return unwrapResponse<T>(resp)
}

export async function biliPostMultipartJson<T>(
  url: string,
  formData: FormData,
  options?: {
    query?: Record<string, string | number | undefined | null>
    referer?: string
    origin?: string
    auth?: BiliAuthCredential
  },
): Promise<T> {
  const auth = options?.auth ?? (await getMainBiliAuth())
  if (!formData.has('csrf')) formData.append('csrf', auth.csrf)
  const fullUrl = await buildUrl(url, options?.query)
  const resp = await tauriFetch(fullUrl, {
    method: 'POST',
    headers: {
      Cookie: auth.cookie,
      'User-Agent': DEFAULT_UA,
      Referer: options?.referer ?? 'https://t.bilibili.com/',
      Origin: options?.origin ?? 'https://t.bilibili.com',
    },
    body: formData,
  })
  return unwrapResponse<T>(resp)
}
