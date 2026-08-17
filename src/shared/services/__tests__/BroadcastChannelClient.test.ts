import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EventModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import type { DanmakuChannel } from '@/shared/services/danmakuChannel'
import { createDanmakuChannel } from '@/shared/services/danmakuChannel'
import BroadcastChannelClient from '@/shared/services/DanmakuClients/BroadcastChannelClient'

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
    const cloned = structuredClone(data)
    for (const channel of BroadcastChannelMock.channels.get(this.name) ?? []) {
      if (channel === this) continue
      for (const listener of channel.listeners) listener({ data: cloned } as MessageEvent)
    }
  }

  public close() {
    BroadcastChannelMock.channels.get(this.name)?.delete(this)
    this.listeners.clear()
  }
}

function makeEvent(overrides: Partial<EventModel> = {}): EventModel {
  return {
    type: EventDataTypes.Gift,
    uid: 1,
    uname: 'tester',
    msg: '辣条',
    num: 1,
    price: 0.1,
    guard_level: 0,
    fans_medal_wearing_status: false,
    fans_medal_level: 0,
    fans_medal_name: '',
    uface: '',
    open_id: '',
    ouid: '',
    time: 1,
    ...overrides,
  }
}

describe('BroadcastChannelClient', () => {
  let publisher: DanmakuChannel
  let consumerChannel: DanmakuChannel

  beforeEach(() => {
    vi.stubGlobal('BroadcastChannel', BroadcastChannelMock)
    BroadcastChannelMock.reset()
    publisher = createDanmakuChannel('publisher')
    consumerChannel = createDanmakuChannel('consumer')
  })

  afterEach(() => {
    consumerChannel.close()
    publisher.close()
    vi.unstubAllGlobals()
    BroadcastChannelMock.reset()
  })

  it('forwards matching-scope events into model listeners', async () => {
    const client = new BroadcastChannelClient(consumerChannel, 'openlive:account:1', 'publisher')
    const gift = vi.fn()
    client.onEvent('gift', gift)
    await client.Start()

    publisher.publishEvent('openlive:account:1', 'gift', makeEvent({ msg: '小花花' }))

    expect(gift).toHaveBeenCalledWith(expect.objectContaining({ msg: '小花花' }), undefined)
    client.Stop()
  })

  it('ignores events from a different scope', async () => {
    const client = new BroadcastChannelClient(consumerChannel, 'openlive:account:1', 'publisher')
    const gift = vi.fn()
    client.onEvent('gift', gift)
    await client.Start()

    publisher.publishEvent('openlive:account:2', 'gift', makeEvent({ msg: '别人的礼物' }))

    expect(gift).not.toHaveBeenCalled()
    client.Stop()
  })

  it('ignores events from a non-owner source when owner is pinned', async () => {
    const client = new BroadcastChannelClient(consumerChannel, 'openlive:account:1', 'publisher')
    const gift = vi.fn()
    client.onEvent('gift', gift)
    await client.Start()

    // 另一条同 scope 的源, sourceId 不是 pinned owner
    const other = createDanmakuChannel('other-publisher')
    other.publishEvent('openlive:account:1', 'gift', makeEvent({ msg: '非主源' }))
    other.close()

    expect(gift).not.toHaveBeenCalled()
    client.Stop()
  })

  it('stops receiving after Stop', async () => {
    const client = new BroadcastChannelClient(consumerChannel, 'openlive:account:1')
    const gift = vi.fn()
    client.onEvent('gift', gift)
    await client.Start()
    client.Stop()

    publisher.publishEvent('openlive:account:1', 'gift', makeEvent())

    expect(gift).not.toHaveBeenCalled()
  })
})
