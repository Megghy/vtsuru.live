import type { EventModel } from '@/api/client-types'
import { EventDataTypes, GuardLevel } from '@/api/generated/model'

import type {
  GiftEntry,
  GiftWindowSettings,
  OnlineGuardEntry,
  OnlineViewerEntry,
  RankEntry,
  ThankSummaryItem,
  UserActivityState,
} from './giftWindowTypes'

export function isUserOnlineByThreshold(lastActiveTime: number, onlineThresholdMinutes: number): boolean {
  if (!lastActiveTime) return false
  const thresholdMs = (onlineThresholdMinutes || 20) * 60 * 1000
  return Date.now() - lastActiveTime <= thresholdMs
}

export function sortGiftEntries(list: GiftEntry[], settings: GiftWindowSettings): GiftEntry[] {
  const copy = [...list]
  switch (settings.sortBy) {
    case 'price':
      copy.sort((a, b) => b.totalPrice - a.totalPrice)
      break
    case 'num':
      copy.sort((a, b) => b.totalNum - a.totalNum)
      break
    default:
      copy.sort((a, b) => b.lastUpdateTime - a.lastUpdateTime)
      break
  }
  if (settings.reverseOrder) copy.reverse()
  return copy
}

export function buildRankedList(
  rankMap: Map<string, RankEntry>,
  userActivityMap: Map<string, UserActivityState>,
  settings: GiftWindowSettings,
): RankEntry[] {
  const list = Array.from(rankMap.values()).map((item) => {
    const act = userActivityMap.get(item.id)
    const lastActive = Math.max(item.lastActiveTime || 0, act?.lastActiveTime || 0)
    const guardLevel = item.guardLevel > 0 ? item.guardLevel : (act?.guardLevel ?? GuardLevel.None)
    return {
      ...item,
      guardLevel,
      lastActiveTime: lastActive,
      isOnline: isUserOnlineByThreshold(lastActive, settings.onlineThresholdMinutes),
    }
  })

  return list.toSorted((a, b) => b.score - a.score).slice(0, settings.rankDisplayCount || 50)
}

export function buildOnlineGuardList(
  rankMap: Map<string, RankEntry>,
  userActivityMap: Map<string, UserActivityState>,
  rankedList: RankEntry[],
  onlineThresholdMinutes: number,
): OnlineGuardEntry[] {
  const rankIndexMap = new Map<string, number>()
  rankedList.forEach((r, idx) => rankIndexMap.set(r.id, idx + 1))

  const list: OnlineGuardEntry[] = []
  for (const [id, act] of userActivityMap.entries()) {
    if (act.guardLevel > 0 && isUserOnlineByThreshold(act.lastActiveTime, onlineThresholdMinutes)) {
      const rankItem = rankMap.get(id)
      list.push({
        id,
        uid: act.uid,
        uname: act.uname,
        uface: act.uface,
        guardLevel: act.guardLevel,
        lastActiveTime: act.lastActiveTime,
        lastAction: act.lastAction,
        totalPaid: rankItem?.totalPaid || 0,
        rankIndex: rankIndexMap.get(id),
      })
    }
  }

  list.sort((a, b) => (a.guardLevel !== b.guardLevel ? a.guardLevel - b.guardLevel : b.lastActiveTime - a.lastActiveTime))
  return list
}

export function buildThankSummaryList(
  ranked: RankEntry[],
  onlineGuards: OnlineGuardEntry[],
): ThankSummaryItem[] {
  const rankedIds = new Set(ranked.map((r) => r.id))
  const items: ThankSummaryItem[] = ranked.map((r, idx) => ({
    id: r.id,
    uid: r.uid,
    uname: r.uname,
    uface: r.uface,
    totalPaid: r.totalPaid,
    guardLevel: r.guardLevel,
    isOnline: r.isOnline,
    lastActiveTime: r.lastActiveTime,
    isTopRank: true,
    rankIndex: idx + 1,
    isGuardOnly: false,
  }))

  for (const g of onlineGuards) {
    if (rankedIds.has(g.id)) continue
    items.push({
      id: g.id,
      uid: g.uid,
      uname: g.uname,
      uface: g.uface,
      totalPaid: g.totalPaid,
      guardLevel: g.guardLevel,
      isOnline: true,
      lastActiveTime: g.lastActiveTime,
      isTopRank: false,
      isGuardOnly: true,
    })
  }

  return items
}

export function buildOnlineViewerList(
  userActivityMap: Map<string, UserActivityState>,
  onlineThresholdMinutes: number,
): OnlineViewerEntry[] {
  const list: OnlineViewerEntry[] = []
  const now = Date.now()
  const thresholdMs = (onlineThresholdMinutes || 20) * 60 * 1000

  for (const [id, act] of userActivityMap.entries()) {
    const isOnline = now - act.lastActiveTime < thresholdMs
    if (!isOnline && act.lastAction === '在线黑听') continue
    list.push({
      id,
      uid: act.uid,
      uname: act.uname,
      uface: act.uface,
      guardLevel: act.guardLevel,
      isFormerGuard: Boolean(act.isFormerGuard),
      medalName: act.medalName,
      medalLevel: act.medalLevel,
      score: act.score,
      isOnline,
      lastActiveTime: act.lastActiveTime,
      lastAction: act.lastAction,
    })
  }

  list.sort((a, b) => {
    if (a.guardLevel > 0 && b.guardLevel > 0) {
      if (a.guardLevel !== b.guardLevel) return a.guardLevel - b.guardLevel
    } else if (a.guardLevel > 0) {
      return -1
    } else if (b.guardLevel > 0) {
      return 1
    }

    if (a.isFormerGuard !== b.isFormerGuard) return a.isFormerGuard ? -1 : 1
    const medalDiff = (b.medalLevel || 0) - (a.medalLevel || 0)
    if (medalDiff !== 0) return medalDiff
    return b.lastActiveTime - a.lastActiveTime
  })

  return list
}

export function createMockGiftEvent(): EventModel {
  const types = [EventDataTypes.Gift, EventDataTypes.SC, EventDataTypes.Guard]
  const t = types[Math.floor(Math.random() * types.length)]
  const gifts = ['小花花', '辣条', '能量饮料', '小星星', '告白气球']
  const mockUid = Math.floor(Math.random() * 100000)
  const guardLevel =
    t === EventDataTypes.Guard
      ? [GuardLevel.Zongdu, GuardLevel.Tidu, GuardLevel.Jianzhang][Math.floor(Math.random() * 3)]
      : GuardLevel.None

  const priceYuan =
    t === EventDataTypes.SC
      ? [30, 50, 100, 500][Math.floor(Math.random() * 4)]
      : t === EventDataTypes.Guard
        ? guardLevel === GuardLevel.Zongdu
          ? 19998
          : guardLevel === GuardLevel.Tidu
            ? 1998
            : 198
        : [0.1, 1, 5, 19.9][Math.floor(Math.random() * 4)]

  return {
    type: t,
    uid: mockUid,
    uname: `测试用户${Math.floor(Math.random() * 100)}`,
    uface: 'https://i0.hdslb.com/bfs/face/member/noface.jpg',
    msg:
      t === EventDataTypes.Guard
        ? `开通了${guardLevel === GuardLevel.Zongdu ? '总督' : guardLevel === GuardLevel.Tidu ? '提督' : '舰长'}`
        : t === EventDataTypes.SC
          ? '感谢主播！'
          : gifts[Math.floor(Math.random() * gifts.length)],
    num: t === EventDataTypes.Gift ? Math.floor(Math.random() * 20) + 1 : 1,
    price: priceYuan,
    guard_level: guardLevel,
    open_id: '',
    time: Date.now(),
    fans_medal_level: 0,
    fans_medal_name: '',
    fans_medal_wearing_status: false,
    ouid: String(mockUid),
  }
}
