import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { onScopeDispose, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import type { EventModel } from '@/api/client-types'
import { EventDataTypes, GuardLevel } from '@/api/generated/model'
import { officialLiveStats } from '@/shared/services/officialLiveStats'
import { usePersistedStorage } from '@/shared/storage/persist'
import { postBroadcastMessage } from '@/shared/utils/broadcastChannel'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import {
  applyTransparentWindowBackground,
  DEFAULT_OVERLAY_POSITION,
  ensureOverlayWindow,
  normalizePaidYuan,
} from '../utils/overlayWindow'

export { applyTransparentWindowBackground }

export interface DanmakuWindowSettings {
  width: number
  height: number
  x: number
  y: number
  opacity: number
  showAvatar: boolean
  showUsername: boolean
  showFansMedal: boolean
  showGuardIcon: boolean
  fontSize: number
  fontFamily?: string
  maxDanmakuCount: number
  reverseOrder: boolean
  filterTypes: string[]
  animationDuration: number
  enableAnimation: boolean
  backgroundColor: string
  windowBackgroundColor: string
  textColor: string
  alwaysOnTop: boolean
  interactive: boolean
  borderRadius: number
  itemSpacing: number
  enableShadow: boolean
  shadowColor: string
  autoDisappearTime: number
  displayStyle: string
  textStyleCompact: boolean
  textStyleShowType: boolean
  textStyleNameSeparator: string
  showStatusBar?: boolean
  showWatchedCount?: boolean
  showLikeCount?: boolean
  showIncome?: boolean
  hideIncomeAmount?: boolean
  showOnlineCount?: boolean
  contentProtected?: boolean
}

export interface LiveStatsData {
  watchedCount: number
  watchedText?: string | null
  likeCount: number
  totalIncome: number // 单位：人民币元
  onlineCount: number
  popularity?: number | null
}

export const DANMAKU_WINDOW_BROADCAST_CHANNEL = 'channel.danmaku.window'
export type DanmakuWindowBCData =
  | { type: 'danmaku'; data: EventModel }
  | { type: 'update-setting'; data: DanmakuWindowSettings }
  | { type: 'window-ready' }
  | { type: 'clear-danmaku' }
  | { type: 'test-danmaku'; data: EventModel }
  | { type: 'live-stats'; data: LiveStatsData }
  | { type: 'toggle-interactive' }

function generateTestDanmaku(): EventModel {
  const types = [
    EventDataTypes.Message,
    EventDataTypes.Gift,
    EventDataTypes.SC,
    EventDataTypes.Guard,
    EventDataTypes.Enter,
  ]
  const randomType = types[Math.floor(Math.random() * types.length)]
  const randomUid = Math.floor(Math.random() * 1000000)
  const randomName = `测试用户${randomUid % 100}`
  const randomTime = Date.now()
  const randomOuid = `oid_${randomUid}`

  const hasMedal = Math.random() > 0.3
  const isWearingMedal = hasMedal && Math.random() > 0.2
  const medalNames = ['鸽子团', '鲨鱼牌', '椰奶', '饼干', '猫猫头', '南极', '狗妈', '可爱', '团子', '喵']
  const randomMedalName = medalNames[Math.floor(Math.random() * medalNames.length)]
  const randomMedalLevel = isWearingMedal ? Math.floor(Math.random() * 40) + 1 : 0

  const baseEvent: Partial<EventModel> = {
    uname: randomName,
    uface: 'https://i0.hdslb.com/bfs/face/member/noface.jpg',
    uid: randomUid,
    open_id: randomOuid,
    time: randomTime,
    guard_level: Math.floor(Math.random() * 4),
    fans_medal_level: randomMedalLevel,
    fans_medal_name: randomMedalName,
    fans_medal_wearing_status: isWearingMedal,
    ouid: randomOuid,
  }

  switch (randomType) {
    case EventDataTypes.Message:
      return {
        ...baseEvent,
        type: EventDataTypes.Message,
        msg: `这是一条测试弹幕消息 ${Math.random().toString(36).substring(7)}`,
        num: 0,
        price: 0,
      } as EventModel
    case EventDataTypes.Gift: {
      const giftNames = ['小花花', '辣条', '能量饮料', '小星星']
      const giftNums = [1, 5, 10]
      const giftPricesYuan = [0.1, 1, 5, 19.9]
      return {
        ...baseEvent,
        type: EventDataTypes.Gift,
        msg: giftNames[Math.floor(Math.random() * giftNames.length)],
        num: giftNums[Math.floor(Math.random() * giftNums.length)],
        price: giftPricesYuan[Math.floor(Math.random() * giftPricesYuan.length)],
      } as EventModel
    }
    case EventDataTypes.SC: {
      const scPrices = [30, 50, 100, 500, 1000]
      return {
        ...baseEvent,
        type: EventDataTypes.SC,
        msg: '这是一条测试SC消息！感谢老板！',
        num: 1,
        price: scPrices[Math.floor(Math.random() * scPrices.length)],
      } as EventModel
    }
    case EventDataTypes.Guard: {
      const guardLevels = [GuardLevel.Jianzhang, GuardLevel.Tidu, GuardLevel.Zongdu]
      const guardPrices = {
        [GuardLevel.Jianzhang]: 198,
        [GuardLevel.Tidu]: 1998,
        [GuardLevel.Zongdu]: 19998,
        [GuardLevel.None]: 0,
      }
      const selected = guardLevels[Math.floor(Math.random() * guardLevels.length)]
      return {
        ...baseEvent,
        type: EventDataTypes.Guard,
        msg: `开通了${selected === GuardLevel.Jianzhang ? '舰长' : selected === GuardLevel.Tidu ? '提督' : '总督'}`,
        num: 1,
        price: guardPrices[selected],
        guard_level: selected,
      } as EventModel
    }
    case EventDataTypes.Enter:
      return {
        ...baseEvent,
        type: EventDataTypes.Enter,
        msg: '进入了直播间',
        num: 0,
        price: 0,
      } as EventModel
    default:
      return {
        ...baseEvent,
        type: EventDataTypes.Message,
        msg: '默认测试弹幕',
        num: 0,
        price: 0,
      } as EventModel
  }
}

export const useDanmakuWindow = defineStore('danmakuWindow', () => {
  const danmakuWindow = ref<WebviewWindow>()
  const danmakuWindowSetting = usePersistedStorage<DanmakuWindowSettings>('Setting.DanmakuWindow', {
    width: 400,
    height: 600,
    x: DEFAULT_OVERLAY_POSITION.x,
    y: DEFAULT_OVERLAY_POSITION.y,
    opacity: 0.9,
    showAvatar: true,
    showUsername: true,
    showFansMedal: true,
    showGuardIcon: true,
    fontSize: 14,
    fontFamily: '',
    maxDanmakuCount: 30,
    reverseOrder: false,
    filterTypes: ['Message', 'Gift', 'SC', 'Guard'],
    animationDuration: 300,
    backgroundColor: 'rgba(0,0,0,0.6)',
    windowBackgroundColor: 'rgba(0,0,0,0)',
    textColor: '#ffffff',
    alwaysOnTop: true,
    interactive: false,
    borderRadius: 8,
    itemSpacing: 5,
    enableShadow: true,
    shadowColor: 'rgba(0,0,0,0.5)',
    autoDisappearTime: 0,
    displayStyle: 'card',
    textStyleCompact: false,
    textStyleShowType: true,
    textStyleNameSeparator: ': ',
    enableAnimation: true,
    showStatusBar: true,
    showWatchedCount: true,
    showLikeCount: true,
    showIncome: true,
    hideIncomeAmount: false,
    showOnlineCount: true,
    contentProtected: false,
  })

  const danmakuClient = useDanmakuClient()
  const isWindowOpened = ref(false)
  let bc: BroadcastChannel | undefined

  const liveStats = ref<LiveStatsData>({
    watchedCount: 0,
    likeCount: 0,
    totalIncome: 0,
    onlineCount: 0,
  })

  const activeUsers = new Map<string, number>()
  const ONLINE_THRESHOLD_MS = 20 * 60 * 1000
  let lastOnlineRefreshAt = 0

  let isInited = false
  let _moveDebounceTimer: ReturnType<typeof setTimeout> | null = null
  const storeUnlistens: Array<() => void> = []
  const windowUnlistens: Array<() => void> = []

  watch(
    () => officialLiveStats.value,
    (stats) => {
      let changed = false
      if (stats.watchedCount !== null && stats.watchedCount !== liveStats.value.watchedCount) {
        liveStats.value.watchedCount = stats.watchedCount
        liveStats.value.watchedText = stats.watchedText
        changed = true
      }
      if (stats.totalLikes !== null && stats.totalLikes !== liveStats.value.likeCount) {
        liveStats.value.likeCount = stats.totalLikes
        changed = true
      }
      if (stats.onlineRank !== null && stats.onlineRank !== liveStats.value.onlineCount) {
        liveStats.value.onlineCount = stats.onlineRank
        changed = true
      }
      if (stats.popularity !== null && stats.popularity !== liveStats.value.popularity) {
        liveStats.value.popularity = stats.popularity
        changed = true
      }
      if (changed) syncLiveStats()
    },
    { deep: true, immediate: true },
  )

  function clearWindowListeners() {
    for (const fn of windowUnlistens) fn()
    windowUnlistens.length = 0
  }

  onScopeDispose(() => {
    clearWindowListeners()
    for (const fn of storeUnlistens) fn()
    storeUnlistens.length = 0
    if (_moveDebounceTimer) {
      clearTimeout(_moveDebounceTimer)
      _moveDebounceTimer = null
    }
    bc?.close()
    bc = undefined
    isInited = false
  })

  function refreshOnlineCount() {
    const now = Date.now()
    if (now - lastOnlineRefreshAt < 1000) return
    lastOnlineRefreshAt = now

    const cutoff = now - ONLINE_THRESHOLD_MS
    for (const [key, time] of activeUsers.entries()) {
      if (time < cutoff) activeUsers.delete(key)
    }
    if (officialLiveStats.value.onlineRank !== null) {
      liveStats.value.onlineCount = officialLiveStats.value.onlineRank
    } else {
      liveStats.value.onlineCount = activeUsers.size
    }
  }

  function recordActivity(uid: number | string, uname?: string) {
    const key = String(uid || uname || '')
    if (key && key !== '0') {
      activeUsers.set(key, Date.now())
      refreshOnlineCount()
    }
  }

  function syncLiveStats() {
    if (!isWindowOpened.value || !bc) return
    postBroadcastMessage(bc, {
      type: 'live-stats',
      data: { ...liveStats.value },
    } satisfies DanmakuWindowBCData)
  }

  async function bindWindowEvents(win: WebviewWindow) {
    clearWindowListeners()
    windowUnlistens.push(
      await win.onCloseRequested((event) => {
        event.preventDefault()
        void closeWindow()
      }),
      await win.onMoved(({ payload: position }) => {
        if (_moveDebounceTimer) clearTimeout(_moveDebounceTimer)
        _moveDebounceTimer = setTimeout(() => {
          _moveDebounceTimer = null
          danmakuWindowSetting.value.x = position.x
          danmakuWindowSetting.value.y = position.y
        }, 300)
      }),
    )
  }

  async function checkAndUseSetting(setting: DanmakuWindowSettings) {
    await danmakuWindow.value?.setAlwaysOnTop(setting.alwaysOnTop)
    await danmakuWindow.value?.setIgnoreCursorEvents(setting.interactive)
    await danmakuWindow.value?.setContentProtected(setting.contentProtected ?? false)
  }

  async function openWindow() {
    if (!isInited) init()
    try {
      const s = danmakuWindowSetting.value
      const win = await ensureOverlayWindow({
        label: 'danmaku-window',
        url: 'danmaku-window',
        title: 'VTsuru 弹幕机',
        width: s.width || 400,
        height: s.height || 600,
        x: s.x ?? DEFAULT_OVERLAY_POSITION.x,
        y: s.y ?? DEFAULT_OVERLAY_POSITION.y,
        resizable: false,
        alwaysOnTop: s.alwaysOnTop,
      })
      if (!win) return
      danmakuWindow.value = win
      await bindWindowEvents(win)
      await checkAndUseSetting(s)
      await win.show()
      isWindowOpened.value = true
      postBroadcastMessage(bc, { type: 'update-setting', data: s } satisfies DanmakuWindowBCData)
      syncLiveStats()
    } catch (err) {
      toast.error('打开弹幕窗口失败', { description: String(err) })
    }
  }

  async function closeWindow() {
    isWindowOpened.value = false
    clearWindowListeners()
    const win = danmakuWindow.value
    danmakuWindow.value = undefined
    if (win) {
      await win.destroy().catch(() => win.hide().catch(() => {}))
    }
  }

  function setDanmakuWindowSize(width: number, height: number) {
    danmakuWindowSetting.value.width = width
    danmakuWindowSetting.value.height = height
    void danmakuWindow.value?.setSize(new PhysicalSize(width, height))
  }

  function setDanmakuWindowPosition(x: number, y: number) {
    danmakuWindowSetting.value.x = x
    danmakuWindowSetting.value.y = y
    void danmakuWindow.value?.setPosition(new PhysicalPosition(x, y))
  }

  function updateWindowPosition() {
    void danmakuWindow.value?.setPosition(
      new PhysicalPosition(danmakuWindowSetting.value.x, danmakuWindowSetting.value.y),
    )
  }

  function init() {
    if (isInited) return
    isInited = true

    bc = new BroadcastChannel(DANMAKU_WINDOW_BROADCAST_CHANNEL)
    bc.onmessage = (event: MessageEvent<DanmakuWindowBCData>) => {
      if (event.data.type === 'window-ready') {
        postBroadcastMessage(bc, {
          type: 'update-setting',
          data: danmakuWindowSetting.value,
        } satisfies DanmakuWindowBCData)
        postBroadcastMessage(bc, {
          type: 'live-stats',
          data: { ...liveStats.value },
        } satisfies DanmakuWindowBCData)
      } else if (event.data.type === 'toggle-interactive') {
        danmakuWindowSetting.value.interactive = !danmakuWindowSetting.value.interactive
      }
    }

    const onEventHandler = (event: EventModel) => onGetDanmakus(event)
    const listenedEvents = ['danmaku', 'gift', 'sc', 'guard', 'enter', 'scDel', 'like'] as const
    for (const evt of listenedEvents) {
      danmakuClient.onEvent(evt, onEventHandler)
      storeUnlistens.push(() => danmakuClient.offEvent(evt, onEventHandler))
    }

    const stopSettingsWatch = watch(
      () => danmakuWindowSetting.value,
      async (newValue) => {
        postBroadcastMessage(bc, { type: 'update-setting', data: newValue } satisfies DanmakuWindowBCData)
        if (danmakuWindow.value) {
          await checkAndUseSetting(newValue)
        }
      },
      { deep: true },
    )
    storeUnlistens.push(stopSettingsWatch)
  }

  function onGetDanmakus(data: EventModel) {
    if (!isWindowOpened.value || !bc) return

    recordActivity(data.uid, data.uname)

    if (data.type === EventDataTypes.Like) {
      if (officialLiveStats.value.totalLikes === null) {
        liveStats.value.likeCount += Math.max(1, data.num || 1)
      }
    } else if (data.type === EventDataTypes.Gift || data.type === EventDataTypes.SC) {
      const yuan = normalizePaidYuan(data.price)
      if (yuan > 0) {
        liveStats.value.totalIncome = Math.round((liveStats.value.totalIncome + yuan) * 100) / 100
      }
    } else if (data.type === EventDataTypes.Guard) {
      const guardYuan =
        normalizePaidYuan(data.price) ||
        (data.guard_level === GuardLevel.Zongdu ? 19998 : data.guard_level === GuardLevel.Tidu ? 1998 : 198)
      liveStats.value.totalIncome = Math.round((liveStats.value.totalIncome + guardYuan) * 100) / 100
    }

    syncLiveStats()
    postBroadcastMessage(bc, { type: 'danmaku', data } satisfies DanmakuWindowBCData)
  }

  function clearAllDanmaku() {
    if (!isWindowOpened.value || !bc) return
    postBroadcastMessage(bc, { type: 'clear-danmaku' } satisfies DanmakuWindowBCData)
  }

  function resetLiveStats() {
    liveStats.value = {
      watchedCount: officialLiveStats.value.watchedCount ?? 0,
      watchedText: officialLiveStats.value.watchedText,
      likeCount: officialLiveStats.value.totalLikes ?? 0,
      totalIncome: 0,
      onlineCount: officialLiveStats.value.onlineRank ?? 0,
      popularity: officialLiveStats.value.popularity,
    }
    activeUsers.clear()
    syncLiveStats()
  }

  function sendTestDanmaku() {
    if (!isWindowOpened.value || !bc) return
    const testData = generateTestDanmaku()
    if (officialLiveStats.value.watchedCount === null) {
      liveStats.value.watchedCount = Math.max(liveStats.value.watchedCount + Math.floor(Math.random() * 5) + 1, 10)
    }
    if (officialLiveStats.value.totalLikes === null) {
      liveStats.value.likeCount += Math.floor(Math.random() * 3) + 1
    }
    onGetDanmakus(testData)
  }

  return {
    danmakuWindow,
    danmakuWindowSetting,
    setDanmakuWindowSize,
    setDanmakuWindowPosition,
    updateWindowPosition,
    isDanmakuWindowOpen: isWindowOpened,
    openWindow,
    closeWindow,
    init,
    liveStats,
    resetLiveStats,
    clearAllDanmaku,
    sendTestDanmaku,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useDanmakuWindow, import.meta.hot))
}
