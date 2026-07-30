import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import BaseDanmakuClient from '../DanmakuClients/BaseDanmakuClient'
import type { AuthInfo } from '../DanmakuClients/OpenLiveClient'
import OpenLiveClient from '../DanmakuClients/OpenLiveClient'

const mocks = vi.hoisted(() => {
  class KeepLiveWSMock extends EventTarget {
    public static instances: KeepLiveWSMock[] = []
    public closeCalls = 0
    public closed = false

    public constructor(
      public roomId: number,
      public options?: unknown,
    ) {
      super()
      KeepLiveWSMock.instances.push(this)
    }

    public emit(type: string, data?: unknown) {
      const event = new Event(type)
      Object.defineProperty(event, 'data', { value: data })
      this.dispatchEvent(event)
    }

    public close() {
      if (this.closed) return
      this.closed = true
      this.closeCalls++
      this.emit('close')
    }
  }

  return {
    KeepLiveWSMock,
    queryGet: vi.fn(),
    queryPost: vi.fn(),
  }
})

vi.mock('@laplace.live/ws/client', () => ({
  KeepLiveWS: mocks.KeepLiveWSMock,
}))

vi.mock('worker-timers', () => ({
  clearTimeout: (timer: ReturnType<typeof globalThis.setTimeout>) => globalThis.clearTimeout(timer),
  setTimeout: (callback: () => void, delay: number) => globalThis.setTimeout(callback, delay),
}))

vi.mock('@/api/query', () => ({
  QueryGetAPI: mocks.queryGet,
  QueryPostAPI: mocks.queryPost,
}))

class TestDanmakuClient extends BaseDanmakuClient {
  public type = 'direct' as const
  public serverUrl = 'wss://test'
  public socket: InstanceType<typeof mocks.KeepLiveWSMock> | undefined
  public beforeCreate: Promise<void> = Promise.resolve()

  protected async initClient(signal: AbortSignal) {
    await this.beforeCreate
    this.socket = new mocks.KeepLiveWSMock(1)
    return this.initClientInner(this.socket as never, signal)
  }

  public onDanmaku() {}
  public onGift() {}
  public onSC() {}
  public onGuard() {}
  public onEnter() {}
  public onScDel() {}
  public onLike() {}
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function startOpenLive(client: OpenLiveClient) {
  const startPromise = client.Start()
  await vi.advanceTimersByTimeAsync(0)
  const socket = mocks.KeepLiveWSMock.instances.at(-1)
  socket.emit('live')
  expect(await startPromise).toEqual({ success: true, message: '' })
  return socket
}

describe('base danmaku client lifecycle', () => {
  beforeEach(() => {
    mocks.KeepLiveWSMock.instances.length = 0
  })

  it('does not revive a start that was stopped while initialization was pending', async () => {
    const gate = deferred()
    const client = new TestDanmakuClient()
    client.beforeCreate = gate.promise

    const startPromise = client.Start()
    client.Stop()
    gate.resolve()

    expect(await startPromise).toEqual({ success: false, message: '弹幕客户端启动已取消' })
    expect(client.state).toBe('disconnected')
    expect(client.client).toBeNull()
    expect(client.socket?.closed).toBe(true)
  })

  it('fails immediately when the socket closes before the live handshake', async () => {
    const client = new TestDanmakuClient()
    const startPromise = client.Start()
    await Promise.resolve()
    client.socket.emit('close')

    expect(await startPromise).toEqual({ success: false, message: '连接在握手完成前关闭' })
    expect(client.state).toBe('disconnected')
    expect(client.client).toBeNull()
  })

  it('keeps the wrapper active after a connected inner socket closes', async () => {
    const client = new TestDanmakuClient()
    const startPromise = client.Start()
    await Promise.resolve()
    client.socket.emit('live')
    await startPromise

    client.socket.emit('close')

    expect(client.state).toBe('connected')
    expect(client.client).toBe(client.socket)
  })

  it('ignores lifecycle events from a stopped connection after restarting', async () => {
    const client = new TestDanmakuClient()
    const firstStart = client.Start()
    await Promise.resolve()
    const firstSocket = client.socket
    firstSocket.emit('live')
    await firstStart

    client.Stop()
    const secondStart = client.Start()
    await Promise.resolve()
    const secondSocket = client.socket
    secondSocket.emit('live')
    await secondStart

    firstSocket.emit('close')

    expect(client.state).toBe('connected')
    expect(client.client).toBe(secondSocket)
  })
})

describe('open live client heartbeat lifecycle', () => {
  const authInfo: AuthInfo = {
    Timestamp: '123',
    Code: 'code',
    Mid: 'mid',
    Caller: 'caller',
    CodeSign: 'sign',
  }
  const startResponse = {
    code: 200,
    message: '',
    data: {
      anchor_info: { room_id: 1 },
      websocket_info: { auth_body: '{}', wss_link: ['wss://test'] },
    },
  }

  beforeEach(() => {
    vi.useFakeTimers()
    mocks.KeepLiveWSMock.instances.length = 0
    mocks.queryGet.mockReset()
    mocks.queryPost.mockReset()
    mocks.queryPost.mockResolvedValue(startResponse)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs one HTTP heartbeat at a time and aborts it on Stop without losing AuthInfo', async () => {
    let heartbeatSignal: AbortSignal | undefined
    let heartbeatCalls = 0
    mocks.queryPost.mockImplementation(async (url: string, ...args: unknown[]) => {
      if (url.endsWith('/start')) return Promise.resolve(startResponse)
      heartbeatCalls++
      heartbeatSignal = (args[3] as { signal: AbortSignal }).signal
      return new Promise((_resolve, reject) => {
        heartbeatSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {
          once: true,
        })
      })
    })

    const client = new OpenLiveClient(authInfo)
    const connectionLost = vi.fn()
    client.onConnectionLost = connectionLost
    await startOpenLive(client)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(heartbeatCalls).toBe(1)
    expect(heartbeatSignal?.aborted).toBe(false)

    client.Stop()
    await vi.advanceTimersByTimeAsync(0)

    expect(heartbeatSignal?.aborted).toBe(true)
    expect(connectionLost).not.toHaveBeenCalled()
    expect(client.authInfo).toBe(authInfo)
    expect(client.state).toBe('disconnected')
  })
})
