import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  postApiAccountSelf: vi.fn(),
  postApiAccountRefreshToken: vi.fn(),
}))

vi.mock('@/api/generated/account/account', () => ({
  postApiAccountSelf: mocks.postApiAccountSelf,
  postApiAccountRefreshToken: mocks.postApiAccountRefreshToken,
  postApiAccountBiliAuthComplete: vi.fn(),
  postApiAccountBiliAuthPrepare: vi.fn(),
  postApiAccountBlackListAddBili: vi.fn(),
  postApiAccountBlackListDelete: vi.fn(),
  postApiAccountBlackListDeleteBili: vi.fn(),
  postApiAccountLogin: vi.fn(),
  postApiAccountRegister: vi.fn(),
  postApiAccountUpdateEnableFunctions: vi.fn(),
  postApiAccountUpdateSetting: vi.fn(),
  postApiAccountUpdateSingleSetting: vi.fn(),
}))

vi.mock('@/api/generated/config/config', () => ({
  getApiUserConfigGet: vi.fn(),
  getApiUserConfigGetHash: vi.fn(),
  getApiUserConfigGetUser: vi.fn(),
  postApiUserConfigSet: vi.fn(),
}))

vi.mock('@/shared/storage/persist', () => {
  const { ref } = require('vue')
  return {
    persistedRemoveItem: vi.fn(),
    usePersistedStorage: (_key: string, initial: unknown) => ref(initial),
  }
})

vi.mock('@/shared/utils', () => ({
  message: { error: vi.fn(), success: vi.fn() },
}))

import { ACCOUNT, GetSelfAccount, Self } from '../account'
import { cookie } from '../auth'

describe('account Self and GetSelfAccount token flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookie.value = undefined
    ACCOUNT.value = {} as typeof ACCOUNT.value
  })

  it('Self 携带 token 时正确设置 Authorization header', async () => {
    mocks.postApiAccountSelf.mockResolvedValue({
      code: 200,
      message: 'ok',
      data: { id: 101, name: 'Alice', settings: {} },
    })

    await Self('test-token-123')

    expect(mocks.postApiAccountSelf).toHaveBeenCalledWith({
      headers: { Authorization: 'Bearer test-token-123' },
    })
  })

  it('GetSelfAccount 成功时更新 ACCOUNT 并携带 token 刷新 cookie', async () => {
    mocks.postApiAccountSelf.mockResolvedValue({
      code: 200,
      message: 'ok',
      data: { id: 202, name: 'Bob', settings: {} },
    })
    mocks.postApiAccountRefreshToken.mockResolvedValue({
      code: 200,
      message: 'ok',
      data: 'new-jwt-cookie-token',
    })

    const res = await GetSelfAccount('bob-perm-token')

    expect(res).toBeDefined()
    expect(res?.id).toBe(202)
    expect(ACCOUNT.value.id).toBe(202)
    expect(mocks.postApiAccountRefreshToken).toHaveBeenCalledWith({
      headers: { Authorization: 'Bearer bob-perm-token' },
    })

    // 等待微任务更新 cookie
    await vi.waitFor(() => {
      expect(cookie.value?.cookie).toBe('new-jwt-cookie-token')
    })
  })

  it('并发调用 GetSelfAccount 时按 token 去重为单次请求', async () => {
    let resolveSelf!: (value: any) => void
    mocks.postApiAccountSelf.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSelf = resolve
      }),
    )
    mocks.postApiAccountRefreshToken.mockResolvedValue({ code: 200, message: 'ok', data: 't' })

    const p1 = GetSelfAccount('dedup-token')
    const p2 = GetSelfAccount('dedup-token')
    expect(mocks.postApiAccountSelf).toHaveBeenCalledTimes(1)

    resolveSelf({ code: 200, message: 'ok', data: { id: 303, name: 'Carol', settings: {} } })
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1?.id).toBe(303)
    expect(r2?.id).toBe(303)
  })

  it('显式拉取采用服务端最新 settings，轮询 preserveLocalSettings 保留本地编辑态', async () => {
    cookie.value = { cookie: 'jwt', refreshDate: Date.now() }
    ACCOUNT.value = {
      id: 404,
      name: 'Dave',
      settings: { enableFunctions: ['Point'] },
    } as unknown as typeof ACCOUNT.value

    mocks.postApiAccountSelf.mockResolvedValueOnce({
      code: 200,
      message: 'ok',
      data: { id: 404, name: 'Dave', settings: { enableFunctions: ['SongRequest'] } },
    })
    await GetSelfAccount(undefined, { preserveLocalSettings: true })
    expect(ACCOUNT.value.settings.enableFunctions).toEqual(['Point'])

    mocks.postApiAccountSelf.mockResolvedValueOnce({
      code: 200,
      message: 'ok',
      data: { id: 404, name: 'Dave', settings: { enableFunctions: ['SongRequest'] } },
    })
    await GetSelfAccount()
    expect(ACCOUNT.value.settings.enableFunctions).toEqual(['SongRequest'])
  })
})
