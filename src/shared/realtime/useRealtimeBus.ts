import { HttpTransportType, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'
import type { HubConnection } from '@microsoft/signalr'
import { ref } from 'vue'

import { useAccount } from '@/api/account'
import { BASE_HUB_URL, mapToCurrentAPI } from '@/shared/config'

import type { RealtimeBusStatus, RealtimeEventHandler } from './types'

interface TopicRegistration {
  key?: string
  refCount: number
  listeners: Map<string, Set<RealtimeEventHandler>>
}

class RealtimeBusService {
  private connection: HubConnection | null = null
  private connectingPromise: Promise<void> | null = null
  private topics = new Map<string, TopicRegistration>()
  private status = ref<RealtimeBusStatus>({
    connected: false,
    connecting: false,
    error: '',
  })

  public getStatus() {
    return this.status
  }

  private buildConnection(): HubConnection {
    const account = useAccount()
    const url = new URL(mapToCurrentAPI(`${BASE_HUB_URL}realtime`))
    if (account.value.token) {
      url.searchParams.set('token', account.value.token)
    }

    const conn = new HubConnectionBuilder()
      .withUrl(url.toString(), {
        skipNegotiation: true,
        transport: HttpTransportType.WebSockets,
      })
      .configureLogging(LogLevel.Warning)
      .withAutomaticReconnect()
      .build()

    conn.on('Event', (topic: string, eventName: string, payload: unknown) => {
      this.dispatchEvent(topic, eventName, payload)
    })

    conn.on('Subscribed', (_topic: string, _success?: boolean) => {
      // 服务端订阅确认 ACK，消费避免客户端报 No client method with the name 'subscribed'
    })

    conn.on('Unsubscribed', (_topic: string) => {
      // 服务端退订确认 ACK，消费避免客户端报 No client method with the name 'unsubscribed'
    })

    conn.onreconnecting(() => {
      this.status.value.connected = false
      this.status.value.connecting = true
    })

    conn.onreconnected(async () => {
      this.status.value.connected = true
      this.status.value.connecting = false
      this.status.value.error = ''
      await this.resubscribeAll()
    })

    conn.onclose(() => {
      this.status.value.connected = false
      this.status.value.connecting = false
      this.connection = null
    })

    return conn
  }

  public async ensureConnected(): Promise<HubConnection> {
    if (this.connection && this.connection.state === HubConnectionState.Connected) {
      return this.connection
    }
    if (this.connectingPromise) {
      await this.connectingPromise
      if (this.connection && this.connection.state === HubConnectionState.Connected) {
        return this.connection
      }
    }

    this.status.value.connecting = true
    this.status.value.error = ''

    this.connectingPromise = (async () => {
      try {
        if (!this.connection || this.connection.state === HubConnectionState.Disconnected) {
          this.connection = this.buildConnection()
        }
        await this.connection.start()
        this.status.value.connected = true
        this.status.value.connecting = false
        await this.resubscribeAll()
      } catch (err: unknown) {
        this.status.value.connected = false
        this.status.value.connecting = false
        this.status.value.error = err instanceof Error ? err.message : String(err)
        this.connection = null
        throw err
      } finally {
        this.connectingPromise = null
      }
    })()

    await this.connectingPromise
    if (!this.connection) throw new Error('未能建立实时网关连接')
    return this.connection
  }

  private async resubscribeAll() {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected) return
    const promises: Promise<unknown>[] = []
    for (const [topic, reg] of this.topics.entries()) {
      if (reg.refCount > 0) {
        promises.push(this.connection.invoke('Subscribe', topic, reg.key ?? null).catch(() => {}))
      }
    }
    await Promise.allSettled(promises)
  }

  private dispatchEvent(topic: string, eventName: string, payload: unknown) {
    const reg = this.topics.get(topic)
    if (!reg) return
    const set = reg.listeners.get(eventName.toLowerCase())
    if (!set) return
    for (const handler of set) {
      try {
        handler(payload)
      } catch (err) {
        console.error(`[RealtimeBus] 处理器处理事件 ${topic}/${eventName} 异常:`, err)
      }
    }
  }

  public async subscribe(topic: string, key?: string): Promise<void> {
    let reg = this.topics.get(topic)
    if (!reg) {
      reg = { key, refCount: 0, listeners: new Map() }
      this.topics.set(topic, reg)
    }
    reg.refCount++
    if (key !== undefined) reg.key = key

    if (reg.refCount === 1) {
      const conn = await this.ensureConnected()
      await conn.invoke('Subscribe', topic, key ?? null)
    }
  }

  public async unsubscribe(topic: string): Promise<void> {
    const reg = this.topics.get(topic)
    if (!reg) return
    reg.refCount = Math.max(0, reg.refCount - 1)

    if (reg.refCount === 0) {
      if (this.connection && this.connection.state === HubConnectionState.Connected) {
        try {
          await this.connection.invoke('Unsubscribe', topic)
        } catch {
          /* 忽略退订时的通信失败 */
        }
      }
    }
  }

  public on(topic: string, eventName: string, handler: RealtimeEventHandler): () => void {
    let reg = this.topics.get(topic)
    if (!reg) {
      reg = { refCount: 0, listeners: new Map() }
      this.topics.set(topic, reg)
    }
    const evt = eventName.toLowerCase()
    let set = reg.listeners.get(evt)
    if (!set) {
      set = new Set()
      reg.listeners.set(evt, set)
    }
    set.add(handler)

    return () => {
      set.delete(handler)
      if (set.size === 0) {
        reg.listeners.delete(evt)
      }
    }
  }

  public async publish(topic: string, eventName: string, payload: unknown): Promise<void> {
    const conn = await this.ensureConnected()
    await conn.invoke('Publish', topic, eventName, payload)
  }
}

// 全局单例
let busInstance: RealtimeBusService | null = null

export function getRealtimeBus(): RealtimeBusService {
  if (!busInstance) {
    busInstance = new RealtimeBusService()
  }
  return busInstance
}

export function useRealtimeBus() {
  const bus = getRealtimeBus()
  return {
    bus,
    status: bus.getStatus(),
    ensureConnected: () => bus.ensureConnected(),
    publish: (topic: string, eventName: string, payload: unknown) => bus.publish(topic, eventName, payload),
    on: (topic: string, eventName: string, handler: RealtimeEventHandler) => bus.on(topic, eventName, handler),
  }
}
