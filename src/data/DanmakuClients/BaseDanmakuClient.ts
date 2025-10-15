import type { LiveWS } from 'bilibili-live-danmaku'
// BaseDanmakuClient.ts
import type { EventModel } from '@/api/api-models'
// 导入事件模型和类型枚举

// 定义基础弹幕客户端抽象类
export default abstract class BaseDanmakuClient {
  constructor() {
    this.client = null // 初始化客户端实例为 null
    // 初始化两套事件监听器存储
    this.eventsAsModel = this.createEmptyEventModelListeners()
    this.eventsRaw = this.createEmptyRawEventlisteners()
  }

  // WebSocket 客户端实例
  public client: LiveWS | null

  // 客户端连接状态
  public state: 'padding' | 'connected' | 'connecting' | 'disconnected'
    = 'padding'

  // 客户端类型 (由子类实现)
  public abstract type: 'openlive' | 'direct'
  // 目标服务器地址 (由子类实现)
  public abstract serverUrl: string

  // --- 事件系统 1: 使用 EventModel ---
  // 事件监听器集合 (统一使用 EventModel)
  public eventsAsModel: {
    danmaku: ((arg1: EventModel, arg2?: any) => void)[]
    gift: ((arg1: EventModel, arg2?: any) => void)[]
    sc: ((arg1: EventModel, arg2?: any) => void)[]
    guard: ((arg1: EventModel, arg2?: any) => void)[]
    enter: ((arg1: EventModel, arg2?: any) => void)[] // 新增: 用户进入事件
    scDel: ((arg1: EventModel, arg2?: any) => void)[] // 新增: SC 删除事件
    all: ((arg1: any) => void)[] // 'all' 事件监听器接收原始消息或特定事件包
    follow: ((arg1: EventModel, arg2?: any) => void)[] // 新增: 关注事件
    like: ((arg1: EventModel, arg2?: any) => void)[] // 新增: 点赞事件
  }

  // --- 事件系统 2: 使用原始数据类型 ---
  // 事件监听器集合 (使用原始数据结构, 类型设为 any, 由具体实现和调用者保证)
  public eventsRaw: {
    danmaku: ((arg1: any, arg2?: any) => void)[]
    gift: ((arg1: any, arg2?: any) => void)[]
    sc: ((arg1: any, arg2?: any) => void)[]
    guard: ((arg1: any, arg2?: any) => void)[]
    enter: ((arg1: any, arg2?: any) => void)[] // 新增: 用户进入事件
    scDel: ((arg1: any, arg2?: any) => void)[] // 新增: SC 删除事件
    all: ((arg1: any) => void)[] // 'all' 事件监听器接收原始消息或特定事件包
    follow: ((arg1: any, arg2?: any) => void)[] // 新增: 关注事件
    like: ((arg1: any, arg2?: any) => void)[] // 新增: 点赞事件
  }

  // 创建空的 EventModel 监听器对象
  public createEmptyEventModelListeners() {
    return {
      danmaku: [],
      gift: [],
      sc: [],
      guard: [],
      enter: [],
      scDel: [],
      all: [],
      follow: [], // 初始化 follow 事件
      like: [],
    }
  }

  // 创建空的 RawEvent 监听器对象
  public createEmptyRawEventlisteners() {
    return {
      danmaku: [],
      gift: [],
      sc: [],
      guard: [],
      enter: [],
      scDel: [],
      all: [],
      follow: [], // 初始化 follow 事件
      like: [],
    }
  }

  /**
   * 启动弹幕客户端连接
   * @returns Promise<{ success: boolean; message: string }> 启动结果
   */
  public async Start(): Promise<{ success: boolean, message: string }> {
    // 如果已连接，直接返回成功
    if (this.state === 'connected') {
      return {
        success: true,
        message: '弹幕客户端已启动',
      }
    }
    // 如果正在连接中，返回提示
    if (this.state === 'connecting') {
      return {
        success: false,
        message: '弹幕客户端正在启动',
      }
    }
    // 设置状态为连接中
    this.state = 'connecting'
    try {
      // 确保 client 为 null 才初始化
      if (!this.client) {
        console.log(`[${this.type}] 正在启动弹幕客户端`)
        // 调用子类实现的初始化方法
        const result = await this.initClient()
        if (result.success) {
          this.state = 'connected'
          console.log(`[${this.type}] 弹幕客户端已完成启动`)
        } else {
          this.state = 'disconnected'
          console.error(`[${this.type}] 弹幕客户端启动失败: ${result.message}`)
        }
        return result
      } else {
        console.warn(`[${this.type}] 客户端实例已存在但状态异常，尝试重置状态`)
        this.state = 'disconnected'
        return {
          success: false,
          message: '客户端实例状态异常，请尝试重新启动',
        }
      }
    } catch (err: any) {
      console.error(`[${this.type}] 启动过程中发生异常:`, err)
      this.state = 'disconnected'
      if (this.client) {
        try {
          this.client.close()
        } catch { }
        this.client = null
      }
      return {
        success: false,
        message: err?.message || err?.toString() || '未知错误',
      }
    }
  }

  /**
   * 停止弹幕客户端连接
   */
  public Stop() {
    // 如果已断开，则无需操作
    if (this.state === 'disconnected') {
      return
    }
    // 设置状态为已断开
    this.state = 'disconnected'
    if (this.client) {
      console.log(`[${this.type}] 正在停止弹幕客户端`)
      try {
        this.client.close() // 关闭 WebSocket 连接
      } catch (err) {
        console.error(`[${this.type}] 关闭客户端时发生错误:`, err)
      }
      this.client = null // 将客户端实例置为 null
    } else {
      console.warn(`[${this.type}] 弹幕客户端未被启动, 忽略停止操作`)
    }
    // 注意: 清空所有事件监听器
    // this.eventsAsModel = this.createEmptyEventModelListeners();
    // this.eventsRaw = this.createEmptyRawEventlisteners();
  }

  /**
   * 初始化客户端实例 (抽象方法，由子类实现具体的创建逻辑)
   * @returns Promise<{ success: boolean; message: string }> 初始化结果
   */
  protected abstract initClient(): Promise<{
    success: boolean
    message: string
  }>

  /**
   * 内部通用的客户端事件绑定和连接状态等待逻辑
   * @param chatClient - 已创建的 KeepLiveWS 实例
   * @returns Promise<{ success: boolean; message: string }> 连接结果
   */
  protected async initClientInner(
    chatClient: LiveWS,
  ): Promise<{ success: boolean, message: string }> {
    let isConnected = false // 标记是否连接成功
    let isError = false // 标记是否发生错误
    let errorMsg = '' // 存储错误信息

    // 监听错误事件
    chatClient.addEventListener('error', (err: any) => {
      console.error(`[${this.type}] 客户端发生错误:`, err)
      isError = true
      errorMsg = err?.message || err?.toString() || '未知错误'
    })

    // 监听连接成功事件
    chatClient.addEventListener('CONNECT_SUCCESS', () => {
      console.log(`[${this.type}] 弹幕客户端连接成功`)
      isConnected = true
    })

    // 监听连接关闭事件
    chatClient.addEventListener('close', () => {
      console.log(`[${this.type}] 弹幕客户端连接已关闭`)
      if (this.state !== 'disconnected') {
        this.state = 'disconnected'
        this.client = null
      }
      isConnected = false // 标记为未连接
    })

    // 监听原始消息事件 (通用)
    // 注意: 子类可能也会监听特定事件名, 这里的 'msg' 是备用或处理未被特定监听器捕获的事件
    chatClient.addEventListener('MESSAGE', (command: any) => this.onRawMessage(command.data))

    this.client = chatClient // 保存客户端实例

    // 等待连接成功或发生错误
    const timeout = 30000 // 30 秒超时
    const startTime = Date.now()
    while (!isConnected && !isError) {
      if (Date.now() - startTime > timeout) {
        isError = true
        errorMsg = '连接超时'
        console.error(`[${this.type}] ${errorMsg}`)
        break
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 500)
      })
    }

    // 如果连接过程中发生错误，清理客户端实例
    if (isError && this.client) {
      try {
        this.client.close()
      } catch { }
      this.client = null
      this.state = 'disconnected'
    }

    // 返回连接结果
    return {
      success: isConnected && !isError,
      message: errorMsg,
    }
  }

  /**
   * 处理接收到的原始消息，并根据类型分发 (主要用于 'msg' 事件)
   * @param command - 原始消息对象 (类型为 any)
   */
  public onRawMessage = (command: any) => {
    // 触发 'all' 事件监听器 (两套系统都触发)
    try {
      this.eventsAsModel.all?.forEach((listener) => {
        listener(command)
      })
      this.eventsRaw.all?.forEach((listener) => {
        listener(command)
      })
    } catch (err) {
      console.error(`[${this.type}] 处理 'all' 事件监听器时出错:`, err, command)
    }
  }

  // --- 抽象处理方法 (子类实现) ---
  // 这些方法负责接收原始数据, 触发 RawEvent, 转换数据, 触发 ModelEvent

  /**
   * 处理弹幕消息 (子类实现)
   * @param data - 原始消息数据部分 (any 类型)
   * @param rawCommand - 完整的原始消息对象 (可选, any 类型)
   */
  public abstract onDanmaku(comand: any): void
  /**
   * 处理礼物消息 (子类实现)
   * @param data - 原始消息数据部分 (any 类型)
   * @param rawCommand - 完整的原始消息对象 (可选, any 类型)
   */
  public abstract onGift(comand: any): void
  /**
   * 处理 Super Chat 消息 (子类实现)
   * @param data - 原始消息数据部分 (any 类型)
   * @param rawCommand - 完整的原始消息对象 (可选, any 类型)
   */
  public abstract onSC(comand: any): void
  /**
   * 处理上舰/舰队消息 (子类实现)
   * @param data - 原始消息数据部分 (any 类型)
   * @param rawCommand - 完整的原始消息对象 (可选, any 类型)
   */
  public abstract onGuard(comand: any): void
  /**
   * 处理用户进入消息 (子类实现)
   * @param data - 原始消息数据部分 (any 类型)
   * @param rawCommand - 完整的原始消息对象 (可选, any 类型)
   */
  public abstract onEnter(comand: any): void
  /**
   * 处理 SC 删除消息 (子类实现)
   * @param data - 原始消息数据部分 (any 类型) - 通常可能只包含 message_id
   * @param rawCommand - 完整的原始消息对象 (可选, any 类型)
   */
  public abstract onScDel(comand: any): void
  /**
   * 处理点赞消息 (子类实现)
   * @param data - 原始消息数据部分 (any 类型)
   * @param rawCommand - 完整的原始消息对象 (可选, any 类型)
   */
  public abstract onLike(comand: any): void

  // --- 事件系统 1: on/off (使用 EventModel) ---
  public onEvent(eventName: 'danmaku', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'gift', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'sc', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'guard', listener: (arg1: EventModel, arg2?: any) => void): this
  public onEvent(eventName: 'enter', listener: (arg1: EventModel, arg2?: any) => void): this // 新增
  public onEvent(eventName: 'scDel', listener: (arg1: EventModel, arg2?: any) => void): this // 新增
  public onEvent(eventName: 'all', listener: (arg1: any) => void): this
  public onEvent(eventName: 'follow', listener: (arg1: EventModel, arg2?: any) => void): this // 新增
  public onEvent(eventName: 'like', listener: (arg1: EventModel, arg2?: any) => void): this // 新增
  public onEvent(eventName: keyof BaseDanmakuClient['eventsAsModel'], listener: (...args: any[]) => void): this {
    if (!this.eventsAsModel[eventName]) {
      // @ts-ignore
      this.eventsAsModel[eventName] = []
    }
    // @ts-ignore
    this.eventsAsModel[eventName].push(listener)
    return this
  }

  public offEvent(eventName: keyof BaseDanmakuClient['eventsAsModel'], listener: (...args: any[]) => void): this {
    if (this.eventsAsModel[eventName]?.length) {
      // @ts-ignore
      const index = this.eventsAsModel[eventName].indexOf(listener)
      if (index > -1) {
        this.eventsAsModel[eventName].splice(index, 1)
      }
    }
    return this
  }

  // --- 事件系统 2: on/off (使用原始数据) ---
  // 注意: listener 的 arg1 类型为 any, 需要调用者根据 eventName 自行转换或处理
  public on(eventName: 'danmaku', listener: (arg1: any, arg2?: any) => void): this
  public on(eventName: 'gift', listener: (arg1: any, arg2?: any) => void): this
  public on(eventName: 'sc', listener: (arg1: any, arg2?: any) => void): this
  public on(eventName: 'guard', listener: (arg1: any, arg2?: any) => void): this
  public on(eventName: 'enter', listener: (arg1: any, arg2?: any) => void): this // 新增
  public on(eventName: 'scDel', listener: (arg1: any, arg2?: any) => void): this // 新增
  public on(eventName: 'all', listener: (arg1: any) => void): this
  public on(eventName: 'follow', listener: (arg1: any, arg2?: any) => void): this // 新增
  public on(eventName: 'like', listener: (arg1: any, arg2?: any) => void): this // 新增
  public on(eventName: keyof BaseDanmakuClient['eventsRaw'], listener: (...args: any[]) => void): this {
    if (!this.eventsRaw[eventName]) {
      // @ts-ignore
      this.eventsRaw[eventName] = []
    }
    // @ts-ignore
    this.eventsRaw[eventName].push(listener)
    return this
  }

  public off(eventName: keyof BaseDanmakuClient['eventsRaw'], listener: (...args: any[]) => void): this {
    if (this.eventsRaw[eventName]?.length) {
      // @ts-ignore
      const index = this.eventsRaw[eventName].indexOf(listener)
      if (index > -1) {
        this.eventsRaw[eventName].splice(index, 1)
      }
    }
    return this
  }
}
