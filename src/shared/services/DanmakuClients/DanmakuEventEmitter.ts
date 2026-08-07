// DanmakuEventEmitter.ts
// 协议无关的弹幕事件总线基类。
//
// 只负责「事件表 + 订阅/分发」, 不关心数据从哪来 (B站 LiveWS / 本地 RPC / 未来其他来源)。
// - BaseDanmakuClient 继承它, 补上 B 站 LiveWS 专属的连接与原始命令解析。
// - LocalRpcClient 继承它, 走本地 birpc 拿到已经是 EventModel 的数据后直接分发。
import type { EventModel } from '@/api/api-models'

export type DanmakuClientType = 'openlive' | 'direct' | 'local' | 'broadcast'

type ModelListener = (arg1: EventModel, arg2?: any) => void
type AllListener = (arg1: any) => void

export interface ModelEventListeners {
  danmaku: ModelListener[]
  gift: ModelListener[]
  sc: ModelListener[]
  guard: ModelListener[]
  enter: ModelListener[]
  scDel: ModelListener[]
  all: AllListener[]
  follow: ModelListener[]
  like: ModelListener[]
}

type RawListener = (arg1: any, arg2?: any) => void
export interface RawEventListeners {
  danmaku: RawListener[]
  gift: RawListener[]
  sc: RawListener[]
  guard: RawListener[]
  enter: RawListener[]
  scDel: RawListener[]
  all: AllListener[]
  follow: RawListener[]
  like: RawListener[]
}

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
  public onRawMessage = (command: any) => {
    this.notifyListeners('model:all', this.eventsAsModel.all, command)
    this.notifyListeners('raw:all', this.eventsRaw.all, command)
  }

  /**
   * 分发一个已经是 EventModel 的事件到两套监听器 + all。
   * 供数据源本身就是 EventModel 的 client 使用 (LocalRpc / BroadcastChannel),
   * 无需像 B站 client 那样解析原始命令。
   */
  protected emitModel(eventName: Exclude<keyof ModelEventListeners, 'all'>, data: EventModel) {
    this.notifyListeners(`raw:${eventName}`, this.eventsRaw[eventName], data)
    this.notifyListeners(`model:${eventName}`, this.eventsAsModel[eventName], data)
    this.notifyListeners('raw:all', this.eventsRaw.all, data)
    this.notifyListeners('model:all', this.eventsAsModel.all, data)
  }

  protected notifyListeners(eventName: string, listeners: readonly ((...args: any[]) => void)[], ...args: any[]) {
    for (const listener of listeners) {
      try {
        listener(...args)
      } catch (error) {
        console.error(`[${this.type}] ${eventName} 监听器执行失败:`, error, args[0])
      }
    }
  }

  // --- 事件系统 1: onEvent/offEvent (EventModel) ---
  public onEvent(eventName: 'danmaku', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'gift', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'sc', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'guard', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'enter', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'scDel', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'all', listener: (arg1: any) => void): this
  public onEvent(eventName: 'follow', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'like', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: keyof ModelEventListeners, listener: (...args: any[]) => void): this {
    ;(this.eventsAsModel[eventName] as ((...args: any[]) => void)[]).push(listener)
    return this
  }

  public offEvent(eventName: keyof ModelEventListeners, listener: (...args: any[]) => void): this {
    const listeners = this.eventsAsModel[eventName] as ((...args: any[]) => void)[]
    const index = listeners.indexOf(listener)
    if (index > -1) listeners.splice(index, 1)
    return this
  }

  // --- 事件系统 2: on/off (原始数据) ---
  public on(eventName: 'danmaku', listener: (arg1: any, arg2?: any) => void): this
  public on(eventName: 'gift', listener: (arg1: any, arg2?: any) => void): this
  public on(eventName: 'sc', listener: (arg1: any, arg2?: any) => void): this
  public on(eventName: 'guard', listener: (arg1: any, arg2?: any) => void): this
  public on(eventName: 'enter', listener: (arg1: any, arg2?: any) => void): this
  public on(eventName: 'scDel', listener: (arg1: any, arg2?: any) => void): this
  public on(eventName: 'all', listener: (arg1: any) => void): this
  public on(eventName: 'follow', listener: (arg1: any, arg2?: any) => void): this
  public on(eventName: 'like', listener: (arg1: any, arg2?: any) => void): this
  public on(eventName: keyof RawEventListeners, listener: (...args: any[]) => void): this {
    ;(this.eventsRaw[eventName] as ((...args: any[]) => void)[]).push(listener)
    return this
  }

  public off(eventName: keyof RawEventListeners, listener: (...args: any[]) => void): this {
    const listeners = this.eventsRaw[eventName] as ((...args: any[]) => void)[]
    const index = listeners.indexOf(listener)
    if (index > -1) listeners.splice(index, 1)
    return this
  }
}
