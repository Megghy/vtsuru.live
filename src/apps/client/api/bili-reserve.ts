import { biliGetJson, biliPostFormJson, getMainBiliAuth } from './bili-auth-http'

export interface CreateBiliReserveResult {
  sid: number
  title: string
  livePlanStartTime: number
}

/**
 * 创建 B 站直播预约（使用主播主账号 Cookie）
 * @param title 预约标题（建议 ≤ 20 字）
 * @param livePlanStartTime 计划开播秒级 Unix 时间戳（需晚于当前时间至少 10 分钟）
 * @param options 可选配置：是否同步发布预约动态
 */
export async function createBiliLiveReserve(
  title: string,
  livePlanStartTime: number,
  options?: { dynamic?: boolean; expireAfterSeconds?: number },
): Promise<CreateBiliReserveResult> {
  const trimmed = title.trim()
  if (!trimmed) throw new Error('预约标题不能为空')
  const nowSec = Math.floor(Date.now() / 1000)
  if (livePlanStartTime <= nowSec + 180) {
    throw new Error('直播预约时间必须晚于当前时间至少 3 分钟')
  }
  const auth = await getMainBiliAuth()
  const stime = livePlanStartTime + (options?.expireAfterSeconds ?? 3600)

  const data = await biliPostFormJson<{ sid?: number; id?: number }>(
    'https://api.bilibili.com/x/activity/up/reserve/create',
    {
      type: 2,
      title: trimmed,
      live_plan_start_time: Math.floor(livePlanStartTime),
      stime: Math.floor(stime),
      from: 'space',
      dynamic: options?.dynamic === false ? 0 : 1,
    },
    {
      auth,
      referer: `https://space.bilibili.com/${auth.uid}/`,
      origin: 'https://space.bilibili.com',
    },
  )

  return {
    sid: Number(data?.sid ?? data?.id ?? 0),
    title: trimmed,
    livePlanStartTime: Math.floor(livePlanStartTime),
  }
}

/**
 * 取消 / 撤销 B 站直播预约
 */
export async function cancelBiliLiveReserve(sid: number): Promise<void> {
  if (!sid || sid <= 0) throw new Error('无效的预约 SID')
  const auth = await getMainBiliAuth()
  await biliPostFormJson(
    'https://api.bilibili.com/x/activity/up/reserve/cancel',
    {
      sid,
      from: 'space',
    },
    {
      auth,
      referer: `https://space.bilibili.com/${auth.uid}/`,
      origin: 'https://space.bilibili.com',
    },
  )
}

/**
 * 查询自己当前的 B 站空间直播预约列表
 */
export async function fetchMyBiliReserves(): Promise<
  Array<{ sid: number; name: string; livePlanStartTime: number; total: number; state: number }>
> {
  const auth = await getMainBiliAuth()
  const data = await biliGetJson<
    Array<{
      sid: number
      name: string
      type: number
      total: number
      state: number
      live_plan_start_time?: number
    }>
  >('https://api.bilibili.com/x/space/reservation', {
    auth,
    query: { vmid: auth.uid },
    referer: `https://space.bilibili.com/${auth.uid}/`,
    origin: 'https://space.bilibili.com',
  })

  return (Array.isArray(data) ? data : [])
    .filter((item) => item.type === 2)
    .map((item) => ({
      sid: item.sid,
      name: item.name,
      livePlanStartTime: item.live_plan_start_time ?? 0,
      total: item.total ?? 0,
      state: item.state ?? 0,
    }))
}
