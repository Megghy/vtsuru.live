import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'

const busMock = vi.hoisted(() => {
  const handlers = new Map<string, Set<(payload: unknown) => void>>()
  const subscribe = vi.fn().mockResolvedValue(true)
  const unsubscribe = vi.fn().mockResolvedValue(undefined)
  const on = vi.fn((topic: string, eventName: string, handler: (payload: unknown) => void) => {
    const key = `${topic}:${eventName}`
    if (!handlers.has(key)) handlers.set(key, new Set())
    handlers.get(key)!.add(handler)
    return () => {
      handlers.get(key)?.delete(handler)
    }
  })

  return {
    status: null as any,
    reconnectedCount: null as any,
    handlers,
    subscribe,
    unsubscribe,
    on,
    emit(topic: string, eventName: string, payload?: unknown) {
      const key = `${topic}:${eventName}`
      handlers.get(key)?.forEach((fn) => fn(payload))
    },
    reset() {
      this.status.value = { connected: true, connecting: false, error: '' }
      this.reconnectedCount.value = 0
      handlers.clear()
      subscribe.mockClear()
      unsubscribe.mockClear()
      on.mockClear()
    },
  }
})

vi.mock('@/shared/realtime/useRealtimeBus', async () => {
  const { ref: vueRef } = await import('vue')
  busMock.status = vueRef({ connected: true, connecting: false, error: '' })
  busMock.reconnectedCount = vueRef(0)
  return {
    getRealtimeBus: () => ({
      getStatus: () => busMock.status,
      getReconnectedCount: () => busMock.reconnectedCount,
      subscribe: busMock.subscribe,
      unsubscribe: busMock.unsubscribe,
      on: busMock.on,
    }),
  }
})

import { useObsRealtimeSync } from '../composables/useObsRealtimeSync'

describe('useObsRealtimeSync', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    busMock.reset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('已连接时仅在首次挂载与重连后触发同步，不进行高频轮询', async () => {
    const onSync = vi.fn()
    const TestComp = defineComponent({
      setup() {
        const { on } = useObsRealtimeSync({
          topic: 'obs:display:queue:42',
          onSync,
        })
        on('Changed', () => onSync())
        return {}
      },
      template: '<div />',
    })

    const wrapper = mount(TestComp)
    await nextTick()

    expect(busMock.subscribe).toHaveBeenCalledWith('obs:display:queue:42', undefined)
    expect(onSync).toHaveBeenCalledTimes(1)

    // 推进 30s，已连接且无连接后兜底定时器的情况下不会触发轮询
    await vi.advanceTimersByTimeAsync(30000)
    expect(onSync).toHaveBeenCalledTimes(1)

    // 收到服务端 Changed 事件时立即同步
    busMock.emit('obs:display:queue:42', 'Changed', { updatedAt: 123 })
    expect(onSync).toHaveBeenCalledTimes(2)

    // 断线重连后自动补拉一次
    busMock.reconnectedCount.value++
    await nextTick()
    expect(onSync).toHaveBeenCalledTimes(3)

    wrapper.unmount()
  })

  it('断线时降级为定时兜底轮询，恢复连接后停止轮询', async () => {
    busMock.status.value.connected = false
    const onSync = vi.fn()

    const TestComp = defineComponent({
      setup() {
        useObsRealtimeSync({
          topic: 'obs:display:vote:77',
          onSync,
          disconnectedFallbackMs: 2000,
        })
        return {}
      },
      template: '<div />',
    })

    const wrapper = mount(TestComp)
    await nextTick()
    expect(onSync).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(2000)
    expect(onSync).toHaveBeenCalledTimes(2)

    // 恢复连接后不再继续降级轮询
    busMock.status.value.connected = true
    await nextTick()
    await vi.advanceTimersByTimeAsync(6000)
    expect(onSync).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })

  it('从隐藏切换为可见时自动补拉最新状态', async () => {
    const visible = ref(false)
    const onSync = vi.fn()

    const TestComp = defineComponent({
      setup() {
        useObsRealtimeSync({
          topic: 'obs:display:live-request:9',
          visible,
          onSync,
        })
        return {}
      },
      template: '<div />',
    })

    const wrapper = mount(TestComp)
    await nextTick()
    expect(onSync).toHaveBeenCalledTimes(0)

    visible.value = true
    await nextTick()
    expect(onSync).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})
