import { onScopeDispose, ref, watch } from 'vue'

import type { VoteOBSData } from '@/api/api-models'

import { getVoteStandings } from './voteStandings'

export type RankMove = 'up' | 'down'
const MOVE_HOLD_MS = 1100

export function computeRankMoves(previous: Map<number, number>, current: Map<number, number>) {
  const moves: Record<number, RankMove> = {}
  for (const [id, rank] of current) {
    const before = previous.get(id)
    if (before !== undefined && before !== rank) moves[id] = rank < before ? 'up' : 'down'
  }
  return moves
}

/** 数字与胜负同时落位，动画只表现位置变化，避免补间票数与领先提示互相矛盾。 */
export function useVoteCardMotion(data: () => VoteOBSData | null) {
  const moves = ref<Record<number, RankMove>>({})
  const overtaking = ref<number | null>(null)
  let previousRanks = new Map<number, number>()
  let sessionId: number | undefined
  let lastLeader: number | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  function clearFeedback() {
    clearTimeout(timer)
    moves.value = {}
    overtaking.value = null
  }

  watch(
    data,
    (snapshot) => {
      if (snapshot?.sessionId !== sessionId || !snapshot?.showResults || snapshot.isEnding) {
        clearFeedback()
        previousRanks.clear()
        lastLeader = undefined
        sessionId = snapshot?.sessionId
      }
      if (!snapshot?.showResults || snapshot.isEnding) return

      const standings = getVoteStandings(snapshot.options)
      const nextMoves = computeRankMoves(previousRanks, standings.ranks)
      previousRanks = standings.ranks
      const nextLeader = standings.leader?.index
      const didOvertake = nextLeader !== undefined && lastLeader !== undefined && nextLeader !== lastLeader

      // 平票不算反超，但保留此前领先者，以识别「落后 → 追平 → 反超」。
      if (nextLeader !== undefined) lastLeader = nextLeader
      if (!standings.total) lastLeader = undefined
      if (overtaking.value !== nextLeader) overtaking.value = null
      if (didOvertake || Object.keys(nextMoves).length > 0) {
        clearFeedback()
        moves.value = nextMoves
        overtaking.value = didOvertake ? (nextLeader ?? null) : null
        timer = setTimeout(clearFeedback, MOVE_HOLD_MS)
      }
    },
    { immediate: true, deep: true },
  )

  onScopeDispose(clearFeedback)
  return { moves, overtaking }
}
