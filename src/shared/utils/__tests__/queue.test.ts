import { describe, expect, it } from 'vitest'

import { QueueSortType } from '@/api/generated/model'

import { getSCColor, normalizeTimestampMs, sortByQueueType } from '../queue'

interface MockQueueEntry {
  id: string
  createAt: number
  guardLevel?: number
  price?: number
  fansMedalLevel?: number
  priorityLevel?: number
  sortOrder?: number | null
}

const accessor = {
  createAt: (item: MockQueueEntry) => item.createAt,
  guardLevel: (item: MockQueueEntry) => item.guardLevel,
  price: (item: MockQueueEntry) => item.price,
  fansMedalLevel: (item: MockQueueEntry) => item.fansMedalLevel,
  priorityLevel: (item: MockQueueEntry) => item.priorityLevel,
  sortOrder: (item: MockQueueEntry) => item.sortOrder,
}

describe('sortByQueueType', () => {
  it('优先按插队等级降序置顶，再按常规排序策略', () => {
    const items: MockQueueEntry[] = [
      { id: 'early-normal', createAt: 100, priorityLevel: 0 },
      { id: 'late-priority-1', createAt: 300, priorityLevel: 1 },
      { id: 'mid-priority-2', createAt: 200, priorityLevel: 2 },
    ]

    const sorted = sortByQueueType(items, QueueSortType.TimeFirst, false, accessor)
    expect(sorted.map((i) => i.id)).toEqual(['mid-priority-2', 'late-priority-1', 'early-normal'])
  })

  it('在支付优先模式下插队等级优先，同等级内部按金额降序', () => {
    const items: MockQueueEntry[] = [
      { id: 'high-pay-normal', createAt: 100, price: 200, priorityLevel: 0 },
      { id: 'low-pay-priority', createAt: 200, price: 0, priorityLevel: 1 },
      { id: 'mid-pay-normal', createAt: 150, price: 50, priorityLevel: 0 },
    ]

    const sorted = sortByQueueType(items, QueueSortType.PaymentFist, false, accessor)
    expect(sorted.map((i) => i.id)).toEqual(['low-pay-priority', 'high-pay-normal', 'mid-pay-normal'])
  })

  it('存在 sortOrder 时手动排序优先于插队与规则排序，相同或缺失 sortOrder 回退常规比较', () => {
    const items: MockQueueEntry[] = [
      { id: 'auto-priority', createAt: 100, priorityLevel: 5, sortOrder: null },
      { id: 'manual-2', createAt: 400, priorityLevel: 0, sortOrder: 2 },
      { id: 'manual-1', createAt: 500, priorityLevel: 0, sortOrder: 1 },
      { id: 'manual-1-older', createAt: 200, priorityLevel: 0, sortOrder: 1 },
      { id: 'auto-normal', createAt: 50, priorityLevel: 0, sortOrder: undefined },
    ]

    const sorted = sortByQueueType(items, QueueSortType.TimeFirst, false, accessor)
    expect(sorted.map((i) => i.id)).toEqual(['manual-1-older', 'manual-1', 'manual-2', 'auto-priority', 'auto-normal'])
  })

  it('开启倒序时保持手动 sortOrder 与插队优先级在前，仅反转常规规则排序', () => {
    const items: MockQueueEntry[] = [
      { id: 'auto-early', createAt: 100, priorityLevel: 0, sortOrder: null },
      { id: 'auto-late', createAt: 300, priorityLevel: 0, sortOrder: null },
      { id: 'auto-priority-high', createAt: 200, priorityLevel: 2, sortOrder: null },
      { id: 'auto-priority-low-early', createAt: 150, priorityLevel: 1, sortOrder: null },
      { id: 'auto-priority-low-late', createAt: 250, priorityLevel: 1, sortOrder: null },
      { id: 'manual-1', createAt: 500, priorityLevel: 0, sortOrder: 1 },
      { id: 'manual-2', createAt: 400, priorityLevel: 0, sortOrder: 2 },
    ]

    const sorted = sortByQueueType(items, QueueSortType.TimeFirst, true, accessor)
    expect(sorted.map((i) => i.id)).toEqual([
      'manual-1',
      'manual-2',
      'auto-priority-high',
      'auto-priority-low-late',
      'auto-priority-low-early',
      'auto-late',
      'auto-early',
    ])
  })
})

describe('getSCColor', () => {
  it('按 SC 金额区间返回对应色阶', () => {
    expect(getSCColor(undefined)).toBe('var(--muted-foreground)')
    expect(getSCColor(0)).toBe('var(--muted-foreground)')
    expect(getSCColor(30)).toBe('#2A60B2')
    expect(getSCColor(50)).toBe('#427D9E')
    expect(getSCColor(100)).toBe('#E2B52B')
    expect(getSCColor(500)).toBe('#E09443')
    expect(getSCColor(1000)).toBe('#E54D4D')
    expect(getSCColor(2000)).toBe('#AB1A32')
  })
})

describe('normalizeTimestampMs', () => {
  it('统一将秒级、毫秒级或空时间戳规范化为毫秒时间戳', () => {
    expect(normalizeTimestampMs(undefined)).toBe(0)
    expect(normalizeTimestampMs(null)).toBe(0)
    expect(normalizeTimestampMs(0)).toBe(0)
    expect(normalizeTimestampMs(1700000000)).toBe(1700000000000)
    expect(normalizeTimestampMs(1700000000123)).toBe(1700000000123)
  })
})
