import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

import {
  initPersistedStorage,
  persistedGetJson,
  persistedRemoveItem,
  usePersistedStorage,
  whenPersistedReady,
} from '../persist'

const TEST_KEY = 'vtsuru:test:persist-shared-scope'

afterEach(async () => {
  await persistedRemoveItem(TEST_KEY)
})

describe('usePersistedStorage detached effectScope', () => {
  it('第一个消费作用域停止后，共享静态 key 的后续写入仍能落盘', async () => {
    await initPersistedStorage()

    const scopeA = effectScope()
    let refA!: ReturnType<typeof usePersistedStorage<{ count: number }>>
    scopeA.run(() => {
      refA = usePersistedStorage(TEST_KEY, { count: 0 })
    })
    await whenPersistedReady(refA)

    // 模拟首个调用组件卸载销毁 scope
    scopeA.stop()

    const scopeB = effectScope()
    let refB!: ReturnType<typeof usePersistedStorage<{ count: number }>>
    scopeB.run(() => {
      refB = usePersistedStorage(TEST_KEY, { count: 0 })
    })
    expect(refB).toBe(refA)

    refB.value = { count: 42 }
    await vi.waitFor(async () => {
      expect(await persistedGetJson<{ count: number }>(TEST_KEY)).toEqual({ count: 42 })
    })

    // 深层属性变更同样应继续同步落盘
    refB.value.count = 99
    await vi.waitFor(async () => {
      expect(await persistedGetJson<{ count: number }>(TEST_KEY)).toEqual({ count: 99 })
    })

    scopeB.stop()
  })
})
