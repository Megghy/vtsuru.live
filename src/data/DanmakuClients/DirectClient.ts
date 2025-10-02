import { KeepLiveWS } from 'bilibili-live-ws/browser'
import { EventDataTypes, GuardLevel } from '@/api/api-models'
import { GuidUtils } from '@/Utils'
import { AVATAR_URL } from '../constants'
import BaseDanmakuClient from './BaseDanmakuClient'

export interface DirectClientAuthInfo {
  token: string
  roomId: number
  tokenUserId: number
  buvid: string
}
/**
 * 直播间弹幕客户端, 只能在vtsuru.client环境使用
 *
 */
export default class DirectClient extends BaseDanmakuClient {
  public serverUrl: string = 'wss://broadcastlv.chat.bilibili.com/sub'

  constructor(auth: DirectClientAuthInfo) {
    super()
    this.authInfo = auth
  }

  public type = 'direct' as const

  public readonly authInfo: DirectClientAuthInfo

  protected async initClient(): Promise<{ success: boolean, message: string }> {
    if (this.authInfo) {
      const chatClient = new KeepLiveWS(this.authInfo.roomId, {
        key: this.authInfo.token,
        buvid: this.authInfo.buvid,
        uid: this.authInfo.tokenUserId,
        protover: 3,
      })

      chatClient.on('live', () => {
        console.log(`[direct] 已连接房间: ${this.authInfo.roomId}`)
      })
      chatClient.on('DANMU_MSG', data => this.onDanmaku(data))
      chatClient.on('SEND_GIFT', data => this.onGift(data))
      chatClient.on('GUARD_BUY', data => this.onGuard(data))
      chatClient.on('SUPER_CHAT_MESSAGE', data => this.onSC(data))
      chatClient.on('INTERACT_WORD', data => this.onEnter(data))
      chatClient.on('SUPER_CHAT_MESSAGE_DELETE', data => this.onScDel(data))

      return super.initClientInner(chatClient)
    } else {
      console.log('[direct] 无法开启场次, 未提供弹幕客户端认证信息')
      return {
        success: false,
        message: '未提供弹幕客户端认证信息',
      }
    }
  }

  public onDanmaku(command: any): void {
    const info = command.info
    this.eventsRaw?.danmaku?.forEach((d) => {
      d(info, command)
    })
    this.eventsAsModel.danmaku?.forEach((d) => {
      d(
        {
          type: EventDataTypes.Message,
          uname: info[2][1],
          uid: info[2][0],
          msg: info[1],
          price: 0,
          num: 1,
          time: Date.now(),
          guard_level: info[7],
          fans_medal_level: info[0][15].user.medal?.level,
          fans_medal_name: info[0][15].user.medal?.name,
          fans_medal_wearing_status: info[0][15].user.medal?.is_light === 1,
          emoji: info[0]?.[13]?.url?.replace('http://', 'https://') || '',
          uface: info[0][15].user.base.face.replace('http://', 'https://'),
          open_id: '',
          ouid: GuidUtils.numToGuid(info[2][0]),
        },
        command,
      )
    })
  }

  public onGift(command: any): void {
    const data = command.data
    this.eventsRaw?.gift?.forEach((d) => {
      d(data, command)
    })
    this.eventsAsModel.gift?.forEach((d) => {
      d(
        {
          type: EventDataTypes.Gift,
          uname: data.uname,
          uid: data.uid,
          msg: data.giftName,
          price: data.price / 1000,
          num: data.num,
          time: Date.now(),
          guard_level: data.guard_level,
          fans_medal_level: data.medal_info.medal_level,
          fans_medal_name: data.medal_info.medal_name,
          fans_medal_wearing_status: data.medal_info.is_lighted === 1,
          uface: data.face.replace('http://', 'https://'),
          open_id: '',
          ouid: GuidUtils.numToGuid(data.uid),
        },
        command,
      )
    })
  }

  public onSC(command: any): void {
    const data = command.data
    this.eventsRaw?.sc?.forEach((d) => {
      d(data, command)
    })
    this.eventsAsModel.sc?.forEach((d) => {
      d(
        {
          type: EventDataTypes.SC,
          uname: data.user_info.uname,
          uid: data.uid,
          msg: data.message,
          price: data.price,
          num: 1,
          time: Date.now(),
          guard_level: data.user_info.guard_level,
          fans_medal_level: data.medal_info.medal_level,
          fans_medal_name: data.medal_info.medal_name,
          fans_medal_wearing_status: data.medal_info.is_lighted === 1,
          uface: data.user_info.face.replace('http://', 'https://'),
          open_id: '',
          ouid: GuidUtils.numToGuid(data.uid),
        },
        command,
      )
    })
  }

  public onGuard(command: any): void {
    const data = command.data
    this.eventsRaw?.guard?.forEach((d) => {
      d(data, command)
    })
    this.eventsAsModel.guard?.forEach((d) => {
      d(
        {
          type: EventDataTypes.Guard,
          uname: data.username,
          uid: data.uid,
          msg: data.gift_name,
          price: data.price / 1000,
          num: data.num,
          time: Date.now(),
          guard_level: data.guard_level,
          fans_medal_level: 0,
          fans_medal_name: '',
          fans_medal_wearing_status: false,
          uface: AVATAR_URL + data.uid,
          open_id: '',
          ouid: GuidUtils.numToGuid(data.uid),
        },
        command,
      )
    })
  }

  public onEnter(command: any): void {
    const data = command.data
    const msgType = data.msg_type

    if (msgType === 1) {
      this.eventsRaw?.enter?.forEach((d) => {
        d(data, command)
      })
      this.eventsAsModel.enter?.forEach((d) => {
        d(
          {
            type: EventDataTypes.Enter,
            uname: data.uname,
            uid: data.uid,
            msg: '',
            price: 0,
            num: 1,
            time: data.timestamp ? data.timestamp * 1000 : Date.now(),
            guard_level: data.privilege_type || GuardLevel.None,
            fans_medal_level: data.fans_medal?.medal_level || 0,
            fans_medal_name: data.fans_medal?.medal_name || '',
            fans_medal_wearing_status: data.fans_medal?.is_lighted === 1,
            uface: data.face?.replace('http://', 'https://') || (AVATAR_URL + data.uid),
            open_id: '',
            ouid: GuidUtils.numToGuid(data.uid),
          },
          command,
        )
      })
    } else if (msgType === 2) {
      this.eventsRaw?.follow?.forEach((d) => {
        d(data, command)
      })
      this.eventsAsModel.follow?.forEach((d) => {
        d(
          {
            type: EventDataTypes.Follow,
            uname: data.uname,
            uid: data.uid,
            msg: '关注了主播',
            price: 0,
            num: 1,
            time: data.timestamp ? data.timestamp * 1000 : Date.now(),
            guard_level: data.privilege_type || GuardLevel.None,
            fans_medal_level: data.fans_medal?.medal_level || 0,
            fans_medal_name: data.fans_medal?.medal_name || '',
            fans_medal_wearing_status: data.fans_medal?.is_lighted === 1,
            uface: data.face?.replace('http://', 'https://') || (AVATAR_URL + data.uid),
            open_id: '',
            ouid: GuidUtils.numToGuid(data.uid),
          },
          command,
        )
      })
    }
  }

  public onScDel(command: any): void {
    const data = command.data
    this.eventsRaw?.scDel?.forEach((d) => {
      d(data, command)
    })
    this.eventsAsModel.scDel?.forEach((d) => {
      d(
        {
          type: EventDataTypes.SCDel,
          uname: '',
          uid: 0,
          msg: JSON.stringify(data.ids),
          price: 0,
          num: 1,
          time: Date.now(),
          guard_level: 0,
          fans_medal_level: 0,
          fans_medal_name: '',
          fans_medal_wearing_status: false,
          uface: '',
          open_id: '',
          ouid: '',
        },
        command,
      )
    })
  }
}
