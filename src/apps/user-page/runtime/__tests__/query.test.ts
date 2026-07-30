import { beforeEach, describe, expect, it } from 'vitest'
import { effectScope } from 'vue'

import { clearUserPageRuntimeCache, useUserPageRuntimeQuery } from '../query'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((accept) => {
    resolve = accept
  })
  return { promise, resolve }
}

describe('useUserPageRuntimeQuery', () => {
  beforeEach(() => clearUserPageRuntimeCache())

  it('合并相同资源的并发请求并缓存结果', async () => {
    const result = deferred<string>()
    let calls = 0
    const loader = async () => {
      calls += 1
      return result.promise
    }
    const firstScope = effectScope()
    const secondScope = effectScope()
    const first = firstScope.run(() => useUserPageRuntimeQuery({ key: () => 'video:1', loader }))
    const second = secondScope.run(() => useUserPageRuntimeQuery({ key: () => 'video:1', loader }))

    const firstRequest = first.execute()
    const secondRequest = second.execute()
    result.resolve('ready')

    await expect(firstRequest).resolves.toBe('ready')
    await expect(secondRequest).resolves.toBe('ready')
    expect(calls).toBe(1)
    await expect(first.execute()).resolves.toBe('ready')
    expect(calls).toBe(1)
    firstScope.stop()
    secondScope.stop()
  })

  it('新请求开始后忽略旧请求结果', async () => {
    const firstResult = deferred<string>()
    const secondResult = deferred<string>()
    let key = 'first'
    const scope = effectScope()
    const query = scope.run(() =>
      useUserPageRuntimeQuery({
        key: () => key,
        loader: async () => (key === 'first' ? firstResult.promise : secondResult.promise),
      }),
    )

    const oldRequest = query.execute()
    key = 'second'
    const latestRequest = query.execute()
    firstResult.resolve('outdated')
    secondResult.resolve('latest')

    await expect(oldRequest).resolves.toBeUndefined()
    await expect(latestRequest).resolves.toBe('latest')
    expect(query.data.value).toBe('latest')
    scope.stop()
  })
})
