import { describe, expect, it } from 'vitest'

import { EventDataTypes, GuardLevel } from '@/api/generated/model'

import { computeGoalEventDelta, computeGoalProgressPercent, formatCountdownClock } from '../components/goal/goalEngine'
import { DEFAULT_GOAL_STATE } from '../components/goal/types'

describe('goalEngine', () => {
  it('能正确格式化倒计时时间', () => {
    expect(formatCountdownClock(0)).toBe('00:00:00')
    expect(formatCountdownClock(3661 * 1000)).toBe('01:01:01')
  })

  it('能计算进度条百分比并钳位在 0~100', () => {
    expect(computeGoalProgressPercent(15, 30)).toBe(50)
    expect(computeGoalProgressPercent(50, 30)).toBe(100)
    expect(computeGoalProgressPercent(5, 0)).toBe(0)
  })

  it('上舰事件在 combo 模式下会同时推进舰长目标并延长耐久时间', () => {
    const now = 1_700_000_000_000
    const state = {
      ...DEFAULT_GOAL_STATE,
      mode: 'combo' as const,
      metric: 'guard' as const,
      current: 10,
      countdownPaused: false,
      countdownEndAt: now + 600_000,
      secondsPerJianzhang: 300,
    }

    const res = computeGoalEventDelta(
      state,
      { type: EventDataTypes.Guard, priceYuan: 198, guardLevel: GuardLevel.Jianzhang, num: 1 },
      now,
    )

    expect(res).not.toBeNull()
    expect(res?.addedProgress).toBe(1)
    expect(res?.addedSeconds).toBe(300)
    expect(res?.patch.current).toBe(11)
    expect(res?.patch.countdownEndAt).toBe(now + 900_000)
  })

  it('SC/礼物按每元秒数增加耐久时间，paused 状态下直接加到 pausedRemainingMs', () => {
    const now = 1_700_000_000_000
    const state = {
      ...DEFAULT_GOAL_STATE,
      mode: 'subathon' as const,
      countdownPaused: true,
      pausedRemainingMs: 1_800_000,
      secondsPerYuan: 10,
    }

    const res = computeGoalEventDelta(
      state,
      { type: EventDataTypes.SC, priceYuan: 30 },
      now,
    )

    expect(res?.addedProgress).toBe(0)
    expect(res?.addedSeconds).toBe(300)
    expect(res?.patch.pausedRemainingMs).toBe(2_100_000)
  })
})
