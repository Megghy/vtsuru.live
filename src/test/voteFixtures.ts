import type { VoteOBSData } from '@/api/api-models'

export function voteSnapshot(counts: number[], overrides: Partial<VoteOBSData> = {}): VoteOBSData {
  const totalVotes = counts.reduce((sum, count) => sum + count, 0)
  return {
    sessionId: 1,
    title: '下一局挑战',
    totalVotes,
    isActive: true,
    isEnding: false,
    showResults: true,
    theme: 'duel',
    roundedCorners: true,
    displayPosition: 'top-center',
    startTime: 1_700_000_000_000,
    options: counts.map((count, index) => ({
      index: index + 1,
      text: `选项 ${index + 1}`,
      count,
      percentage: totalVotes ? Math.round((count / totalVotes) * 100) : 0,
    })),
    ...overrides,
  }
}
