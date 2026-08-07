import { EventDataTypes, GuardLevel } from '@/api/api-models'
import { AVATAR_URL } from '@/shared/config'
import { GuidUtils } from '@/shared/utils'

import BaseDanmakuClient, { DanmakuKeepLiveWS } from './BaseDanmakuClient'
import { decodeInteractWord } from './interactWord'
import type { InteractionData } from './interactWord'
import { decodeSendGiftV2 } from './sendGiftV2'

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

  protected async initClient(signal: AbortSignal): Promise<{ success: boolean; message: string }> {
    if (this.authInfo) {
      const chatClient = new DanmakuKeepLiveWS(this.authInfo.roomId, {
        key: this.authInfo.token,
        buvid: this.authInfo.buvid,
        uid: this.authInfo.tokenUserId,
        protover: 3,
      })

      chatClient.addEventListener('live', () => {
        console.log(`[direct] 已连接房间: ${this.authInfo.roomId}`)
      })
      chatClient.addEventListener('DANMU_MSG', ({ data }) => this.onDanmaku(data))
      chatClient.addEventListener('SEND_GIFT', ({ data }) => this.onGift(data))
      chatClient.addEventListener('SEND_GIFT_V2', ({ data }) => this.onGiftV2(data))
      chatClient.addEventListener('GUARD_BUY', ({ data }) => this.onGuard(data))
      chatClient.addEventListener('SUPER_CHAT_MESSAGE', ({ data }) => this.onSC(data))
      chatClient.addEventListener('SUPER_CHAT_MESSAGE_DELETE', ({ data }) => this.onScDel(data))
      chatClient.addEventListener('INTERACT_WORD', ({ data }) => this.onEnter(data))
      chatClient.addEventListener('INTERACT_WORD_V2', ({ data }) =>
        this.emitInteraction(decodeInteractWord(data.data.pb), data),
      )
      chatClient.addEventListener('LIKE_INFO_V3_CLICK', ({ data }) => this.onLike(data))

      return super.initClientInner(chatClient, signal)
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
    const medal = data.medal_info || undefined
    this.emitGift(
      {
        uid: data.uid,
        uname: data.uname,
        face: data.face,
        guardLevel: data.guard_level,
        medalLevel: medal?.medal_level ?? 0,
        medalName: medal?.medal_name ?? '',
        medalWearing: medal !== undefined,
        giftName: data.giftName,
        giftNum: data.num,
        price: data.total_coin / 1000,
        time: data.timestamp ? data.timestamp * 1000 : Date.now(),
      },
      data,
      command,
    )
  }

  public onGiftV2(command: any): void {
    const data = decodeSendGiftV2(command.data.pb)
    for (const gift of data.gifts) {
      this.emitGift(
        {
          uid: data.uid,
          uname: data.uname,
          face: data.face,
          guardLevel: data.guardLevel,
          medalLevel: data.medal?.level ?? 0,
          medalName: data.medal?.name ?? '',
          medalWearing: data.medal !== undefined && data.medal.name !== '',
          giftName: gift.name,
          giftNum: gift.num,
          price: (gift.price * gift.num) / 1000,
          time: gift.timestamp ? gift.timestamp * 1000 : Date.now(),
        },
        gift,
        command,
      )
    }
  }

  private emitGift(data: DirectGiftData, rawData: any, command: any): void {
    this.eventsRaw.gift.forEach((listener) => listener(rawData, command))
    this.eventsAsModel.gift?.forEach((d) => {
      d(
        {
          type: EventDataTypes.Gift,
          uname: data.uname,
          uid: data.uid,
          msg: data.giftName,
          price: data.price,
          num: data.giftNum,
          time: data.time,
          guard_level: data.guardLevel,
          fans_medal_level: data.medalLevel,
          fans_medal_name: data.medalName,
          fans_medal_wearing_status: data.medalWearing,
          uface: data.face.replace('http://', 'https://') || `${AVATAR_URL}${data.uid}`,
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
          fans_medal_level: data.medal_info?.medal_level ?? 0,
          fans_medal_name: data.medal_info?.medal_name ?? '',
          fans_medal_wearing_status: data.medal_info !== null && data.medal_info !== undefined,
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
    this.emitInteraction(
      {
        uid: data.uid,
        uname: data.uname,
        msgType: data.msg_type,
        timestamp: data.timestamp,
        privilegeType: data.privilege_type,
        fansMedal: data.fans_medal
          ? {
              medalLevel: data.fans_medal.medal_level,
              medalName: data.fans_medal.medal_name,
              isLighted: data.fans_medal.is_lighted,
            }
          : undefined,
        avatar: data.uinfo?.base?.face,
      },
      command,
    )
  }

  private emitInteraction(data: InteractionData, command: any): void {
    const event =
      data.msgType === 1
        ? { name: 'enter' as const, type: EventDataTypes.Enter, msg: '' }
        : data.msgType === 2
          ? { name: 'follow' as const, type: EventDataTypes.Follow, msg: '关注了主播' }
          : undefined
    if (!event) return

    const model = {
      type: event.type,
      uname: data.uname,
      uid: data.uid,
      msg: event.msg,
      price: 0,
      num: 1,
      time: data.timestamp ? data.timestamp * 1000 : Date.now(),
      guard_level: data.privilegeType || GuardLevel.None,
      fans_medal_level: data.fansMedal?.medalLevel || 0,
      fans_medal_name: data.fansMedal?.medalName || '',
      fans_medal_wearing_status: data.fansMedal?.isLighted === 1,
      uface: data.avatar?.replace('http://', 'https://') || `${AVATAR_URL}${data.uid}`,
      open_id: '',
      ouid: GuidUtils.numToGuid(data.uid),
    }

    this.eventsRaw[event.name].forEach((listener) => listener(data, command))
    this.eventsAsModel[event.name].forEach((listener) => listener(model, command))
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
          guard_level: data.uinfo.guard?.level ?? 0,
          fans_medal_level: data.fans_medal?.medal_level ?? 0,
          fans_medal_name: data.fans_medal?.medal_name ?? '',
          fans_medal_wearing_status: data.fans_medal?.is_lighted === 1,
          uface: data.uinfo.base.face.replace('http://', 'https://'),
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

interface DirectGiftData {
  uid: number
  uname: string
  face: string
  guardLevel: number
  medalLevel: number
  medalName: string
  medalWearing: boolean
  giftName: string
  giftNum: number
  price: number
  time: number
}
