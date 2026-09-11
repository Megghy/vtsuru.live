import { HubConnectionState } from '@microsoft/signalr'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCOUNT } from '@/api/account'

import { isHubConnected, useVTsuruHub } from '../useVTsuruHub'

const send = vi.fn()
const invoke = vi.fn()
const start = vi.fn()
const on = vi.fn()
const off = vi.fn()
const onclose = vi.fn()
const onreconnected = vi.fn()

const fakeConnection = {
  state: HubConnectionState.Disconnected as HubConnectionState,
  send,
  invoke,
  on,
  off,
  start,
  onclose,
  onreconnected,
}

vi.mock('@microsoft/signalr', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@microsoft/signalr')>()
  return {
    ...actual,
    HubConnectionBuilder: class {
      withUrl() {
        return this
      }
      withAutomaticReconnect() {
        return this
      }
      withHubProtocol() {
        return this
      }
      build() {
        return fakeConnection
      }
    },
  }
})

vi.mock('@microsoft/signalr-protocol-msgpack', () => ({
  MessagePackHubProtocol: class {},
}))

describe('useVTsuruHub', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    send.mockReset()
    invoke.mockReset()
    start.mockReset()
    on.mockReset()
    fakeConnection.state = HubConnectionState.Disconnected
    ACCOUNT.value = { id: 1, token: 'test-token' } as typeof ACCOUNT.value
  })

  it('isHubConnected 只认 Connected', () => {
    expect(isHubConnected(undefined)).toBe(false)
    expect(isHubConnected({ state: HubConnectionState.Disconnected } as never)).toBe(false)
    expect(isHubConnected({ state: HubConnectionState.Reconnecting } as never)).toBe(false)
    expect(isHubConnected({ state: HubConnectionState.Connected } as never)).toBe(true)
  })

  it('未连接时 send 不会调用底层 send', async () => {
    start.mockImplementation(async () => {
      fakeConnection.state = HubConnectionState.Disconnected
    })
    const hub = useVTsuruHub()
    await hub.send('Ping')
    expect(send).not.toHaveBeenCalled()
  })

  it('已连接时 send 才发出', async () => {
    start.mockImplementation(async () => {
      fakeConnection.state = HubConnectionState.Connected
    })
    const hub = useVTsuruHub()
    await hub.send('Ping', 1)
    expect(send).toHaveBeenCalledWith('Ping', 1)
  })

  it('Finished 在非 Connected 时不回发', async () => {
    const handlers: Record<string, () => void> = {}
    on.mockImplementation((name: string, cb: () => void) => {
      handlers[name] = cb
    })
    start.mockImplementation(async () => {
      fakeConnection.state = HubConnectionState.Connected
    })
    const hub = useVTsuruHub()
    await hub.Init()
    fakeConnection.state = HubConnectionState.Disconnecting
    send.mockClear()
    handlers.Finished?.()
    expect(send).not.toHaveBeenCalled()
  })
})
