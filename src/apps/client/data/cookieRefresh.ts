import { QueryBiliAPI } from './utils'

const BILI_REFRESH_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDLgd2OAkcGVtoE3ThUREbio0Eg
Uc/prcajMKXvkCKFCWhJYJcLkcM2DKKcSeFpD/j6Boy538YXnR6VhcuUJOhH2x71
nzPjfdTcqMz7djHum0qSZA0AyCBDABUqCrfNgCiJ00Ra7GmRj+YCK1NJEuewlb40
JNrRuoEUXpabUzGB8QIDAQAB
-----END PUBLIC KEY-----`

function str2ab(str: string): ArrayBuffer {
  const clean = str
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * 客户端纯原生 RSA-OAEP (SHA-256) 计算 CorrespondPath
 */
export async function getCorrespondPath(timestamp: number): Promise<string> {
  try {
    const keyData = str2ab(BILI_REFRESH_PUBLIC_KEY)
    const key = await window.crypto.subtle.importKey(
      'spki',
      keyData,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256',
      },
      false,
      ['encrypt'],
    )
    const plainText = new TextEncoder().encode(`refresh_${timestamp}`)
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      key,
      plainText,
    )
    return Array.from(new Uint8Array(encrypted))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } catch (err) {
    console.warn('[CookieRefresh] 原生 WebCrypto 计算失败，尝试回退:', err)
    const resp = await fetch(`https://wasm-rsa.vercel.app/api/rsa?t=${timestamp}`)
    const json = (await resp.json()) as { hash?: string }
    if (json.hash) return json.hash
    throw err
  }
}

/**
 * 解析 Cookie 字符串为键值 Map
 */
export function parseCookie(cookieStr: string): Map<string, string> {
  const map = new Map<string, string>()
  if (!cookieStr) return map
  const pairs = cookieStr.split(';')
  for (const pair of pairs) {
    const trimmed = pair.trim()
    if (!trimmed) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx > 0) {
      const k = trimmed.slice(0, eqIdx).trim()
      const v = trimmed.slice(eqIdx + 1).trim()
      if (k) map.set(k, v)
    }
  }
  return map
}

/**
 * 将 Map 重组为 Cookie 规范字符串
 */
export function buildCookie(cookieMap: Map<string, string>): string {
  return Array.from(cookieMap, ([k, v]) => `${k}=${v}`).join('; ')
}

/**
 * 从 HTML 页面中精准提取 refresh_csrf
 */
export function extractRefreshCsrf(html: string): string | null {
  if (!html) return null
  const m = html.match(/<div\s+id=(['"])1-name\1>\s*([0-9a-fA-F]{32})\s*<\/div>/i)
  if (m && m[2]) {
    return m[2]
  }
  const fallback = html.match(/([0-9a-fA-F]{32})/i)
  return fallback ? fallback[1] : null
}

export interface RefreshCookieResult {
  success: boolean
  refreshed: boolean
  newCookie?: string
  newRefreshToken?: string
  message?: string
}

/**
 * 检查当前 Cookie 是否需要刷新
 */
export async function checkNeedRefresh(
  cookie: string,
): Promise<{ needRefresh: boolean; timestamp: number }> {
  const cookieMap = parseCookie(cookie)
  const csrf = cookieMap.get('bili_jct') || ''

  const url = `https://passport.bilibili.com/x/passport-login/web/cookie/info?csrf=${encodeURIComponent(csrf)}`
  const resp = await QueryBiliAPI(url, 'GET', cookie, true)
  const json = (await resp.json()) as {
    code: number
    message?: string
    data?: {
      refresh: boolean
      timestamp: number
    }
  }

  if (json.code !== 0 || !json.data) {
    throw new Error(json.message || `获取刷新状态失败 (code: ${json.code})`)
  }

  return {
    needRefresh: !!json.data.refresh,
    timestamp: json.data.timestamp || Date.now(),
  }
}

/**
 * 完整的 B 站 Cookie 自动续期与换票闭环
 * - 纯本地在客户端内执行，避免服务器异地 IP 风控
 * - 先检查是否需要刷新，无需刷新则直接返回原状态
 * - 刷新成功后自动确认更新并注销旧凭证
 */
export async function refreshBiliCookieAsync(
  cookie: string,
  refreshToken: string,
  force = false,
): Promise<RefreshCookieResult> {
  if (!cookie) {
    return { success: false, refreshed: false, message: 'Cookie 不能为空' }
  }
  if (!refreshToken) {
    return { success: false, refreshed: false, message: '未找到 refreshToken，无法自动续期' }
  }

  const cookieMap = parseCookie(cookie)
  const csrf = cookieMap.get('bili_jct')
  if (!csrf) {
    return { success: false, refreshed: false, message: 'Cookie 中缺少 bili_jct (CSRF)，无法执行续期' }
  }

  try {
    // Step 1: 检查是否需要刷新
    let timestamp = Date.now()
    if (!force) {
      const checkRes = await checkNeedRefresh(cookie)
      if (!checkRes.needRefresh) {
        return {
          success: true,
          refreshed: false,
          newCookie: cookie,
          newRefreshToken: refreshToken,
          message: '当前 Cookie 仍处于有效期内，无需刷新',
        }
      }
      timestamp = checkRes.timestamp
    }

    // Step 2: 计算 CorrespondPath
    const correspondPath = await getCorrespondPath(timestamp)
    if (!correspondPath) {
      return { success: false, refreshed: false, message: '生成 CorrespondPath 失败' }
    }

    // Step 3: 获取 refresh_csrf
    const htmlResp = await QueryBiliAPI(
      `https://www.bilibili.com/correspond/1/${correspondPath}`,
      'GET',
      cookie,
      true,
    )
    const html = await htmlResp.text()
    const refreshCsrf = extractRefreshCsrf(html)
    if (!refreshCsrf) {
      return { success: false, refreshed: false, message: '从页面提取 refresh_csrf 失败' }
    }

    // Step 4: 执行换票刷新
    const body = new URLSearchParams({
      csrf,
      refresh_csrf: refreshCsrf,
      source: 'main_web',
      refresh_token: refreshToken,
    })

    const refreshResp = await QueryBiliAPI(
      'https://passport.bilibili.com/x/passport-login/web/cookie/refresh',
      'POST',
      cookie,
      true,
      body,
    )
    const refreshJson = (await refreshResp.json()) as {
      code: number
      message?: string
      data?: {
        refresh_token?: string
      }
    }

    if (refreshJson.code !== 0) {
      return {
        success: false,
        refreshed: false,
        message: refreshJson.message || `换票失败 (code: ${refreshJson.code})`,
      }
    }

    const newRefreshToken = refreshJson.data?.refresh_token
    if (!newRefreshToken) {
      return { success: false, refreshed: false, message: '刷新接口未下发新的 refresh_token' }
    }

    // 从响应中更新 Cookie 键值 (涵盖 SESSDATA 与 bili_jct)
    const updatedCookieMap = new Map<string, string>(cookieMap)
    const setCookies = refreshResp.headers.get('set-cookie')
    if (setCookies) {
      const regex = /([^=;,\s]+)=([^;,]*)/g
      let match: RegExpExecArray | null
      while ((match = regex.exec(setCookies)) !== null) {
        const key = match[1].trim()
        const val = match[2].trim()
        if (
          key &&
          !['expires', 'max-age', 'domain', 'path', 'secure', 'httponly', 'samesite'].includes(
            key.toLowerCase(),
          )
        ) {
          updatedCookieMap.set(key, val)
        }
      }
    }

    const newCookie = buildCookie(updatedCookieMap)
    const newCsrf = updatedCookieMap.get('bili_jct') || csrf

    // Step 5: 确认更新（使用新 Cookie 确认使旧 refresh_token 正式注销）
    try {
      const confirmBody = new URLSearchParams({
        csrf: newCsrf,
        refresh_token: refreshToken, // 传入旧的 refresh_token 作废
      })
      await QueryBiliAPI(
        'https://passport.bilibili.com/x/passport-login/web/confirm/refresh',
        'POST',
        newCookie,
        true,
        confirmBody,
      )
    } catch (confirmErr) {
      console.warn('[CookieRefresh] 确认更新接口异常 (新凭据仍已换领成功):', confirmErr)
    }

    return {
      success: true,
      refreshed: true,
      newCookie,
      newRefreshToken,
      message: 'Cookie 自动续期换票成功',
    }
  } catch (err: any) {
    return {
      success: false,
      refreshed: false,
      message: `自动续期流程异常: ${String(err)}`,
    }
  }
}
