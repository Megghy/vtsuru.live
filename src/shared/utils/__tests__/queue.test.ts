import { describe, expect, it } from 'vitest'

import { QueueSortType } from '@/api/generated/model'

import { sortByQueueType } from '../queue'

interface MockQueueEntry {
  id: string
  createAt: number
  guardLevel?: number
  price?: number
  fansMedalLevel?: number
  priorityLevel?: number
}

const accessor = {
  createAt: (item: MockQueueEntry) => item.createAt,
  guardLevel: (item: MockQueueEntry) => item.guardLevel,
  price: (item: MockQueueEntry) => item.price,
  fansMedalLevel: (item: MockQueueEntry) => item.fansMedalLevel,
  priorityLevel: (item: MockQueueEntry) => item.priorityLevel,
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
})
