import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { EventModel } from '@/api/client-types'
import { getApiLiveCurrent, getApiLiveRanking } from '@/api/generated/live/live'
import type { ResponseLiveInfoModel, ResponseLiveRankingEntryModel } from '@/api/generated/model'
import { EventDataTypes, GuardLevel } from '@/api/generated/model'
import { QueryBiliAPI } from '@/apps/client/data/utils'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { isTauri } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { postBroadcastMessage } from '@/shared/utils/broadcastChannel'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import { DEFAULT_OVERLAY_POSITION, ensureOverlayWindow, normalizePaidYuan } from '../utils/overlayWindow'
import type {
  GiftEntry,
  GiftFilterType,
  GiftSortBy,
  GiftWindowBCData,
  GiftWindowSettings,
  OnlineGuardEntry,
  OnlineViewerEntry,
  RankEntry,
  RankViewMode,
  ThankSummaryItem,
  UserActivityState,
} from './giftWindowTypes'
import { DEFAULT_GIFT_WINDOW_SETTINGS, GIFT_WINDOW_BROADCAST_CHANNEL } from './giftWindowTypes'
import {
  buildOnlineGuardList,
  buildOnlineViewerList,
  buildRankedList,
  buildThankSummaryList,
  createMockGiftEvent,
  isUserOnlineByThreshold,
  sortGiftEntries,
} from './giftWindowUtils'

export type {
  GiftEntry,
  GiftFilterType,
  GiftSortBy,
  GiftWindowBCData,
  GiftWindowSettings,
  OnlineGuardEntry,
  OnlineViewerEntry,
  RankEntry,
  RankViewMode,
  ThankSummaryItem,
}
export { GIFT_WINDOW_BROADCAST_CHANNEL }

const TYPE_TO_FILTER: Partial<Record<EventDataTypes, GiftFilterType>> = {
  [EventDataTypes.Gift]: 'Gift',
  [EventDataTypes.SC]: 'SC',
  [EventDataTypes.Guard]: 'Guard',
}

export const useGiftWindow = defineStore('giftWindow', () => {
  const giftWindow = ref<WebviewWindow>()
  const settings = usePersistedStorage<GiftWindowSettings>('Setting.GiftWindow', { ...DEFAULT_GIFT_WINDOW_SETTINGS })

  const danmakuClient = useDanmakuClient()
  const accountInfo = useAccount()
  const biliCookie = useBiliCookie()
  const isWindowOpened = ref(false)
  const giftList = ref<GiftEntry[]>([])
  const rankMap = ref(new Map<string, RankEntry>())
  const userActivityMap = ref(new Map<string, UserActivityState>())
  const formerGuardsSet = ref<Set<number>>(new Set())
  const currentLive = ref<ResponseLiveInfoModel | null>(null)

  let bc: BroadcastChannel | undefined
  let isInited = false
  let isSyncingLive = false
  let _goldRankTimerId: ReturnType<typeof setInterval> | null = null
  let _cleanupTimerId: ReturnType<typeof setInterval> | null = null
  let _refreshOnlineTimerId: ReturnType<typeof setInterval> | null = null
  let _syncLiveTimerId: ReturnType<typeof setInterval> | null = null
  let _moveResizeSaveTimer: ReturnType<typeof setTimeout> | null = null
  const storeUnlistens: Array<() => void> = []
  const windowUnlistens: Array<() => void> = []

  function clearWindowListeners() {
    for (const fn of windowUnlistens) fn()
    windowUnlistens.length = 0
  }

  onScopeDispose(() => {
    clearWindowListeners()
    for (const fn of storeUnlistens) fn()
    storeUnlistens.length = 0
    if (_goldRankTimerId) clearInterval(_goldRankTimerId)
    if (_cleanupTimerId) clearInterval(_cleanupTimerId)
    if (_refreshOnlineTimerId) clearInterval(_refreshOnlineTimerId)
    if (_syncLiveTimerId) clearInterval(_syncLiveTimerId)
    if (_moveResizeSaveTimer) clearTimeout(_moveResizeSaveTimer)
    _goldRankTimerId = null
    _cleanupTimerId = null
    _refreshOnlineTimerId = null
    _syncLiveTimerId = null
    _moveResizeSaveTimer = null
    bc?.close()
    bc = undefined
    isInited = false
  })

  async function applyWindowSettings() {
    await giftWindow.value?.setAlwaysOnTop(settings.value.alwaysOnTop)
    await giftWindow.value?.setIgnoreCursorEvents(settings.value.interactive)
    await giftWindow.value?.setContentProtected(settings.value.contentProtected ?? false)
  }

  async function bindWindowEvents(win: WebviewWindow) {
    clearWindowListeners()
    const debouncedPatch: Partial<Pick<GiftWindowSettings, 'x' | 'y' | 'width' | 'height'>> = {}
    const queueWindowPatch = (patch: Partial<Pick<GiftWindowSettings, 'x' | 'y' | 'width' | 'height'>>) => {
      Object.assign(debouncedPatch, patch)
      if (_moveResizeSaveTimer) clearTimeout(_moveResizeSaveTimer)
      _moveResizeSaveTimer = setTimeout(() => {
        _moveResizeSaveTimer = null
        Object.assign(settings.value, { ...debouncedPatch })
      }, 300)
    }

    windowUnlistens.push(
      await win.onCloseRequested((event) => {
        event.preventDefault()
        void closeWindow()
      }),
      await win.onMoved(({ payload: pos }) => queueWindowPatch({ x: pos.x, y: pos.y })),
      await win.onResized(({ payload: size }) => queueWindowPatch({ width: size.width, height: size.height })),
    )
  }

  async function openWindow() {
    if (!isInited) init()
    try {
      const s = settings.value
      const win = await ensureOverlayWindow({
        label: 'gift-window',
        url: 'gift-window',
        title: 'VTsuru 礼物窗口',
        width: s.width || 340,
        height: s.height || 560,
        x: s.x ?? DEFAULT_OVERLAY_POSITION.x,
        y: s.y ?? DEFAULT_OVERLAY_POSITION.y,
        resizable: true,
        alwaysOnTop: s.alwaysOnTop,
      })
      if (!win) return
      giftWindow.value = win
      await bindWindowEvents(win)
      await applyWindowSettings()
      void fetchOnlineGoldRank()
      await win.show()
      isWindowOpened.value = true
      postBroadcastMessage(bc, { type: 'update-setting', data: s } satisfies GiftWindowBCData)
      sendGiftList()
      sendRankList()
      sendOnlineGuardList()
      sendOnlineViewerList()
    } catch (err) {
      toast.error('打开礼物窗口失败', { description: String(err) })
    }
  }

  async function closeWindow() {
    isWindowOpened.value = false
    clearWindowListeners()
    const win = giftWindow.value
    giftWindow.value = undefined
    if (win) {
      await win.destroy().catch(() => win.hide().catch(() => {}))
    }
  }

  function setSize(width: number, height: number) {
    settings.value.width = width
    settings.value.height = height
    void giftWindow.value?.setSize(new PhysicalSize(width, height))
  }

  function setPosition(x: number, y: number) {
    settings.value.x = x
    settings.value.y = y
    void giftWindow.value?.setPosition(new PhysicalPosition(x, y))
  }

  function updateWindowPosition() {
    void giftWindow.value?.setPosition(new PhysicalPosition(settings.value.x, settings.value.y))
  }

  function resolveUserId(data: EventModel): string {
    return data.ouid || (data.uid > 0 ? String(data.uid) : '')
  }

  function recordUserActivity(data: EventModel, actionName = '活跃') {
    const id = resolveUserId(data)
    if (!id) return

    const now = data.time > 0 ? data.time : Date.now()
    const existing = userActivityMap.value.get(id)
    const guardLevel =
      data.guard_level && data.guard_level > 0 ? data.guard_level : (existing?.guardLevel ?? GuardLevel.None)
    if (guardLevel > 0 && data.uid) formerGuardsSet.value.add(data.uid)

    const uid = data.uid || existing?.uid || 0
    const wasGuard = (uid > 0 && formerGuardsSet.value.has(uid)) || existing?.isFormerGuard || false

    userActivityMap.value.set(id, {
      id,
      uid,
      uname: data.uname || existing?.uname || `用户${data.uid || id}`,
      uface: data.uface || existing?.uface || '',
      guardLevel,
      isFormerGuard: guardLevel === GuardLevel.None && wasGuard,
      medalName: data.fans_medal_name || existing?.medalName,
      medalLevel: data.fans_medal_level || existing?.medalLevel,
      score: existing?.score || 0,
      lastActiveTime: now,
      lastAction: actionName,
    })

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

    const priceYuan = normalizePaidYuan(data.price)
    if (priceYuan < settings.value.minPrice) return

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
      existing.totalPrice = Math.round((existing.totalPrice + priceYuan) * 100) / 100
      existing.lastUpdateTime = now
      if (settings.value.autoDisappearTime > 0) {
        existing.disappearAt = now + settings.value.autoDisappearTime * 1000
      }
    } else {
      giftList.value.unshift({
        id: `${data.uid}_${data.msg}_${now}`,
        uid: data.uid,
        uname: data.uname,
        uface: data.uface,
        giftName: data.msg,
        giftIcon: data.gift_icon,
        totalNum: data.num || 1,
        totalPrice: priceYuan,
        type: data.type,
        guardLevel: data.guard_level,
        firstTime: now,
        lastUpdateTime: now,
        disappearAt: settings.value.autoDisappearTime > 0 ? now + settings.value.autoDisappearTime * 1000 : undefined,
      })
      if (giftList.value.length > settings.value.maxItemCount) {
        giftList.value.splice(settings.value.maxItemCount)
      }
    }

    sendGiftList()
  }

  function updateRank(data: EventModel) {
    if (!currentLive.value) return
    const id = resolveUserId(data)
    if (!id) return

    const now = data.time > 0 ? data.time : Date.now()
    const activity = userActivityMap.value.get(id)
    const guardLevel =
      data.guard_level && data.guard_level > 0 ? data.guard_level : (activity?.guardLevel ?? GuardLevel.None)

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
      const paidYuan = normalizePaidYuan(data.price)
      entry.totalPaid = Math.round((entry.totalPaid + paidYuan) * 100) / 100
    }
    entry.score = entry.totalPaid
    sendRankList()
    sendOnlineGuardList()
  }

  function getRankedList(): RankEntry[] {
    return buildRankedList(rankMap.value, userActivityMap.value, settings.value)
  }

  function getOnlineGuardList(): OnlineGuardEntry[] {
    return buildOnlineGuardList(
      rankMap.value,
      userActivityMap.value,
      getRankedList(),
      settings.value.onlineThresholdMinutes,
    )
  }

  function getThankSummaryList(): ThankSummaryItem[] {
    return buildThankSummaryList(getRankedList(), getOnlineGuardList())
  }

  function getOnlineViewerList(): OnlineViewerEntry[] {
    return buildOnlineViewerList(userActivityMap.value, settings.value.onlineThresholdMinutes)
  }

  function sendGiftList() {
    postBroadcastMessage(bc, { type: 'gift-list', data: sortGiftEntries(giftList.value, settings.value) } satisfies GiftWindowBCData)
  }

  function sendRankList() {
    postBroadcastMessage(bc, { type: 'rank-list', data: getRankedList() } satisfies GiftWindowBCData)
  }

  function sendOnlineGuardList() {
    postBroadcastMessage(bc, { type: 'online-guard-list', data: getOnlineGuardList() } satisfies GiftWindowBCData)
  }

  function sendOnlineViewerList() {
    postBroadcastMessage(bc, { type: 'online-viewer-list', data: getOnlineViewerList() } satisfies GiftWindowBCData)
  }

  async function fetchOnlineGoldRank() {
    try {
      const roomId = accountInfo.value?.biliRoomId
      const ruid = accountInfo.value?.biliId || biliCookie.uId
      if (!roomId || !ruid || !isTauri()) return

      const url = `https://api.live.bilibili.com/xlive/general-interface/v1/rank/getOnlineGoldRank?ruid=${ruid}&roomId=${roomId}&page=1&pageSize=50`
      const cookie = (await biliCookie.getBiliCookie()) || ''
      const resp = await QueryBiliAPI(url, 'GET', cookie, true)
      if (!resp.ok) return

      const text = await resp.text()
      if (!text.trim()) return
      const json = JSON.parse(text) as {
        code: number
        data?: {
          OnlineRankItem?: Array<{
            uid: number
            name: string
            face: string
            score: number
            guard_level: number
            medal_info?: { guard_level: number; medal_level: number; medal_name: string }
          }>
        }
      }

      if (json.code === 0 && json.data?.OnlineRankItem) {
        const now = Date.now()
        for (const item of json.data.OnlineRankItem) {
          const id = String(item.uid)
          const existing = userActivityMap.value.get(id)
          const guardLevel =
            item.guard_level > 0 ? (item.guard_level as GuardLevel) : (existing?.guardLevel ?? GuardLevel.None)
          if (guardLevel > 0) formerGuardsSet.value.add(item.uid)

          const wasGuard =
            formerGuardsSet.value.has(item.uid) || (item.medal_info?.guard_level ?? 0) > 0 || existing?.isFormerGuard || false

          userActivityMap.value.set(id, {
            id,
            uid: item.uid,
            uname: item.name || existing?.uname || `用户${item.uid}`,
            uface: item.face || existing?.uface || '',
            guardLevel,
            isFormerGuard: guardLevel === GuardLevel.None && wasGuard,
            medalName: item.medal_info?.medal_name || existing?.medalName,
            medalLevel: item.medal_info?.medal_level || existing?.medalLevel,
            score: item.score || existing?.score || 0,
            lastActiveTime: Math.max(existing?.lastActiveTime || 0, now),
            lastAction: existing?.lastAction || '在线黑听',
          })
        }
        sendOnlineGuardList()
        sendOnlineViewerList()
      }
    } catch (err) {
      console.warn('[GiftWindow] 获取高能在线观众榜失败:', err)
    }
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
            isOnline: isUserOnlineByThreshold(lastActive, settings.value.onlineThresholdMinutes),
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
      const current = await getApiLiveCurrent()
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

      const ranking = await getApiLiveRanking({
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
    if (rankMap.value.size > 0 || userActivityMap.value.size > 0) {
      sendRankList()
      sendOnlineGuardList()
      sendOnlineViewerList()
    }
  }

  function init() {
    if (isInited) return
    isInited = true

    bc = new BroadcastChannel(GIFT_WINDOW_BROADCAST_CHANNEL)
    bc.onmessage = (event: MessageEvent<GiftWindowBCData>) => {
      if (event.data.type === 'window-ready') {
        postBroadcastMessage(bc, { type: 'update-setting', data: settings.value } satisfies GiftWindowBCData)
        sendGiftList()
        sendRankList()
        sendOnlineGuardList()
        sendOnlineViewerList()
        void fetchOnlineGoldRank()
      }
    }

    if (_goldRankTimerId) clearInterval(_goldRankTimerId)
    _goldRankTimerId = setInterval(() => void fetchOnlineGoldRank(), 30_000)

    const onDanmaku = (e: EventModel) => recordUserActivity(e, '发弹幕')
    const onEnter = (e: EventModel) => recordUserActivity(e, '进入直播间')
    const onLike = (e: EventModel) => recordUserActivity(e, '点赞')
    const onPaid = (action: string) => (e: EventModel) => {
      recordUserActivity(e, action)
      onGiftEvent(e)
      updateRank(e)
    }
    const onGift = onPaid('送出礼物')
    const onSc = onPaid('发送SC')
    const onGuard = onPaid('开通大航海')

    danmakuClient.onEvent('danmaku', onDanmaku)
    danmakuClient.onEvent('enter', onEnter)
    danmakuClient.onEvent('like', onLike)
    danmakuClient.onEvent('gift', onGift)
    danmakuClient.onEvent('sc', onSc)
    danmakuClient.onEvent('guard', onGuard)
    storeUnlistens.push(
      () => danmakuClient.offEvent('danmaku', onDanmaku),
      () => danmakuClient.offEvent('enter', onEnter),
      () => danmakuClient.offEvent('like', onLike),
      () => danmakuClient.offEvent('gift', onGift),
      () => danmakuClient.offEvent('sc', onSc),
      () => danmakuClient.offEvent('guard', onGuard),
    )

    const stopSettingsWatch = watch(
      () => settings.value,
      (v) => {
        postBroadcastMessage(bc, { type: 'update-setting', data: v } satisfies GiftWindowBCData)
        if (giftWindow.value) void applyWindowSettings()
        sendGiftList()
        sendRankList()
        sendOnlineGuardList()
        sendOnlineViewerList()
      },
      { deep: true },
    )
    storeUnlistens.push(stopSettingsWatch)

    _cleanupTimerId = setInterval(cleanupExpired, 1000)
    _refreshOnlineTimerId = setInterval(refreshOnlineStatus, 15_000)
    void syncCurrentLive()
    _syncLiveTimerId = setInterval(() => void syncCurrentLive(), 30_000)
  }

  function sendTestGift() {
    const mockEvent = createMockGiftEvent()
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
    getOnlineViewerList,
    getThankSummaryList,
    fetchOnlineGoldRank,
    sendOnlineViewerList,
    init,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGiftWindow, import.meta.hot))
}
