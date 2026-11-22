import { describe, expect, it } from 'vitest'

import { createDefaultVoteConfig, type VoteSessionModel } from '@/api/vote'
import { isPotentialVoteMessage } from '@/composables/useVoteDanmakuBridge'

function createSession(options: string[]): VoteSessionModel {
  return {
    id: 1,
    title: '测试投票',
    startTime: 1_700_000_000,
    isActive: true,
    totalVotes: 0,
    options: options.map((text) => ({
      text,
      count: 0,
      voters: [],
      voterDetails: [],
    })),
  }
}

describe('isPotentialVoteMessage', () => {
  it('accepts repeated single digits matching existing option indexes', () => {
    const session = createSession(['选项A', '选项B'])
    const config = createDefaultVoteConfig()

    expect(isPotentialVoteMessage('11111', session, config)).toBe(true)
    expect(isPotentialVoteMessage('222', session, config)).toBe(true)
    expect(isPotentialVoteMessage(' 11 ', session, config)).toBe(true)
    expect(isPotentialVoteMessage('投票 11111', session, config)).toBe(true)
  })

  it('rejects zero, mixed, and out-of-range repeated digits', () => {
    const session = createSession(['选项A', '选项B'])
    const config = createDefaultVoteConfig()

    expect(isPotentialVoteMessage('000', session, config)).toBe(false)
    expect(isPotentialVoteMessage('121', session, config)).toBe(false)
    expect(isPotentialVoteMessage('999', session, config)).toBe(false)
  })

  it('still accepts exact matching text when option text is repeated digits', () => {
    const session = createSession(['选项A', '选项B', '999'])
    const config = createDefaultVoteConfig()

    expect(isPotentialVoteMessage('999', session, config)).toBe(true)
  })

  it('respects allowDirectVote=false while allowing prefixed repeated digits', () => {
    const session = createSession(['选项A', '选项B'])
    const config = { ...createDefaultVoteConfig(), allowDirectVote: false, voteCommand: '投票' }

    expect(isPotentialVoteMessage('11111', session, config)).toBe(false)
    expect(isPotentialVoteMessage('投票 11111', session, config)).toBe(true)
  })
})
