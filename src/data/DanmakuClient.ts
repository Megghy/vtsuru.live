import { OpenLiveInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import ChatClientDirectOpenLive from '@/data/chat/ChatClientDirectOpenLive.js'
import { OPEN_LIVE_API_URL } from './constants'
import { ref, toRef } from 'vue'
import { setInterval, clearInterval } from 'worker-timers'

export interface DanmakuInfo {
  room_id: number
  uid: number
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
  } = {
    danmaku: [],
    gift: [],
    sc: [],
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
    }
  }
  private sendHeartbeat() {
    if (this.client) {
      const query = this.authInfo ? QueryPostAPI<OpenLiveInfo>(OPEN_LIVE_API_URL + 'heartbeat', this.authInfo) : QueryGetAPI<OpenLiveInfo>(OPEN_LIVE_API_URL + 'heartbeat-internal')
      query.then((data) => {
        if (data.code != 200) {
          console.error('[OPEN-LIVE] 心跳失败: ' + data.message)
          this.client.stop()
          this.client = null
          this.initClient()
        }
      })
    }
  }
  private onDanmaku = (command: any) => {
    const data = command.data as DanmakuInfo
    if (this.events.danmaku) {
      this.events.danmaku.forEach((d) => {
        d(data, command)
      })
    }
  }
  private onGift = (command: any) => {
    const data = command.data as GiftInfo
    if (this.events.gift) {
      this.events.gift.forEach((d) => {
        d(data, command)
      })
    }
  }
  public on(eventName: 'danmaku', listener: DanmakuEventsMap['danmaku']): this
  public on(eventName: 'gift', listener: DanmakuEventsMap['gift']): this
  public on(eventName: 'sc', listener: DanmakuEventsMap['sc']): this
  public on(eventName: 'danmaku' | 'gift' | 'sc', listener: (...args: any[]) => void): this {
    if (!this.events[eventName]) {
      this.events[eventName] = []
    }
    this.events[eventName].push(listener)
    return this
  }
  public off(eventName: 'danmaku' | 'gift' | 'sc', listener: (...args: any[]) => void): this {
    if (this.events[eventName]) {
      const index = this.events[eventName].indexOf(listener)
      if (index > -1) {
        this.events[eventName].splice(index, 1)
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
        console.error('无法获取场次数据: ' + data.message)
        return {
          data: null,
          message: data.message,
        }
      }
    } catch (err) {
      console.error(err)

      return {
        data: null,
        message: err?.toString() || '未知错误',
      }
    }
  }

  private CMD_CALLBACK_MAP = {
    LIVE_OPEN_PLATFORM_DM: this.onDanmaku.bind(this),
    LIVE_OPEN_PLATFORM_SEND_GIFT: this.onGift.bind(this),
  }
}
