// LocalRpcClient.ts
// 通过本地 eventfetcher 的开放 RPC 接口获取弹幕事件的客户端。
//
// 与 OpenLive/Direct 不同, 数据来自本机已安装的 eventfetcher (birpc over WebSocket),
// 收到的已经是 EventModel, 无需解析 B 站原始命令, 因此直接继承协议无关的事件总线。
import type { RpcClient } from '@/shared/rpc/client'
import { connectLocalFetcher, probeLocalFetcher } from '@/shared/rpc/client'
import { DANMAKU_EVENT_NAMES } from '@/shared/rpc/contract'

import DanmakuEventEmitter from './DanmakuEventEmitter'

export default class LocalRpcClient extends DanmakuEventEmitter {
  public type = 'local' as const
  private rpcClient: RpcClient | undefined

  public async Start(): Promise<{ success: boolean; message: string }> {
    if (this.state === 'connected') return { success: true, message: '已连接' }
    this.state = 'connecting'

    const health = await probeLocalFetcher()
    if (!health) {
      this.state = 'disconnected'
      return { success: false, message: '未检测到本地 eventfetcher' }
    }

    try {
      this.rpcClient = await connectLocalFetcher(
        { onDanmakuEvent: (eventName, data) => this.emitModel(eventName, data) },
        () => this.onDisconnected(),
      )
      await this.rpcClient.rpc.danmakuSubscribe([...DANMAKU_EVENT_NAMES])
      this.state = 'connected'
      console.log('[local] 已接入本地 eventfetcher 弹幕流')
      return { success: true, message: '' }
    } catch (err: any) {
      this.state = 'disconnected'
      this.rpcClient?.close()
      this.rpcClient = undefined
      return { success: false, message: err?.message || String(err) }
    }
  }

  public Stop(): void {
    if (this.state === 'disconnected') return
    this.state = 'disconnected'
    this.rpcClient?.close()
    this.rpcClient = undefined
    console.log('[local] 已断开本地 eventfetcher')
  }

  // 本地 fetcher 意外关闭 (WebSocket 断开)
  private onDisconnected() {
    if (this.state === 'disconnected') return
    this.state = 'disconnected'
    this.rpcClient = undefined
    console.warn('[local] 本地 eventfetcher 连接已断开')
    this.onConnectionLost?.()
  }
}
