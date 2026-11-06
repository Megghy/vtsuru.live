import type { ResponseQAInfo } from '@/api/generated/model'

export interface QuestionThread<T extends ResponseQAInfo> {
  root: T
  followUps: T[]
}

/** 按首条提问聚合追问, 保持 list 中首条的原有顺序; 首条缺失的追问单独成组 */
export function groupQuestionThreads<T extends ResponseQAInfo>(list: T[]): QuestionThread<T>[] {
  const ids = new Set(list.map((q) => q.id))
  const followUps = Map.groupBy(
    list.filter((q) => q.threadRootId && ids.has(q.threadRootId)),
    (q) => q.threadRootId!,
  )
  return list
    .filter((q) => !q.threadRootId || !ids.has(q.threadRootId))
    .map((root) => ({ root, followUps: (followUps.get(root.id) ?? []).toSorted((a, b) => a.sendAt - b.sendAt) }))
}

/** 某条追问之前的同线程内容 (首条 + 更早的追问), 按时间先后 */
export function threadContextOf<T extends ResponseQAInfo>(list: T[], item: T): T[] {
  const rootId = item.threadRootId
  if (!rootId) return []
  return list
    .filter((q) => q.id === rootId || (q.threadRootId === rootId && q.sendAt < item.sendAt))
    .toSorted((a, b) => a.sendAt - b.sendAt)
}
