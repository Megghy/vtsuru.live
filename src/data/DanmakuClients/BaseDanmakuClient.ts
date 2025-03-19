import { EventModel } from '@/api/api-models'
import { KeepLiveWS } from 'bilibili-live-ws/browser'

export default abstract class BaseDanmakuClient {
  constructor() {
    this.client = null
  }

  public client: KeepLiveWS | null

  public state: 'padding' | 'connected' | 'connecting' | 'disconnected' =
    'padding'

  public abstract type: 'openlive' | 'direct'

  public eventsAsModel: {
    danmaku: ((arg1: EventModel, arg2?: any) => void)[]
    gift: ((arg1: EventModel, arg2?: any) => void)[]
    sc: ((arg1: EventModel, arg2?: any) => void)[]
    guard: ((arg1: EventModel, arg2?: any) => void)[]
    all: ((arg1: any) => void)[]
  } = {
    danmaku: [],
    gift: [],
    sc: [],
    guard: [],
    all: []
  }

  public async Start(): Promise<{ success: boolean; message: string }> {
    if (this.state == 'connected') {
      return {
        success: true,
        message: '弹幕客户端已启动'
      }
    }
    if (this.state == 'connecting') {
      return {
        success: false,
        message: '弹幕客户端正在启动'
      }
    }
    this.state = 'connecting'
    try {
      if (!this.client) {
        console.log(`[${this.type}] 正在启动弹幕客户端`)
        const result = await this.initClient()
        if (result.success) {
          this.state = 'connected'
        }
        return result
      } else {
        console.warn(`[${this.type}] 弹幕客户端已被启动过`)
        this.state = 'connected'
        return {
          success: false,
          message: '弹幕客户端已被启动过'
        }
      }
    } catch (err) {
      console.error(err)
      this.state = 'disconnected'
      return {
        success: false,
        message: err ? err.toString() : '未知错误'
      }
    }
  }
  public Stop() {
    if (this.state === 'disconnected') {
      return
    }
    this.state = 'disconnected'
    if (this.client) {
      console.log(`[${this.type}] 正在停止弹幕客户端`)
      this.client.close()
    } else {
      console.warn(`[${this.type}] 弹幕客户端未被启动, 忽略`)
    }
    this.eventsAsModel = {
      danmaku: [],
      gift: [],
      sc: [],
      guard: [],
      all: []
    }
  }
  protected abstract initClient(): Promise<{
    success: boolean
    message: string
  }>
  protected async initClientInner(
    chatClient: KeepLiveWS
  ): Promise<{ success: boolean; message: string }> {
    let isConnected = false
    let isError = false
    let errorMsg = ''
    chatClient.on('error', (err: any) => {
      console.error(err)
      isError = true
      errorMsg = err
    })
    chatClient.on('live', () => {
      isConnected = true
    })
    chatClient.on('close', () => {
      console.log(`[${this.type}] 弹幕客户端已关闭`)
    })
    chatClient.on('msg', (cmd) => this.onRawMessage(cmd))

    this.client = chatClient
    while (!isConnected && !isError) {
      await new Promise((resolve) => {
        setTimeout(resolve, 1000)
      })
    }
    if (isError) {
      this.client.close()
      this.client = null
    }
    return {
      success: !isError,
      message: errorMsg
    }
  }

  public onRawMessage = (command: any) => {
    this.eventsAsModel.all?.forEach((d) => {
      d(command)
    })
  }

  public abstract onDanmaku(command: any): void
  public abstract onGift(command: any): void
  public abstract onSC(command: any): void
  public abstract onGuard(command: any): void
  public on(
    eventName: 'danmaku',
    listener: (arg1: EventModel, arg2?: any) => void
  ): this
  public on(
    eventName: 'gift',
    listener: (arg1: EventModel, arg2?: any) => void
  ): this
  public on(
    eventName: 'sc',
    listener: (arg1: EventModel, arg2?: any) => void
  ): this
  public on(
    eventName: 'guard',
    listener: (arg1: EventModel, arg2?: any) => void
  ): this
  public on(eventName: 'all', listener: (arg1: any) => void): this
  public on(
    eventName: 'danmaku' | 'gift' | 'sc' | 'guard' | 'all',
    listener: (...args: any[]) => void
  ): this {
    if (!this.eventsAsModel[eventName]) {
      this.eventsAsModel[eventName] = []
    }
    this.eventsAsModel[eventName].push(listener)
    return this
  }
  public off(
    eventName: 'danmaku' | 'gift' | 'sc' | 'guard' | 'all',
    listener: (...args: any[]) => void
  ): this {
    if (this.eventsAsModel[eventName]) {
      const index = this.eventsAsModel[eventName].indexOf(listener)
      if (index > -1) {
        this.eventsAsModel[eventName].splice(index, 1)
      }
    }
    return this
  }
}
