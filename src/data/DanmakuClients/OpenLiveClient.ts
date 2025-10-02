import type { OpenLiveInfo } from '@/api/api-models'
import { KeepLiveWS } from 'bilibili-live-ws/browser'
import { clearInterval, setInterval } from 'worker-timers'
import { EventDataTypes } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { GuidUtils } from '@/Utils'
import { OPEN_LIVE_API_URL } from '../constants'
import BaseDanmakuClient from './BaseDanmakuClient'

export default class OpenLiveClient extends BaseDanmakuClient {
  public serverUrl: string = ''
  constructor(auth?: AuthInfo) {
    super()
    this.authInfo = auth
  }

  public type = 'openlive' as const

  private timer: any | undefined

  public authInfo: AuthInfo | undefined
  public roomAuthInfo: OpenLiveInfo | undefined

  public async Start(): Promise<{ success: boolean, message: string }> {
    const result = await super.Start()
    if (result.success) {
      this.timer ??= setInterval(() => {
        this.sendHeartbeat()
      }, 20 * 1000)
    }
    return result
  }

  public Stop() {
    super.Stop()
    clearInterval(this.timer)
    this.timer = undefined
    this.roomAuthInfo = undefined
  }

  protected async initClient(): Promise<{ success: boolean, message: string }> {
    const auth = await this.getAuthInfo()
    if (auth.data) {
      const chatClient = new KeepLiveWS(auth.data.anchor_info.room_id, {
        authBody: JSON.parse(auth.data.websocket_info.auth_body),
        address: auth.data.websocket_info.wss_link[0],
      })
      chatClient.on('LIVE_OPEN_PLATFORM_DM', cmd => this.onDanmaku(cmd))
      chatClient.on('LIVE_OPEN_PLATFORM_GIFT', cmd => this.onGift(cmd))
      chatClient.on('LIVE_OPEN_PLATFORM_GUARD', cmd => this.onGuard(cmd))
      chatClient.on('LIVE_OPEN_PLATFORM_SC', cmd => this.onSC(cmd))
      chatClient.on('LIVE_OPEN_PLATFORM_LIVE_ROOM_ENTER', cmd => this.onEnter(cmd))
      chatClient.on('LIVE_OPEN_PLATFORM_SUPER_CHAT_DEL', cmd => this.onScDel(cmd))
      chatClient.on('live', () => {
        console.log(
          `[${this.type}] 已连接房间: ${auth.data?.anchor_info.room_id}`,
        )
      })

      this.roomAuthInfo = auth.data

      return super.initClientInner(chatClient)
    } else {
      console.log(`[${this.type}] 无法开启场次: ${auth.message}`)
      return {
        success: false,
        message: auth.message,
      }
    }
  }

  private async getAuthInfo(): Promise<{
    data: OpenLiveInfo | null
    message: string
  }> {
    try {
      const data = await QueryPostAPI<OpenLiveInfo>(
        `${OPEN_LIVE_API_URL}start`,
        this.authInfo?.Code ? this.authInfo : undefined,
      )
      if (data.code == 200) {
        console.log(`[${this.type}] 已获取场次信息`)
        return {
          data: data.data,
          message: '',
        }
      } else {
        return {
          data: null,
          message: data.message,
        }
      }
    } catch (err) {
      return {
        data: null,
        message: err?.toString() || '未知错误',
      }
    }
  }

  private sendHeartbeat() {
    if (this.state !== 'connected') {
      clearInterval(this.timer)
      this.timer = undefined
      return
    }
    const query = this.authInfo
      ? QueryPostAPI<OpenLiveInfo>(
          `${OPEN_LIVE_API_URL}heartbeat`,
          this.authInfo,
        )
      : QueryGetAPI<OpenLiveInfo>(`${OPEN_LIVE_API_URL}heartbeat-internal`)
    query.then((data) => {
      if (data.code != 200) {
        console.error(`[${this.type}] 心跳失败, 将重新连接`)
        this.client?.close()
        this.client = null
        this.initClient()
      }
    })
  }

  public onDanmaku(command: any) {
    const data = command.data as DanmakuInfo
    this.eventsRaw.danmaku?.forEach((d) => {
      d(data, command)
    })
    this.eventsAsModel.danmaku?.forEach((d) => {
      d(
        {
          type: EventDataTypes.Message,
          uname: data.uname,
          uid: data.uid,
          msg: data.msg,
          price: 0,
          num: 0,
          time: data.timestamp,
          guard_level: data.guard_level,
          fans_medal_level: data.fans_medal_level,
          fans_medal_name: data.fans_medal_name,
          fans_medal_wearing_status: data.fans_medal_wearing_status,
          emoji: data.dm_type == 1 ? data.emoji_img_url : undefined,
          uface: data.uface,
          open_id: data.open_id,
          ouid: data.open_id ?? GuidUtils.numToGuid(data.uid),
        },
        command,
      )
    })
  }

  public onGift(command: any) {
    const data = command.data as GiftInfo
    const price = (data.price * data.gift_num) / 1000
    this.eventsRaw.gift?.forEach((d) => {
      d(data, command)
    })
    this.eventsAsModel.gift?.forEach((d) => {
      d(
        {
          type: EventDataTypes.Gift,
          uname: data.uname,
          uid: data.uid,
          msg: data.gift_name,
          price: data.paid ? price : -price,
          num: data.gift_num,
          time: data.timestamp,
          guard_level: data.guard_level,
          fans_medal_level: data.fans_medal_level,
          fans_medal_name: data.fans_medal_name,
          fans_medal_wearing_status: data.fans_medal_wearing_status,
          uface: data.uface,
          open_id: data.open_id,
          ouid: data.open_id ?? GuidUtils.numToGuid(data.uid),
        },
        command,
      )
    })
  }

  public onSC(command: any) {
    const data = command.data as SCInfo
    this.eventsRaw.sc?.forEach((d) => {
      d(data, command)
    })
    this.eventsAsModel.sc?.forEach((d) => {
      d(
        {
          type: EventDataTypes.SC,
          uname: data.uname,
          uid: data.uid,
          msg: data.message,
          price: data.rmb,
          num: 1,
          time: data.timestamp,
          guard_level: data.guard_level,
          fans_medal_level: data.fans_medal_level,
          fans_medal_name: data.fans_medal_name,
          fans_medal_wearing_status: data.fans_medal_wearing_status,
          uface: data.uface,
          open_id: data.open_id,
          ouid: data.open_id ?? GuidUtils.numToGuid(data.uid),
        },
        command,
      )
    })
  }

  public onGuard(command: any) {
    const data = command.data as GuardInfo
    this.eventsRaw.guard?.forEach((d) => {
      d(data, command)
    })
    this.eventsAsModel.guard?.forEach((d) => {
      d(
        {
          type: EventDataTypes.Guard,
          uname: data.user_info.uname,
          uid: data.user_info.uid,
          msg:
            data.guard_level == 1
              ? '总督'
              : data.guard_level == 2
                ? '提督'
                : data.guard_level == 3
                  ? '舰长'
                  : '',
          price: data.price / 1000,
          num: data.guard_num,
          time: data.timestamp,
          guard_level: data.guard_level,
          fans_medal_level: data.fans_medal_level,
          fans_medal_name: data.fans_medal_name,
          fans_medal_wearing_status: data.fans_medal_wearing_status,
          uface: data.user_info.uface,
          open_id: data.user_info.open_id,
          ouid:
            data.user_info.open_id ?? GuidUtils.numToGuid(data.user_info.uid),
        },
        command,
      )
    })
  }

  public onEnter(command: any): void {
    const data = command.data as EnterInfo
    this.eventsRaw.enter?.forEach((d) => {
      d(data)
    })
    this.eventsAsModel.enter?.forEach((d) => {
      d(
        {
          type: EventDataTypes.Enter,
          uname: data.uname,
          msg: '',
          price: 0,
          num: 0,
          time: data.timestamp,
          guard_level: 0,
          fans_medal_level: 0,
          fans_medal_name: '',
          fans_medal_wearing_status: false,
          uface: data.uface,
          open_id: data.open_id,
          uid: 0,
          ouid: data.open_id,
        },
        command,
      )
    })
  }

  public onScDel(command: any): void {
    const data = command.data as SCDelInfo
    this.eventsRaw.scDel?.forEach((d) => {
      d(data, command)
    })
    this.eventsAsModel.scDel?.forEach((d) => {
      d(
        {
          type: EventDataTypes.Enter,
          uname: '',
          msg: JSON.stringify(data.message_ids),
          price: 0,
          num: 0,
          time: Date.now(),
          guard_level: 0,
          fans_medal_level: 0,
          fans_medal_name: '',
          fans_medal_wearing_status: false,
          uface: '',
          open_id: '',
          uid: 0,
          ouid: '',
        },
        command,
      )
    })
  }
}

export interface DanmakuInfo {
  room_id: number
  uid: number
  open_id: string
  uname: string
  msg: string
  msg_id: string
  fans_medal_level: number
  fans_medal_name: string
  fans_medal_wearing_status: boolean
  guard_level: number
  timestamp: number
  uface: string
  emoji_img_url: string
  dm_type: number
}
export interface GiftInfo {
  room_id: number
  uid: number
  open_id: string
  uname: string
  uface: string
  gift_id: number
  gift_name: string
  gift_num: number
  price: number
  paid: boolean
  fans_medal_level: number
  fans_medal_name: string
  fans_medal_wearing_status: boolean
  guard_level: number
  timestamp: number
  msg_id: string
  anchor_info: {
    uid: number
    uname: string
    uface: string
  }
  gift_icon: string
  combo_gift: boolean
  combo_info: {
    combo_base_num: number
    combo_count: number
    combo_id: string
    combo_timeout: number
  }
}
export interface SCInfo {
  room_id: number // 直播间id
  uid: number // 购买用户UID
  open_id: string
  uname: string // 购买的用户昵称
  uface: string // 购买用户头像
  message_id: number // 留言id(风控场景下撤回留言需要)
  message: string // 留言内容
  msg_id: string // 消息唯一id
  rmb: number // 支付金额(元)
  timestamp: number // 赠送时间秒级
  start_time: number // 生效开始时间
  end_time: number // 生效结束时间
  guard_level: number // 对应房间大航海登记    (新增)
  fans_medal_level: number // 对应房间勋章信息  (新增)
  fans_medal_name: string // 对应房间勋章名字  (新增)
  fans_medal_wearing_status: boolean // 该房间粉丝勋章佩戴情况   (新增)
}
export interface GuardInfo {
  user_info: {
    uid: number // 用户uid
    open_id: string
    uname: string // 用户昵称
    uface: string // 用户头像
  }
  guard_level: number // 对应的大航海等级 1总督 2提督 3舰长
  guard_num: number
  price: number // 购买金额(1000=1元)
  guard_unit: string // (个月)
  fans_medal_level: number // 粉丝勋章等级
  fans_medal_name: string // 粉丝勋章名
  fans_medal_wearing_status: boolean // 该房间粉丝勋章佩戴情况
  timestamp: number
  room_id: number
  msg_id: string // 消息唯一id
}
export interface EnterInfo {
  open_id: string
  uname: string
  uface: string
  timestamp: number
  room_id: number
}
// 假设的 SC 删除事件原始信息结构 (需要根据实际情况调整)
export interface SCDelInfo {
  room_id: number
  message_ids: number[] // 被删除的 SC 的 message_id
  msg_id: string // 删除操作的消息 ID
}
export interface AuthInfo {
  Timestamp: string
  Code: string
  Mid: string
  Caller: string
  CodeSign: string
}
