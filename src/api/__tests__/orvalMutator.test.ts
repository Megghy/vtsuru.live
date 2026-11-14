import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  currentApiUrl: 'https://api.vtsuru.suki.club/',
  queryGetCalls: [] as Array<{ endpoint: string; params: unknown }>,
}))

vi.mock('@/shared/config/api', () => ({
  getCurrentAPIUrl: () => state.currentApiUrl,
}))

vi.mock('../query', () => ({
  QueryGetAPI: vi.fn(async (endpoint: string, params: unknown) => {
    state.queryGetCalls.push({ endpoint, params })
    return { code: 200, message: 'ok', data: null }
  }),
  QueryDeleteAPI: vi.fn(),
  QueryPatchAPI: vi.fn(),
  QueryPostAPIWithParams: vi.fn(),
}))

import { vtsuruMutator } from '../orval-mutator'

describe('vtsuruMutator dynamic endpoint resolution', () => {
  beforeEach(() => {
    state.currentApiUrl = 'https://api.vtsuru.suki.club/'
    state.queryGetCalls = []
  })

  it('每次调用按当前 getCurrentAPIUrl() 动态解析而非绑定静态 BASE_URL', async () => {
    await vtsuruMutator('/api/queue/get-active?id=42', { method: 'GET' })
    expect(state.queryGetCalls[0]).toEqual({
      endpoint: 'https://api.vtsuru.suki.club/api/queue/get-active',
      params: { id: '42' },
    })

    // 运行期切换至备用节点后，无需重新加载模块即命中新域名
    state.currentApiUrl = 'https://failover-api.vtsuru.suki.club/'
    await vtsuruMutator('/api/queue/get-active?id=42', { method: 'GET' })
    expect(state.queryGetCalls[1]).toEqual({
      endpoint: 'https://failover-api.vtsuru.suki.club/api/queue/get-active',
      params: { id: '42' },
    })
  })
})
