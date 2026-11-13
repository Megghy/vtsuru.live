import { KeywordMatchType, QueueSortType } from '@/api/generated/model'

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
}

/**
 * 按队列排序策略对列表排序, 队列与点播共用。
 * 插队优先级永远优先；同优先级内再按指定排序策略比较。
 * 舰长等级原始值越小代表越高 (1 总督 > 2 提督 > 3 舰长 > 0 普通), 排序时把 0/空映射为 4 置后。
 */
export function sortByQueueType<T>(
  items: readonly T[],
  sortType: QueueSortType | undefined,
  isReverse: boolean,
  accessor: QueueSortAccessor<T>,
): T[] {
  const result = [...items].toSorted((a, b) => {
    const priorityDiff = (accessor.priorityLevel?.(b) ?? 0) - (accessor.priorityLevel?.(a) ?? 0)
    if (priorityDiff !== 0) return priorityDiff

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
  })

  return isReverse ? result.toReversed() : result
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
