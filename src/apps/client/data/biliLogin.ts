import { fetch } from '@tauri-apps/plugin-http'
import { error } from '@tauri-apps/plugin-log'

import { QueryBiliAPI } from './utils'

export async function checkLoginStatusAsync(): Promise<boolean> {
  const url = 'https://api.bilibili.com/x/web-interface/nav/stat'
  const response = await fetch(url)
  const json = await response.json()

  return json.code === 0
}

export async function getUidAsync(): Promise<number> {
  const url = 'https://api.live.bilibili.com/xlive/web-ucenter/user/get_user_info'
  const response = await fetch(url)
  const json = (await response.json()) as { data?: { uid?: number } }

  if (json.data && typeof json.data.uid === 'number') {
    return json.data.uid
  }

  return 0
}

interface LoginUrlMessage {
  code: number
  message?: string
  data?: {
    url: string
    qrcode_key: string
  }
}
// 二维码地址及扫码密钥
export async function getLoginUrlAsync(): Promise<LoginUrlMessage> {
  const url = 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate'
  const response = await QueryBiliAPI(url, 'GET')
  if (!response.ok) {
    const result = await response.text()
    error(`无法获取B站登陆二维码: ${result}`)
    throw new Error('获取二维码地址失败')
  }
  return (await response.json()) as LoginUrlMessage
}

export async function getLoginUrlDataAsync(): Promise<{
  url: string
  qrcode_key: string
}> {
  const message = await getLoginUrlAsync()
  if (message.code !== 0) {
    throw new Error('获取二维码地址失败')
  }
  return message.data
}
type QRCodeLoginInfo =
  | { status: 'expired' }
  | { status: 'unknown' }
  | { status: 'scanned' }
  | { status: 'waiting' }
  | { status: 'confirmed'; cookie: string; refresh_token: string }
export async function getLoginInfoAsync(qrcodeKey: string): Promise<QRCodeLoginInfo> {
  const url = `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${qrcodeKey}&source=main-fe-header`
  const response = await QueryBiliAPI(url)
  const message = await response.json()

  if (!message.data) {
    throw new Error('获取登录信息失败')
  }

  if (message.data.code !== 0) {
    switch (message.data.code) {
      case 86038:
        return { status: 'expired' }
      case 86090:
        return { status: 'scanned' }
      case 86101:
        return { status: 'waiting' }
      default:
        return { status: 'unknown' }
    }
  }

  const cookiesHeader = response.headers.get('set-cookie')
  const urlCookieMap = message.data.url ? extractCookieFromUrl(message.data.url) : new Map<string, string>()

  const mergedCookie = mergeCookies(urlCookieMap, cookiesHeader)
  if (!mergedCookie) {
    throw new Error('无法获取 Cookie，响应头与授权链接均无凭据')
  }

  return {
    status: 'confirmed',
    cookie: mergedCookie,
    refresh_token: message.data.refresh_token,
  }
}

/**
 * 从 B 站扫码成功的跳转 url (crossDomain) query 参数中提取核心登录凭证
 * B 站官方以此方式向跨域/原生宿主安全传递 Cookie
 */
export function extractCookieFromUrl(targetUrl: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!targetUrl) return map
  try {
    const parsed = new URL(targetUrl)
    const allowed = ['DedeUserID', 'DedeUserID__ckMd5', 'SESSDATA', 'bili_jct', 'sid']
    for (const key of allowed) {
      const val = parsed.searchParams.get(key)
      if (val) {
        map.set(key, val)
      }
    }
  } catch (e) {
    console.warn('[biliLogin] 从 url 提取 cookie 失败:', e)
  }
  return map
}

/**
 * 合并 url 查询参数与 Set-Cookie 响应头提取的 Cookie
 */
export function mergeCookies(urlCookieMap: Map<string, string>, headerCookieStr?: string | null): string {
  const finalMap = new Map<string, string>(urlCookieMap)
  if (headerCookieStr) {
    const fromHeaders = extractCookie(headerCookieStr)
    if (fromHeaders) {
      for (const item of fromHeaders.split('; ')) {
        const [k, ...v] = item.split('=')
        if (k && v.length > 0 && !finalMap.has(k)) {
          finalMap.set(k.trim(), v.join('=').trim())
        }
      }
    }
  }
  return Array.from(finalMap, ([k, v]) => `${k}=${v}`).join('; ')
}

// Cookie 属性名 (非真实 Cookie 键值), 需在解析时跳过
const COOKIE_ATTRIBUTES = new Set([
  'expires',
  'max-age',
  'domain',
  'path',
  'secure',
  'httponly',
  'samesite',
  'priority',
  'partitioned',
])

// 从合并的 set-cookie 头中精确提取 name=value 对。
// 直接按 ',' 分割会被 Expires=Wed, 21-Oct-... 中的逗号干扰, 故用正则逐对匹配并跳过属性名。
function extractCookie(cookies: string): string {
  const result = new Map<string, string>()
  const regex = /([^=;,\s]+)=([^;,]*)/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(cookies)) !== null) {
    const name = match[1].trim()
    if (COOKIE_ATTRIBUTES.has(name.toLowerCase())) {
      continue
    }
    result.set(name, match[2].trim())
  }
  return Array.from(result, ([name, value]) => `${name}=${value}`).join('; ')
}
