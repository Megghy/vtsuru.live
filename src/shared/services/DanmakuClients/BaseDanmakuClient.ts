import { KeepLiveWS } from '@laplace.live/ws/client'
import DanmakuEventEmitter from './DanmakuEventEmitter'

type StartResult = { success: boolean, message: string }
type ConnectOutcome = 'connected' | 'error' | 'timeout' | 'cancelled'

const CONNECT_TIMEOUT_MS = 30_000

export class DanmakuKeepLiveWS extends KeepLiveWS {
  public override connect(reconnect = true) {
    if (this.closed) return
    super.connect(reconnect)
  }
}

export default abstract class BaseDanmakuClient extends DanmakuEventEmitter {
  public client: DanmakuKeepLiveWS | null = null
  public abstract type: 'openlive' | 'direct'
  public abstract serverUrl: string

  private lifecycle = 0
  private lifecycleController: AbortController | undefined

  public async Start(): Promise<StartResult> {
    if (this.state === 'connected') {
      return { success: true, message: '弹幕客户端已启动' }
    }
    if (this.state === 'connecting') {
      return { success: false, message: '弹幕客户端正在启动' }
    }

    const generation = ++this.lifecycle
    const controller = new AbortController()
    this.lifecycleController = controller
    this.state = 'connecting'
    console.log(`[${this.type}] 正在启动弹幕客户端`)

    try {
      const result = await this.initClient(controller.signal)
      if (!this.isCurrentLifecycle(generation, controller)) {
        return { success: false, message: '弹幕客户端启动已取消' }
      }

      this.state = result.success ? 'connected' : 'disconnected'
      if (result.success) {
        console.log(`[${this.type}] 弹幕客户端已完成启动`)
      } else {
        this.closeCurrentClient()
        console.error(`[${this.type}] 弹幕客户端启动失败: ${result.message}`)
        this.lifecycleController = undefined
      }
      return result
    } catch (error) {
      if (!this.isCurrentLifecycle(generation, controller)) {
        return { success: false, message: '弹幕客户端启动已取消' }
      }

      const message = error instanceof Error ? error.message : String(error)
      console.error(`[${this.type}] 启动过程中发生异常:`, error)
      this.state = 'disconnected'
      this.closeCurrentClient()
      this.lifecycleController = undefined
      return { success: false, message }
    }
  }

  public Stop(): void {
    ++this.lifecycle
    this.state = 'disconnected'

    const controller = this.lifecycleController
    this.lifecycleController = undefined
    controller?.abort()

    if (!this.client) return
    console.log(`[${this.type}] 正在停止弹幕客户端`)
    this.closeCurrentClient()
  }

  protected abstract initClient(signal: AbortSignal): Promise<StartResult>

  protected async initClientInner(chatClient: DanmakuKeepLiveWS, signal: AbortSignal): Promise<StartResult> {
    if (signal.aborted) {
      chatClient.close()
      return { success: false, message: '弹幕客户端启动已取消' }
    }

    let message = ''
    let finish!: (outcome: ConnectOutcome) => void
    const outcomePromise = new Promise<ConnectOutcome>((resolve) => {
      let settled = false
      finish = (outcome) => {
        if (settled) return
        settled = true
        resolve(outcome)
      }
    })

    const failHandshake = (reason: string) => {
      if (this.client !== chatClient || this.state !== 'connecting') return
      message = reason
      finish('error')
    }
    const onLive = () => {
      if (this.client !== chatClient || signal.aborted) return
      if (this.state === 'connecting') finish('connected')
      else if (this.state === 'connected') console.log(`[${this.type}] 弹幕客户端已自动重连`)
    }
    const onClose = () => {
      if (this.client !== chatClient) return
      if (this.state === 'connecting') failHandshake('连接在握手完成前关闭')
      else if (this.state === 'connected') console.warn(`[${this.type}] WebSocket 已断开，等待自动重连`)
    }
    const onError = (error: Event) => {
      console.error(`[${this.type}] WebSocket 发生错误:`, error)
      failHandshake('WebSocket 连接发生错误')
    }
    const onAbort = () => finish('cancelled')

    chatClient.addEventListener('live', onLive)
    chatClient.addEventListener('close', onClose)
    chatClient.addEventListener('error', onError)
    chatClient.addEventListener('msg', event => {
      if (this.client === chatClient && !signal.aborted) this.onRawMessage(event.data)
    })
    signal.addEventListener('abort', onAbort, { once: true })
    this.client = chatClient

    const timeoutId = setTimeout(() => finish('timeout'), CONNECT_TIMEOUT_MS)
    const outcome = await outcomePromise
    clearTimeout(timeoutId)
    signal.removeEventListener('abort', onAbort)

    if (outcome === 'connected') return { success: true, message: '' }

    if (outcome === 'timeout') message = '连接超时'
    if (outcome === 'cancelled') message = '弹幕客户端启动已取消'
    if (this.client === chatClient) this.client = null
    chatClient.close()
    return { success: false, message }
  }

  private isCurrentLifecycle(generation: number, controller: AbortController) {
    return generation === this.lifecycle
      && controller === this.lifecycleController
      && !controller.signal.aborted
  }

  private closeCurrentClient() {
    const client = this.client
    this.client = null
    if (!client) return
    try {
      client.close()
    } catch (error) {
      console.error(`[${this.type}] 关闭客户端时发生错误:`, error)
    }
  }

  public abstract onDanmaku(command: any): void
  public abstract onGift(command: any): void
  public abstract onSC(command: any): void
  public abstract onGuard(command: any): void
  public abstract onEnter(command: any): void
  public abstract onScDel(command: any): void
  public abstract onLike(command: any): void
}
