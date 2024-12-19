import ChatClientOfficialBase, * as base from './ChatClientOfficialBase'
import { processAvatarUrl } from './models'

export default class ChatClientDirectOpenLive extends ChatClientOfficialBase {
  constructor(authInfo) {
    super()
    this.CMD_CALLBACK_MAP = CMD_CALLBACK_MAP

    this.auth = authInfo
  }

  stop() {
    super.stop()
  }

  async initRoom() {
    return true
  }

  async onBeforeWsConnect() {
    return super.onBeforeWsConnect()
  }

  getWsUrl() {
    return this.auth.websocket_info.wss_link[this.retryCount % this.auth.websocket_info.wss_link.length]
  }

  sendAuth() {
    this.websocket.send(this.makePacket(this.auth.websocket_info.auth_body, base.OP_AUTH))
  }

  async dmCallback(command) {
    if (!this.onAddText) {
      return
    }
    let data = command.data

    let authorType
    if (data.uid === this.roomOwnerUid) {
      authorType = 3
    } else if (data.guard_level !== 0) {
      authorType = 1
    } else {
      authorType = 0
    }

    let emoticon = null
    if (data.dm_type === 1) {
      emoticon = data.emoji_img_url
    }

    data = {
      avatarUrl: processAvatarUrl(data.uface),
      timestamp: data.timestamp,
      authorName: data.uname,
      authorType: authorType,
      content: data.msg,
      privilegeType: data.guard_level,
      isGiftDanmaku: false,
      authorLevel: 1,
      isNewbie: false,
      isMobileVerified: true,
      medalLevel: data.fans_medal_wearing_status ? data.fans_medal_level : 0,
      id: data.msg_id,
      translation: '',
      emoticon: emoticon,
    }
    this.onAddText(data)
  }

  sendGiftCallback(command) {
    if (!this.onAddGift) {
      return
    }
    let data = command.data
    if (!data.paid) {
      // 丢人
      return
    }

    data = {
      id: data.msg_id,
      avatarUrl: processAvatarUrl(data.uface),
      timestamp: data.timestamp,
      authorName: data.uname,
      totalCoin: data.price,
      giftName: data.gift_name,
      num: data.gift_num,
    }
    this.onAddGift(data)
  }

  async guardCallback(command) {
    if (!this.onAddMember) {
      return
    }

    let data = command.data
    data = {
      id: data.msg_id,
      avatarUrl: processAvatarUrl(data.user_info.uface),
      timestamp: data.timestamp,
      authorName: data.user_info.uname,
      privilegeType: data.guard_level,
    }
    this.onAddMember(data)
  }

  superChatCallback(command) {
    if (!this.onAddSuperChat) {
      return
    }

    let data = command.data
    data = {
      id: data.message_id.toString(),
      avatarUrl: processAvatarUrl(data.uface),
      timestamp: data.start_time,
      authorName: data.uname,
      price: data.rmb,
      content: data.message,
      translation: '',
    }
    this.onAddSuperChat(data)
  }

  superChatDelCallback(command) {
    if (!this.onDelSuperChat) {
      return
    }

    const ids = []
    for (const id of command.data.message_ids) {
      ids.push(id.toString())
    }
    this.onDelSuperChat({ ids })
  }

  rawMessageCallback(command) {
    if (!this.onRawMessage) {
      return
    }
    this.onRawMessage(command)
  }
}

const CMD_CALLBACK_MAP = {
  LIVE_OPEN_PLATFORM_DM: ChatClientDirectOpenLive.prototype.dmCallback,
  LIVE_OPEN_PLATFORM_SEND_GIFT: ChatClientDirectOpenLive.prototype.sendGiftCallback,
  LIVE_OPEN_PLATFORM_GUARD: ChatClientDirectOpenLive.prototype.guardCallback,
  LIVE_OPEN_PLATFORM_SUPER_CHAT: ChatClientDirectOpenLive.prototype.superChatCallback,
  LIVE_OPEN_PLATFORM_SUPER_CHAT_DEL: ChatClientDirectOpenLive.prototype.superChatDelCallback,
  RAW_MESSAGE: ChatClientDirectOpenLive.prototype.rawMessageCallback,
}
