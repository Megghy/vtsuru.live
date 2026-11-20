import { KeywordMatchType, QueueSortType } from '@/api/generated/model'

export function normalizeTimestampMs(ts?: number | null): number {
  if (!ts) return 0
  return ts < 1e12 ? ts * 1000 : ts
}

/** 舰长等级对应主题色 (1 总督 / 2 提督 / 3 舰长), 其它返回次要文本色 */
export function getGuardColor(level: number | null | undefined): string {
  switch (level) {
    case 1:
      return 'rgb(122, 4, 35)'
    case 2:
      return 'rgb(157, 155, 255)'
    case 3:
      return 'rgb(104, 136, 241)'
    default:
      return 'var(--muted-foreground)'
  }
}

/** SC 金额对应标准色阶，供点播管理与历史共用 */
export function getSCColor(price: number | null | undefined): string {
  if (!price) return 'var(--muted-foreground)'
  if (price >= 2000) return '#AB1A32'
  if (price >= 1000) return '#E54D4D'
  if (price >= 500) return '#E09443'
  if (price >= 100) return '#E2B52B'
  if (price >= 50) return '#427D9E'
  return '#2A60B2'
}

/**
 * 把名单格式化为可复制的纯文本, 队列/点歌共用。
 * 形如 `1. 用户名` 或 `1. 用户名 - 歌名`, 每行一条, 自动编号。
 */
export function formatListForCopy<T>(
  items: T[],
  getPrimary: (item: T) => string,
  getSecondary?: (item: T) => string | undefined | null,
): string {
  return items
    .map((item, i) => {
      const primary = getPrimary(item)?.trim() || '未知'
      const secondary = getSecondary?.(item)?.trim()
      return secondary ? `${i + 1}. ${primary} - ${secondary}` : `${i + 1}. ${primary}`
    })
    .join('\n')
}

/** 排序时用于读取每一项关键字段的取值器 */
export interface QueueSortAccessor<T> {
  createAt: (item: T) => number
  guardLevel: (item: T) => number | null | undefined
  price: (item: T) => number | null | undefined
  fansMedalLevel: (item: T) => number | null | undefined
  /** 仅粉丝牌排序需要: 是否佩戴粉丝牌 */
  fansMedalWearing?: (item: T) => boolean | null | undefined
  /** 积分插队优先级（降序，数值越大越靠前） */
  priorityLevel?: (item: T) => number | null | undefined
  /** 手动排序权重（升序，存在非空值的记录优先于规则排序） */
  sortOrder?: (item: T) => number | null | undefined
}

function compareByQueueRule<T>(
  a: T,
  b: T,
  sortType: QueueSortType | undefined,
  accessor: QueueSortAccessor<T>,
): number {
  switch (sortType) {
    case QueueSortType.GuardFirst: {
      const guardDiff = (accessor.guardLevel(a) || 4) - (accessor.guardLevel(b) || 4)
      if (guardDiff !== 0) return guardDiff
      break
    }
    case QueueSortType.PaymentFist: {
      const priceDiff = (accessor.price(b) ?? 0) - (accessor.price(a) ?? 0)
      if (priceDiff !== 0) return priceDiff
      break
    }
    case QueueSortType.FansMedalFirst: {
      const wearingDiff = (accessor.fansMedalWearing?.(b) ? 1 : 0) - (accessor.fansMedalWearing?.(a) ? 1 : 0)
      if (wearingDiff !== 0) return wearingDiff
      const medalDiff = (accessor.fansMedalLevel(b) ?? 0) - (accessor.fansMedalLevel(a) ?? 0)
      if (medalDiff !== 0) return medalDiff
      break
    }
    case QueueSortType.TimeFirst:
    default:
      break
  }

  return accessor.createAt(a) - accessor.createAt(b)
}

/**
 * 按队列排序策略对列表排序, 队列与点播共用。
 * 手动调序 (sortOrder) 优先级最高且不受倒序影响；其后是插队优先级（始终高优先级在前）；同级内再按规则与倒序设置比较。
 * 舰长等级原始值越小代表越高 (1 总督 > 2 提督 > 3 舰长 > 0 普通), 排序时把 0/空映射为 4 置后。
 */
export function sortByQueueType<T>(
  items: readonly T[],
  sortType: QueueSortType | undefined,
  isReverse: boolean,
  accessor: QueueSortAccessor<T>,
): T[] {
  return [...items].toSorted((a, b) => {
    const orderA = accessor.sortOrder?.(a)
    const orderB = accessor.sortOrder?.(b)
    const hasA = orderA !== null && orderA !== undefined
    const hasB = orderB !== null && orderB !== undefined
    if (hasA && hasB) {
      if (orderA !== orderB) return orderA - orderB
      const manualPriorityDiff = (accessor.priorityLevel?.(b) ?? 0) - (accessor.priorityLevel?.(a) ?? 0)
      if (manualPriorityDiff !== 0) return manualPriorityDiff
      return compareByQueueRule(a, b, sortType, accessor)
    }
    if (hasA !== hasB) return hasA ? -1 : 1

    const priorityDiff = (accessor.priorityLevel?.(b) ?? 0) - (accessor.priorityLevel?.(a) ?? 0)
    if (priorityDiff !== 0) return priorityDiff

    const ruleDiff = compareByQueueRule(a, b, sortType, accessor)
    if (ruleDiff === 0) return 0
    return isReverse ? -ruleDiff : ruleDiff
  })
}

/** 关键词匹配, 弹幕队列/点播共用。Regex 模式用原始 keyword 构造正则 */
export function matchKeyword(text: string, keyword: string, matchType: KeywordMatchType): boolean {
  const key = keyword.trim()
  if (!key) return false

  switch (matchType) {
    case KeywordMatchType.Full:
      return text.trim().toLowerCase() === key.toLowerCase()
    case KeywordMatchType.Contains:
      return text.trim().toLowerCase().includes(key.toLowerCase())
    case KeywordMatchType.Regex:
      try {
        return new RegExp(keyword).test(text)
      } catch (e) {
        console.warn('[queue] 正则表达式无效:', keyword, e)
        return false
      }
    default:
      return false
  }
}
