import { describe, expect, it } from 'vitest'

import { EventDataTypes } from '@/api/generated/model'

import { computeDanmakuPulse } from '../pulse'
import type { DashboardEvent } from '../types'

function makeEvent(msg: string, time: number, key: string): DashboardEvent {
  return {
    key,
    type: EventDataTypes.Message,
    time,
    uid: 1,
    ouid: 'o1',
    uname: 'tester',
    uface: '',
    msg,
    price: 0,
    num: 1,
    guardLevel: 0,
    medalLevel: 0,
    medalName: '',
    medalWearing: false,
    read: false,
    deleted: false,
  }
}

describe('computeDanmakuPulse', () => {
  it('统计近 3 分钟分桶并在异常提醒词出现 ≥2 次时优先标红置顶', () => {
    const now = 1_700_000_000_000
    const events = [
      makeEvent('哈哈哈', now - 25_000, '1'),
      makeEvent('哈哈哈！', now - 20_000, '2'),
      makeEvent('哈哈哈', now - 15_000, '3'),
      makeEvent('没声音了', now - 10_000, '4'),
      makeEvent('没声音了', now - 5_000, '5'),
    ]
    const snap = computeDanmakuPulse(events, now)
    expect(snap.buckets.length).toBe(18)
    expect(snap.currentPerMin).toBe(10)
    expect(snap.hotWords[0]).toMatchObject({ text: '没声音了', count: 2, isAlert: true })
    expect(snap.hotWords[1]).toMatchObject({ text: '哈哈哈', count: 3, isAlert: false })
  })

  it('在最近 10 秒突发大量弹幕时标记 isSpike', () => {
    const now = 1_700_000_000_000
    const events: DashboardEvent[] = []
    for (let i = 0; i < 12; i++) {
      events.push(makeEvent('6666', now - i * 500, `k-${i}`))
    }
    const snap = computeDanmakuPulse(events, now)
    expect(snap.isSpike).toBe(true)
  })
})
