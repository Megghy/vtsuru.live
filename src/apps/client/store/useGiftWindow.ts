import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref, watch } from 'vue'

import type {
  EventModel,
  ResponseCurrentLiveModel,
  ResponseLiveInfoModel,
  ResponseLiveRankingEntryModel,
} from '@/api/api-models'
import { EventDataTypes, GuardLevel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { LIVE_API_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { postBroadcastMessage } from '@/shared/utils/broadcastChannel'
import { useDanmakuClient } from '@/store/useDanmakuClient'

export type GiftSortBy = 'time' | 'price' | 'num'
export type GiftFilterType = 'Gift' | 'SC' | 'Guard'
export type RankViewMode = 'thank_summary' | 'rank' | 'online_guard'

export interface GiftWindowSettings {
  width: number
  height: number
  x: number
  y: number
  opacity: number
  fontSize: number
  backgroundColor: string
  windowBackgroundColor: string
  textColor: string
  highlightColor: string
  alwaysOnTop: boolean
  interactive: boolean
  borderRadius: number
  itemSpacing: number
  maxItemCount: number
  autoDisappearTime: number
  mergeWindowSeconds: number
  showAvatar: boolean
  showPrice: boolean
  showTime: boolean
  filterTypes: GiftFilterType[]
  sortBy: GiftSortBy
  minPrice: number
  reverseOrder: boolean
  compactMode: boolean
  showGiftList: boolean
  showRanking: boolean
  rankDisplayCount: number
  rankViewMode: RankViewMode
  showScrollbar: boolean
  onlineThresholdMinutes: number
  contentProtected?: boolean
}

export interface GiftEntry {
  id: string
  uid: number
  uname: string
  uface: string
  giftName: string
  giftIcon?: string
  totalNum: number
  totalPrice: number
  type: EventDataTypes
  guardLevel: GuardLevel
  firstTime: number
  lastUpdateTime: number
  disappearAt?: number
}

export const GIFT_WINDOW_BROADCAST_CHANNEL = 'channel.gift.window'

export interface RankEntry {
  id: string
  uid: number
  uname: string
  uface: string
  totalPaid: number
  score: number
  guardLevel: GuardLevel
  isOnline: boolean
  lastActiveTime: number
}

export interface OnlineGuardEntry {
  id: string
  uid: number
  uname: string
  uface: string
  guardLevel: GuardLevel
  lastActiveTime: number
  lastAction: string
  totalPaid: number
  rankIndex?: number
}

export interface ThankSummaryItem {
  id: string
  uid: number
  uname: string
  uface: string
  totalPaid: number
  guardLevel: GuardLevel
  isOnline: boolean
  lastActiveTime: number
  isTopRank: boolean
  rankIndex?: number
  isGuardOnly: boolean
}

export type GiftWindowBCData =
  | { type: 'gift-list'; data: GiftEntry[] }
  | { type: 'rank-list'; data: RankEntry[] }
  | { type: 'online-guard-list'; data: OnlineGuardEntry[] }
  | { type: 'update-setting'; data: GiftWindowSettings }
  | { type: 'window-ready' }
  | { type: 'clear' }

interface UserActivityState {
  id: string
  uid: number
  uname: string
  uface: string
  guardLevel: GuardLevel
  lastActiveTime: number
  lastAction: string
}

const TYPE_TO_FILTER: Partial<Record<EventDataTypes, GiftFilterType>> = {
  [EventDataTypes.Gift]: 'Gift',
  [EventDataTypes.SC]: 'SC',
  [EventDataTypes.Guard]: 'Guard',
}

export const useGiftWindow = defineStore('giftWindow', () => {
  const giftWindow = ref<WebviewWindow>()
  const settings = usePersistedStorage<GiftWindowSettings>('Setting.GiftWindow', {
    width: 340,
    height: 560,
    x: 100,
    y: 100,
    opacity: 0.95,
    fontSize: 14,
    backgroundColor: 'rgba(20,20,30,0.85)',
    windowBackgroundColor: 'rgba(10,10,20,0.6)',
    textColor: '#ffffff',
    highlightColor: '#fbbf24',
    alwaysOnTop: true,
    interactive: false,
    borderRadius: 10,
    itemSpacing: 8,
    maxItemCount: 30,
    autoDisappearTime: 60,
    mergeWindowSeconds: 10,
    showAvatar: true,
    showPrice: true,
    showTime: true,
    filterTypes: ['Gift', 'SC', 'Guard'],
    sortBy: 'time',
    minPrice: 0,
    reverseOrder: false,
    compactMode: false,
    showGiftList: true,
    showRanking: true,
    rankDisplayCount: 50,
    rankViewMode: 'thank_summary',
    showScrollbar: true,
    onlineThresholdMinutes: 20,
    contentProtected: false,
  })

  const danmakuClient = useDanmakuClient()
  const isWindowOpened = ref(false)
  const giftList = ref<GiftEntry[]>([])
  const rankMap = ref(new Map<string, RankEntry>())
  const userActivityMap = ref(new Map<string, UserActivityState>())
  const currentLive = ref<ResponseLiveInfoModel | null>(null)
  let bc: BroadcastChannel | undefined
  let isInited = false
  let isSyncingLive = false

  function closeWindow() {
    giftWindow.value?.hide()
    isWindowOpened.value = false
  }

  function openWindow() {
    if (!isInited) init()
    applyWindowSettings()
    giftWindow.value?.show()
    isWindowOpened.value = true
  }

  function setSize(width: number, height: number) {
    settings.value.width = width
    settings.value.height = height
    giftWindow.value?.setSize(new PhysicalSize(width, height))
  }

  function setPosition(x: number, y: number) {
    settings.value.x = x
    settings.value.y = y
    giftWindow.value?.setPosition(new PhysicalPosition(x, y))
  }

  function updateWindowPosition() {
    giftWindow.value?.setPosition(new PhysicalPosition(settings.value.x, settings.value.y))
  }

  async function applyWindowSettings() {
    await giftWindow.value?.setAlwaysOnTop(settings.value.alwaysOnTop)
    await giftWindow.value?.setIgnoreCursorEvents(settings.value.interactive)
    await giftWindow.value?.setContentProtected(settings.value.contentProtected ?? false)
  }

  function resolveUserId(data: EventModel): string {
    return data.ouid || (data.uid > 0 ? String(data.uid) : '')
  }

  function recordUserActivity(data: EventModel, actionName = '活跃') {
    const id = resolveUserId(data)
    if (!id) return

    const now = data.time > 0 ? data.time : Date.now()
    const existing = userActivityMap.value.get(id)
    const guardLevel = data.guard_level && data.guard_level > 0 ? data.guard_level : existing?.guardLevel ?? GuardLevel.None

    userActivityMap.value.set(id, {
      id,
      uid: data.uid,
      uname: data.uname || existing?.uname || `用户${data.uid}`,
      uface: data.uface || existing?.uface || '',
      guardLevel,
      lastActiveTime: now,
      lastAction: actionName,
    })

    // 同步更新 rankMap 里的用户信息与在线状态
    const rankItem = rankMap.value.get(id)
    if (rankItem) {
      if (data.uname) rankItem.uname = data.uname
      if (data.uface) rankItem.uface = data.uface
      if (guardLevel > 0) rankItem.guardLevel = guardLevel
      rankItem.lastActiveTime = now
      rankItem.isOnline = true
    }
  }

  function onGiftEvent(data: EventModel) {
    if (!isWindowOpened.value) return

    const filterKey = TYPE_TO_FILTER[data.type]
    if (!filterKey || !settings.value.filterTypes.includes(filterKey)) return

    const price = data.price
    if (price < settings.value.minPrice) return

    const now = Date.now()
    const mergeMs = settings.value.mergeWindowSeconds * 1000

    const existing =
      data.type === EventDataTypes.Gift
        ? giftList.value.find(
            (e) =>
              e.uid === data.uid &&
              e.type === EventDataTypes.Gift &&
              e.giftName === data.msg &&
              now - e.lastUpdateTime < mergeMs,
          )
        : undefined

    if (existing) {
      existing.totalNum += data.num || 1
      existing.totalPrice += price
      existing.lastUpdateTime = now
      if (settings.value.autoDisappearTime > 0) {
        existing.disappearAt = now + settings.value.autoDisappearTime * 1000
      }
    } else {
      const entry: GiftEntry = {
        id: `${data.uid}_${data.msg}_${now}`,
        uid: data.uid,
        uname: data.uname,
        uface: data.uface,
        giftName: data.msg,
        giftIcon: data.gift_icon,
        totalNum: data.num || 1,
        totalPrice: price,
        type: data.type,
        guardLevel: data.guard_level,
        firstTime: now,
        lastUpdateTime: now,
        disappearAt: settings.value.autoDisappearTime > 0 ? now + settings.value.autoDisappearTime * 1000 : undefined,
      }
      giftList.value.unshift(entry)
      if (giftList.value.length > settings.value.maxItemCount) {
        giftList.value.splice(settings.value.maxItemCount)
      }
    }

    sendGiftList()
  }

  function getSortedList(): GiftEntry[] {
    const list = [...giftList.value]
    switch (settings.value.sortBy) {
      case 'price':
        list.sort((a, b) => b.totalPrice - a.totalPrice)
        break
      case 'num':
        list.sort((a, b) => b.totalNum - a.totalNum)
        break
      default:
        list.sort((a, b) => b.lastUpdateTime - a.lastUpdateTime)
        break
    }
    if (settings.value.reverseOrder) list.reverse()
    return list
  }

  function sendGiftList() {
    postBroadcastMessage(bc, { type: 'gift-list', data: getSortedList() } satisfies GiftWindowBCData)
  }

  function updateRank(data: EventModel) {
    if (!currentLive.value) return
    const id = resolveUserId(data)
    if (!id) return

    const now = data.time > 0 ? data.time : Date.now()
    const activity = userActivityMap.value.get(id)
    const guardLevel = data.guard_level && data.guard_level > 0 ? data.guard_level : activity?.guardLevel ?? GuardLevel.None

    let entry = rankMap.value.get(id)
    if (!entry) {
      entry = {
        id,
        uid: data.uid,
        uname: data.uname,
        uface: data.uface,
        totalPaid: 0,
        score: 0,
        guardLevel,
        isOnline: true,
        lastActiveTime: now,
      }
      rankMap.value.set(id, entry)
    }
    entry.uname = data.uname || entry.uname
    entry.uface = data.uface || entry.uface
    if (guardLevel > 0) entry.guardLevel = guardLevel
    entry.lastActiveTime = now
    entry.isOnline = true

    if (data.type === EventDataTypes.Gift || data.type === EventDataTypes.SC || data.type === EventDataTypes.Guard) {
      entry.totalPaid += data.price
    }
    entry.score = entry.totalPaid
    sendRankList()
    sendOnlineGuardList()
  }

  function isUserOnline(lastActiveTime: number): boolean {
    if (!lastActiveTime) return false
    const thresholdMs = (settings.value.onlineThresholdMinutes || 20) * 60 * 1000
    return Date.now() - lastActiveTime <= thresholdMs
  }

  function getRankedList(): RankEntry[] {
    const list = Array.from(rankMap.value.values()).map((item) => {
      const act = userActivityMap.value.get(item.id)
      const lastActive = Math.max(item.lastActiveTime || 0, act?.lastActiveTime || 0)
      const guardLevel = item.guardLevel > 0 ? item.guardLevel : act?.guardLevel ?? GuardLevel.None
      return {
        ...item,
        guardLevel,
        lastActiveTime: lastActive,
        isOnline: isUserOnline(lastActive),
      }
    })

    return list
      .toSorted((a, b) => b.score - a.score)
      .slice(0, settings.value.rankDisplayCount || 50)
  }

  function getOnlineGuardList(): OnlineGuardEntry[] {
    const rankList = getRankedList()
    const rankIndexMap = new Map<string, number>()
    rankList.forEach((r, idx) => rankIndexMap.set(r.id, idx + 1))

    const list: OnlineGuardEntry[] = []

    for (const [id, act] of userActivityMap.value.entries()) {
      if (act.guardLevel > 0 && isUserOnline(act.lastActiveTime)) {
        const rankItem = rankMap.value.get(id)
        const totalPaid = rankItem?.totalPaid || 0
        list.push({
          id,
          uid: act.uid,
          uname: act.uname,
          uface: act.uface,
          guardLevel: act.guardLevel,
          lastActiveTime: act.lastActiveTime,
          lastAction: act.lastAction,
          totalPaid,
          rankIndex: rankIndexMap.get(id),
        })
      }
    }

    // 排序：总督 (1) > 提督 (2) > 舰长 (3)，同等级按最近活跃时间排序
    list.sort((a, b) => {
      if (a.guardLevel !== b.guardLevel) {
        return a.guardLevel - b.guardLevel
      }
      return b.lastActiveTime - a.lastActiveTime
    })

    return list
  }

  function getThankSummaryList(): ThankSummaryItem[] {
    const ranked = getRankedList()
    const onlineGuards = getOnlineGuardList()
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

    // 查找不在 Top 50 中的其他在场舰长
    const additionalGuards = onlineGuards.filter((g) => !rankedIds.has(g.id))
    for (const g of additionalGuards) {
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

  function sendRankList() {
    postBroadcastMessage(bc, { type: 'rank-list', data: getRankedList() } satisfies GiftWindowBCData)
  }

  function sendOnlineGuardList() {
    postBroadcastMessage(bc, { type: 'online-guard-list', data: getOnlineGuardList() } satisfies GiftWindowBCData)
  }

  function replaceRank(entries: ResponseLiveRankingEntryModel[]) {
    rankMap.value = new Map(
      entries.map((entry) => {
        const id = entry.ouId
        const act = userActivityMap.value.get(id)
        const lastActive = act?.lastActiveTime || 0
        return [
          id,
          {
            id,
            uid: 0,
            uname: entry.uName,
            uface: entry.uFace ?? '',
            totalPaid: entry.totalPaid,
            score: entry.totalPaid,
            guardLevel: act?.guardLevel ?? GuardLevel.None,
            isOnline: isUserOnline(lastActive),
            lastActiveTime: lastActive,
          },
        ]
      }),
    )
    sendRankList()
    sendOnlineGuardList()
  }

  async function syncCurrentLive() {
    if (isSyncingLive) return
    isSyncingLive = true
    try {
      const current = await QueryGetAPI<ResponseCurrentLiveModel>(`${LIVE_API_URL}current`)
      if (current.code !== 200) throw new Error(current.message)

      const nextLive = current.data.live
      const liveChanged = currentLive.value?.liveId !== nextLive?.liveId
      currentLive.value = nextLive
      if (liveChanged) {
        rankMap.value.clear()
        userActivityMap.value.clear()
        sendRankList()
        sendOnlineGuardList()
      }
      if (!nextLive) return

      const ranking = await QueryGetAPI<ResponseLiveRankingEntryModel[]>(`${LIVE_API_URL}ranking`, {
        liveId: nextLive.liveId,
        limit: Math.max(100, settings.value.rankDisplayCount || 50),
      })
      if (ranking.code !== 200) throw new Error(ranking.message)
      replaceRank(ranking.data)
    } catch (error) {
      console.warn('[GiftWindow] 同步当前场次排行失败', error)
    } finally {
      isSyncingLive = false
    }
  }

  function clearGifts() {
    giftList.value = []
    postBroadcastMessage(bc, { type: 'clear' } satisfies GiftWindowBCData)
  }

  function cleanupExpired() {
    if (settings.value.autoDisappearTime > 0 && giftList.value.length > 0) {
      const now = Date.now()
      const before = giftList.value.length
      giftList.value = giftList.value.filter((e) => !e.disappearAt || e.disappearAt > now)
      if (giftList.value.length !== before) sendGiftList()
    }
  }

  function refreshOnlineStatus() {
    // 定期刷新在线状态广播
    if (rankMap.value.size > 0 || userActivityMap.value.size > 0) {
      sendRankList()
      sendOnlineGuardList()
    }
  }

  async function init() {
    if (isInited) return
    giftWindow.value = (await getAllWebviewWindows()).find((w) => w.label === 'gift-window')
    if (!giftWindow.value) return

    giftWindow.value.onCloseRequested((event) => {
      event.preventDefault()
      closeWindow()
    })
    giftWindow.value.onMoved(({ payload: pos }) => {
      settings.value.x = pos.x
      settings.value.y = pos.y
    })
    giftWindow.value.onResized(({ payload: size }) => {
      settings.value.width = size.width
      settings.value.height = size.height
    })

    bc = new BroadcastChannel(GIFT_WINDOW_BROADCAST_CHANNEL)
    bc.onmessage = (event: MessageEvent<GiftWindowBCData>) => {
      if (event.data.type === 'window-ready') {
        postBroadcastMessage(bc, { type: 'update-setting', data: settings.value } satisfies GiftWindowBCData)
        sendGiftList()
        sendRankList()
        sendOnlineGuardList()
      }
    }
    postBroadcastMessage(bc, { type: 'window-ready' } satisfies GiftWindowBCData)
    postBroadcastMessage(bc, { type: 'update-setting', data: settings.value } satisfies GiftWindowBCData)

    // 全量事件监听以追踪用户在场活跃状态与大航海
    danmakuClient.onEvent('danmaku', (e) => recordUserActivity(e, '发弹幕'))
    danmakuClient.onEvent('enter', (e) => recordUserActivity(e, '进入直播间'))
    danmakuClient.onEvent('like', (e) => recordUserActivity(e, '点赞'))

    danmakuClient.onEvent('gift', (e) => {
      recordUserActivity(e, '送出礼物')
      onGiftEvent(e)
      updateRank(e)
    })
    danmakuClient.onEvent('sc', (e) => {
      recordUserActivity(e, '发送SC')
      onGiftEvent(e)
      updateRank(e)
    })
    danmakuClient.onEvent('guard', (e) => {
      recordUserActivity(e, '开通大航海')
      onGiftEvent(e)
      updateRank(e)
    })

    watch(
      () => settings,
      (v) => {
        postBroadcastMessage(bc, { type: 'update-setting', data: v.value } satisfies GiftWindowBCData)
        applyWindowSettings()
        sendGiftList()
        sendRankList()
        sendOnlineGuardList()
      },
      { deep: true },
    )

    setInterval(cleanupExpired, 1000)
    setInterval(refreshOnlineStatus, 15_000)
    void syncCurrentLive()
    setInterval(() => void syncCurrentLive(), 30_000)
    isInited = true
  }

  function sendTestGift() {
    const types = [EventDataTypes.Gift, EventDataTypes.SC, EventDataTypes.Guard]
    const t = types[Math.floor(Math.random() * types.length)]
    const gifts = ['小花花', '辣条', '能量饮料', '小星星', '告白气球']
    const mockUid = Math.floor(Math.random() * 100000)
    const mockEvent: EventModel = {
      type: t,
      uid: mockUid,
      uname: `测试用户${Math.floor(Math.random() * 100)}`,
      uface: 'https://i0.hdslb.com/bfs/face/member/noface.jpg',
      msg:
        t === EventDataTypes.Guard
          ? '开通了舰长'
          : t === EventDataTypes.SC
            ? '感谢主播！'
            : gifts[Math.floor(Math.random() * gifts.length)],
      num: t === EventDataTypes.Gift ? Math.floor(Math.random() * 20) + 1 : 1,
      price:
        t === EventDataTypes.SC
          ? [30, 50, 100, 500][Math.floor(Math.random() * 4)]
          : t === EventDataTypes.Guard
            ? 198
            : [100, 1000, 5000][Math.floor(Math.random() * 3)],
      guard_level: t === EventDataTypes.Guard ? [GuardLevel.Zongdu, GuardLevel.Tidu, GuardLevel.Jianzhang][Math.floor(Math.random() * 3)] : GuardLevel.None,
      open_id: '',
      time: Date.now(),
      fans_medal_level: 0,
      fans_medal_name: '',
      fans_medal_wearing_status: false,
      ouid: String(mockUid),
    }

    recordUserActivity(mockEvent, '测试送礼')
    onGiftEvent(mockEvent)
    updateRank(mockEvent)
  }

  return {
    giftWindow,
    settings,
    isGiftWindowOpen: isWindowOpened,
    giftList,
    rankMap,
    userActivityMap,
    currentLive,
    openWindow,
    closeWindow,
    setSize,
    setPosition,
    updateWindowPosition,
    clearGifts,
    sendTestGift,
    getRankedList,
    getOnlineGuardList,
    getThankSummaryList,
    init,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGiftWindow, import.meta.hot))
}
