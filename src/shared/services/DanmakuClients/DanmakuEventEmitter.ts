import md5 from 'md5'

// DanmakuEventEmitter.ts
// 协议无关的弹幕事件总线基类。
//
// 只负责「事件表 + 订阅/分发」, 不关心数据从哪来 (B站 LiveWS / 本地 RPC / 未来其他来源)。
// - BaseDanmakuClient 继承它, 补上 B 站 LiveWS 专属的连接与原始命令解析。
// - LocalRpcClient 继承它, 走本地 birpc 拿到已经是 EventModel 的数据后直接分发。
import type { EventModel } from '@/api/client-types'

export type DanmakuClientType = 'openlive' | 'direct' | 'local' | 'broadcast'

export type EventArgsMap = Record<string, unknown[]>
export type EventListener<TArgs extends unknown[]> = (...args: TArgs) => void
export type EventListenersMap<TEvents extends EventArgsMap> = {
  [K in keyof TEvents]: Array<EventListener<TEvents[K]>>
}

export type ModelEventName = 'danmaku' | 'gift' | 'sc' | 'guard' | 'enter' | 'scDel' | 'follow' | 'like'

export type ModelEventMap = {
  danmaku: [arg1: EventModel, arg2?: unknown]
  gift: [arg1: EventModel, arg2?: unknown]
  sc: [arg1: EventModel, arg2?: unknown]
  guard: [arg1: EventModel, arg2?: unknown]
  enter: [arg1: EventModel, arg2?: unknown]
  scDel: [arg1: EventModel, arg2?: unknown]
  all: [arg1: unknown]
  follow: [arg1: EventModel, arg2?: unknown]
  like: [arg1: EventModel, arg2?: unknown]
}

export type RawEventMap = {
  danmaku: [arg1: unknown, arg2?: unknown]
  gift: [arg1: unknown, arg2?: unknown]
  sc: [arg1: unknown, arg2?: unknown]
  guard: [arg1: unknown, arg2?: unknown]
  enter: [arg1: unknown, arg2?: unknown]
  scDel: [arg1: unknown, arg2?: unknown]
  all: [arg1: unknown]
  follow: [arg1: unknown, arg2?: unknown]
  like: [arg1: unknown, arg2?: unknown]
}

export type ModelEventListeners = EventListenersMap<ModelEventMap>
export type RawEventListeners = EventListenersMap<RawEventMap>

export default abstract class DanmakuEventEmitter {
  constructor() {
    this.eventsAsModel = this.createEmptyEventModelListeners()
    this.eventsRaw = this.createEmptyRawEventlisteners()
  }

  // 客户端类型 (由子类实现)
  public abstract type: DanmakuClientType

  // 连接状态
  public state: 'padding' | 'connected' | 'connecting' | 'disconnected' = 'padding'

  // 连接意外断开时的回调 (由 store 注入, 用于触发重新选源)。区别于主动 Stop()。
  public onConnectionLost?: () => void

  // --- 事件系统 1: EventModel ---
  public eventsAsModel: ModelEventListeners
  // --- 事件系统 2: 原始数据 ---
  public eventsRaw: RawEventListeners

  public createEmptyEventModelListeners(): ModelEventListeners {
    return { danmaku: [], gift: [], sc: [], guard: [], enter: [], scDel: [], all: [], follow: [], like: [] }
  }

  public createEmptyRawEventlisteners(): RawEventListeners {
    return { danmaku: [], gift: [], sc: [], guard: [], enter: [], scDel: [], all: [], follow: [], like: [] }
  }

  /** 启动连接 (子类实现) */
  public abstract Start(): Promise<{ success: boolean; message: string }>
  /** 停止连接 (子类实现) */
  public abstract Stop(): void

  /** 触发 'all' 事件监听器 (两套系统都触发) */
  public onRawMessage = (command: unknown) => {
    this.notifyListeners('model:all', this.eventsAsModel.all, command)
    this.notifyListeners('raw:all', this.eventsRaw.all, command)
  }

  /**
   * 分发一个已经是 EventModel 的事件到两套监听器 + all。
   * 供数据源本身就是 EventModel 的 client 使用 (LocalRpc / BroadcastChannel),
   * 无需像 B站 client 那样解析原始命令。
   */
  protected emitModel(eventName: ModelEventName, data: EventModel) {
    this.emitParsedEvent(eventName, data, data)
    this.notifyListeners('raw:all', this.eventsRaw.all, data)
    this.notifyListeners('model:all', this.eventsAsModel.all, data)
  }

  protected emitParsedEvent(eventName: ModelEventName, rawData: unknown, data: EventModel, command?: unknown) {
    // Hash the source packet, not receipt time, to identify reconnect replays.
    data.eventId ??= eventName + ':' + md5(JSON.stringify(command ?? rawData))
    this.notifyListeners(`raw:${eventName}`, this.eventsRaw[eventName], rawData, command)
    this.notifyListeners(`model:${eventName}`, this.eventsAsModel[eventName], data, command)
  }

  protected notifyListeners<TArgs extends unknown[]>(
    eventName: string,
    listeners: readonly EventListener<TArgs>[],
    ...args: TArgs
  ) {
    for (const listener of listeners) {
      try {
        listener(...args)
      } catch (error) {
        console.error(`[${this.type}] ${eventName} 监听器执行失败:`, error, args[0])
      }
    }
  }

  // --- 事件系统 1: onEvent/offEvent (EventModel) ---
  public onEvent<K extends keyof ModelEventMap>(eventName: K, listener: EventListener<ModelEventMap[K]>): this {
    this.eventsAsModel[eventName].push(listener)
    return this
  }

  public offEvent<K extends keyof ModelEventMap>(eventName: K, listener: EventListener<ModelEventMap[K]>): this {
    const listeners = this.eventsAsModel[eventName]
    const index = listeners.indexOf(listener)
    if (index > -1) listeners.splice(index, 1)
    return this
  }

  // --- 事件系统 2: on/off (原始数据) ---
  public on<K extends keyof RawEventMap>(eventName: K, listener: EventListener<RawEventMap[K]>): this {
    this.eventsRaw[eventName].push(listener)
    return this
  }

  public off<K extends keyof RawEventMap>(eventName: K, listener: EventListener<RawEventMap[K]>): this {
    const listeners = this.eventsRaw[eventName]
    const index = listeners.indexOf(listener)
    if (index > -1) listeners.splice(index, 1)
    return this
  }
}
