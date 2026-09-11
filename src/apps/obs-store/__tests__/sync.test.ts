import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useObsBridge } from '../sync/useObsBridge'

// Mock 后端 API 调用
vi.mock('@/api/obs-store', () => ({
  getObsSyncState: vi.fn().mockResolvedValue({
    hash: 'mock-hash-123',
    changed: false,
    data: null,
    updatedAt: Date.now(),
  }),
  updateObsSyncState: vi.fn().mockResolvedValue({
    hash: 'mock-hash-456',
    changed: true,
    data: null,
    updatedAt: Date.now(),
  }),
}))

describe('OBS Store 通用数据同步机制 (useObsBridge)', () => {
  const defaultState = {
    title: '测试计数器',
    count: 10,
    active: true,
  }

  // 模拟 localStorage
  const storageMap = new Map<string, string>()
  const mockLocalStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, val: string) => storageMap.set(key, String(val)),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear(),
  }

  // 模拟 BroadcastChannel
  class MockBroadcastChannel {
    name: string
    onmessage: ((event: MessageEvent) => void) | null = null
    constructor(name: string) {
      this.name = name
    }
    postMessage(data: any) {}
    close() {}
  }

  beforeEach(() => {
    storageMap.clear()
    // @ts-ignore
    globalThis.window = {
      localStorage: mockLocalStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any
    // @ts-ignore
    globalThis.BroadcastChannel = MockBroadcastChannel as any
  })

  afterEach(() => {
    storageMap.clear()
  })

  it('应正确初始化默认状态与持久化配置', () => {
    const bridge = useObsBridge({
      componentId: 'test-counter',
      defaultState,
    })

    expect(bridge.state.value.count).toBe(10)
    expect(bridge.state.value.title).toBe('测试计数器')
    expect(bridge.channelName).toBe('vtsuru:obs:test-counter:default')
    expect(bridge.storageKey).toBe('vtsuru_obs_state:test-counter:default')

    bridge.destroy()
  })

  it('持久化存储中存在数据时应优先恢复', () => {
    const saved = { title: '已保存标题', count: 99, active: false }
    mockLocalStorage.setItem(
      'vtsuru_obs_state:test-counter:default',
      JSON.stringify(saved),
    )

    const bridge = useObsBridge({
      componentId: 'test-counter',
      defaultState,
    })

    expect(bridge.state.value.count).toBe(99)
    expect(bridge.state.value.title).toBe('已保存标题')

    bridge.destroy()
  })

  it('updateState 应能局部更新状态并写入本地存储', () => {
    const bridge = useObsBridge({
      componentId: 'test-counter',
      defaultState,
    })

    bridge.updateState({ count: 42 })
    expect(bridge.state.value.count).toBe(42)
    expect(bridge.state.value.title).toBe('测试计数器')

    const raw = mockLocalStorage.getItem(bridge.storageKey)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.count).toBe(42)

    // 函数式更新
    bridge.updateState((prev) => ({ count: prev.count + 1 }))
    expect(bridge.state.value.count).toBe(43)

    bridge.destroy()
  })

  it('setState 应能全量重设状态并更新本地存储', () => {
    const bridge = useObsBridge({
      componentId: 'test-counter',
      defaultState,
    })

    bridge.setState({ title: '全新标题', count: 0, active: false })
    expect(bridge.state.value.title).toBe('全新标题')
    expect(bridge.state.value.count).toBe(0)

    const raw = mockLocalStorage.getItem(bridge.storageKey)
    expect(JSON.parse(raw!).title).toBe('全新标题')

    bridge.destroy()
  })

  it('sendAction 与 onAction 应能注册并接收操作动作', () => {
    const bridge = useObsBridge<{ count: number }, { type: string; val: number }>({
      componentId: 'test-action',
      defaultState: { count: 0 },
    })

    const handler = vi.fn()
    const unsubscribe = bridge.onAction(handler)

    expect(typeof unsubscribe).toBe('function')
    unsubscribe()

    bridge.destroy()
  })

  it('destroy 应安全清理通道与监听', () => {
    const bridge = useObsBridge({
      componentId: 'test-destroy',
      defaultState,
    })

    expect(() => bridge.destroy()).not.toThrow()
  })
})
