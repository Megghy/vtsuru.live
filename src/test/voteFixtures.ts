import type { VoteOBSData } from '@/api/generated/model'

export function voteSnapshot(counts: number[], overrides: Partial<VoteOBSData> = {}): VoteOBSData {
  const totalVotes = counts.reduce((sum, count) => sum + count, 0)
  return {
    sessionId: 1,
    title: '下一局挑战',
    totalVotes,
    totalContribution: 0,
    resultMode: 0,
    isActive: true,
    isPaused: false,
    isUnlimited: false,
    isEnding: false,
    winnerByDraw: false,
    showResults: true,
    theme: 'duel',
    roundedCorners: true,
    displayPosition: 'top-center',
    startTime: 1_700_000_000_000,
    fontFamily: '',
    fontScale: 1,
    borderRadius: 12,
    cardOpacity: 0.9,
    backdropBlur: 12,
    accentColor: '',
    leadingColor: '',
    duelLeftColor: '',
    duelRightColor: '',
    showRecentVoter: false,
    options: counts.map((count, index) => ({
      index: index + 1,
      text: `选项 ${index + 1}`,
      count,
      contribution: 0,
      percentage: totalVotes ? Math.round((count / totalVotes) * 100) : 0,
    })),
    ...overrides,
  }
}
