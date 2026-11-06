import { describe, expect, it } from 'vitest'

import { groupQuestionThreads, threadContextOf } from '@/shared/questionThread'
import { createMockQuestion } from '@/test/testUtils'

const q = (id: number, sendAt: number, threadRootId?: number) => createMockQuestion({ id, sendAt, threadRootId })

describe('groupQuestionThreads', () => {
  it('把追问按时间挂到首条下, 并保持首条顺序', () => {
    const list = [q(2, 200), q(12, 400, 1), q(1, 100), q(11, 300, 1)]
    const threads = groupQuestionThreads(list)
    expect(threads.map((t) => t.root.id)).toEqual([2, 1])
    expect(threads[1]!.followUps.map((f) => f.id)).toEqual([11, 12])
    expect(threads[0]!.followUps).toEqual([])
  })

  it('首条缺失的追问单独成组', () => {
    const threads = groupQuestionThreads([q(11, 300, 99)])
    expect(threads).toHaveLength(1)
    expect(threads[0]!.root.id).toBe(11)
  })
})

describe('threadContextOf', () => {
  const list = [q(1, 100), q(11, 200, 1), q(12, 300, 1), q(2, 150)]

  it('返回首条与更早的追问', () => {
    expect(threadContextOf(list, list[2]!).map((x) => x.id)).toEqual([1, 11])
  })

  it('首条提问没有上文', () => {
    expect(threadContextOf(list, list[0]!)).toEqual([])
  })
})
