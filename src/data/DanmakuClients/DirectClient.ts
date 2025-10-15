import type { MessageData } from 'bilibili-live-danmaku'
import { LiveWS } from 'bilibili-live-danmaku'
import { EventDataTypes, GuardLevel } from '@/api/api-models'
import { GuidUtils } from '@/Utils'
import { AVATAR_URL } from '../constants'
import BaseDanmakuClient from './BaseDanmakuClient'
import Long from 'long'

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
      const chatClient = new LiveWS(this.authInfo.roomId, {
        key: this.authInfo.token,
        buvid: this.authInfo.buvid,
        uid: this.authInfo.tokenUserId,
        protover: 3,
      })

      chatClient.addEventListener('CONNECT_SUCCESS', () => {
        console.log(`[direct] 已连接房间: ${this.authInfo.roomId}`)
      })
      chatClient.addEventListener('DANMU_MSG', data => this.onDanmaku(data.data))
      chatClient.addEventListener('SEND_GIFT', data => this.onGift(data.data))
      chatClient.addEventListener('GUARD_BUY', data => this.onGuard(data.data))
      chatClient.addEventListener('SUPER_CHAT_MESSAGE', data => this.onSC(data.data))
      // chatClient.addEventListener('INTERACT_WORD', data => this.onEnter(data.data))
      chatClient.addEventListener('MESSAGE', (data) => {
        switch (data.data.cmd) {
          case 'INTERACT_WORD_V2':
            this.onEnter(data.data)
            break
          case 'LIKE_INFO_V3_CLICK':
            this.onLike(data.data)
            break
          default:
            break
        }
      })
      // chatClient.addEventListener('SUPER_CHAT_MESSAGE_DELETE', data => this.onScDel(data))

      return super.initClientInner(chatClient)
    } else {
      console.log('[direct] 无法开启场次, 未提供弹幕客户端认证信息')
      return {
        success: false,
        message: '未提供弹幕客户端认证信息',
      }
    }
  }

  public onDanmaku(command: MessageData.DANMU_MSG): void {
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

  public onGift(command: MessageData.SEND_GIFT): void {
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
          price: data.total_coin / 1000,
          num: data.num,
          time: Date.now(),
          guard_level: data.guard_level,
          fans_medal_level: data.fans_medal?.medal_level,
          fans_medal_name: data.fans_medal?.medal_name,
          fans_medal_wearing_status: data.fans_medal !== null || data.fans_medal !== undefined,
          uface: data.face.replace('http://', 'https://'),
          open_id: '',
          ouid: GuidUtils.numToGuid(data.uid),
        },
        command,
      )
    })
  }

  public onSC(command: MessageData.SUPER_CHAT_MESSAGE): void {
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
          fans_medal_wearing_status: data.medal_info !== null || data.medal_info !== undefined,
          uface: data.user_info.face.replace('http://', 'https://'),
          open_id: '',
          ouid: GuidUtils.numToGuid(data.uid),
        },
        command,
      )
    })
  }

  public onGuard(command: MessageData.GUARD_BUY): void {
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

  public onEnter(command: MessageData.INTERACT_WORD_V2): void {
    const data = command.decoded
    const msgType = data?.msgType

    if (msgType === 1) {
      this.eventsRaw?.enter?.forEach((d) => {
        d(data, command)
      })
      this.eventsAsModel.enter?.forEach((d) => {
        d(
          {
            type: EventDataTypes.Enter,
            uname: data?.uname || '',
            uid: this.convertToNumber(data?.uid) || 0,
            msg: '',
            price: 0,
            num: 1,
            time: data?.timestamp ? this.convertToNumber(data.timestamp) * 1000 : Date.now(),
            guard_level: this.convertToNumber(data?.privilegeType) || GuardLevel.None,
            fans_medal_level: this.convertToNumber(data?.fansMedal?.medalLevel) || 0,
            fans_medal_name: data?.fansMedal?.medalName || '',
            fans_medal_wearing_status: data?.fansMedal?.isLighted === 1,
            uface: data?.uinfo?.uheadFrame?.frameImg?.replace('http://', 'https://') || (AVATAR_URL + this.convertToNumber(data?.uid)),
            open_id: '',
            ouid: GuidUtils.numToGuid(this.convertToNumber(data?.uid)),
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
            uname: data?.uname || '',
            uid: this.convertToNumber(data?.uid),
            msg: '关注了主播',
            price: 0,
            num: 1,
            time: data?.timestamp ? this.convertToNumber(data.timestamp) * 1000 : Date.now(),
            guard_level: this.convertToNumber(data?.privilegeType) || GuardLevel.None,
            fans_medal_level: this.convertToNumber(data?.fansMedal?.medalLevel) || 0,
            fans_medal_name: data?.fansMedal?.medalName || '',
            fans_medal_wearing_status: data?.fansMedal?.isLighted === 1,
            uface: data?.uinfo?.uheadFrame?.frameImg?.replace('http://', 'https://') || (AVATAR_URL + data?.uid),
            open_id: '',
            ouid: GuidUtils.numToGuid(this.convertToNumber(data?.uid)),
          },
          command,
        )
      })
    }
  }

  convertToNumber(value: number | Long | null | undefined): number {
    if (value instanceof Long) {
      return value.toNumber()
    }
    return value || 0
  }

  public onLike(command: any): void {
    const data = command.data
    this.eventsRaw?.like?.forEach((d) => {
      d(data, command)
    })
    this.eventsAsModel.like?.forEach((d) => {
      d(
        {
          type: EventDataTypes.Like,
          uname: data.uname,
          uid: data.uid,
          msg: '为直播间点赞',
          price: 0,
          num: 1,
          time: Date.now(),
          guard_level: 0,
          fans_medal_level: data.medal_info?.medal_level ?? 0,
          fans_medal_name: data.medal_info?.medal_name ?? '',
          fans_medal_wearing_status: data.medal_info?.is_lighted === 1,
          uface: data.uface.replace('http://', 'https://'),
          open_id: '',
          ouid: GuidUtils.numToGuid(data.uid),
        },
        command,
      )
    })
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
