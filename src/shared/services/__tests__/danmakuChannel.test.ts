import type { EventModel } from '@/api/api-models'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDanmakuChannel } from '../danmakuChannel'

// 跨标签页 BroadcastChannel 的内存 mock (同名 channel 互通, 不回送给自己)
class BroadcastChannelMock {
  private static channels = new Map<string, Set<BroadcastChannelMock>>()
  private listeners = new Set<(event: MessageEvent) => void>()

  public static reset() {
    BroadcastChannelMock.channels.clear()
  }

  public constructor(public readonly name: string) {
    const channels = BroadcastChannelMock.channels.get(name) ?? new Set<BroadcastChannelMock>()
    channels.add(this)
    BroadcastChannelMock.channels.set(name, channels)
  }

  public addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') this.listeners.add(listener)
  }

  public postMessage(data: unknown) {
    for (const channel of BroadcastChannelMock.channels.get(this.name) ?? []) {
      if (channel === this) continue
      for (const listener of channel.listeners) listener({ data } as MessageEvent)
    }
  }

  public close() {
    BroadcastChannelMock.channels.get(this.name)?.delete(this)
    this.listeners.clear()
  }
}

function makeEvent(overrides: Partial<EventModel> = {}): EventModel {
  return { uid: 1, uname: 'tester', msg: 'hi', num: 1, price: 0, guard_level: 0, fans_medal_wearing_status: false, fans_medal_level: 0, ...overrides } as EventModel
}

describe('danmakuChannel', () => {
  beforeEach(() => {
    vi.stubGlobal('BroadcastChannel', BroadcastChannelMock)
    BroadcastChannelMock.reset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    BroadcastChannelMock.reset()
  })

  it('delivers events to other tabs but not back to sender', () => {
    const a = createDanmakuChannel('tab-a')
    const b = createDanmakuChannel('tab-b')

    const aRecv = vi.fn()
    const bRecv = vi.fn()
    a.onEvent(aRecv)
    b.onEvent(bRecv)

    const ev = makeEvent({ msg: '辣条' })
    a.publishEvent('room-1', 'gift', ev)

    expect(bRecv).toHaveBeenCalledWith('tab-a', 'room-1', 'gift', ev)
    expect(aRecv).not.toHaveBeenCalled() // 不回送给自己
  })

  it('keeps the connection scope on every event', () => {
    const a = createDanmakuChannel('tab-a')
    const b = createDanmakuChannel('tab-b')

    const bRecv = vi.fn()
    b.onEvent(bRecv)
    const event = makeEvent()
    a.publishEvent('direct:100', 'danmaku', event)

    expect(bRecv).toHaveBeenCalledWith('tab-a', 'direct:100', 'danmaku', event)
  })

  it('routes state and state-request to their own subscribers', () => {
    const a = createDanmakuChannel('tab-a')
    const b = createDanmakuChannel('tab-b')

    const onState = vi.fn()
    const onReq = vi.fn()
    b.onState(onState)
    b.onStateRequest(onReq)

    a.publishState('openlive:account:1', 'connected', 'openlive', { roomId: 100 })
    a.requestState('openlive:account:1')

    expect(onState).toHaveBeenCalledWith('tab-a', 'openlive:account:1', 'connected', 'openlive', { roomId: 100 })
    expect(onReq).toHaveBeenCalledWith('openlive:account:1')
  })

  it('stops receiving after unsubscribe', () => {
    const a = createDanmakuChannel('tab-a')
    const b = createDanmakuChannel('tab-b')

    const recv = vi.fn()
    const off = b.onEvent(recv)
    off()
    a.publishEvent('room-1', 'sc', makeEvent())

    expect(recv).not.toHaveBeenCalled()
  })
})
