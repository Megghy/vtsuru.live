import type { EventModel } from '@/api/api-models'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const account = ref({ id: 1001 })
const startMock = vi.fn(async () => ({ success: true, message: '' }))
const stopMock = vi.fn()

const EVENT_NAMES = ['danmaku', 'gift', 'sc', 'guard', 'enter', 'scDel', 'all', 'follow', 'like'] as const

function createListeners() {
  return Object.fromEntries(EVENT_NAMES.map(name => [name, []]))
}

class MockDanmakuClient {
  public client = null
  public state: 'padding' | 'connected' | 'connecting' | 'disconnected' = 'padding'
  public type = 'openlive' as const
  public serverUrl = ''
  public roomAuthInfo = undefined
  public eventsAsModel = createListeners()
  public eventsRaw = createListeners()

  public createEmptyEventModelListeners() {
    return createListeners()
  }

  public createEmptyRawEventlisteners() {
    return createListeners()
  }

  public async Start() {
    this.state = 'connected'
    return startMock()
  }

  public Stop() {
    this.state = 'disconnected'
    stopMock()
  }
}

vi.mock('@/api/account', () => ({
  useAccount: () => account,
}))

vi.mock('@/shared/services/DanmakuClients/OpenLiveClient', () => ({
  default: MockDanmakuClient,
}))

vi.mock('@/shared/services/DanmakuClients/DirectClient', () => ({
  default: MockDanmakuClient,
}))

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
      channel.dispatch(data)
    }
  }

  public close() {
    BroadcastChannelMock.channels.get(this.name)?.delete(this)
    this.listeners.clear()
  }

  private dispatch(data: unknown) {
    const event = { data } as MessageEvent
    for (const listener of this.listeners) listener(event)
  }
}

const { useDanmakuClient } = await import('../useDanmakuClient')

function makeEvent(overrides: Partial<EventModel> = {}): EventModel {
  return {
    uid: 1,
    uname: 'tester',
    msg: '小心心',
    num: 1,
    price: 0,
    guard_level: 0,
    fans_medal_wearing_status: false,
    fans_medal_level: 0,
    ...overrides,
  } as EventModel
}

async function createStore() {
  setActivePinia(createPinia())
  return useDanmakuClient()
}

describe('useDanmakuClient event sharing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2030, 0, 1, 12))
    vi.stubGlobal('BroadcastChannel', BroadcastChannelMock)
    BroadcastChannelMock.reset()
    account.value = { id: 1001 }
    startMock.mockClear()
    stopMock.mockClear()
  })

  afterEach(async () => {
    await useDanmakuClient().dispose()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    BroadcastChannelMock.reset()
  })

  it('emits model gift events from the active client to store listeners', async () => {
    const store = await createStore()
    const giftListener = vi.fn()
    const allListener = vi.fn()
    store.onEvent('gift', giftListener)
    store.onEvent('all', allListener)

    await store.initOpenlive()
    const event = makeEvent({ uname: 'Alice', msg: '辣条', num: 3 })
    store.danmakuClient!.eventsAsModel.gift[0](event, { cmd: 'gift' })

    expect(giftListener).toHaveBeenCalledWith(event, { cmd: 'gift' })
    expect(allListener).toHaveBeenCalledWith(event)
    expect(startMock).toHaveBeenCalledTimes(1)
  })

  it('receives gift events from another local page without starting a new client', async () => {
    const owner = await createStore()
    await owner.initOpenlive()

    const reader = await createStore()
    const giftListener = vi.fn()
    reader.onEvent('gift', giftListener)
    const ensurePromise = reader.ensureOpenlive({ connect: false })
    await vi.advanceTimersByTimeAsync(600)
    await ensurePromise

    const event = makeEvent({ uname: 'Bob', msg: '小花花', num: 2 })
    owner.danmakuClient!.eventsAsModel.gift[0](event)

    expect(giftListener).toHaveBeenCalledWith(event, undefined)
    expect(startMock).toHaveBeenCalledTimes(1)
  })

  it('uses a fresh remote source instead of opening a duplicate connection', async () => {
    const owner = await createStore()
    await owner.initOpenlive()

    const reader = await createStore()
    const ensurePromise = reader.ensureOpenlive()
    await vi.advanceTimersByTimeAsync(600)
    await ensurePromise

    expect(reader.hasRemoteSource).toBe(true)
    expect(reader.connected).toBe(false)
    expect(startMock).toHaveBeenCalledTimes(1)
  })

  it('ignores broadcast events from a different account', async () => {
    const reader = await createStore()
    const giftListener = vi.fn()
    reader.onEvent('gift', giftListener)
    const ensurePromise = reader.ensureOpenlive({ connect: false })
    await vi.advanceTimersByTimeAsync(600)
    await ensurePromise

    new BroadcastChannelMock('vtsuru.danmaku.model-events.v1').postMessage({
      kind: 'event',
      sourceId: 'other-account-tab',
      accountId: 2002,
      eventName: 'gift',
      data: makeEvent({ uname: 'Other' }),
    })

    expect(giftListener).not.toHaveBeenCalled()
  })
})
