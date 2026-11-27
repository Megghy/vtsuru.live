import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { error, info, warn } from '@tauri-apps/plugin-log'
import { AES, enc, MD5 } from 'crypto-js'

export interface CookieCloudConfig {
  key: string
  password: string
  host?: string
}

export interface CookieCloudCookie {
  domain: string
  expirationDate: number
  hostOnly: boolean
  httpOnly: boolean
  name: string
  path: string
  sameSite: string
  secure: boolean
  session: boolean
  storeId: string
  value: string
}

export interface CookieCloudExportData {
  cookie_data: Record<string, CookieCloudCookie[]>
  local_storage_data?: Record<string, unknown>
  update_time: string
}

export const DEFAULT_COOKIE_CLOUD_HOST = 'https://cookie.vtsuru.live'

/**
 * 规范化 HTTP Cookie 请求头：清除首尾空白、尾部分号与空段，
 * 避免违反 RFC 6265 触发 B 站边缘 WAF `-412`。
 */
export function normalizeBiliCookie(rawCookie?: string | null): string {
  if (!rawCookie) return ''
  return rawCookie
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('; ')
}

function extractBiliCookieString(exportData: CookieCloudExportData): string {
  const biliCookies = exportData.cookie_data?.['bilibili.com']
  if (!biliCookies || biliCookies.length === 0) {
    throw new Error("在 CookieCloud 数据中未找到 'bilibili.com' 的 Cookie")
  }
  const pairs = new Map<string, { value: string; isRoot: boolean }>()
  for (const c of biliCookies) {
    const name = c.name?.trim()
    if (!name || c.value == null) continue
    const isRoot = c.domain?.toLowerCase() === '.bilibili.com'
    const existing = pairs.get(name)
    if (!existing || isRoot || !existing.isRoot) {
      pairs.set(name, { value: c.value, isRoot })
    }
  }
  return Array.from(pairs, ([k, v]) => `${k}=${v.value}`).join('; ')
}

/**
 * 从 CookieCloud 拉取并解密 bilibili.com Cookie 字符串（单一实现，供主账号与多账号池共用）
 */
export async function fetchBiliCookieFromCloud(config: CookieCloudConfig): Promise<string> {
  if (!config?.key || !config?.password) {
    throw new Error('CookieCloud 配置不完整 (缺少 Key 或 Password)')
  }

  const host = config.host?.trim() || DEFAULT_COOKIE_CLOUD_HOST
  const url = new URL(host)
  url.pathname = `/get/${config.key}`

  info(`[CookieCloud] 正在从 ${url.hostname} 获取 Cookie...`)

  const response = await tauriFetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`CookieCloud 请求失败: ${response.status} ${response.statusText}. ${errorText}`)
  }

  const json = (await response.json()) as {
    encrypted?: string
    cookie_data?: Record<string, CookieCloudCookie[]>
    message?: string
  }

  if (json.encrypted) {
    const decryptionKey = MD5(`${config.key}-${config.password}`).toString().substring(0, 16)
    const decrypted = AES.decrypt(json.encrypted, decryptionKey).toString(enc.Utf8)
    if (!decrypted) {
      error('[CookieCloud] AES 解密结果为空，可能是密码不匹配')
      throw new Error('CookieCloud 解密失败，请检查 Key 与 Password 是否匹配')
    }
    const data = JSON.parse(decrypted) as CookieCloudExportData
    return extractBiliCookieString(data)
  }

  if (json.cookie_data) {
    warn('[CookieCloud] 收到未加密的 Cookie 数据')
    return extractBiliCookieString(json as CookieCloudExportData)
  }

  throw new Error(json.message || '从 CookieCloud 获取 Cookie 失败，响应格式不正确')
}
