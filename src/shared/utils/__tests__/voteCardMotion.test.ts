import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import type { VoteOBSData } from '@/api/api-models'
import { voteSnapshot } from '@/test/voteFixtures'

import { computeRankMoves, useVoteCardMotion } from '../voteCardMotion'

const stops: (() => void)[] = []
function mount(counts: number[]) {
  const source = ref<VoteOBSData | null>(voteSnapshot(counts))
  const scope = effectScope()
  const motion = scope.run(() => useVoteCardMotion(() => source.value))!
  stops.push(() => scope.stop())
  return { source, motion, stop: () => scope.stop() }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  stops.splice(0).forEach((stop) => stop())
  vi.useRealTimers()
})

describe('computeRankMoves', () => {
  it('compares competition ranks, including shared ranks', () => {
    expect(
      computeRankMoves(
        new Map([
          [1, 2],
          [2, 1],
        ]),
        new Map([
          [1, 1],
          [2, 1],
        ]),
      ),
    ).toEqual({ 1: 'up' })
  })
  it('ignores newly seen options', () => {
    expect(computeRankMoves(new Map(), new Map([[1, 1]]))).toEqual({})
  })
})

describe('useVoteCardMotion', () => {
  it('does not report an overtake on initial load or the first vote', async () => {
    const { source, motion } = mount([0, 0])
    source.value = voteSnapshot([0, 1])
    await nextTick()
    expect(motion.overtaking.value).toBeNull()
  })

  it('detects overtaking across a tie, but not tying or regaining the same lead', async () => {
    const { source, motion } = mount([101, 100])
    for (const counts of [
      [101, 101],
      [102, 101],
      [102, 102],
    ]) {
      source.value = voteSnapshot(counts)
      await nextTick()
      expect(motion.overtaking.value).toBeNull()
    }
    source.value = voteSnapshot([102, 103])
    await nextTick()
    expect(motion.overtaking.value).toBe(2)
    vi.advanceTimersByTime(1100)
    expect(motion.overtaking.value).toBeNull()
  })

  it('tracks in-place preview mutations and restarts the feedback timer', async () => {
    const { source, motion } = mount([101, 100])
    source.value!.options[1].count = 102
    await nextTick()
    expect(motion.overtaking.value).toBe(2)
    vi.advanceTimersByTime(800)
    source.value!.options[0].count = 103
    await nextTick()
    expect(motion.overtaking.value).toBe(1)
    vi.advanceTimersByTime(400)
    expect(motion.overtaking.value).toBe(1)
    vi.advanceTimersByTime(700)
    expect(motion.overtaking.value).toBeNull()
  })

  it.each([{ sessionId: 2 }, { isEnding: true, isActive: false }, { showResults: false }])(
    'resets feedback when the snapshot changes to %j',
    async (change) => {
      const { source, motion } = mount([101, 100])
      source.value = voteSnapshot([100, 102])
      await nextTick()
      expect(motion.overtaking.value).toBe(2)
      source.value = voteSnapshot([103, 102], change)
      await nextTick()
      expect(motion.overtaking.value).toBeNull()
      expect(motion.moves.value).toEqual({})
    },
  )

  it('clears state on null and cancels timers when disposed', async () => {
    const { source, motion, stop } = mount([101, 100])
    source.value = voteSnapshot([100, 102])
    await nextTick()
    stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(motion.overtaking.value).toBeNull()
  })

  it('never carries a leader across an empty snapshot', async () => {
    const { source, motion } = mount([101, 100])
    source.value = null
    await nextTick()
    source.value = voteSnapshot([100, 102])
    await nextTick()
    expect(motion.overtaking.value).toBeNull()
  })
})
