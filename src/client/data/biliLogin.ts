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
  const json = await response.json()

  if (json.data && json.data.uid) {
    return json.data.uid
  }

  return 0
}
// 二维码地址及扫码密钥
export async function getLoginUrlAsync(): Promise<any> {
  const url = 'https://passport.bilibili.com/x/passport-login/web/qrcode/generate'
  const response = await QueryBiliAPI(url, 'GET')
  if (!response.ok) {
    const result = await response.text()
    error(`无法获取B站登陆二维码: ${result}`)
    throw new Error('获取二维码地址失败')
  }
  return response.json()
}

export async function getLoginUrlDataAsync(): Promise<{
  url: string
  qrcode_key: string
}> {
  const message = await getLoginUrlAsync()
  if (message.code !== 0) {
    throw new Error('获取二维码地址失败')
  }
  return message.data as {
    url: string
    qrcode_key: string
  }
}
type QRCodeLoginInfo
  = | { status: 'expired' }
    | { status: 'unknown' }
    | { status: 'scanned' }
    | { status: 'waiting' }
    | { status: 'confirmed', cookie: string, refresh_token: string }
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

  const cookies = response.headers.get('set-cookie')
  if (!cookies) {
    throw new Error('无法获取 Cookie')
  }

  return { status: 'confirmed', cookie: extractCookie(cookies), refresh_token: message.data.refresh_token }
}

function extractCookie(cookies: string): string {
  const cookieArray = cookies
    .split(',')
    .map(cookie => cookie.split(';')[0].trim())
    .filter(Boolean)
  const cookieSet = new Set(cookieArray)
  return Array.from(cookieSet).join('; ')
}
