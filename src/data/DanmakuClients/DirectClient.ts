import { KeepLiveWS } from 'bilibili-live-ws/browser'
import BaseDanmakuClient from './BaseDanmakuClient'
export type DirectClientAuthInfo = {
  token: string
  roomId: number
  tokenUserId: number
  buvid: string
}
/** 直播间弹幕客户端, 只能在vtsuru.client环境使用
 *
 * 未实现除raw事件外的所有事件
 */
export default class DirectClient extends BaseDanmakuClient {
  public onDanmaku(command: any): void {
    throw new Error('Method not implemented.')
  }
  public onGift(command: any): void {
    throw new Error('Method not implemented.')
  }
  public onSC(command: any): void {
    throw new Error('Method not implemented.')
  }
  public onGuard(command: any): void {
    throw new Error('Method not implemented.')
  }
  constructor(auth: DirectClientAuthInfo) {
    super()
    this.authInfo = auth
  }

  public type = 'direct' as const

  public readonly authInfo: DirectClientAuthInfo

  protected async initClient(): Promise<{ success: boolean; message: string }> {
    if (this.authInfo) {
      const chatClient = new KeepLiveWS(this.authInfo.roomId, {
        key: this.authInfo.token,
        buvid: this.authInfo.buvid,
        uid: this.authInfo.tokenUserId,
        protover: 3
      })

      chatClient.on('live', () => {
        console.log('[DIRECT] 已连接房间: ' + this.authInfo.roomId)
      })
      /*chatClient.on('DANMU_MSG', this.onDanmaku)
      chatClient.on('SEND_GIFT', this.onGift)
      chatClient.on('GUARD_BUY', this.onGuard)
      chatClient.on('SUPER_CHAT_MESSAGE', this.onSC)
      chatClient.on('msg', (data) => {
        this.events.all?.forEach((d) => {
          d(data)
        })
      })*/
      return await super.initClientInner(chatClient)
    } else {
      console.log('[DIRECT] 无法开启场次, 未提供弹幕客户端认证信息')
      return {
        success: false,
        message: '未提供弹幕客户端认证信息'
      }
    }
  }
}
