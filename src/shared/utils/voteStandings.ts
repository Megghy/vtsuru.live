import { type VoteOptionDtoModel, VoteResultMode } from '@/api/vote'

export function formatContribution(value?: number): string {
  if (!value || value <= 0) return '¥0'
  return Number.isInteger(value) ? `¥${value}` : `¥${value.toFixed(1)}`
}

/** 原始票数（或按贡献度模式下的原始金额）是排名、差距与胜负的唯一依据，禁止使用舍入百分比判胜负。 */
export function getVoteStandings(
  options: readonly VoteOptionDtoModel[],
  resultMode: VoteResultMode = VoteResultMode.ByCount,
  winnerOverride?: string | null,
) {
  const totalContribution = options.reduce((sum, option) => sum + (option.contribution ?? 0), 0)
  const useContribution = resultMode === VoteResultMode.ByContribution && totalContribution > 0

  const scoreOf = (option: VoteOptionDtoModel) => (useContribution ? (option.contribution ?? 0) : option.count)

  const ordered = options.toSorted(
    (a, b) => scoreOf(b) - scoreOf(a) || b.count - a.count || a.index - b.index,
  )
  const topScore = ordered[0] ? scoreOf(ordered[0]) : 0
  const topCount = ordered[0]?.count ?? 0

  const leaders = ordered.filter((option) => {
    if (topScore <= 0) return false
    if (useContribution) {
      return scoreOf(option) === topScore && option.count === topCount
    }
    return option.count === topCount
  })

  const overrideOption = winnerOverride
    ? ordered.find((option) => option.text.toLowerCase() === winnerOverride.trim().toLowerCase()) ?? null
    : null

  const leader = overrideOption ?? (leaders.length === 1 ? leaders[0] : null)
  let rank = 0
  const ranks = new Map(
    ordered.map((option, index) => {
      const prev = ordered[index - 1]
      const sameAsPrev =
        index > 0 &&
        scoreOf(option) === scoreOf(prev) &&
        (!useContribution || option.count === prev.count)
      if (!sameAsPrev) rank = index + 1
      return [option.index, rank] as const
    }),
  )

  const gap = leader && ordered.length > 1 ? Math.max(0, scoreOf(leader) - scoreOf(ordered[1])) : 0

  return {
    ordered,
    leaders,
    leader,
    ranks,
    useContribution,
    total: options.reduce((sum, option) => sum + option.count, 0),
    totalContribution,
    gap,
    isTied: leaders.length > 1,
    hasOverrideWinner: !!overrideOption,
  }
}

export type VoteStandings = ReturnType<typeof getVoteStandings>

export function voteOutcomeLabel(
  standings: VoteStandings,
  isEnding: boolean,
  options?: { isPaused?: boolean; winnerByDraw?: boolean },
): string {
  if (options?.isPaused && !isEnding) return '投票已暂停'
  if (standings.total === 0) return isEnding ? '无人投票' : '等待投票'
  if (!standings.leader) return isEnding ? '并列第一' : '平票'
  if (isEnding) {
    return options?.winnerByDraw || standings.hasOverrideWinner
      ? `抽签胜出：${standings.leader.text}`
      : `胜出：${standings.leader.text}`
  }
  if (standings.useContribution) {
    return `领先第二名 ${formatContribution(standings.gap)}`
  }
  return `领先第二名 ${standings.gap} 票`
}
