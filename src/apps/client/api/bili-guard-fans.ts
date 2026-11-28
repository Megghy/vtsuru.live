import { biliGetJson, biliPostFormJson, getMainBiliAuth } from './bili-auth-http'

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

export interface AnchorGuardStreamItem {
  streamKey: string
  uid: number
  uname: string
  face: string
  goodsId: number
  guardLevel: number // 1 总督, 2 提督, 3 舰长
  msg: '舰长' | '提督' | '总督'
  time: number // Unix ms
  timeText: string
  num: number
  hamster: number
  price: number // 按金仓鼠推算的观众实付元数，缺省按档位回退
  roomId: number
}

export interface FetchGuardStreamProgress {
  monthLabel: string
  monthIndex: number
  monthTotal: number
  page: number
  totalPage: number
  waitingReady: boolean
  fetchedCount: number
}

const DEFAULT_GUARD_GOODS_IDS = [5, 6, 7] as const
const LIVE_CENTER_REFERER = 'https://link.bilibili.com/p/center/index'
const LIVE_CENTER_ORIGIN = 'https://link.bilibili.com'

function resolveGuardTypeFromGoods(goodsId: number, name: string): { guardLevel: number; msg: '舰长' | '提督' | '总督' } | null {
  const trimmed = name.trim()
  if (goodsId === 5 || trimmed === '总督') return { guardLevel: 1, msg: '总督' }
  if (goodsId === 6 || trimmed === '提督') return { guardLevel: 2, msg: '提督' }
  if (goodsId === 7 || trimmed === '舰长') return { guardLevel: 3, msg: '舰长' }
  return null
}

function defaultPriceByGuardMsg(msg: '舰长' | '提督' | '总督'): number {
  if (msg === '总督') return 15998
  if (msg === '提督') return 1598
  return 138
}

function estimatePriceFromHamster(hamster: number, msg: '舰长' | '提督' | '总督'): number {
  // B 站常规分成 50%，1000 金仓鼠 = 1 元主播分成，对应观众支付 2 元（即 hamster / 500）
  if (Number.isFinite(hamster) && hamster > 0) {
    return Math.round((hamster / 500) * 100) / 100
  }
  return defaultPriceByGuardMsg(msg)
}

function parseBiliBeijingTimeMs(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) return 0
  const iso = `${trimmed.replace(' ', 'T')}+08:00`
  const parsed = Date.parse(iso)
  return Number.isNaN(parsed) ? 0 : parsed
}

function formatYmdCompact(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function parseYmdDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0)
}

export function splitDateRangeByMonth(
  startDateYmd: string,
  endDateYmd: string,
): Array<{ beginDate: string; endDate: string; label: string }> {
  const start = parseYmdDate(startDateYmd)
  const end = parseYmdDate(endDateYmd)
  if (start.getTime() > end.getTime()) return []

  const slices: Array<{ beginDate: string; endDate: string; label: string }> = []
  let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())

  while (cursor.getTime() <= end.getTime()) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
    const sliceEnd = monthEnd.getTime() < end.getTime() ? monthEnd : end
    slices.push({
      beginDate: formatYmdCompact(cursor),
      endDate: formatYmdCompact(sliceEnd),
      label: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
    })
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }

  return slices
}

function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/**
 * 获取主播后台大航海分类对应的 goods_id（默认 [5, 6, 7]：总督/提督/舰长）
 */
export async function fetchAnchorGuardGoodsIds(): Promise<number[]> {
  try {
    const data = await biliGetJson<{
      list?: Array<{
        category_type?: number
        category_name?: string
        items?: Array<{ goods_id?: number; gift_id?: number; name?: string }>
      }>
    }>('https://api.live.bilibili.com/xlive/revenue/v2/giftStream/getGiftTypes', {
      referer: LIVE_CENTER_REFERER,
      origin: LIVE_CENTER_ORIGIN,
    })

    const guardCategory = data?.list?.find(
      (cat) => cat.category_type === 0 && (cat.category_name?.includes('大航海') || cat.items?.some((i) => i.name === '舰长')),
    )
    const ids = (guardCategory?.items ?? [])
      .map((i) => Number(i.goods_id))
      .filter((id) => Number.isInteger(id) && id > 0)

    return ids.length > 0 ? Array.from(new Set(ids)) : [...DEFAULT_GUARD_GOODS_IDS]
  } catch {
    return [...DEFAULT_GUARD_GOODS_IDS]
  }
}

interface BiliGiftStreamRawItem {
  uid?: number
  uname?: string
  time?: string
  goods_id?: number
  gift_id?: number
  name?: string
  num?: number
  hamster?: number
  room_id?: number
  uinfo?: {
    uid?: number
    base?: {
      name?: string
      face?: string
    }
  }
}

interface BiliGiftStreamPageResponse {
  ready?: number
  total_page?: number
  total_count?: number
  total_hamster?: number
  list?: BiliGiftStreamRawItem[]
}

/**
 * 从主播后台收礼流水接口拉取指定日期范围内的大航海（总督/提督/舰长）流水
 * 接口：POST https://api.live.bilibili.com/xlive/revenue/v1/giftStream/getReceivedGiftStream
 */
export async function fetchAnchorGuardStream(options: {
  startDate: string // yyyy-MM-dd
  endDate: string // yyyy-MM-dd
  signal?: AbortSignal
  onProgress?: (progress: FetchGuardStreamProgress) => void
}): Promise<AnchorGuardStreamItem[]> {
  const slices = splitDateRangeByMonth(options.startDate, options.endDate)
  if (slices.length === 0) return []

  const auth = await getMainBiliAuth()
  const goodsIds = await fetchAnchorGuardGoodsIds()
  const goodsIdParam = goodsIds.join(',')

  const items: AnchorGuardStreamItem[] = []
  const keyCounter = new Map<string, number>()

  const pollPage = async (
    beginDate: string,
    endDate: string,
    page: number,
    monthLabel: string,
    monthIndex: number,
    knownTotalPage: number,
  ): Promise<BiliGiftStreamPageResponse> => {
    const startedAt = Date.now()
    const timeoutMs = 90_000
    let attempt = 0

    while (Date.now() - startedAt < timeoutMs) {
      if (options.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError')
      }

      const data = await biliPostFormJson<BiliGiftStreamPageResponse>(
        'https://api.live.bilibili.com/xlive/revenue/v1/giftStream/getReceivedGiftStream',
        {
          page,
          gift_id: 0,
          begin_date: beginDate,
          end_date: endDate,
          uname: '',
          goods_id: goodsIdParam,
        },
        {
          auth,
          referer: LIVE_CENTER_REFERER,
          origin: LIVE_CENTER_ORIGIN,
        },
      )

      if (data?.ready === 1) {
        return data
      }

      options.onProgress?.({
        monthLabel,
        monthIndex,
        monthTotal: slices.length,
        page: page + 1,
        totalPage: knownTotalPage,
        waitingReady: true,
        fetchedCount: items.length,
      })

      const delay = Math.min(1000 * Math.pow(2, attempt), 10_000)
      attempt++
      await sleepWithAbort(delay, options.signal)
    }

    throw new Error(`拉取 ${monthLabel} 流水超时，B 站后台仍在生成数据，请稍后重试`)
  }

  for (let i = 0; i < slices.length; i++) {
    const slice = slices[i]
    let page = 0
    let totalPage = 1

    while (page < totalPage) {
      options.onProgress?.({
        monthLabel: slice.label,
        monthIndex: i + 1,
        monthTotal: slices.length,
        page: page + 1,
        totalPage,
        waitingReady: false,
        fetchedCount: items.length,
      })

      const res = await pollPage(slice.beginDate, slice.endDate, page, slice.label, i + 1, totalPage)
      if (page === 0) {
        totalPage = Math.max(0, Number(res.total_page ?? 0))
      }

      const list = Array.isArray(res.list) ? res.list : []
      for (const row of list) {
        const goodsId = Number(row.goods_id ?? 0)
        const rawName = String(row.name ?? '')
        const resolved = resolveGuardTypeFromGoods(goodsId, rawName)
        if (!resolved) continue

        const uid = Number(row.uid ?? row.uinfo?.uid ?? 0)
        const uname = String(row.uname ?? row.uinfo?.base?.name ?? '').trim()
        const timeText = String(row.time ?? '').trim()
        const timeMs = parseBiliBeijingTimeMs(timeText)
        if (!uid || !timeMs) continue

        const num = Math.max(1, Number(row.num ?? 1))
        const hamster = Number(row.hamster ?? 0)
        const baseKey = `${timeMs}_${uid}_${goodsId}_${num}_${hamster}`
        const seq = keyCounter.get(baseKey) ?? 0
        keyCounter.set(baseKey, seq + 1)

        items.push({
          streamKey: `${baseKey}_${seq}`,
          uid,
          uname: uname || `UID:${uid}`,
          face: normalizeUrl(row.uinfo?.base?.face),
          goodsId,
          guardLevel: resolved.guardLevel,
          msg: resolved.msg,
          time: timeMs,
          timeText,
          num,
          hamster,
          price: estimatePriceFromHamster(hamster, resolved.msg),
          roomId: Number(row.room_id ?? 0),
        })
      }

      page++
      if (page < totalPage) {
        await sleepWithAbort(250, options.signal)
      }
    }
  }

  return items.toSorted((a, b) => b.time - a.time)
}
