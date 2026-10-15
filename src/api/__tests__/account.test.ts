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

vi.mock('@/shared/storage/persist', () => ({
  persistedRemoveItem: vi.fn(),
}))

vi.mock('@/shared/utils', () => ({
  createNaiveUIApi: () => ({
    message: { error: vi.fn(), success: vi.fn() },
  }),
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
})
