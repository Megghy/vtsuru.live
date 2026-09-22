import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCOUNT } from '@/api/account'
import { cookie } from '@/api/auth'
import * as queryModule from '@/api/query'

import { useBiliAuth } from '../useBiliAuth'

vi.mock('@/api/query', () => ({
  QueryGetAPI: vi.fn(),
  QueryPostAPI: vi.fn(),
  QueryPostAPIWithParams: vi.fn(),
}))
vi.mock('@/api/account', async () => ({ ACCOUNT: (await import('vue')).ref({}) }))
vi.mock('@/api/auth', async () => ({ cookie: (await import('vue')).ref(undefined) }))

describe('useBiliAuth Store 测试', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    ACCOUNT.value = {} as typeof ACCOUNT.value
    cookie.value = undefined
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
    })

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
    })

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
      async () =>
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

  it('站内登录统一使用绑定身份，不发送旧 Bili-Auth 凭据', async () => {
    const store = useBiliAuth()
    store.currentToken = 'other-account'
    ACCOUNT.value = { id: 10, biliUserAuthInfo: { id: 20, userId: 30 } } as typeof ACCOUNT.value
    cookie.value = { cookie: 'site-session', refreshDate: 0 }
    expect(store.biliAuth.id).toBe(20)
    expect(
      await store.getBiliAuthHeaders([
        ['Bili-Auth', 'injected'],
        ['X-Test', 'yes'],
      ]),
    ).toEqual([['X-Test', 'yes']])
    await expect(store.setCurrentAuth('another')).rejects.toThrow('请先退出站内账号')
  })

  it('未绑定的站内账号不回退到浏览器保存的其他身份', async () => {
    const store = useBiliAuth()
    store.currentToken = 'other-account'
    ACCOUNT.value = { id: 10 } as typeof ACCOUNT.value
    cookie.value = { cookie: 'site-session', refreshDate: 0 }
    expect(store.isAuthed).toBe(false)
    expect(store.biliAuth.id).toBeUndefined()
    expect(await store.getBiliAuthHeaders()).toEqual([])
    expect(await store.getAuthInfo()).toBe(false)
    expect(queryModule.QueryGetAPI).not.toHaveBeenCalled()
  })

  it('切换账号后迟到的请求不会覆盖新身份', async () => {
    let finishOld!: (value: unknown) => void
    vi.mocked(queryModule.QueryGetAPI).mockImplementationOnce(
      async () =>
        new Promise((resolve) => {
          finishOld = resolve
        }),
    )
    const store = useBiliAuth()
    store.currentToken = 'old'
    const oldRequest = store.getAuthInfo()
    await vi.waitFor(() => expect(finishOld).toBeDefined())
    vi.mocked(queryModule.QueryGetAPI).mockResolvedValueOnce({ code: 200, data: { id: 2, userId: 22 }, message: '' })
    await store.setCurrentAuth('new')
    finishOld({ code: 200, data: { id: 919191, userId: 11 }, message: '' })
    expect(await oldRequest).toBe(false)
    expect(store.biliAuth.id).toBe(2)
    expect(store.biliTokens.some((item) => item.id === 919191)).toBe(false)
  })
})
