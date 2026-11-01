import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useOBSNotification } from '../useOBSNotification'

const mockAccount = ref({ id: 10, token: 'token-10' })
vi.mock('@/api/account', () => ({
  useAccount: () => mockAccount,
}))

const mockRealtimeState = {
  subscribed: [] as string[],
  published: [] as Array<{ topic: string; event: string; payload: unknown }>,
  handlers: new Map<string, (payload: unknown) => void>(),
}

vi.mock('@/shared/realtime', () => ({
  useRealtimeBus: () => ({
    bus: {
      subscribe: vi.fn((topic: string) => {
        mockRealtimeState.subscribed.push(topic)
      }),
      unsubscribe: vi.fn(),
    },
    on: vi.fn((topic: string, event: string, handler: (payload: unknown) => void) => {
      mockRealtimeState.handlers.set(`${topic}:${event}`, handler)
      return () => {}
    }),
    publish: vi.fn(async (topic: string, event: string, payload: unknown) => {
      mockRealtimeState.published.push({ topic, event, payload })
    }),
  }),
}))

vi.mock('../useVTsuruHub', () => ({
  useVTsuruHub: () => ({
    Init: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    invoke: vi.fn().mockResolvedValue(undefined),
  }),
}))

describe('useOBSNotification (RealtimeBus Topic)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockRealtimeState.subscribed = []
    mockRealtimeState.published = []
    mockRealtimeState.handlers.clear()
    window.$message = {
      success: vi.fn(),
      error: vi.fn(),
    } as any
    window.$route = { query: {} } as any
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('subscribes to obs:notify topic using route id', async () => {
    window.$route = { query: { id: '99' } } as any
    const store = useOBSNotification()
    await store.init(['live-request'])

    expect(mockRealtimeState.subscribed).toContain('obs:notify:99')
  })

  it('displays message on receiving ObsNotification event', async () => {
    window.$route = { query: { id: '99' } } as any
    const store = useOBSNotification()
    await store.init(['live-request'])

    const handler = mockRealtimeState.handlers.get('obs:notify:99:ObsNotification')
    expect(handler).toBeDefined()

    handler!({
      Type: 'success',
      Title: '点歌',
      Message: '测试歌曲 点播成功',
      Source: 'live-request',
      UserName: '观众A',
    })

    expect(window.$message.success).toHaveBeenCalledWith(
      expect.stringContaining('测试歌曲 点播成功'),
      expect.objectContaining({ duration: 4000 }),
    )
  })

  it('filters out notifications from non-matching sources', async () => {
    window.$route = { query: { id: '99' } } as any
    const store = useOBSNotification()
    await store.init(['music-request'])

    const handler = mockRealtimeState.handlers.get('obs:notify:99:ObsNotification')
    expect(handler).toBeDefined()

    handler!({
      Type: 'success',
      Title: '排队',
      Message: '排队成功',
      Source: 'queue',
    })

    expect(window.$message.success).not.toHaveBeenCalled()
  })

  it('publishes notification to realtime gateway', async () => {
    const store = useOBSNotification()
    await store.publish({
      Type: 'success',
      Message: '通知测试',
      Source: 'test',
    })

    expect(mockRealtimeState.published).toHaveLength(1)
    expect(mockRealtimeState.published[0]).toMatchObject({
      topic: 'obs:notify:10',
      event: 'PublishObsNotification',
      payload: expect.objectContaining({
        Message: '通知测试',
        Source: 'test',
      }),
    })
  })
})
