import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'

import { EventDataTypes, GuardLevel } from '@/api/api-models'
import type { DashboardEvent } from '../../core/types'
import { useDashboardStats } from '../stats'

function createEvent(partial: Partial<DashboardEvent>): DashboardEvent {
  return {
    key: `k_${Math.random()}`,
    type: EventDataTypes.Message,
    time: Date.now(),
    uid: 12345,
    uname: 'TestUser',
    uface: '',
    msg: 'hello',
    price: 0,
    num: 1,
    read: false,
    ...partial,
  }
}

describe('useDashboardStats 中控台实时统计', () => {
  it('正确统计弹幕、点赞数和在线人数', () => {
    const paid = shallowRef<DashboardEvent[]>([])
    const stats = useDashboardStats(paid)

    expect(stats.counters.danmaku).toBe(0)
    expect(stats.counters.like).toBe(0)
    expect(stats.onlineCount.value).toBe(0)
    expect(stats.userCount.value).toBe(0)

    // 收到一条弹幕
    stats.record(createEvent({ type: EventDataTypes.Message, uid: 101, uname: '用户A' }))
    expect(stats.counters.danmaku).toBe(1)
    expect(stats.onlineCount.value).toBe(1)
    expect(stats.userCount.value).toBe(1)

    // 收到连续 3 次点赞 (num = 5)
    stats.record(createEvent({ type: EventDataTypes.Like, uid: 102, uname: '用户B', num: 5 }))
    expect(stats.counters.like).toBe(5)
    expect(stats.onlineCount.value).toBe(2)
    expect(stats.userCount.value).toBe(2)

    // 用户 A 再次发送点赞 (去重计数)
    stats.record(createEvent({ type: EventDataTypes.Like, uid: 101, uname: '用户A', num: 2 }))
    expect(stats.counters.like).toBe(7)
    expect(stats.onlineCount.value).toBe(2)
    expect(stats.userCount.value).toBe(2)
  })

  it('正确计算本场总收益与付费分项', () => {
    const paid = shallowRef<DashboardEvent[]>([])
    const stats = useDashboardStats(paid)

    const now = Date.now()
    paid.value = [
      createEvent({ type: EventDataTypes.SC, price: 30, time: now }),
      createEvent({ type: EventDataTypes.Gift, price: 50, time: now }),
      createEvent({ type: EventDataTypes.Guard, price: 198, num: 1, guardLevel: GuardLevel.Jianzhang, time: now }),
    ]

    expect(stats.totals.value.sc).toBe(30)
    expect(stats.totals.value.gift).toBe(50)
    expect(stats.totals.value.guard).toBe(198)
    expect(stats.totals.value.guardCount).toBe(1)
    expect(stats.totals.value.totalRevenue).toBe(278)
  })

  it('重置时清理点赞数与在场用户', () => {
    const paid = shallowRef<DashboardEvent[]>([])
    const stats = useDashboardStats(paid)

    stats.record(createEvent({ type: EventDataTypes.Like, uid: 101, num: 10 }))
    stats.reset()

    expect(stats.counters.like).toBe(0)
    expect(stats.counters.danmaku).toBe(0)
    expect(stats.onlineCount.value).toBe(0)
    expect(stats.userCount.value).toBe(0)
  })
})
