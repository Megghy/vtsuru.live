import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

const mockAccount = ref({ id: 100, token: 'test-token' })
vi.mock('@/api/account', () => ({
  useAccount: () => mockAccount,
}))

let mockConnection: MockHubConnection | null = null

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
    withUrl() {
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
    // 重置全局单例
    const bus = getRealtimeBus()
    // @ts-expect-error test reset
    bus.topics.clear()
    // @ts-expect-error test reset
    bus.connection = null
  })

  it('subscribes topic on mount and unsubscribes on scope dispose with refCount', async () => {
    const scope1 = effectScope()
    const scope2 = effectScope()

    scope1.run(() => {
      useRealtimeTopic('pngtuber:room:R12345')
    })
    await Promise.resolve()

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
    await Promise.resolve()
    expect(mockConnection?.invoke.mock.calls.length).toBe(invokeCountBefore)

    // 销毁 scope1，引用计数减 1，但仍有 scope2 在用，不触发 Unsubscribe
    scope1.stop()
    await Promise.resolve()
    expect(mockConnection?.invoke).not.toHaveBeenCalledWith('Unsubscribe', 'pngtuber:room:R12345')

    // 销毁 scope2，引用计数归零，触发 Unsubscribe
    scope2.stop()
    await Promise.resolve()
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

    await Promise.resolve()

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
})
