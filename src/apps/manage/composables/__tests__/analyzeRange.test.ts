import { describe, expect, it } from 'vitest'

import { computeRangeSummary, filterChartDataByRange } from '../analyzeRange'

describe('analyzeRange', () => {
  const points = [
    {
      timestamp: 1_000,
      income: 10,
      interactionCount: 1,
      danmakuCount: 2,
      payingUsers: 1,
      interactionUsers: 2,
      liveMinutes: 30,
      likeCount: 0,
    },
    {
      timestamp: 2_000,
      income: 20,
      interactionCount: 3,
      danmakuCount: 4,
      payingUsers: 2,
      interactionUsers: 3,
      liveMinutes: 0,
      likeCount: 0,
    },
    {
      timestamp: 3_000,
      income: 5,
      interactionCount: 1,
      danmakuCount: 1,
      payingUsers: 0,
      interactionUsers: 1,
      liveMinutes: 10,
      likeCount: 0,
    },
  ]

  it('filters points by inclusive range', () => {
    const filtered = filterChartDataByRange(points, 1_500, 3_000)
    expect(filtered.map((p) => p.timestamp)).toEqual([2_000, 3_000])
  })

  it('computes range summary from filtered points', () => {
    const summary = computeRangeSummary(filterChartDataByRange(points, 1_000, 2_000))
    expect(summary.totalIncome).toBe(30)
    expect(summary.totalDanmakuCount).toBe(6)
    expect(summary.activeLiveDays).toBe(1)
    expect(summary.dailyAvgIncome).toBe(30)
  })
})
