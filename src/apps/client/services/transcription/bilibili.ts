import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

const PLAY_INFO_URL = 'https://api.live.bilibili.com/xlive/web-room/v2/index/getRoomPlayInfo'

interface StreamFormat {
  format_name: string
  codec: Array<{
    codec_name: string
    base_url: string
    url_info: Array<{ host: string; extra: string }>
  }>
}

interface PlayInfoResponse {
  code: number
  message: string
  data: {
    room_id: number
    live_status: number
    playurl_info?: {
      playurl?: {
        stream?: Array<{
          protocol_name: string
          format: StreamFormat[]
        }>
      }
    }
  }
}

export interface BilibiliStreamSource {
  url: string
  canonicalRoomId: number
  protocol: string
  format: string
}

const FORMAT_ORDER = ['flv', 'ts', 'fmp4']
const PROTOCOL_ORDER = ['http_stream', 'http_hls']

export async function resolveBilibiliStream(roomId: number): Promise<BilibiliStreamSource> {
  const query = new URLSearchParams({
    room_id: String(roomId),
    protocol: '0,1',
    format: '0,1,2',
    codec: '0,1',
    qn: '10000',
    platform: 'web',
    ptype: '8',
  })
  const response = await tauriFetch(`${PLAY_INFO_URL}?${query}`)
  if (!response.ok) throw new Error(`Bilibili 播放接口请求失败: HTTP ${response.status}`)
  const payload = (await response.json()) as PlayInfoResponse
  if (payload.code !== 0) throw new Error(payload.message || `Bilibili 播放接口返回 ${payload.code}`)
  if (payload.data.live_status !== 1) throw new Error('当前绑定的 Bilibili 直播间未开播')

  const streams = payload.data.playurl_info?.playurl?.stream ?? []
  for (const protocol of PROTOCOL_ORDER) {
    const stream = streams.find((item) => item.protocol_name === protocol)
    if (!stream) continue
    for (const formatName of FORMAT_ORDER) {
      const format = stream.format.find((item) => item.format_name === formatName)
      const codec = format?.codec.find((item) => item.codec_name === 'avc') ?? format?.codec[0]
      const url = codec?.url_info[0]
      if (codec && url) {
        return {
          url: `${url.host}${codec.base_url}${url.extra}`,
          canonicalRoomId: payload.data.room_id,
          protocol,
          format: formatName,
        }
      }
    }
  }
  throw new Error('Bilibili 未返回可用的直播播放流')
}
