import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as analyzeApi from '@/api/generated/analyze/analyze'
import { useAnalyzeStore } from '../useAnalyzeStore'

vi.mock('@/api/generated/analyze/analyze', () => ({
  getApiAnalyzeAll: vi.fn(),
}))

describe('useAnalyzeStore SWR loading and caching', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initializes with empty cache and false flags', () => {
    const store = useAnalyzeStore()
    expect(store.analyzeData).toBeNull()
    expect(store.loading).toBe(false)
    expect(store.refreshing).toBe(false)
    expect(store.hasData).toBe(false)
  })

  it('triggers full blocking skeleton loading on first load without cache', async () => {
    const mockData = {
      summary: {
        last7Days: { totalIncome: 100 },
        last30Days: { totalIncome: 500, totalLiveMinutes: 120, totalDanmakuCount: 50 },
      },
      chartData: {
        '1700000000': { income: 50, danmakuCount: 10 },
      },
      sessions: [],
    }

    vi.mocked(analyzeApi.getApiAnalyzeAll).mockImplementation(async () => {
      // 模拟请求进行中时检查 loading 状态
      expect(store.loading).toBe(true)
      expect(store.refreshing).toBe(false)
      return { code: 200, message: 'ok', data: mockData as any }
    })

    const store = useAnalyzeStore()
    await store.loadData()

    expect(store.loading).toBe(false)
    expect(store.refreshing).toBe(false)
    expect(store.hasData).toBe(true)
    expect(store.analyzeData?.summary.last30Days.totalIncome).toBe(500)
    expect(store.lastUpdateTime).toBeGreaterThan(0)
  })

  it('uses SWR strategy on subsequent loads (loading stays false, refreshing turns true)', async () => {
    const store = useAnalyzeStore()
    store.analyzeData = {
      summary: {
        last7Days: {} as any,
        last30Days: { totalIncome: 200, totalLiveMinutes: 60 } as any,
      },
      chartData: {
        '1700000000': { income: 200 } as any,
      },
    }

    const updatedData = {
      summary: {
        last7Days: {} as any,
        last30Days: { totalIncome: 300, totalLiveMinutes: 90 } as any,
      },
      chartData: {
        '1700000000': { income: 300 } as any,
      },
    }

    vi.mocked(analyzeApi.getApiAnalyzeAll).mockImplementation(async () => {
      expect(store.loading).toBe(false)
      expect(store.refreshing).toBe(true)
      return { code: 200, message: 'ok', data: updatedData as any }
    })

    await store.loadData()

    expect(store.loading).toBe(false)
    expect(store.refreshing).toBe(false)
    expect(store.analyzeData?.summary.last30Days.totalIncome).toBe(300)
  })
})
