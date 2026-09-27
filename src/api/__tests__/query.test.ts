import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiState = {
  fail: false,
  selected: 'main' as 'main' | 'failover',
}

vi.mock('@/shared/config', () => ({
  selectedAPIKey: {
    get value() {
      return apiState.selected
    },
  },
  apiFail: {
    get value() {
      return apiState.fail
    },
    set value(v: boolean) {
      apiState.fail = v
    },
  },
  isManagedAPIUrl: (url: string) =>
    url.startsWith('https://api.vtsuru.suki.club/') || url.startsWith('https://failover-api.vtsuru.suki.club/'),
  mapToCurrentAPI: (url: string) =>
    apiState.fail
      ? url.replace('https://api.vtsuru.suki.club/', 'https://failover-api.vtsuru.suki.club/')
      : url.replace('https://failover-api.vtsuru.suki.club/', 'https://api.vtsuru.suki.club/'),
  markAPIFailover: () => {
    if (apiState.selected !== 'main' || apiState.fail) return false
    apiState.fail = true
    return true
  },
  getAPIUrl: (key: string) =>
    key === 'failover' ? 'https://failover-api.vtsuru.suki.club/' : 'https://api.vtsuru.suki.club/',
}))

vi.mock('@/api/auth', () => ({
  cookie: { value: undefined },
}))

import { QueryGetAPI, QueryRequestError } from '../query'

const MAIN = 'https://api.vtsuru.suki.club/api/point/get-orders'
const FAILOVER = 'https://failover-api.vtsuru.suki.club/api/point/get-orders'
const okBody = { code: 200, message: 'ok', data: [1] }

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('QueryGetAPI failover', () => {
  beforeEach(() => {
    apiState.fail = false
    apiState.selected = 'main'
    vi.restoreAllMocks()
  })

  it('并发主节点失败时，所有请求都切到备用节点重试', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.startsWith('https://api.vtsuru.suki.club/')) {
        throw new TypeError('Failed to fetch')
      }
      return jsonResponse(okBody)
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = await Promise.all([QueryGetAPI(MAIN), QueryGetAPI(MAIN), QueryGetAPI(MAIN)])

    expect(results.every((r) => r.code === 200)).toBe(true)
    expect(apiState.fail).toBe(true)
    expect(fetchMock.mock.calls.some((call) => String(call[0]).startsWith('https://failover-api.vtsuru.suki.club/'))).toBe(
      true,
    )
  })

  it('空 404 不当成网络失败，也不切备用节点', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 404 })),
    )

    await expect(QueryGetAPI(MAIN)).rejects.toMatchObject({
      name: 'QueryRequestError',
      message: '请求失败 (404)',
    })
    expect(apiState.fail).toBe(false)
  })

  it('备用节点自己失败时不再重试', async () => {
    apiState.fail = true
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        expect(String(input)).toBe(FAILOVER)
        throw new TypeError('Failed to fetch')
      }),
    )

    await expect(QueryGetAPI(MAIN)).rejects.toBeInstanceOf(QueryRequestError)
  })
})
