import type { DirectDanmakuAuth } from '@vtsuru/danmaku'

import { signWbi, wbiKeyFromUrl } from './wbi'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

interface NavData {
  mid: number
  wbi_img: { img_url: string; sub_url: string }
}

interface DanmuInfo {
  token: string
  host_list: { host: string; wss_port: number }[]
}

async function getJson<T>(url: string, cookie: string, fetchImpl: typeof fetch) {
  const response = await fetchImpl(url, {
    headers: {
      Cookie: cookie,
      'User-Agent': USER_AGENT,
      Referer: 'https://live.bilibili.com/',
    },
  })
  if (!response.ok) throw new Error(`${url} ${response.status}`)
  return (await response.json()) as { code: number; message?: string; data?: T }
}

export async function resolveDirectAuth(input: {
  roomId: number
  uid: number
  cookie: string
  fetch?: typeof fetch
  nowSeconds?: number
  random?: () => number
}): Promise<DirectDanmakuAuth> {
  const fetchImpl = input.fetch ?? fetch
  const nav = await getJson<NavData>('https://api.bilibili.com/x/web-interface/nav', input.cookie, fetchImpl)
  if (nav.code !== 0 || !nav.data) throw new Error(nav.message || '无法从 Cookie 获取用户信息')

  const buvid = await getJson<{ buvid: string }>('https://api.bilibili.com/x/web-frontend/getbuvid', input.cookie, fetchImpl)
  if (buvid.code !== 0 || !buvid.data?.buvid) throw new Error(buvid.message || '无法获取buvid')

  const signed = signWbi(
    { id: String(input.roomId), type: '0' },
    wbiKeyFromUrl(nav.data.wbi_img.img_url),
    wbiKeyFromUrl(nav.data.wbi_img.sub_url),
    input.nowSeconds ?? Math.floor(Date.now() / 1000),
  )
  const info = await getJson<DanmuInfo>(
    `https://api.live.bilibili.com/xlive/web-room/v1/index/getDanmuInfo?${signed}`,
    input.cookie,
    fetchImpl,
  )
  if (info.code !== 0 || !info.data?.token || !info.data.host_list?.length) {
    throw new Error(info.message || '无法获取直播间 key')
  }
  const host = info.data.host_list[Math.floor((input.random ?? Math.random)() * info.data.host_list.length)]
  return {
    type: 'direct',
    roomId: input.roomId,
    token: info.data.token,
    buvid: buvid.data.buvid,
    uid: input.uid,
    address: directSocketAddress(host.host, host.wss_port),
  }
}

export function directSocketAddress(host: string, wssPort: number) {
  return `wss://${host}:${wssPort}/sub`
}
