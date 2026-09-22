import type { OpenLiveDanmakuAuth } from '@vtsuru/danmaku'

import { withToken } from './api'

interface OpenLiveStartData {
  websocket_info?: { auth_body?: string; wss_link?: string[] }
  anchor_info?: { room_id?: number }
}

export async function resolveOpenLiveAuth(apiBase: string, token: string, fetchImpl: typeof fetch = fetch): Promise<OpenLiveDanmakuAuth> {
  const response = await fetchImpl(withToken(`${apiBase}api/open-live/start`, token))
  if (!response.ok) throw new Error(`无法开启场次: ${response.status}`)
  const json = (await response.json()) as { code: number; message?: string; data?: OpenLiveStartData }
  if (json.code !== 200) throw new Error(json.message || '无法开启场次')
  const authBody = json.data?.websocket_info?.auth_body
  const address = json.data?.websocket_info?.wss_link?.[0]
  const roomId = json.data?.anchor_info?.room_id
  if (!authBody || !address || !roomId) throw new Error('无法开启场次')
  return {
    type: 'openlive',
    roomId,
    authBody: JSON.parse(authBody) as Record<string, unknown>,
    address,
  }
}

export async function openLiveHeartbeat(apiBase: string, token: string, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(withToken(`${apiBase}api/open-live/heartbeat-internal`, token))
  if (!response.ok) return false
  const json = (await response.json()) as { code: number }
  return json.code === 200
}
