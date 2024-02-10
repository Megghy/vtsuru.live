import { EventDataTypes, EventModel, OpenLiveInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import ChatClientDirectOpenLive from '@/data/chat/ChatClientDirectOpenLive.js'
import { ref } from 'vue'
import { clearInterval, setInterval } from 'worker-timers'
import { OPEN_LIVE_API_URL } from './constants'
import { GuidUtils } from '@/Utils'

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
interface GuardInfo {
  user_info: {
    uid: number // 用户uid
    open_id: string
    uname: string // 用户昵称
    uface: string // 用户头像
  }
  guard_level: number // 对应的大航海等级 1总督 2提督 3舰长
  guard_num: number
  guard_unit: string // (个月)
  fans_medal_level: number // 粉丝勋章等级
  fans_medal_name: string // 粉丝勋章名
  fans_medal_wearing_status: boolean // 该房间粉丝勋章佩戴情况
  timestamp: number
  room_id: number
  msg_id: string // 消息唯一id
}
export interface AuthInfo {
  Timestamp: string
  Code: string
  Mid: string
  Caller: string
  CodeSign: string
}
/**
 * 场次信息
 */
interface GameInfo {
  /**
   * 场次id,心跳key(心跳保持20s-60s)调用一次,超过60s无心跳自动关闭,长连停止推送消息
   */
  game_id: string
}

/**
 * 长连信息
 */
interface WebsocketInfo {
  /**
   * 长连使用的请求json体 第三方无需关注内容,建立长连时使用即可
   */
  auth_body: string
  /**
   * wss 长连地址
   */
  wss_link: string[]
}

/**
 * 主播信息
 */
interface AnchorInfo {
  /**
   * 主播房间号
   */
  room_id: number
  /**
   * 主播昵称
   */
  uname: string
  /**
   * 主播头像
   */
  uface: string
  /**
   * 主播uid
   */
  uid: number
}
export interface RoomAuthInfo {
  /**
   * 场次信息
   */
  game_info: GameInfo
  /**
   * 长连信息
   */
  websocket_info: WebsocketInfo
  /**
   * 主播信息
   */
  anchor_info: AnchorInfo
}
interface DanmakuEventsMap {
  danmaku: (arg1: DanmakuInfo, arg2?: any) => void
  gift: (arg1: GiftInfo, arg2?: any) => void
  sc: (arg1: SCInfo, arg2?: any) => void
  guard: (arg1: GuardInfo, arg2?: any) => void
}

export default class DanmakuClient {
  constructor(auth: AuthInfo | null) {
    this.authInfo = auth
  }

  private client: any
  private authInfo: AuthInfo | null
  private timer: any | undefined

  public roomAuthInfo = ref<RoomAuthInfo>({} as RoomAuthInfo)
  public authCode: string | undefined

  private events: {
    danmaku: ((arg1: DanmakuInfo, arg2?: any) => void)[]
    gift: ((arg1: GiftInfo, arg2?: any) => void)[]
    sc: ((arg1: SCInfo, arg2?: any) => void)[]
    guard: ((arg1: GuardInfo, arg2?: any) => void)[]
  } = {
    danmaku: [],
    gift: [],
    sc: [],
    guard: [],
  }
  private eventsAsModel: {
    danmaku: ((arg1: EventModel, arg2?: any) => void)[]
    gift: ((arg1: EventModel, arg2?: any) => void)[]
    sc: ((arg1: EventModel, arg2?: any) => void)[]
    guard: ((arg1: EventModel, arg2?: any) => void)[]
  } = {
    danmaku: [],
    gift: [],
    sc: [],
    guard: [],
  }

  public async Start(): Promise<{ success: boolean; message: string }> {
    if (!this.client) {
      console.log('[OPEN-LIVE] 正在启动弹幕客户端')
      const result = await this.initClient()
      if (result.success) {
        this.timer = setInterval(() => {
          this.sendHeartbeat()
        }, 20 * 1000)
      }
      return result
    } else {
      console.warn('[OPEN-LIVE] 弹幕客户端已被启动过')
      return {
        success: false,
        message: '弹幕客户端已被启动过',
      }
    }
  }
  public Stop() {
    if (this.client) {
      console.log('[OPEN-LIVE] 正在停止弹幕客户端')
      this.client.stop()
    } else {
      console.warn('[OPEN-LIVE] 弹幕客户端未被启动, 忽略')
    }
    if (this.timer) {
      clearInterval(this.timer)
    }
    this.events = {
      danmaku: [],
      gift: [],
      sc: [],
      guard: [],
    }
    this.eventsAsModel = {
      danmaku: [],
      gift: [],
      sc: [],
      guard: [],
    }
  }
  private sendHeartbeat() {
    if (this.client) {
      const query = this.authInfo ? QueryPostAPI<OpenLiveInfo>(OPEN_LIVE_API_URL + 'heartbeat', this.authInfo) : QueryGetAPI<OpenLiveInfo>(OPEN_LIVE_API_URL + 'heartbeat-internal')
      query.then((data) => {
        if (data.code != 200) {
          console.error('[OPEN-LIVE] 心跳失败')
          this.client.stop()
          this.client = null
          this.initClient()
        }
      })
    }
  }
  private onDanmaku = (command: any) => {
    const data = command.data as DanmakuInfo

    this.events.danmaku?.forEach((d) => {
      d(data, command)
    })
    this.eventsAsModel.danmaku?.forEach((d) => {
      d(
        {
          type: EventDataTypes.Message,
          name: data.uname,
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
  private onGift = (command: any) => {
    const data = command.data as GiftInfo
    const price = (data.price * data.gift_num) / 1000
    this.events.gift?.forEach((d) => {
      d(data, command)
    })
    this.eventsAsModel.gift?.forEach((d) => {
      d(
        {
          type: EventDataTypes.Gift,
          name: data.uname,
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
  private onSC = (command: any) => {
    const data = command.data as SCInfo
    this.events.sc?.forEach((d) => {
      d(data, command)
    })
    this.eventsAsModel.sc?.forEach((d) => {
      d(
        {
          type: EventDataTypes.SC,
          name: data.uname,
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
  private onGuard = (command: any) => {
    const data = command.data as GuardInfo
    this.events.guard?.forEach((d) => {
      d(data, command)
    })
    this.eventsAsModel.guard?.forEach((d) => {
      d(
        {
          type: EventDataTypes.Guard,
          name: data.user_info.uname,
          uid: data.user_info.uid,
          msg: data.guard_level == 1 ? '总督' : data.guard_level == 2 ? '提督' : data.guard_level == 3 ? '舰长' : '',
          price: 0,
          num: data.guard_num,
          time: data.timestamp,
          guard_level: data.guard_level,
          fans_medal_level: data.fans_medal_level,
          fans_medal_name: data.fans_medal_name,
          fans_medal_wearing_status: data.fans_medal_wearing_status,
          uface: data.user_info.uface,
          open_id: data.user_info.open_id,
          ouid: data.user_info.open_id ?? GuidUtils.numToGuid(data.user_info.uid),
        },
        command,
      )
    })
  }
  public on(eventName: 'danmaku', listener: DanmakuEventsMap['danmaku']): this
  public on(eventName: 'gift', listener: DanmakuEventsMap['gift']): this
  public on(eventName: 'sc', listener: DanmakuEventsMap['sc']): this
  public on(eventName: 'guard', listener: DanmakuEventsMap['guard']): this
  public on(eventName: 'danmaku' | 'gift' | 'sc' | 'guard', listener: (...args: any[]) => void): this {
    if (!this.events[eventName]) {
      this.events[eventName] = []
    }
    this.events[eventName].push(listener)
    return this
  }
  public onEvent(eventName: 'danmaku', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'gift', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'sc', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'guard', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'danmaku' | 'gift' | 'sc' | 'guard', listener: (...args: any[]) => void): this {
    if (!this.eventsAsModel[eventName]) {
      this.eventsAsModel[eventName] = []
    }
    this.eventsAsModel[eventName].push(listener)
    return this
  }
  public off(eventName: 'danmaku' | 'gift' | 'sc' | 'guard', listener: (...args: any[]) => void): this {
    if (this.events[eventName]) {
      const index = this.events[eventName].indexOf(listener)
      if (index > -1) {
        this.events[eventName].splice(index, 1)
      }
    }
    return this
  }
  public offEvent(eventName: 'danmaku' | 'gift' | 'sc' | 'guard', listener: (...args: any[]) => void): this {
    if (this.eventsAsModel[eventName]) {
      const index = this.eventsAsModel[eventName].indexOf(listener)
      if (index > -1) {
        this.eventsAsModel[eventName].splice(index, 1)
      }
    }
    return this
  }
  private async initClient(): Promise<{ success: boolean; message: string }> {
    const auth = await this.getAuthInfo()
    if (auth.data) {
      const chatClient = new ChatClientDirectOpenLive(auth.data)
      //chatClient.msgHandler = this;
      chatClient.CMD_CALLBACK_MAP = this.CMD_CALLBACK_MAP
      chatClient.start()
      this.roomAuthInfo.value = auth.data
      this.client = chatClient
      console.log('[OPEN-LIVE] 已连接房间: ' + auth.data.anchor_info.room_id)
      return {
        success: true,
        message: '',
      }
    } else {
      console.log('[OPEN-LIVE] 无法开启场次')
      return {
        success: false,
        message: auth.message,
      }
    }
  }
  private async getAuthInfo(): Promise<{ data: OpenLiveInfo | null; message: string }> {
    try {
      const data = await QueryPostAPI<OpenLiveInfo>(OPEN_LIVE_API_URL + 'start', this.authInfo?.Code ? this.authInfo : undefined)
      if (data.code == 200) {
        console.log('[OPEN-LIVE] 已获取场次信息')
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

  private CMD_CALLBACK_MAP = {
    LIVE_OPEN_PLATFORM_DM: this.onDanmaku.bind(this),
    LIVE_OPEN_PLATFORM_SEND_GIFT: this.onGift.bind(this),
    LIVE_OPEN_PLATFORM_SUPER_CHAT: this.onSC.bind(this),
    LIVE_OPEN_PLATFORM_GUARD: this.onGuard.bind(this),
  }
}
