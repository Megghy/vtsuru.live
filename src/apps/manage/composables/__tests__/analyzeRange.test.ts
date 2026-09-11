import { describe, expect, it } from 'vitest'

import {
  computeAreaStatsFromSessions,
  computeDayOfWeekStats,
  computeMilestones,
  computeRangeSummary,
  filterChartDataByRange,
  filterSessionsByRange,
  type AnalyzeDayPoint,
  type AnalyzeSessionItem,
} from '../analyzeRange'

describe('analyzeRange', () => {
  const points: AnalyzeDayPoint[] = [
    {
      timestamp: 1_000,
      income: 10,
      giftIncome: 6,
      scIncome: 4,
      guardIncome: 100,
      totalIncomeWithGuard: 110,
      interactionCount: 1,
      danmakuCount: 2,
      payingUsers: 1,
      interactionUsers: 2,
      liveMinutes: 30,
      likeCount: 5,
      sessionCount: 1,
    },
    {
      timestamp: 2_000,
      income: 20,
      giftIncome: 15,
      scIncome: 5,
      guardIncome: 0,
      totalIncomeWithGuard: 20,
      interactionCount: 3,
      danmakuCount: 4,
      payingUsers: 2,
      interactionUsers: 3,
      liveMinutes: 0,
      likeCount: 10,
      sessionCount: 0,
    },
    {
      timestamp: 3_000,
      income: 5,
      giftIncome: 5,
      scIncome: 0,
      guardIncome: 0,
      totalIncomeWithGuard: 5,
      interactionCount: 1,
      danmakuCount: 1,
      payingUsers: 0,
      interactionUsers: 1,
      liveMinutes: 10,
      likeCount: 2,
      sessionCount: 1,
    },
  ]

  it('filters points by inclusive range', () => {
    const filtered = filterChartDataByRange(points, 1_500, 3_000)
    expect(filtered.map((p) => p.timestamp)).toEqual([2_000, 3_000])
  })

  it('computes range summary with revenue breakdown and efficiency metrics', () => {
    const summary = computeRangeSummary(filterChartDataByRange(points, 1_000, 2_000))
    expect(summary.totalIncome).toBe(30)
    expect(summary.giftIncome).toBe(21)
    expect(summary.scIncome).toBe(9)
    expect(summary.guardIncome).toBe(100)
    expect(summary.totalIncomeWithGuard).toBe(130)
    expect(summary.totalDanmakuCount).toBe(6)
    expect(summary.totalLikeCount).toBe(15)
    expect(summary.activeLiveDays).toBe(1)
    expect(summary.dailyAvgIncome).toBe(30)
    expect(summary.payingRate).toBe((3 / 5) * 100)
    expect(summary.hourlyIncome).toBe(60) // 30 / (30/60)
  })

  it('computes milestones accurately', () => {
    const milestones = computeMilestones(points)
    expect(milestones.maxIncomeDay?.value).toBe(20)
    expect(milestones.maxDanmakuDay?.value).toBe(4)
    expect(milestones.maxDurationDay?.value).toBe(30)
    expect(milestones.maxInteractionDay?.value).toBe(3)
  })

  it('computes day-of-week stats ordered Monday to Sunday', () => {
    const dow = computeDayOfWeekStats(points)
    expect(dow).toHaveLength(7)
    expect(dow[0].dayName).toBe('周一')
    expect(dow[6].dayName).toBe('周日')
  })

  it('filters sessions by timestamp range and aggregates area statistics', () => {
    const sessions: AnalyzeSessionItem[] = [
      {
        id: 's1',
        title: '测试单机',
        area: '单机游戏',
        parentArea: '单机',
        coverUrl: '',
        startTime: 1_000,
        liveMinutes: 60,
        totalIncome: 100,
        giftIncome: 80,
        scIncome: 20,
        guardIncome: 0,
        totalIncomeWithGuard: 100,
        danmakuCount: 50,
        interactionCount: 20,
        uniqueInteractionCount: 15,
        uniquePayingCount: 5,
        likeCount: 200,
      },
      {
        id: 's2',
        title: '测试杂谈',
        area: '视频聊天',
        parentArea: '娱乐',
        coverUrl: '',
        startTime: 2_000,
        liveMinutes: 120,
        totalIncome: 200,
        giftIncome: 100,
        scIncome: 100,
        guardIncome: 198,
        totalIncomeWithGuard: 398,
        danmakuCount: 150,
        interactionCount: 40,
        uniqueInteractionCount: 30,
        uniquePayingCount: 8,
        likeCount: 500,
      },
      {
        id: 's3',
        title: '早前直播',
        area: '单机游戏',
        parentArea: '单机',
        coverUrl: '',
        startTime: 500,
        liveMinutes: 30,
        totalIncome: 10,
        giftIncome: 10,
        scIncome: 0,
        guardIncome: 0,
        totalIncomeWithGuard: 10,
        danmakuCount: 10,
        interactionCount: 5,
        uniqueInteractionCount: 4,
        uniquePayingCount: 1,
        likeCount: 50,
      },
    ]

    const filtered = filterSessionsByRange(sessions, 1_000, 2_500)
    expect(filtered).toHaveLength(2)

    const areaStats = computeAreaStatsFromSessions(filtered)
    expect(areaStats).toHaveLength(2)
    expect(areaStats[0].parentArea).toBe('娱乐')
    expect(areaStats[0].totalIncome).toBe(200)
    expect(areaStats[1].parentArea).toBe('单机')
    expect(areaStats[1].totalIncome).toBe(100)
  })
})
