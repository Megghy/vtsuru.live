import { EventDataTypes, GuardLevel } from '@/api/generated/model'

import type { GoalMilestone, GoalState } from './types'

export interface GoalIncomingEvent {
  type: EventDataTypes
  /** 折合人民币元数 */
  priceYuan: number
  guardLevel?: GuardLevel
  num?: number
  /** 礼物名称（用于单品礼物计数匹配） */
  giftName?: string
}

export interface GoalPatchResult {
  patch: Partial<GoalState>
  addedProgress: number
  addedSeconds: number
  deltaText: string
}

/** 计算进度条填充百分比 (0~100) */
export function computeGoalProgressPercent(current: number, target: number): number {
  if (!target || target <= 0) return 0
  return Math.min(100, Math.max(0, (current / target) * 100))
}

/** 格式化剩余倒计时 (HH:MM:SS) */
export function formatCountdownClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':')
}

/** 返回按目标值升序排列的有效里程碑 */
export function getSortedMilestones(milestones?: GoalMilestone[]): GoalMilestone[] {
  if (!milestones?.length) return []
  return milestones
    .filter((m) => Number.isFinite(m.target) && m.target > 0 && m.label.trim().length > 0)
    .toSorted((a, b) => a.target - b.target)
}

/** 获取下一个尚未达成的里程碑 */
export function getNextMilestone(current: number, milestones?: GoalMilestone[]): GoalMilestone | null {
  const sorted = getSortedMilestones(milestones)
  return sorted.find((m) => current < m.target) ?? null
}

/** 根据传入直播事件计算 Goal / Subathon 状态增量 */
export function computeGoalEventDelta(
  state: GoalState,
  event: GoalIncomingEvent,
  now = Date.now(),
): GoalPatchResult | null {
  const count = Math.max(1, event.num ?? 1)
  const priceYuan = Math.max(0, event.priceYuan || 0)

  let addedProgress = 0
  if (state.mode !== 'subathon') {
    if (state.metric === 'guard' && event.type === EventDataTypes.Guard) {
      addedProgress = count
    } else if (
      state.metric === 'amount' &&
      (event.type === EventDataTypes.Gift || event.type === EventDataTypes.SC || event.type === EventDataTypes.Guard)
    ) {
      addedProgress = Number(priceYuan.toFixed(2))
    } else if (state.metric === 'gift_count' && event.type === EventDataTypes.Gift) {
      const keyword = state.targetGiftName?.trim().toLowerCase()
      const name = (event.giftName ?? '').toLowerCase()
      if (!keyword || name.includes(keyword)) {
        addedProgress = count
      }
    } else if (state.metric === 'likes' && event.type === EventDataTypes.Like) {
      addedProgress = count
    } else if (state.metric === 'fans' && event.type === EventDataTypes.Follow) {
      addedProgress = count
    }
  }

  let addedSeconds = 0
  if (state.mode === 'subathon' || state.mode === 'combo') {
    if (event.type === EventDataTypes.Guard) {
      if (event.guardLevel === GuardLevel.Zongdu) {
        addedSeconds = Math.round(state.secondsPerZongdu * count)
      } else if (event.guardLevel === GuardLevel.Tidu) {
        addedSeconds = Math.round(state.secondsPerTidu * count)
      } else {
        addedSeconds = Math.round(state.secondsPerJianzhang * count)
      }
    } else if ((event.type === EventDataTypes.Gift || event.type === EventDataTypes.SC) && priceYuan > 0) {
      addedSeconds = Math.round(priceYuan * Math.max(0, state.secondsPerYuan))
    }
  }

  if (addedProgress <= 0 && addedSeconds <= 0) {
    return null
  }

  const nextCurrent = state.allowOverflow
    ? Number((state.current + addedProgress).toFixed(2))
    : Math.min(state.target > 0 ? state.target : Infinity, Number((state.current + addedProgress).toFixed(2)))

  const parts: string[] = []
  if (addedProgress > 0) parts.push(`+${addedProgress}${state.unit ? ` ${state.unit}` : ''}`)
  if (addedSeconds > 0) {
    const mins = Math.floor(addedSeconds / 60)
    const secs = addedSeconds % 60
    parts.push(mins > 0 && secs === 0 ? `+${mins}m` : `+${addedSeconds}s`)
  }
  const deltaText = parts.join(' / ')

  const patch: Partial<GoalState> = {
    current: nextCurrent,
    lastDeltaTick: now,
    lastDeltaText: deltaText,
  }

  if (addedSeconds > 0) {
    const addMs = addedSeconds * 1000
    if (state.countdownPaused) {
      patch.pausedRemainingMs = Math.max(0, state.pausedRemainingMs) + addMs
    } else {
      const baseEnd = Math.max(now, state.countdownEndAt || now)
      patch.countdownEndAt = baseEnd + addMs
    }
  }

  return {
    patch,
    addedProgress,
    addedSeconds,
    deltaText,
  }
}

/** 计算当前可见剩余毫秒数 */
export function getVisibleRemainingMs(state: GoalState, now = Date.now()): number {
  if (state.countdownPaused) {
    return Math.max(0, state.pausedRemainingMs)
  }
  return Math.max(0, state.countdownEndAt - now)
}
