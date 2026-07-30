// BroadcastChannelClient.ts
// 消费同浏览器其他标签页广播的弹幕事件的客户端。
//
// 当同一浏览器的另一个标签页已握有上游连接 (openlive/direct/local) 时, 本标签页无需重复连接,
// 只要通过共享的 DanmakuChannel 被动接收事件即可。数据已是 EventModel, 直接分发。
import type { DanmakuChannel } from '@/shared/services/danmakuChannel'

import DanmakuEventEmitter from './DanmakuEventEmitter'

export default class BroadcastChannelClient extends DanmakuEventEmitter {
  public type = 'broadcast' as const
  private unsubscribe: (() => void) | undefined

  // channel 由 store 拥有并传入 (借用), 本 client 不负责创建/关闭它
  constructor(
    private readonly channel: DanmakuChannel,
    private readonly scope: string,
    private readonly ownerSourceId?: string,
  ) {
    super()
  }

  public async Start(): Promise<{ success: boolean; message: string }> {
    if (this.state === 'connected') return { success: true, message: '已连接' }
    this.unsubscribe = this.channel.onEvent((sourceId, scope, eventName, data) => {
      if (scope === this.scope && (!this.ownerSourceId || sourceId === this.ownerSourceId)) {
        this.emitModel(eventName, data)
      }
    })
    this.state = 'connected'
    console.log('[broadcast] 已接入同浏览器其他标签页的弹幕流')
    return { success: true, message: '' }
  }

  public Stop(): void {
    if (this.state === 'disconnected') return
    this.state = 'disconnected'
    this.unsubscribe?.()
    this.unsubscribe = undefined
    console.log('[broadcast] 已停止接收跨标签页弹幕')
  }
}
