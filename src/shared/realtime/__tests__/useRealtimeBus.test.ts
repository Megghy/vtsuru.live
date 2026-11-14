import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

const mockAccount = ref({ id: 100, token: 'test-token' })
vi.mock('@/api/account', () => ({
  useAccount: () => mockAccount,
}))

const mockApiUrl = ref('https://api.vtsuru.suki.club/')
vi.mock('@/shared/config', () => ({
  getCurrentAPIUrl: () => mockApiUrl.value,
  isDev: false,
  markAPIFailover: vi.fn(() => false),
}))

let mockConnection: MockHubConnection | null = null
let lastBuiltUrl = ''

class MockHubConnection {
  state = 'Disconnected'
  handlers = new Map<string, (...args: unknown[]) => void>()
  reconnectingCb?: () => void
  reconnectedCb?: () => void
  closeCb?: () => void

  start = vi.fn(async () => {
    this.state = 'Connected'
  })

  stop = vi.fn(async () => {
    this.state = 'Disconnected'
  })

  invoke = vi.fn(async (_method: string, ..._args: unknown[]) => {
    return null
  })

  on(name: string, cb: (...args: unknown[]) => void) {
    this.handlers.set(name, cb)
  }

  onreconnecting(cb: () => void) {
    this.reconnectingCb = cb
  }

  onreconnected(cb: () => void) {
    this.reconnectedCb = cb
  }

  onclose(cb: () => void) {
    this.closeCb = cb
  }

  emit(name: string, ...args: unknown[]) {
    this.handlers.get(name)?.(...args)
  }
}

vi.mock('@microsoft/signalr', () => ({
  HttpTransportType: { WebSockets: 1 },
  HubConnectionState: {
    Connected: 'Connected',
    Disconnected: 'Disconnected',
    Reconnecting: 'Reconnecting',
  },
  LogLevel: { Warning: 2 },
  HubConnectionBuilder: class {
    withUrl(url: string) {
      lastBuiltUrl = url
      return this
    }
    configureLogging() {
      return this
    }
    withAutomaticReconnect() {
      return this
    }
    build() {
      mockConnection = new MockHubConnection()
      return mockConnection
    }
  },
}))

import { getRealtimeBus, useRealtimeTopic } from '../index'

describe('RealtimeBus and useRealtimeTopic', () => {
  beforeEach(() => {
    mockConnection = null
    lastBuiltUrl = ''
    mockAccount.value = { id: 100, token: 'test-token' }
    mockApiUrl.value = 'https://api.vtsuru.suki.club/'
    // 重置全局单例
    const bus = getRealtimeBus()
    // @ts-expect-error test reset
    bus.topics.clear()
    // @ts-expect-error test reset
    bus.connection = null
    // @ts-expect-error test reset
    bus.connectedToken = ''
    // @ts-expect-error test reset
    bus.connectedUrl = ''
    // @ts-expect-error test reset
    bus.hasConnectedOnce = false
  })

  it('subscribes topic on mount and unsubscribes on scope dispose with refCount', async () => {
    const scope1 = effectScope()
    const scope2 = effectScope()

    scope1.run(() => {
      useRealtimeTopic('pngtuber:room:R12345')
    })
    await flushPromises()

    expect(mockConnection).not.toBeNull()
    expect(mockConnection?.handlers.has('Event')).toBe(true)
    expect(mockConnection?.handlers.has('Subscribed')).toBe(true)
    expect(mockConnection?.handlers.has('Unsubscribed')).toBe(true)
    expect(mockConnection?.start).toHaveBeenCalled()
    expect(mockConnection?.invoke).toHaveBeenCalledWith('Subscribe', 'pngtuber:room:R12345', null)

    // 第二个组件也订阅同一主题，不应重复向服务端发送 Subscribe
    const invokeCountBefore = mockConnection?.invoke.mock.calls.length
    scope2.run(() => {
      useRealtimeTopic('pngtuber:room:R12345')
    })
    await flushPromises()
    expect(mockConnection?.invoke.mock.calls.length).toBe(invokeCountBefore)

    // 销毁 scope1，引用计数减 1，但仍有 scope2 在用，不触发 Unsubscribe
    scope1.stop()
    await flushPromises()
    expect(mockConnection?.invoke).not.toHaveBeenCalledWith('Unsubscribe', 'pngtuber:room:R12345')

    // 销毁 scope2，引用计数归零，触发 Unsubscribe
    scope2.stop()
    await flushPromises()
    expect(mockConnection?.invoke).toHaveBeenCalledWith('Unsubscribe', 'pngtuber:room:R12345')
  })

  it('dispatches events to registered listeners and supports publish', async () => {
    const scope = effectScope()
    let receivedPayload: any = null

    scope.run(() => {
      const topic = useRealtimeTopic('pngtuber:room:ABCDEF')
      topic.on('member_audio', (payload) => {
        receivedPayload = payload
      })
      void topic.publish('audio', { volume: 80, isSpeaking: true })
    })

    await flushPromises()

    // 检查 publish
    expect(mockConnection?.invoke).toHaveBeenCalledWith('Publish', 'pngtuber:room:ABCDEF', 'audio', {
      volume: 80,
      isSpeaking: true,
    })

    // 模拟服务端推事件
    mockConnection?.emit('Event', 'pngtuber:room:ABCDEF', 'member_audio', { userId: 2, volume: 90 })
    expect(receivedPayload).toEqual({ userId: 2, volume: 90 })

    scope.stop()
  })

  it('resubscribes all active topics upon reconnect', async () => {
    const scope = effectScope()
    scope.run(() => {
      useRealtimeTopic('pngtuber:room:TEST1')
      useRealtimeTopic('pngtuber:room:TEST2')
    })

    await Promise.resolve()
    mockConnection?.invoke.mockClear()

    // 触发重连
    mockConnection?.reconnectedCb?.()
    await Promise.resolve()

    expect(mockConnection?.invoke).toHaveBeenCalledWith('Subscribe', 'pngtuber:room:TEST1', null)
    expect(mockConnection?.invoke).toHaveBeenCalledWith('Subscribe', 'pngtuber:room:TEST2', null)

    scope.stop()
  })

  it('rebuilds connection and resubscribes when token or API URL changes', async () => {
    const scope = effectScope()
    const bus = getRealtimeBus()
    const beforeCount = bus.getReconnectedCount().value

    scope.run(() => {
      useRealtimeTopic('obs:display:qa:100')
    })
    await flushPromises()
    const firstConn = mockConnection
    expect(lastBuiltUrl).toContain('token=test-token')

    // Token 变化应重建连接并重新订阅
    mockAccount.value = { id: 100, token: 'new-token-2' }
    await nextTick()
    await flushPromises()
    expect(firstConn?.stop).toHaveBeenCalled()
    expect(mockConnection).not.toBe(firstConn)
    expect(lastBuiltUrl).toContain('token=new-token-2')
    expect(mockConnection?.invoke).toHaveBeenCalledWith('Subscribe', 'obs:display:qa:100', null)
    expect(bus.getReconnectedCount().value).toBeGreaterThan(beforeCount)

    // API URL Failover 变化也应重建连接
    const secondConn = mockConnection
    mockApiUrl.value = 'https://failover-api.vtsuru.suki.club/'
    await nextTick()
    await flushPromises()
    expect(secondConn?.stop).toHaveBeenCalled()
    expect(lastBuiltUrl).toContain('failover-api.vtsuru.suki.club')
    expect(mockConnection?.invoke).toHaveBeenCalledWith('Subscribe', 'obs:display:qa:100', null)

    scope.stop()
  })

  it('clears activeTopic when topicRef becomes empty', async () => {
    const scope = effectScope()
    const topicRef = ref('obs:display:qa:100')
    let activeTopicValue = ''

    scope.run(() => {
      const topic = useRealtimeTopic(topicRef)
      topic.on('Scroll', () => {})
      activeTopicValue = topic.activeTopic.value
      topicRef.value = ''
    })
    await nextTick()
    await Promise.resolve()

    expect(activeTopicValue).toBe('obs:display:qa:100')
    scope.stop()
  })
})
