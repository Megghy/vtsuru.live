import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as queryModule from '@/api/query'
import { useBiliAuth } from '../useBiliAuth'

vi.mock('@/api/query', () => ({
  QueryGetAPI: vi.fn(),
  QueryPostAPI: vi.fn(),
  QueryPostAPIWithParams: vi.fn(),
}))

describe('useBiliAuth Store 测试', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('初始无 Token 时调用 getAuthInfo 应优雅返回 false，且不触发 logout', async () => {
    const store = useBiliAuth()
    store.currentToken = null

    const res = await store.getAuthInfo()

    expect(res).toBe(false)
    expect(queryModule.QueryGetAPI).not.toHaveBeenCalled()
    expect(store.isInvalid).toBe(false)
    expect(store.biliAuth.id).toBeFalsy()
  })

  it('有 Token 时调用 getAuthInfo 应正确携带 Bili-Auth 并在 200 时保存信息', async () => {
    vi.mocked(queryModule.QueryGetAPI).mockResolvedValueOnce({
      code: 200,
      data: {
        id: 12345,
        userId: 999999,
        name: '测试粉丝',
        openId: '00000000-0000-0000-0000-000000000000',
        createAt: 1700000000,
        address: [],
        guardInfo: {},
      },
      message: 'OK',
    } as any)

    const store = useBiliAuth()
    store.currentToken = 'mock_valid_token'

    const res = await store.getAuthInfo()

    expect(res).toBe(true)
    expect(queryModule.QueryGetAPI).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(queryModule.QueryGetAPI).mock.calls[0]
    expect(callArgs[2]).toEqual(expect.arrayContaining([['Bili-Auth', 'mock_valid_token']]))
    expect(store.biliAuth.id).toBe(12345)
    expect(store.biliAuth.name).toBe('测试粉丝')
    expect(store.isInvalid).toBe(false)
    expect(store.biliTokens).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 12345,
          token: 'mock_valid_token',
          name: '测试粉丝',
          uId: 999999,
        }),
      ]),
    )
  })

  it('接口返回非 200 错误时应标记 isInvalid，但不应清空本地 Token 与账户列表', async () => {
    vi.mocked(queryModule.QueryGetAPI).mockResolvedValueOnce({
      code: 403,
      data: null,
      message: 'Token 无效',
    } as any)

    const store = useBiliAuth()
    store.currentToken = 'mock_expired_token'
    store.biliTokens = [
      {
        id: 100,
        uId: 200,
        name: '历史账号',
        token: 'mock_expired_token',
      },
    ]

    const res = await store.getAuthInfo()

    expect(res).toBe(false)
    expect(store.isInvalid).toBe(true)
    // 关键断言：不可误杀本地 token 与历史列表
    expect(store.currentToken).toBe('mock_expired_token')
    expect(store.biliTokens.length).toBe(1)
  })

  it('主动调用 logout 时才清理当前凭据', async () => {
    const store = useBiliAuth()
    store.currentToken = 'mock_token'
    store.biliTokens = [
      {
        id: 1,
        uId: 2,
        name: '账号1',
        token: 'mock_token',
      },
      {
        id: 3,
        uId: 4,
        name: '账号2',
        token: 'other_token',
      },
    ]

    store.logout()

    expect(store.currentToken).toBe('')
    expect(store.biliAuth.id).toBeFalsy()
    expect(store.isInvalid).toBe(false)
    expect(store.biliTokens).toEqual([
      {
        id: 3,
        uId: 4,
        name: '账号2',
        token: 'other_token',
      },
    ])
  })

  it('并发多次调用 getAuthInfo 共享同一个请求 promise', async () => {
    vi.mocked(queryModule.QueryGetAPI).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                code: 200,
                data: { id: 1, userId: 2, name: '并发用户' },
                message: 'OK',
              } as any),
            10,
          )
        }),
    )

    const store = useBiliAuth()
    store.currentToken = 'mock_concurrent_token'

    const [res1, res2] = await Promise.all([store.getAuthInfo(), store.getAuthInfo()])

    expect(res1).toBe(true)
    expect(res2).toBe(true)
    expect(queryModule.QueryGetAPI).toHaveBeenCalledTimes(1)
  })
})
