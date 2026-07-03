import type { LiveWS } from '@laplace.live/ws/client'
// BaseDanmakuClient.ts
import DanmakuEventEmitter from './DanmakuEventEmitter'
// 导入事件模型和类型枚举

// B 站弹幕客户端抽象基类 (基于 @laplace.live/ws 的 LiveWS)。
// 事件订阅/分发逻辑在 DanmakuEventEmitter, 这里只负责连接与原始命令解析。
export default abstract class BaseDanmakuClient extends DanmakuEventEmitter {
  constructor() {
    super()
    this.client = null // 初始化客户端实例为 null
  }

  // WebSocket 客户端实例
  public client: LiveWS | null

  // 客户端类型 (由子类实现)
  public abstract type: 'openlive' | 'direct'
  // 目标服务器地址 (由子类实现)
  public abstract serverUrl: string

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

  protected onUnexpectedDisconnect(): void {
    this.onConnectionLost?.()
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
    let finishWait: ((v: 'connected' | 'error') => void) | undefined

    // 监听错误事件
    chatClient.addEventListener('error', (err: any) => {
      console.error(`[${this.type}] 客户端发生错误:`, err)
      isError = true
      errorMsg = err?.message || err?.toString() || '未知错误'
      finishWait?.('error')
    })

    chatClient.addEventListener('live', () => {
      console.log(`[${this.type}] 弹幕客户端连接成功`)
      isConnected = true
      finishWait?.('connected')
    })

    // 监听连接关闭事件
    chatClient.addEventListener('close', () => {
      console.log(`[${this.type}] 弹幕客户端连接已关闭`)
      if (this.state !== 'disconnected') {
        this.state = 'disconnected'
        this.client = null
        this.onUnexpectedDisconnect()
      }
      isConnected = false // 标记为未连接
    })

    // 监听原始消息事件 (通用)
    // 注意: 子类可能也会监听特定事件名, 这里的 'msg' 是备用或处理未被特定监听器捕获的事件
    chatClient.addEventListener('msg', (event: any) => this.onRawMessage(event.data))

    this.client = chatClient // 保存客户端实例

    // 等待连接成功或发生错误（用事件/超时驱动，避免轮询）
    const timeout = 30000 // 30 秒超时
    const outcome = await new Promise<'connected' | 'error' | 'timeout'>((resolve) => {
      let finished = false
      const timeoutId = setTimeout(() => {
        if (finished) return
        finished = true
        finishWait = undefined
        resolve('timeout')
      }, timeout)

      const finish = (v: 'connected' | 'error') => {
        if (finished) return
        finished = true
        clearTimeout(timeoutId)
        finishWait = undefined
        resolve(v)
      }

      finishWait = finish
    })

    if (outcome === 'timeout') {
      isError = true
      errorMsg = '连接超时'
      console.error(`[${this.type}] ${errorMsg}`)
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
}
