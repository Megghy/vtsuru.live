import { biliGetJson, biliPostFormJson } from './bili-auth-http'

export interface SilentUserItem {
  id: number
  tuid: number
  tname: string
  admin_name?: string
  ctime: string
  block_end_time?: string
  msg?: string
}

export interface RoomAdminItem {
  uid: number
  uname: string
  ctime?: string
  face?: string
}

export interface ShieldKeywordItem {
  keyword: string
  id?: number
}

export type RoomSilentModeType = 'off' | 'member' | 'level' | 'medal'

const LIVE_ROOM_REFERER = (roomId: number) => `https://live.bilibili.com/${roomId}`

/**
 * 禁言直播间用户
 * @param roomId 真实房间号
 * @param targetUid 目标用户 UID
 * @param hour 禁言时长：-1 永久，0 本场直播，1..720 指定小时
 * @param msg 触发禁言的弹幕文本（可选）
 */
export async function banLiveRoomUser(
  roomId: number,
  targetUid: number,
  hour: number = 1,
  msg: string = '',
): Promise<unknown> {
  const normalizedHour = hour <= -1 ? -1 : hour === 0 ? 0 : Math.max(1, Math.min(Math.round(hour), 720))
  return biliPostFormJson(
    'https://api.live.bilibili.com/xlive/web-ucenter/v1/banned/AddSilentUser',
    {
      room_id: roomId,
      tuid: targetUid,
      type: normalizedHour === 0 ? 2 : 1,
      hour: normalizedHour,
      mobile_app: 'web',
      msg,
      visit_id: '',
    },
    { referer: LIVE_ROOM_REFERER(roomId) },
  )
}

/**
 * 获取当前直播间禁言用户列表
 */
export async function getSilentUserList(roomId: number, page = 1): Promise<{ items: SilentUserItem[]; totalPage: number }> {
  const data = await biliPostFormJson<{
    data?: SilentUserItem[]
    total_page?: number
  }>(
    'https://api.live.bilibili.com/xlive/web-ucenter/v1/banned/GetSilentUserList',
    {
      room_id: roomId,
      ps: page,
      visit_id: '',
    },
    { referer: LIVE_ROOM_REFERER(roomId) },
  )
  return {
    items: Array.isArray(data?.data) ? data.data : [],
    totalPage: Number(data?.total_page ?? 1),
  }
}

/**
 * 解除直播间用户禁言（传入目标用户 UID）
 */
export async function unbanLiveRoomUser(roomId: number, targetUid: number): Promise<void> {
  await biliPostFormJson(
    'https://api.live.bilibili.com/xlive/web-ucenter/v1/banned/DelSilentUser',
    {
      room_id: roomId,
      tuid: targetUid,
      mobi_app: 'web',
      visit_id: '',
    },
    { referer: LIVE_ROOM_REFERER(roomId) },
  )
}

/**
 * 获取当前直播间房管列表
 */
export async function getRoomAdminList(roomId: number, page = 1, pageSize = 50): Promise<RoomAdminItem[]> {
  const data = await biliGetJson<{
    data?: Array<{ uid: number; uname: string; ctime?: string; face?: string }>
  }>('https://api.live.bilibili.com/xlive/app-ucenter/v1/roomAdmin/get_by_anchor', {
    query: { page, page_size: pageSize },
    referer: LIVE_ROOM_REFERER(roomId),
  })
  return Array.isArray(data?.data) ? data.data : []
}

/**
 * 任命直播间房管
 */
export async function addRoomAdmin(roomId: number, targetUid: number): Promise<void> {
  await biliPostFormJson(
    'https://api.live.bilibili.com/xlive/web-ucenter/v1/roomAdmin/appoint',
    {
      admin: targetUid,
      admin_level: 1,
      visit_id: '',
    },
    { referer: LIVE_ROOM_REFERER(roomId) },
  )
}

/**
 * 撤销直播间房管
 */
export async function removeRoomAdmin(roomId: number, targetUid: number): Promise<void> {
  await biliPostFormJson(
    'https://api.live.bilibili.com/xlive/app-ucenter/v1/roomAdmin/dismiss',
    {
      uid: targetUid,
      visit_id: '',
    },
    { referer: LIVE_ROOM_REFERER(roomId) },
  )
}

/**
 * 获取直播间屏蔽词列表
 */
export async function getShieldKeywords(roomId: number): Promise<ShieldKeywordItem[]> {
  const data = await biliPostFormJson<{
    keyword_list?: Array<string | { keyword: string; id?: number }>
    list?: Array<string | { keyword: string; id?: number }>
  }>(
    'https://api.live.bilibili.com/xlive/web-ucenter/v1/banned/GetShieldKeywordList',
    {
      room_id: roomId,
      visit_id: '',
    },
    { referer: LIVE_ROOM_REFERER(roomId) },
  )
  const raw = data?.keyword_list ?? data?.list ?? []
  return raw
    .map((item) => (typeof item === 'string' ? { keyword: item } : { keyword: item.keyword, id: item.id }))
    .filter((item) => !!item.keyword)
}

/**
 * 添加直播间屏蔽词
 */
export async function addShieldKeyword(roomId: number, keyword: string): Promise<void> {
  const trimmed = keyword.trim()
  if (!trimmed) throw new Error('屏蔽词不能为空')
  await biliPostFormJson(
    'https://api.live.bilibili.com/xlive/web-ucenter/v1/banned/AddShieldKeyword',
    {
      room_id: roomId,
      keyword: trimmed,
      visit_id: '',
    },
    { referer: LIVE_ROOM_REFERER(roomId) },
  )
}

/**
 * 删除直播间屏蔽词
 */
export async function deleteShieldKeyword(roomId: number, keyword: string): Promise<void> {
  await biliPostFormJson(
    'https://api.live.bilibili.com/xlive/web-ucenter/v1/banned/DelShieldKeyword',
    {
      room_id: roomId,
      keyword,
      visit_id: '',
    },
    { referer: LIVE_ROOM_REFERER(roomId) },
  )
}

/**
 * 设置直播间全局禁言 / 发言门槛
 * @param roomId 房间号
 * @param type off(关闭) | member(全员禁言) | level(用户等级限制) | medal(粉丝勋章等级限制)
 * @param level 门槛等级（type 为 level 或 medal 时生效）
 * @param minute 持续分钟数（0 表示本场持续有效）
 */
export async function setRoomSilentMode(
  roomId: number,
  type: RoomSilentModeType,
  level: number = 0,
  minute: number = 0,
): Promise<void> {
  await biliPostFormJson(
    'https://api.live.bilibili.com/xlive/web-room/v1/banned/RoomSilent',
    {
      room_id: roomId,
      type,
      level: type === 'off' || type === 'member' ? 0 : Math.max(1, level),
      minute: Math.max(0, minute),
      visit_id: '',
    },
    { referer: LIVE_ROOM_REFERER(roomId) },
  )
}
