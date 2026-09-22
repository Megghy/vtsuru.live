import { describe, expect, it } from 'vitest'

import { voteSnapshot } from '@/test/voteFixtures'

import { getVoteStandings, voteOutcomeLabel } from '../voteStandings'

describe('vote standings', () => {
  it('uses counts rather than rounded percentages to determine the leader', () => {
    const data = voteSnapshot([100, 101])
    expect(data.options.map((option) => option.percentage)).toEqual([50, 50])
    const result = getVoteStandings(data.options)
    expect(result.leader?.index).toBe(2)
    expect(result.gap).toBe(1)
  })

  it.each([
    [0, 0],
    [100, 100],
    [0, 0, 0],
  ])('does not choose a single winner for %j', (...counts) => {
    expect(getVoteStandings(voteSnapshot(counts).options).leader).toBeNull()
  })

  it('gives tied leaders the same rank regardless of API ordering', () => {
    const result = getVoteStandings(voteSnapshot([100, 100, 50]).options.toReversed())
    expect(result.ordered.map((option) => option.index)).toEqual([1, 2, 3])
    expect(result.leaders.map((option) => option.index)).toEqual([1, 2])
    expect([...result.ranks]).toEqual([
      [1, 1],
      [2, 1],
      [3, 3],
    ])
  })

  it('distinguishes waiting, no votes, ties and settlement', () => {
    const empty = getVoteStandings(voteSnapshot([0, 0]).options)
    const tied = getVoteStandings(voteSnapshot([100, 100]).options)
    const leader = getVoteStandings(voteSnapshot([100, 101]).options)
    expect(voteOutcomeLabel(empty, false)).toBe('等待投票')
    expect(voteOutcomeLabel(empty, true)).toBe('无人投票')
    expect(voteOutcomeLabel(tied, false)).toBe('平票')
    expect(voteOutcomeLabel(tied, true)).toBe('并列第一')
    expect(voteOutcomeLabel(leader, false)).toBe('领先第二名 1 票')
    expect(voteOutcomeLabel(leader, true)).toBe('胜出：选项 2')
  })
})
