// 同浏览器跨标签页弹幕同步 —— 纯传输层 (无 Vue/pinia 依赖, 可单测)
//
// 只负责 BroadcastChannel 的消息编解码 + 账号过滤 + 自身来源过滤。
// 「要不要连、连什么」的决策留在 useDanmakuClient store。
import type { EventModel } from '@/api/api-models'

const LOCAL_EVENT_CHANNEL = 'vtsuru.danmaku.model-events.v1'

export type DanmakuEventName = 'danmaku' | 'gift' | 'sc' | 'guard' | 'enter' | 'scDel' | 'follow' | 'like'
export type ClientType = 'openlive' | 'direct' | 'local' | 'broadcast'

type Payload =
  | { kind: 'event', sourceId: string, accountId?: number, eventName: DanmakuEventName, data: EventModel }
  | { kind: 'state', sourceId: string, accountId?: number, state: 'connected' | 'disconnected', clientType?: ClientType, at: number }
  | { kind: 'state-request', sourceId: string, accountId?: number }

export interface DanmakuChannel {
  publishEvent: (eventName: DanmakuEventName, data: EventModel) => void
  publishState: (state: 'connected' | 'disconnected', clientType?: ClientType) => void
  requestState: () => void
  /** 订阅其他标签页广播的事件, 返回取消订阅函数 */
  onEvent: (cb: (eventName: DanmakuEventName, data: EventModel) => void) => () => void
  /** 订阅其他标签页的状态心跳 */
  onState: (cb: (sourceId: string, state: 'connected' | 'disconnected', at: number) => void) => () => void
  /** 订阅其他标签页的状态查询请求 */
  onStateRequest: (cb: () => void) => () => void
  close: () => void
}

/**
 * 创建弹幕同步通道。
 * @param sourceId 本标签页唯一 id (用于过滤自身消息)
 * @param getAccountId 取当前账号 id (随登录态变化, 故用函数)
 * @param isSameAccount 判断收到的消息是否属于当前账号
 */
export function createDanmakuChannel(
  sourceId: string,
  getAccountId: () => number | undefined,
  isSameAccount: (accountId?: number) => boolean,
): DanmakuChannel {
  const bc = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(LOCAL_EVENT_CHANNEL)

  const eventCbs = new Set<(eventName: DanmakuEventName, data: EventModel) => void>()
  const stateCbs = new Set<(sourceId: string, state: 'connected' | 'disconnected', at: number) => void>()
  const stateRequestCbs = new Set<() => void>()

  bc?.addEventListener('message', (event: MessageEvent<Payload>) => {
    const payload = event.data
    if (!payload || payload.sourceId === sourceId) return
    if (!isSameAccount(payload.accountId)) return

    switch (payload.kind) {
      case 'event':
        for (const cb of eventCbs) cb(payload.eventName, payload.data)
        break
      case 'state':
        for (const cb of stateCbs) cb(payload.sourceId, payload.state, payload.at)
        break
      case 'state-request':
        for (const cb of stateRequestCbs) cb()
        break
    }
  })

  const sub = <T>(set: Set<T>, cb: T) => {
    set.add(cb)
    return () => set.delete(cb)
  }

  return {
    publishEvent: (eventName, data) => bc?.postMessage({ kind: 'event', sourceId, accountId: getAccountId(), eventName, data } satisfies Payload),
    publishState: (state, clientType) => bc?.postMessage({ kind: 'state', sourceId, accountId: getAccountId(), state, clientType, at: Date.now() } satisfies Payload),
    requestState: () => bc?.postMessage({ kind: 'state-request', sourceId, accountId: getAccountId() } satisfies Payload),
    onEvent: cb => sub(eventCbs, cb),
    onState: cb => sub(stateCbs, cb),
    onStateRequest: cb => sub(stateRequestCbs, cb),
    close: () => bc?.close(),
  }
}
