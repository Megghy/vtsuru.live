import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import { DEFAULT_PNGTUBER_RUNTIME } from '../types'
import { usePngtuberRuntime } from '../usePngtuberRuntime'

const account = ref({ id: 1, token: 'one' })
vi.mock('@/api/account', () => ({ useAccount: () => account }))

const mockTopicState = {
  subscribedTopic: '',
  published: [] as Array<{ topic: string; event: string; payload: unknown }>,
  handlers: new Map<string, (payload: unknown) => void>(),
  connected: ref(true),
  error: ref(''),
  ensureConnected: vi.fn(async () => {}),
  unsubscribe: vi.fn(async () => {}),
  subscribe: vi.fn(async () => {}),
}

vi.mock('@/shared/realtime', () => ({
  getRealtimeBus: () => ({
    ensureConnected: mockTopicState.ensureConnected,
    unsubscribe: mockTopicState.unsubscribe,
    subscribe: mockTopicState.subscribe,
  }),
  useRealtimeTopic: (topicRef: { value: string }) => {
    mockTopicState.subscribedTopic = topicRef.value
    return {
      status: ref({
        connected: mockTopicState.connected.value,
        connecting: false,
        error: mockTopicState.error.value,
      }),
      publish: vi.fn(async (event: string, payload: unknown) => {
        mockTopicState.published.push({
          topic: topicRef.value,
          event,
          payload,
        })
      }),
      on: vi.fn((eventName: string, handler: (payload: unknown) => void) => {
        mockTopicState.handlers.set(eventName.toLowerCase(), handler)
        return () => {
          mockTopicState.handlers.delete(eventName.toLowerCase())
        }
      }),
    }
  },
}))

describe('usePngtuberRuntime (RealtimeBus Topic)', () => {
  const scopes: ReturnType<typeof effectScope>[] = []

  function setup(controller = true, initialId = 1, initialChannel = 'default') {
    const scope = effectScope()
    scopes.push(scope)
    const id = ref(initialId)
    const channel = ref(initialChannel)
    const runtime = scope.run(() => usePngtuberRuntime(id, channel, controller))!
    return { ...runtime, scope, id, channel }
  }

  beforeEach(() => {
    mockTopicState.published = []
    mockTopicState.handlers.clear()
    mockTopicState.connected.value = true
    mockTopicState.error.value = ''
    mockTopicState.ensureConnected.mockClear()
    mockTopicState.unsubscribe.mockClear()
    mockTopicState.subscribe.mockClear()
    account.value = { id: 1, token: 'one' }
  })

  afterEach(() => {
    scopes.splice(0).forEach((s) => s.stop())
    vi.restoreAllMocks()
  })

  it('subscribes to correct pngtuber channel topic', () => {
    setup(true, 1, 'room1')
    expect(mockTopicState.subscribedTopic).toBe('pngtuber:channel:1:room1')
  })

  it('rejects controller mode when account id does not match target id', () => {
    account.value = { id: 2, token: 'two' }
    const runtime = setup(true, 1, 'default')
    expect(runtime.connected.value).toBe(false)
  })

  it('receives state event and merges partial updates without dropping control fields', async () => {
    const runtime = setup(false, 1, 'default')
    expect(runtime.runtime.value.volume).toBe(0)

    const stateHandler = mockTopicState.handlers.get('state')
    expect(stateHandler).toBeDefined()

    stateHandler!({
      ...DEFAULT_PNGTUBER_RUNTIME,
      volume: 85,
      isSpeaking: true,
      expressionId: 'smile',
      muted: false,
      updatedAt: 12345,
    })
    await nextTick()

    expect(runtime.runtime.value.volume).toBe(85)
    expect(runtime.runtime.value.isSpeaking).toBe(true)
    expect(runtime.runtime.value.expressionId).toBe('smile')

    // Partial audio update preserves expressionId
    stateHandler!({
      volume: 42,
      isSpeaking: false,
      updatedAt: 12346,
    })
    await nextTick()
    expect(runtime.runtime.value.volume).toBe(42)
    expect(runtime.runtime.value.isSpeaking).toBe(false)
    expect(runtime.runtime.value.expressionId).toBe('smile')
  })

  it('publishes audio state and lets speaking edge transitions bypass 50ms throttle', async () => {
    const runtime = setup(true, 1, 'default')
    await runtime.publish(70, true, 'client')
    await runtime.publish(72, true, 'client') // throttled (same speaking state within 50ms)
    await runtime.publish(0, false, 'client') // edge change (speaking true -> false), must not be dropped

    expect(mockTopicState.published).toHaveLength(2)
    expect(mockTopicState.published[0]).toEqual({
      topic: 'pngtuber:channel:1:default',
      event: 'audio',
      payload: { volume: 70, isSpeaking: true, source: 'client' },
    })
    expect(mockTopicState.published[1]).toEqual({
      topic: 'pngtuber:channel:1:default',
      event: 'audio',
      payload: { volume: 0, isSpeaking: false, source: 'client' },
    })
  })

  it('sends control commands with explicit parameters', async () => {
    const runtime = setup(true, 1, 'default')
    await runtime.control({ expressionId: 'happy', muted: true, away: false }, 200)

    expect(mockTopicState.published).toHaveLength(1)
    expect(mockTopicState.published[0]).toEqual({
      topic: 'pngtuber:channel:1:default',
      event: 'control',
      payload: {
        expressionId: 'happy',
        muted: true,
        away: false,
        durationMs: 200,
      },
    })
  })

  it('prohibits viewer from sending control commands', async () => {
    const runtime = setup(false, 1, 'default')
    await expect(runtime.control({ muted: true })).rejects.toThrow('立绘控制连接尚未就绪')
  })

  it('reconnects by resubscribing topic on realtime bus', async () => {
    const runtime = setup(true, 1, 'default')
    await runtime.reconnect()
    expect(mockTopicState.ensureConnected).toHaveBeenCalledTimes(1)
    expect(mockTopicState.unsubscribe).toHaveBeenCalledWith('pngtuber:channel:1:default')
    expect(mockTopicState.subscribe).toHaveBeenCalledWith('pngtuber:channel:1:default')
  })

  it('closes mouth and mutes volume when disconnected or on scope dispose', async () => {
    const runtime = setup(false, 1, 'default')
    const stateHandler = mockTopicState.handlers.get('state')
    stateHandler!({
      ...DEFAULT_PNGTUBER_RUNTIME,
      volume: 90,
      isSpeaking: true,
      updatedAt: 100,
    })
    await nextTick()
    expect(runtime.runtime.value.isSpeaking).toBe(true)

    runtime.scope.stop()
    await nextTick()
    expect(runtime.runtime.value.isSpeaking).toBe(false)
    expect(runtime.runtime.value.volume).toBe(0)
  })
})
