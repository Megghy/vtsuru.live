import { biliGetJson, biliPostFormJson } from './bili-auth-http'

export interface TianxuanCreateParams {
  roomId: number
  awardName: string
  awardNum: number
  danmu: string
  timeSeconds: number // 60 - 1800
  requireType: 0 | 1 | 2 | 3 // 0 无要求, 1 关注主播, 2 粉丝勋章, 3 大航海
  requireValue?: number // 勋章等级或大航海等级
  giftId?: number
  giftNum?: number
}

export interface TianxuanStatusInfo {
  id: number
  status: number // 1 进行中, 2 已开奖
  awardName: string
  awardNum: number
  danmu: string
  timeLeft: number
  joinNum: number
  awardUsers: Array<{ uid: number; uname: string; face: string }>
}

/**
 * 查询直播间当前天选时刻状态与中奖名单
 */
export async function checkTianxuanStatus(roomId: number): Promise<TianxuanStatusInfo | null> {
  const data = await biliGetJson<Record<string, any>>(
    'https://api.live.bilibili.com/xlive/lottery-interface/v1/Anchor/Check',
    {
      query: { roomid: roomId },
      referer: `https://live.bilibili.com/${roomId}`,
    },
  )
  if (!data || !data.id) return null
  const winners = Array.isArray(data.award_users)
    ? data.award_users.map((u: any) => ({
        uid: Number(u.uid ?? 0),
        uname: String(u.uname ?? ''),
        face: String(u.face ?? '').replace(/^http:\/\//i, 'https://'),
      }))
    : []
  return {
    id: Number(data.id),
    status: Number(data.status ?? 0),
    awardName: String(data.award_name ?? ''),
    awardNum: Number(data.award_num ?? 1),
    danmu: String(data.danmu ?? ''),
    timeLeft: Number(data.time ?? 0),
    joinNum: Number(data.cur_gift_num ?? data.join_num ?? 0),
    awardUsers: winners,
  }
}

/**
 * 发起直播间天选时刻抽奖（主播主账号 Cookie）
 */
export async function createTianxuanLottery(params: TianxuanCreateParams): Promise<{ id: number }> {
  if (!params.awardName.trim()) throw new Error('奖品名称不能为空')
  if (!params.danmu.trim()) throw new Error('参与口令弹幕不能为空')

  const data = await biliPostFormJson<{ id?: number }>(
    'https://api.live.bilibili.com/xlive/lottery-interface/v1/Anchor/Start',
    {
      room_id: params.roomId,
      award_name: params.awardName.trim(),
      award_num: Math.max(1, Math.min(params.awardNum, 100)),
      danmu: params.danmu.trim(),
      time: Math.max(60, Math.min(params.timeSeconds, 1800)),
      require_type: params.requireType,
      require_value: params.requireValue ?? 0,
      gift_id: params.giftId ?? 0,
      gift_num: params.giftNum ?? 0,
      award_type: 0,
      visit_id: '',
    },
    { referer: `https://live.bilibili.com/${params.roomId}` },
  )

  return { id: Number(data?.id ?? 0) }
}
