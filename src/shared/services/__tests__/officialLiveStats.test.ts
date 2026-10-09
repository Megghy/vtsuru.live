import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as query from '@/api/query'

import { fetchOfficialLiveStats, officialLiveStats, updateOfficialStats } from '../officialLiveStats'

describe('officialLiveStats service', () => {
  beforeEach(() => {
    officialLiveStats.value = {
      onlineRank: null,
      onlineRankText: null,
      popularity: null,
      totalLikes: null,
      watchedCount: null,
      watchedText: null,
      updatedAt: null,
    }
    vi.restoreAllMocks()
  })

  it('updates partial stats and stamps updatedAt', () => {
    expect(officialLiveStats.value.onlineRank).toBeNull()

    updateOfficialStats({
      onlineRank: 42,
      onlineRankText: '42',
      totalLikes: 1000,
    })

    expect(officialLiveStats.value.onlineRank).toBe(42)
    expect(officialLiveStats.value.onlineRankText).toBe('42')
    expect(officialLiveStats.value.totalLikes).toBe(1000)
    expect(officialLiveStats.value.updatedAt).toBeGreaterThan(0)
  })

  it('fetches stats from backend api and updates state', async () => {
    vi.spyOn(query, 'QueryGetAPI').mockResolvedValue({
      code: 200,
      data: {
        onlineRank: 128,
        onlineRankText: '128',
        popularity: 54321,
        totalLikes: 9999,
        watchedCount: 3000,
        watchedText: '3000人看过',
      },
    } as any)

    const stats = await fetchOfficialLiveStats(12345, 67890)

    expect(stats.onlineRank).toBe(128)
    expect(stats.onlineRankText).toBe('128')
    expect(stats.popularity).toBe(54321)
    expect(stats.totalLikes).toBe(9999)
    expect(stats.watchedCount).toBe(3000)
    expect(stats.watchedText).toBe('3000人看过')
  })
})
