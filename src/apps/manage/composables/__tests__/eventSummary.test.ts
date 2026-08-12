import { describe, expect, it } from 'vitest'

/** 与 EventView eventSummary 同构的纯函数，供回归断言 */
function summarizeEvents(list: Array<{ ouid?: string; uid?: number; uname?: string; price?: number; num?: number }>) {
  const uniqueUsers = new Set(list.map((e) => e.ouid || String(e.uid) || e.uname)).size
  const totalPrice = list.reduce((sum, e) => sum + (Number(e.price) || 0), 0)
  const totalNum = list.reduce((sum, e) => sum + (Number(e.num) || 0), 0)
  return { count: list.length, uniqueUsers, totalPrice, totalNum }
}

describe('eventSummary shape', () => {
  it('aggregates count, unique users, price and num', () => {
    const summary = summarizeEvents([
      { ouid: 'a', price: 138, num: 1 },
      { ouid: 'a', price: 30, num: 1 },
      { ouid: 'b', price: 1980, num: 1 },
    ])
    expect(summary.count).toBe(3)
    expect(summary.uniqueUsers).toBe(2)
    expect(summary.totalPrice).toBe(2148)
    expect(summary.totalNum).toBe(3)
  })
})
