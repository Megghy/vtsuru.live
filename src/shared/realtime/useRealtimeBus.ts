import { HttpTransportType, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr'
import type { HubConnection } from '@microsoft/signalr'
import { effectScope, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import { getCurrentAPIUrl, isDev, markAPIFailover } from '@/shared/config'

import type { RealtimeBusStatus, RealtimeEventHandler } from './types'

interface TopicRegistration {
  key?: string
  refCount: number
  listeners: Map<string, Set<RealtimeEventHandler>>
}

class RealtimeBusService {
  private connection: HubConnection | null = null
  private connectingPromise: Promise<void> | null = null
  private rebuildingPromise: Promise<void> | null = null
  private connectedToken = ''
  private connectedUrl = ''
  private hasConnectedOnce = false
  private intentionallyStoppedConns = new WeakSet<HubConnection>()
  private topics = new Map<string, TopicRegistration>()
  private status = ref<RealtimeBusStatus>({
    connected: false,
    connecting: false,
    error: '',
  })
  private reconnectedCount = ref(0)

  constructor() {
    const scope = effectScope(true)
    scope.run(() => {
      watch(
        [() => useAccount().value.token, () => getCurrentAPIUrl()],
        () => {
          void this.reconnectIfNeeded()
        },
      )
    })
  }

  public getStatus() {
    return this.status
  }

  public getReconnectedCount() {
    return this.reconnectedCount
  }

  private hasActiveTopics(): boolean {
    for (const reg of this.topics.values()) {
      if (reg.refCount > 0) return true
    }
    return false
  }

  private buildConnection(): { conn: HubConnection; token: string; baseUrl: string } {
    const account = useAccount()
    const token = account.value.token || ''
    const baseUrl = getCurrentAPIUrl()
    const url = new URL('hub/realtime', baseUrl)
    if (token) {
      url.searchParams.set('token', token)
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
      // 服务端订阅确认 ACK
    })

    conn.on('Unsubscribed', (_topic: string) => {
      // 服务端退订确认 ACK
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
      this.reconnectedCount.value++
    })

    conn.onclose(() => {
      if (this.connection !== conn) return
      this.status.value.connected = false
      this.status.value.connecting = false
      this.connection = null
    })

    return { conn, token, baseUrl }
  }

  private async reconnectIfNeeded(): Promise<void> {
    if (!this.connection && !this.connectingPromise) return
    if (this.rebuildingPromise) {
      await this.rebuildingPromise
      return
    }

    const nextToken = useAccount().value.token || ''
    const nextUrl = getCurrentAPIUrl()
    if (nextToken === this.connectedToken && nextUrl === this.connectedUrl) {
      return
    }

    this.rebuildingPromise = (async () => {
      try {
        if (this.connectingPromise) {
          await this.connectingPromise.catch(() => {})
        }
        const staleConn = this.connection
        this.connection = null
        this.status.value.connected = false
        if (staleConn) {
          this.intentionallyStoppedConns.add(staleConn)
          await staleConn.stop().catch(() => {})
        }
        if (this.hasActiveTopics()) {
          await this.connectInternal()
        }
      } finally {
        this.rebuildingPromise = null
      }
    })()

    await this.rebuildingPromise
  }

  public async ensureConnected(): Promise<HubConnection> {
    while (true) {
      if (this.rebuildingPromise) {
        await this.rebuildingPromise
      }

      const conn = await this.connectInternal()
      const nextToken = useAccount().value.token || ''
      const nextUrl = getCurrentAPIUrl()
      if (nextToken !== this.connectedToken || nextUrl !== this.connectedUrl) {
        await this.reconnectIfNeeded()
        continue
      }

      if (this.rebuildingPromise || this.intentionallyStoppedConns.has(conn) || this.connection !== conn) {
        continue
      }

      return conn
    }
  }

  private isCanceledByRebuild(conn: HubConnection): boolean {
    return (
      this.intentionallyStoppedConns.has(conn) ||
      this.rebuildingPromise !== null ||
      (this.connection !== null && this.connection !== conn)
    )
  }

  private async connectInternal(): Promise<HubConnection> {
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
      const startOnce = async () => {
        const built = this.buildConnection()
        this.connection = built.conn
        this.connectedToken = built.token
        this.connectedUrl = built.baseUrl
        await built.conn.start()
      }

      try {
        try {
          await startOnce()
        } catch (err) {
          if (!isDev && markAPIFailover()) {
            const failedConn = this.connection
            this.connection = null
            if (failedConn) {
              this.intentionallyStoppedConns.add(failedConn)
              await failedConn.stop().catch(() => {})
            }
            await startOnce()
          } else {
            throw err
          }
        }

        const wasPreviouslyConnected = this.hasConnectedOnce
        this.hasConnectedOnce = true
        this.status.value.connected = true
        this.status.value.connecting = false
        await this.resubscribeAll()
        if (wasPreviouslyConnected) {
          this.reconnectedCount.value++
        }
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
    const conn = this.connection
    if (!conn || conn.state !== HubConnectionState.Connected) return
    const promises: Promise<unknown>[] = []
    for (const [topic, reg] of this.topics.entries()) {
      if (reg.refCount > 0) {
        promises.push(conn.invoke('Subscribe', topic, reg.key ?? null).catch(() => {}))
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
      while (reg.refCount > 0) {
        const conn = await this.ensureConnected()
        if (reg.refCount <= 0) return
        try {
          await conn.invoke('Subscribe', topic, reg.key ?? null)
          return
        } catch (err) {
          if (this.isCanceledByRebuild(conn)) {
            continue
          }
          throw err
        }
      }
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
    for (let attempt = 0; attempt < 2; attempt++) {
      const conn = await this.ensureConnected()
      try {
        await conn.invoke('Publish', topic, eventName, payload)
        return
      } catch (err) {
        if (attempt === 0 && this.isCanceledByRebuild(conn)) {
          continue
        }
        throw err
      }
    }
  }
}

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
    reconnectedCount: bus.getReconnectedCount(),
    ensureConnected: () => bus.ensureConnected(),
    publish: (topic: string, eventName: string, payload: unknown) => bus.publish(topic, eventName, payload),
    on: (topic: string, eventName: string, handler: RealtimeEventHandler) => bus.on(topic, eventName, handler),
  }
}
