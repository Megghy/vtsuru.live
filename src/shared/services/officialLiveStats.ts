import { ref } from 'vue'

import { QueryGetAPI } from '@/api/query'
import { BILI_API_URL, isTauri } from '@/shared/config'

export interface OfficialLiveStats {
  /** 官方在线人数 (高能用户数/真实在线观众) */
  onlineRank: number | null
  onlineRankText: string | null
  /** 官方人气值 (热度) */
  popularity: number | null
  /** 官方本场累计点赞总数 */
  totalLikes: number | null
  /** 官方累计看过人数 (观看人次) */
  watchedCount: number | null
  watchedText: string | null
  /** 最近更新时间戳 (毫秒) */
  updatedAt: number | null
}

export interface ResponseLiveRoomStats {
  onlineRank?: number | null
  onlineRankText?: string | null
  popularity?: number | null
  totalLikes?: number | null
  watchedCount?: number | null
  watchedText?: string | null
}

export const officialLiveStats = ref<OfficialLiveStats>({
  onlineRank: null,
  onlineRankText: null,
  popularity: null,
  totalLikes: null,
  watchedCount: null,
  watchedText: null,
  updatedAt: null,
})

export function updateOfficialStats(partial: Partial<OfficialLiveStats>) {
  let changed = false
  for (const key of Object.keys(partial) as (keyof OfficialLiveStats)[]) {
    const val = partial[key]
    if (val !== undefined && val !== null && officialLiveStats.value[key] !== val) {
      ;(officialLiveStats.value[key] as any) = val
      changed = true
    }
  }
  if (changed) {
    officialLiveStats.value.updatedAt = Date.now()
  }
}

let isFetching = false

/**
 * 获取官方直播间实时统计数据
 * 优先走后端统一代理接口（规避跨域与风控），客户端环境下若接口失败则走客户端无跨域直连兜底
 */
export async function fetchOfficialLiveStats(roomId: number, uid?: number): Promise<OfficialLiveStats> {
  if (!roomId || isFetching) return officialLiveStats.value
  isFetching = true

  try {
    // 1. 优先调用后端统一接口
    const res = await QueryGetAPI<ResponseLiveRoomStats>(`${BILI_API_URL}room-stats`, {
      roomId,
      uid: uid || 0,
    })

    if (res.code === 200 && res.data) {
      updateOfficialStats({
        onlineRank: res.data.onlineRank ?? null,
        onlineRankText: res.data.onlineRankText ?? null,
        popularity: res.data.popularity ?? null,
        totalLikes: res.data.totalLikes ?? null,
        watchedCount: res.data.watchedCount ?? null,
        watchedText: res.data.watchedText ?? null,
      })
      return officialLiveStats.value
    }
  } catch (err) {
    console.warn('[OfficialLiveStats] 后端 room-stats 请求异常，尝试客户端兜底', err)
  } finally {
    isFetching = false
  }

  // 2. 客户端原生兜底（仅在 Tauri 桌面端环境下）
  if (isTauri) {
    try {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')

      const promises: Promise<void>[] = []

      // 高能榜人数
      if (uid && uid > 0) {
        promises.push(
          (async () => {
            try {
              const r = await tauriFetch(
                `https://api.live.bilibili.com/xlive/general-interface/v1/rank/getOnlineGoldRank?ruid=${uid}&roomId=${roomId}&page=1&pageSize=1`,
                { method: 'GET' },
              )
              const json = (await r.json()) as { code: number; data?: { onlineNum?: number; onlineNumText?: string } }
              if (json.code === 0 && json.data) {
                updateOfficialStats({
                  onlineRank: json.data.onlineNum ?? null,
                  onlineRankText: json.data.onlineNumText ?? null,
                })
              }
            } catch (e) {
              console.warn('[OfficialLiveStats] 客户端直连 getOnlineGoldRank 失败', e)
            }
          })(),
        )
      }

      // 房间基本信息（人气）
      promises.push(
        (async () => {
          try {
            const r = await tauriFetch(`https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${roomId}`, {
              method: 'GET',
            })
            const json = (await r.json()) as { code: number; data?: { online?: number } }
            if (json.code === 0 && json.data?.online !== undefined) {
              updateOfficialStats({
                popularity: json.data.online,
              })
            }
          } catch (e) {
            console.warn('[OfficialLiveStats] 客户端直连 get_info 失败', e)
          }
        })(),
      )

      await Promise.allSettled(promises)
    } catch (e) {
      console.warn('[OfficialLiveStats] 客户端直连兜底失败', e)
    }
  }

  return officialLiveStats.value
}
