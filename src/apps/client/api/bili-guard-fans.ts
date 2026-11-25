import { biliGetJson, getMainBiliAuth } from './bili-auth-http'

export interface AnchorGuardMemberItem {
  uid: number
  uname: string
  face: string
  guardLevel: number // 1 总督, 2 提督, 3 舰长
  expireTime: number // Unix 秒时间戳，0 表示未知
  expireText: string
  daysLeft: number | null
  accompanyDays: number
}

export interface FansMedalMemberItem {
  uid: number
  uname: string
  face: string
  medalLevel: number
  intimacy: number
  todayFeed: number
  guardLevel: number
  isLighted: boolean
}

function normalizeUrl(url?: string): string {
  if (!url) return ''
  return url.replace(/^http:\/\//i, 'https://')
}

function parseExpireTs(raw: unknown): number {
  if (typeof raw === 'number' && raw > 1_000_000_000) return Math.floor(raw)
  if (typeof raw === 'string' && raw.trim()) {
    const asNum = Number(raw)
    if (Number.isFinite(asNum) && asNum > 1_000_000_000) return Math.floor(asNum)
    const parsed = Date.parse(raw.replace(/-/g, '/'))
    if (!Number.isNaN(parsed)) return Math.floor(parsed / 1000)
  }
  return 0
}

/**
 * 拉取主播大航海成员及到期时间（使用新版 guardTab/topListNew，兼容 uinfo 嵌套结构）
 */
export async function fetchAnchorGuardExpireList(
  roomId: number,
  page = 1,
  pageSize = 30,
): Promise<{ items: AnchorGuardMemberItem[]; total: number; hasMore: boolean }> {
  const auth = await getMainBiliAuth()
  const data = await biliGetJson<{
    top3?: Array<Record<string, any>>
    list?: Array<Record<string, any>>
    info?: { num?: number; page?: number; now?: number }
  }>('https://api.live.bilibili.com/xlive/app-room/v2/guardTab/topListNew', {
    auth,
    query: { roomid: roomId, ruid: auth.uid, page, page_size: pageSize },
    referer: `https://live.bilibili.com/${roomId}`,
  })

  const combined = [...(page === 1 && Array.isArray(data?.top3) ? data.top3 : []), ...(data?.list ?? [])]
  const nowSec = Math.floor(Date.now() / 1000)

  const items: AnchorGuardMemberItem[] = combined.map((row) => {
    const uinfo = row.uinfo ?? {}
    const base = uinfo.base ?? {}
    const guard = uinfo.guard ?? {}
    const rawExpiredStr = guard.expired_str || row.expired_time || row.expire_time || row.end_time || ''
    const expireTs = parseExpireTs(rawExpiredStr)
    const daysLeft = expireTs > 0 ? Math.ceil((expireTs - nowSec) / 86400) : null

    return {
      uid: Number(uinfo.uid ?? row.uid ?? 0),
      uname: String(base.name ?? row.username ?? row.uname ?? ''),
      face: normalizeUrl(base.face ?? row.face),
      guardLevel: Number(guard.level ?? row.guard_level ?? 3),
      expireTime: expireTs,
      expireText:
        typeof rawExpiredStr === 'string' && rawExpiredStr.trim()
          ? rawExpiredStr.trim()
          : expireTs > 0
            ? new Date(expireTs * 1000).toLocaleDateString()
            : '未公开',
      daysLeft,
      accompanyDays: Number(row.accompany ?? 0),
    }
  })

  const total = Number(data?.info?.num ?? items.length)
  return {
    items,
    total,
    hasMore: (data?.info?.now ?? page) < (data?.info?.page ?? 1),
  }
}

/**
 * 拉取主播粉丝团成员列表（含粉丝牌等级、亲密度、亮牌状态）
 */
export async function fetchFansMedalMemberList(
  page = 1,
  pageSize = 30,
): Promise<{ items: FansMedalMemberItem[]; total: number; hasMore: boolean }> {
  const auth = await getMainBiliAuth()
  const data = await biliGetJson<{
    item?: Array<Record<string, any>>
    num?: number
    medal_status?: number
  }>('https://api.live.bilibili.com/xlive/general-interface/v1/rank/getFansMembersRank', {
    auth,
    query: { ruid: auth.uid, page, page_size: Math.min(30, pageSize) },
    referer: 'https://live.bilibili.com/',
  })

  const raw = Array.isArray(data?.item) ? data.item : []
  const items: FansMedalMemberItem[] = raw.map((row) => {
    const medal = row.uinfo_medal ?? {}
    return {
      uid: Number(row.uid ?? 0),
      uname: String(row.name ?? row.uname ?? ''),
      face: normalizeUrl(row.face),
      medalLevel: Number(row.level ?? medal.level ?? 0),
      intimacy: Number(row.score ?? medal.score ?? 0),
      todayFeed: 0,
      guardLevel: Number(row.guard_level ?? medal.guard_level ?? 0),
      isLighted: Boolean(medal.is_light ?? 1),
    }
  })

  const total = Number(data?.num ?? items.length)
  return {
    items,
    total,
    hasMore: raw.length > 0 && page * Math.min(30, pageSize) < total,
  }
}
