import type { VoteOptionDto } from '@/api/api-models'

/** 票数是排名、票差与胜负的唯一依据；API 的 percentage 仅是舍入后的展示值。 */
export function getVoteStandings(options: readonly VoteOptionDto[]) {
  const ordered = options.toSorted((a, b) => b.count - a.count || a.index - b.index)
  const topCount = ordered[0]?.count ?? 0
  const leaders = ordered.filter((option) => topCount > 0 && option.count === topCount)
  const leader = leaders.length === 1 ? leaders[0] : null
  let rank = 0
  const ranks = new Map(
    ordered.map((option, index) => {
      if (index === 0 || option.count !== ordered[index - 1].count) rank = index + 1
      return [option.index, rank] as const
    }),
  )
  return {
    ordered,
    leaders,
    leader,
    ranks,
    total: options.reduce((sum, option) => sum + option.count, 0),
    gap: leader && ordered.length > 1 ? leader.count - ordered[1].count : 0,
  }
}

export type VoteStandings = ReturnType<typeof getVoteStandings>

export function voteOutcomeLabel(standings: VoteStandings, isEnding: boolean): string {
  if (standings.total === 0) return isEnding ? '无人投票' : '等待投票'
  if (!standings.leader) return isEnding ? '并列第一' : '平票'
  return isEnding ? `胜出：${standings.leader.text}` : `领先第二名 ${standings.gap} 票`
}
