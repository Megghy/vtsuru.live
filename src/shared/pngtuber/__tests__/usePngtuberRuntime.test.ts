import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { DEFAULT_PNGTUBER_RUNTIME } from '../types'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

const account = ref({ id: 1, token: 'one' })
const clients: MockConnection[] = []
const builds: Array<(client: MockConnection) => void> = []
class MockConnection {
  state = 'Disconnected'
  url = ''
  stateCallback = (_value: typeof DEFAULT_PNGTUBER_RUNTIME) => {}
  reconnecting = () => {}
  reconnected = () => {}
  close = () => {}
  start = vi.fn(async () => {
    this.state = 'Connected'
  })
  stop = vi.fn(async () => {
    this.state = 'Disconnected'
    this.close()
  })
  invoke = vi.fn(async (method: string, ..._args: unknown[]): Promise<unknown> => {
    if (method === 'Heartbeat') return { ...DEFAULT_PNGTUBER_RUNTIME }
  })
  on(_name: string, callback: typeof this.stateCallback) {
    this.stateCallback = callback
  }
  onreconnecting(callback: () => void) {
    this.reconnecting = callback
  }
  onreconnected(callback: () => void) {
    this.reconnected = callback
  }
  onclose(callback: () => void) {
    this.close = callback
  }
  lose() {
    this.state = 'Reconnecting'
    this.reconnecting()
  }
  restore() {
    this.state = 'Connected'
    this.reconnected()
  }
  emit(updatedAt = 1) {
    this.stateCallback({
      ...DEFAULT_PNGTUBER_RUNTIME,
      expressionId: 'happy',
      isSpeaking: true,
      volume: 80,
      source: 'client',
      updatedAt,
    })
  }
}
vi.mock('@/api/account', () => ({ useAccount: () => account }))
vi.mock('@/shared/config', () => ({ BASE_HUB_URL: 'https://example.test/hub/', mapToCurrentAPI: (url: string) => url }))
vi.mock('@microsoft/signalr', () => ({
  HttpTransportType: { WebSockets: 1 },
  HubConnectionState: { Connected: 'Connected' },
  LogLevel: { Error: 4 },
  HubConnectionBuilder: class {
    url = ''
    withUrl(url: string) {
      this.url = url
      return this
    }
    configureLogging() {
      return this
    }
    withAutomaticReconnect() {
      return this
    }
    build() {
      const client = new MockConnection()
      client.url = this.url
      builds.shift()?.(client)
      clients.push(client)
      return client
    }
  },
}))
const { usePngtuberRuntime } = await import('../usePngtuberRuntime')
const scopes: ReturnType<typeof effectScope>[] = []
async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}
function setup(controller = true) {
  const scope = effectScope()
  scopes.push(scope)
  const id = ref(1),
    channel = ref('default')
  const runtime = scope.run(() => usePngtuberRuntime(id, channel, controller))!
  return { ...runtime, scope, id, channel }
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(performance, 'now').mockReturnValue(0)
  clients.length = 0
  builds.length = 0
  account.value = { id: 1, token: 'one' }
})
afterEach(async () => {
  scopes.splice(0).forEach((scope) => scope.stop())
  await flush()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('PNGtuber SignalR runtime races', () => {
  it('sends only provided control fields, preserving false and explicit default expression', async () => {
    const runtime = setup()
    await flush()
    clients[0].emit()
    await runtime.control({ muted: true })
    expect(clients[0].invoke).toHaveBeenLastCalledWith('Control', null, true, null, 0)
    await runtime.control({ away: false })
    expect(clients[0].invoke).toHaveBeenLastCalledWith('Control', null, null, false, 0)
    await runtime.control({ expressionId: '' }, 100)
    expect(clients[0].invoke).toHaveBeenLastCalledWith('Control', '', null, null, 100)
    await runtime.control({ expressionId: 'happy', muted: false, away: true })
    expect(clients[0].invoke).toHaveBeenLastCalledWith('Control', 'happy', false, true, 0)
  })

  it('does not construct a connection after immediate scope disposal', async () => {
    const runtime = setup()
    runtime.scope.stop()
    await flush()
    expect(clients).toHaveLength(0)
  })

  it('stops a deferred start that finishes after disposal without joining or retrying', async () => {
    const start = deferred()
    builds.push((client) =>
      client.start.mockImplementation(async () => {
        await start.promise
        client.state = 'Connected'
      }),
    )
    const runtime = setup()
    await flush()
    runtime.scope.stop()
    start.resolve()
    await flush()
    expect(clients[0].stop).toHaveBeenCalledTimes(2)
    expect(clients[0].invoke).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(5000)
    expect(clients).toHaveLength(1)
  })

  it('keeps the newest channel while older connect awaits deferred stop', async () => {
    const runtime = setup()
    await flush()
    const stopped = deferred()
    clients[0].stop.mockImplementation(() => stopped.promise)
    runtime.channel.value = 'intermediate'
    runtime.channel.value = 'latest'
    await flush()
    expect(clients).toHaveLength(2)
    expect(clients[1].invoke).toHaveBeenCalledWith('Join', 1, 'latest')
    stopped.resolve()
    await flush()
    expect(clients).toHaveLength(2)
    expect(runtime.connected.value).toBe(true)
  })

  it('ignores stale state and lifecycle callbacks after an account switch', async () => {
    const runtime = setup()
    await flush()
    const old = clients[0]
    account.value = { id: 2, token: 'two' }
    expect(runtime.connected.value).toBe(false)
    runtime.id.value = 2
    await flush()
    const active = clients[1]
    expect(active.url).toContain('token=two')
    active.emit(5)
    old.emit(100)
    old.reconnecting()
    old.reconnected()
    old.close()
    await flush()
    expect(runtime.runtime.value.updatedAt).toBe(5)
    expect(runtime.runtime.value.isSpeaking).toBe(true)
    expect(runtime.connected.value).toBe(true)
    expect(old.invoke.mock.calls.filter(([method]) => method === 'Join')).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(3000)
    expect(clients).toHaveLength(2)
  })

  it('reacts to owner changes even when the token does not change', async () => {
    const runtime = setup()
    await flush()
    account.value = { id: 2, token: 'one' }
    expect(runtime.connected.value).toBe(false)
    await flush()
    expect(clients[0].stop).toHaveBeenCalledOnce()
    expect(clients).toHaveLength(1)
  })

  it('contains stop failures during replacement and scope disposal', async () => {
    const runtime = setup()
    await flush()
    clients[0].stop.mockRejectedValue(new Error('old stop'))
    await runtime.reconnect()
    expect(runtime.connected.value).toBe(true)
    expect(runtime.error.value).toBe('')
    clients[1].stop.mockRejectedValue(new Error('dispose stop'))
    runtime.scope.stop()
    await flush()
    expect(runtime.error.value).toBe('')
  })

  it('closes the mouth on reconnect and close, then automatically retries a failed rejoin', async () => {
    const runtime = setup()
    await flush()
    const client = clients[0]
    client.emit()
    client.lose()
    expect(runtime.runtime.value).toMatchObject({ isSpeaking: false, volume: 0, source: '', expressionId: 'happy' })
    const join = deferred()
    client.invoke.mockImplementation((method) =>
      method === 'Join' ? join.promise : Promise.resolve(DEFAULT_PNGTUBER_RUNTIME),
    )
    client.restore()
    expect(runtime.connected.value).toBe(false)
    join.reject(new Error('rejoin failed'))
    await flush()
    expect(runtime.error.value).toBe('rejoin failed')
    await vi.advanceTimersByTimeAsync(3000)
    expect(clients).toHaveLength(2)
    expect(runtime.connected.value).toBe(true)
    clients[1].emit(10)
    clients[1].state = 'Disconnected'
    clients[1].close()
    expect(runtime.runtime.value.isSpeaking).toBe(false)
    expect(runtime.runtime.value.volume).toBe(0)
  })

  it('ignores deferred old joins after replacement and transport loss', async () => {
    const join = deferred()
    builds.push((client) => client.invoke.mockImplementation(() => join.promise))
    const runtime = setup()
    await flush()
    clients[0].lose()
    join.resolve()
    await flush()
    expect(runtime.connected.value).toBe(false)
    await runtime.reconnect()
    expect(runtime.connected.value).toBe(true)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('isolates publish errors, busy flags and throttles across owners', async () => {
    const runtime = setup()
    await flush()
    const oldPublish = deferred()
    clients[0].invoke.mockImplementation(() => oldPublish.promise)
    const oldTask = runtime.publish(80, true, 'client')
    expect(clients[0].invoke).toHaveBeenLastCalledWith('Publish', 80, true, 'client')
    account.value = { id: 2, token: 'two' }
    runtime.id.value = 2
    await flush()
    const nextPublish = deferred()
    clients[1].invoke.mockImplementation(() => nextPublish.promise)
    const nextTask = runtime.publish(60, true, 'client')
    expect(clients[1].invoke).toHaveBeenLastCalledWith('Publish', 60, true, 'client')
    oldPublish.reject(new Error('old owner'))
    await oldTask
    expect(runtime.error.value).toBe('')
    vi.mocked(performance.now).mockReturnValue(100)
    await runtime.publish(40, true, 'client')
    expect(clients[1].invoke.mock.calls.filter(([method]) => method === 'Publish')).toHaveLength(1)
    nextPublish.resolve()
    await nextTask
  })

  it('isolates deferred heartbeat results and busy flags across transport reconnect', async () => {
    const runtime = setup()
    await flush()
    const client = clients[0],
      oldHeartbeat = deferred<unknown>(),
      nextHeartbeat = deferred<unknown>()
    client.invoke.mockImplementation((method) => (method === 'Heartbeat' ? oldHeartbeat.promise : Promise.resolve()))
    await vi.advanceTimersByTimeAsync(1000)
    client.lose()
    client.restore()
    await flush()
    client.invoke.mockImplementation((method) => (method === 'Heartbeat' ? nextHeartbeat.promise : Promise.resolve()))
    await vi.advanceTimersByTimeAsync(1000)
    expect(client.invoke.mock.calls.filter(([method]) => method === 'Heartbeat')).toHaveLength(2)
    oldHeartbeat.resolve({ ...DEFAULT_PNGTUBER_RUNTIME, updatedAt: 100, isSpeaking: true, volume: 80 })
    await flush()
    expect(runtime.runtime.value.isSpeaking).toBe(false)
    await vi.advanceTimersByTimeAsync(1000)
    expect(client.invoke.mock.calls.filter(([method]) => method === 'Heartbeat')).toHaveLength(2)
    nextHeartbeat.resolve({ ...DEFAULT_PNGTUBER_RUNTIME, updatedAt: 5, expressionId: 'new' })
    await flush()
    expect(runtime.runtime.value.expressionId).toBe('new')
  })

  it('does not install an old heartbeat timer when a replaced Join resolves late', async () => {
    const join = deferred()
    builds.push((client) => client.invoke.mockImplementation(() => join.promise))
    const runtime = setup()
    await flush()
    await runtime.reconnect()
    clients[1].emit(5)
    join.resolve()
    await flush()
    expect(runtime.connected.value).toBe(true)
    expect(runtime.runtime.value.updatedAt).toBe(5)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(clients[0].invoke.mock.calls.filter(([method]) => method === 'Heartbeat')).toHaveLength(0)
  })

  it('buffers Join state until success and stays silent if Join fails', async () => {
    const runtime = setup()
    await flush()
    const client = clients[0]
    client.lose()
    const join = deferred()
    client.invoke.mockImplementation(() => join.promise)
    client.restore()
    client.emit(10)
    expect(runtime.runtime.value.isSpeaking).toBe(false)
    join.reject(new Error('join failed after State'))
    await flush()
    expect(runtime.runtime.value.isSpeaking).toBe(false)
    expect(runtime.connected.value).toBe(false)
    await vi.advanceTimersByTimeAsync(3000)
    const active = clients[1]
    active.lose()
    const nextJoin = deferred()
    active.invoke.mockImplementation(() => nextJoin.promise)
    active.restore()
    active.emit(20)
    nextJoin.resolve()
    await flush()
    expect(runtime.runtime.value.isSpeaking).toBe(true)
    expect(runtime.connected.value).toBe(true)
  })

  it('resets publish throttle and ignores old publish failures after transport reconnect', async () => {
    const runtime = setup()
    await flush()
    const client = clients[0],
      publish = deferred()
    client.invoke.mockImplementation((method) => (method === 'Publish' ? publish.promise : Promise.resolve()))
    const task = runtime.publish(80, true, 'client')
    client.lose()
    client.restore()
    await flush()
    client.invoke.mockResolvedValue(undefined)
    await runtime.publish(50, true, 'client')
    expect(client.invoke.mock.calls.filter(([method]) => method === 'Publish')).toHaveLength(2)
    publish.reject(new Error('previous transport'))
    await task
    expect(runtime.error.value).toBe('')
    await runtime.publish(40, true, 'client')
    expect(client.invoke.mock.calls.filter(([method]) => method === 'Publish')).toHaveLength(2)
    vi.mocked(performance.now).mockReturnValue(50)
    await runtime.publish(40, true, 'client')
    expect(client.invoke.mock.calls.filter(([method]) => method === 'Publish')).toHaveLength(3)
  })

  it('retries initial start failure and prohibits public viewer controls', async () => {
    builds.push((client) => client.start.mockRejectedValue(new Error('offline')))
    const runtime = setup(false)
    await flush()
    expect(runtime.error.value).toBe('offline')
    await vi.advanceTimersByTimeAsync(3000)
    expect(runtime.connected.value).toBe(true)
    await expect(runtime.control({ muted: true })).rejects.toThrow('立绘控制连接尚未就绪')
    expect(clients[1].url).not.toContain('token=')
  })
})
