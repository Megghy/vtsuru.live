import { useBiliCookie } from '../store/useBiliCookie'
import { QueryBiliAPI } from '../data/utils'
import { usePersistedStorage, whenPersistedReady } from '@/shared/storage/persist'

export interface BiliFollowerItem {
  mid: number
  uname: string
  face: string
  sign: string
  mtime: number // 关注时间 (秒时间戳)
  attribute: number // 0=未关注, 2=已关注, 6=互相关注
  followerCount?: number // 自身粉丝数
  followingCount?: number // 自身关注数
  statLoaded: boolean // 是否已加载数据
  isFetchingStat?: boolean // 是否正在拉取数据
  isFollowingAction?: boolean // 是否正在回关中
}

export interface FollowersListResponse {
  list: BiliFollowerItem[]
  total: number
}

export interface UserStatCacheItem {
  follower: number
  following: number
  expireAt: number
}

// 粉丝数长效持久化存储 (7天有效)，跨会话、重启不丢失，彻底杜绝高频查询风控
const STAT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const userStatPersistedCache = usePersistedStorage<Record<string, UserStatCacheItem>>(
  'client.fans_viewer.stat_cache',
  {},
)

export interface PersistedFansViewerCache {
  vmid: number
  updatedAt: number
  total: number
  list: BiliFollowerItem[]
}

export const fansViewerCache = usePersistedStorage<PersistedFansViewerCache>(
  'client.fans_viewer.cache',
  {
    vmid: 0,
    updatedAt: 0,
    total: 0,
    list: [],
  },
)

export async function saveFansViewerCache(vmid: number, list: BiliFollowerItem[], total: number) {
  fansViewerCache.value = {
    vmid,
    updatedAt: Date.now(),
    total,
    list: list.slice(0, 1000), // 本地最多持久化缓存最近 1000 位粉丝
  }
}

export async function getFansViewerCache(vmid: number): Promise<PersistedFansViewerCache | null> {
  await whenPersistedReady(fansViewerCache)
  if (fansViewerCache.value.vmid === vmid && fansViewerCache.value.list.length > 0) {
    return fansViewerCache.value
  }
  return null
}

/**
 * 获取主播粉丝列表
 * 采用允许的最大单页 ps=50，减少网络往返与接口调用次数
 */
export async function fetchFollowersList(
  vmid: number,
  pn: number = 1,
  ps: number = 50,
): Promise<FollowersListResponse> {
  const biliCookieStore = useBiliCookie()
  const cookie = (await biliCookieStore.getBiliCookie()) || ''

  // B站粉丝接口最大单页 ps 为 50
  const url = `https://api.bilibili.com/x/relation/followers?vmid=${vmid}&pn=${pn}&ps=${ps}&order=desc`
  const resp = await QueryBiliAPI(url, 'GET', cookie, true)
  const json = (await resp.json()) as {
    code: number
    message?: string
    data?: {
      list?: Array<{
        mid: number
        uname: string
        face: string
        sign: string
        mtime: number
        attribute: number
      }>
      total?: number
    }
  }

  if (json.code !== 0 || !json.data) {
    throw new Error(json.message || `获取粉丝列表失败 (code: ${json.code})`)
  }

  const rawList = json.data.list || []
  const list: BiliFollowerItem[] = rawList.map((item) => {
    const cached = userStatPersistedCache.value[String(item.mid)]
    const isCacheValid = cached && cached.expireAt > Date.now()

    return {
      mid: item.mid,
      uname: item.uname,
      face: item.face,
      sign: item.sign,
      mtime: item.mtime,
      attribute: item.attribute,
      followerCount: isCacheValid ? cached.follower : undefined,
      followingCount: isCacheValid ? cached.following : undefined,
      statLoaded: !!isCacheValid,
    }
  })

  return {
    list,
    total: json.data.total || 0,
  }
}

/**
 * 获取单个用户的粉丝数与关注数 (带长效持久化缓存)
 */
export async function fetchUserStat(
  mid: number,
): Promise<{ follower: number; following: number }> {
  const cached = userStatPersistedCache.value[String(mid)]
  if (cached && cached.expireAt > Date.now()) {
    return { follower: cached.follower, following: cached.following }
  }

  const url = `https://api.bilibili.com/x/relation/stat?vmid=${mid}`
  const resp = await QueryBiliAPI(url, 'GET', '', false)
  const json = (await resp.json()) as {
    code: number
    message?: string
    data?: {
      mid: number
      following: number
      follower: number
    }
  }

  if (json.code === 0 && json.data) {
    const stat = {
      follower: json.data.follower || 0,
      following: json.data.following || 0,
      expireAt: Date.now() + STAT_CACHE_TTL_MS,
    }
    userStatPersistedCache.value[String(mid)] = stat
    return { follower: stat.follower, following: stat.following }
  }

  throw new Error(json.message || `获取用户关系数据失败: ${json.code}`)
}

/**
 * 批量获取列表项的粉丝数 (轻量并发限速队列，平滑限流与智能退避，避免触发 412/429 风控)
 */
export async function batchFetchFollowerStats(
  items: BiliFollowerItem[],
  onProgress?: (completed: number, total: number) => void,
  concurrency: number = 2,
  baseDelayMs: number = 250,
): Promise<void> {
  const unpopulated = items.filter((item) => !item.statLoaded)
  if (unpopulated.length === 0) return

  let index = 0
  let completed = items.length - unpopulated.length
  onProgress?.(completed, items.length)

  const worker = async () => {
    while (index < unpopulated.length) {
      const current = unpopulated[index++]
      if (!current) break

      current.isFetchingStat = true
      let retryCount = 0
      while (retryCount <= 1) {
        try {
          const stat = await fetchUserStat(current.mid)
          current.followerCount = stat.follower
          current.followingCount = stat.following
          current.statLoaded = true
          break
        } catch (err: any) {
          const errMsg = String(err?.message || err)
          const isRateLimited = errMsg.includes('-412') || errMsg.includes('429') || errMsg.includes('频繁')
          if (isRateLimited && retryCount === 0) {
            console.warn(`[FansViewer] 触发 B 站频控拦截 (-412/429)，进入 2s 退避等待重试...`)
            retryCount++
            await new Promise((resolve) => setTimeout(resolve, 2000))
            continue
          }
          console.warn(`[FansViewer] 获取用户 ${current.mid} 统计数据失败:`, err)
          break
        }
      }

      current.isFetchingStat = false
      completed++
      onProgress?.(completed, items.length)

      // 每次请求后留有安全平滑间隔 (250ms + 0~100ms 随机抖动)，严格控制总频次在 3~5 QPS 内
      const jitter = Math.floor(Math.random() * 100)
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs + jitter))
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, unpopulated.length) }, () => worker())
  await Promise.all(workers)
}

/**
 * 在客户端内直接回关关注该用户
 */
export async function followBiliUser(mid: number): Promise<void> {
  const biliCookieStore = useBiliCookie()
  const cookie = (await biliCookieStore.getBiliCookie()) || ''
  if (!cookie) {
    throw new Error('未检测到有效的 B 站登录凭证，无法执行回关')
  }

  const match = cookie.match(/bili_jct=([^;]+)/)
  const csrf = match ? match[1] : ''
  if (!csrf) {
    throw new Error('Cookie 中未找到 bili_jct (CSRF)，无法执行回关')
  }

  const body = new URLSearchParams({
    fid: String(mid),
    act: '1', // 1: 关注
    re_src: '11',
    csrf,
  })

  const resp = await QueryBiliAPI('https://api.bilibili.com/x/relation/modify', 'POST', cookie, true, body)
  const json = (await resp.json()) as { code: number; message?: string }

  if (json.code !== 0) {
    throw new Error(json.message || `回关失败: ${json.code}`)
  }
}
