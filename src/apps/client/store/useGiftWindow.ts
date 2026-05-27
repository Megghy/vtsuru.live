import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { EventModel } from '@/api/api-models'
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow'
import { EventDataTypes, GuardLevel } from '@/api/api-models'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { usePersistedStorage } from '@/shared/storage/persist'

export type GiftSortBy = 'time' | 'price' | 'num'
export type GiftFilterType = 'Gift' | 'SC' | 'Guard'

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

export type GiftWindowBCData =
  | { type: 'gift-list'; data: GiftEntry[] }
  | { type: 'rank-list'; data: RankEntry[] }
  | { type: 'update-setting'; data: GiftWindowSettings }
  | { type: 'window-ready' }
  | { type: 'clear' }

export interface RankEntry {
  uid: number
  uname: string
  uface: string
  totalPaid: number
  danmakuCount: number
  score: number
}

const TYPE_TO_FILTER: Partial<Record<EventDataTypes, GiftFilterType>> = {
  [EventDataTypes.Gift]: 'Gift',
  [EventDataTypes.SC]: 'SC',
  [EventDataTypes.Guard]: 'Guard',
}

export const useGiftWindow = defineStore('giftWindow', () => {
  const giftWindow = ref<WebviewWindow>()
  const settings = usePersistedStorage<GiftWindowSettings>('Setting.GiftWindow', {
    width: 320,
    height: 520,
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
    rankDisplayCount: 20,
  })

  const danmakuClient = useDanmakuClient()
  const isWindowOpened = ref(false)
  const giftList = ref<GiftEntry[]>([])
  const rankMap = ref(new Map<number, RankEntry>())
  let bc: BroadcastChannel | undefined
  let isInited = false
  let cleanupTimer: ReturnType<typeof setInterval> | undefined

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
  }

  function onGiftEvent(data: EventModel) {
    if (!isWindowOpened.value) return

    const filterKey = TYPE_TO_FILTER[data.type]
    if (!filterKey || !settings.value.filterTypes.includes(filterKey)) return

    const price = data.type === EventDataTypes.Gift ? data.price * (data.num || 1) : data.price
    if (price < settings.value.minPrice) return

    const now = Date.now()
    const mergeMs = settings.value.mergeWindowSeconds * 1000

    const existing = giftList.value.find(
      e => e.uid === data.uid && e.giftName === data.msg && e.type === data.type && (now - e.lastUpdateTime) < mergeMs,
    )

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
      case 'price': list.sort((a, b) => b.totalPrice - a.totalPrice); break
      case 'num': list.sort((a, b) => b.totalNum - a.totalNum); break
      default: list.sort((a, b) => b.lastUpdateTime - a.lastUpdateTime); break
    }
    if (settings.value.reverseOrder) list.reverse()
    return list
  }

  function sendGiftList() {
    bc?.postMessage({ type: 'gift-list', data: toRaw(getSortedList()) } satisfies GiftWindowBCData)
  }

  function updateRank(data: EventModel) {
    const uid = data.uid
    if (!uid) return
    let entry = rankMap.value.get(uid)
    if (!entry) {
      entry = { uid, uname: data.uname, uface: data.uface, totalPaid: 0, danmakuCount: 0, score: 0 }
      rankMap.value.set(uid, entry)
    }
    entry.uname = data.uname || entry.uname
    entry.uface = data.uface || entry.uface

    if (data.type === EventDataTypes.Message) {
      entry.danmakuCount++
    } else if (data.type === EventDataTypes.Gift) {
      entry.totalPaid += data.price * (data.num || 1)
    } else if (data.type === EventDataTypes.SC) {
      entry.totalPaid += data.price
    } else if (data.type === EventDataTypes.Guard) {
      entry.totalPaid += data.price
    }
    entry.score = entry.totalPaid
    sendRankList()
  }

  function getRankedList(): RankEntry[] {
    return Array.from(rankMap.value.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, settings.value.rankDisplayCount)
  }

  function sendRankList() {
    bc?.postMessage({ type: 'rank-list', data: toRaw(getRankedList()) } satisfies GiftWindowBCData)
  }

  function clearRank() {
    rankMap.value.clear()
    sendRankList()
  }

  function clearGifts() {
    giftList.value = []
    bc?.postMessage({ type: 'clear' } satisfies GiftWindowBCData)
  }

  function cleanupExpired() {
    if (settings.value.autoDisappearTime <= 0 || giftList.value.length === 0) return
    const now = Date.now()
    const before = giftList.value.length
    giftList.value = giftList.value.filter(e => !e.disappearAt || e.disappearAt > now)
    if (giftList.value.length !== before) sendGiftList()
  }

  async function init() {
    if (isInited) return
    giftWindow.value = (await getAllWebviewWindows()).find(w => w.label === 'gift-window')
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
        bc?.postMessage({ type: 'update-setting', data: toRaw(settings.value) })
        sendGiftList()
        sendRankList()
      }
    }
    bc.postMessage({ type: 'window-ready' })
    bc.postMessage({ type: 'update-setting', data: toRaw(settings.value) })

    danmakuClient.onEvent('gift', e => { onGiftEvent(e); updateRank(e) })
    danmakuClient.onEvent('sc', e => { onGiftEvent(e); updateRank(e) })
    danmakuClient.onEvent('guard', e => { onGiftEvent(e); updateRank(e) })
    danmakuClient.onEvent('danmaku', e => updateRank(e))

    watch(() => settings, (v) => {
      bc?.postMessage({ type: 'update-setting', data: toRaw(v.value) })
      applyWindowSettings()
      sendGiftList()
    }, { deep: true })

    cleanupTimer = setInterval(cleanupExpired, 1000)
    isInited = true
  }

  function sendTestGift() {
    const types = [EventDataTypes.Gift, EventDataTypes.SC, EventDataTypes.Guard]
    const t = types[Math.floor(Math.random() * types.length)]
    const gifts = ['小花花', '辣条', '能量饮料', '小星星', '告白气球']
    onGiftEvent({
      type: t,
      uid: Math.floor(Math.random() * 100000),
      uname: `测试用户${Math.floor(Math.random() * 100)}`,
      uface: 'https://i0.hdslb.com/bfs/face/member/noface.jpg',
      msg: t === EventDataTypes.Guard ? '开通了舰长' : t === EventDataTypes.SC ? '感谢主播！' : gifts[Math.floor(Math.random() * gifts.length)],
      num: t === EventDataTypes.Gift ? Math.floor(Math.random() * 20) + 1 : 1,
      price: t === EventDataTypes.SC ? [30, 50, 100, 500][Math.floor(Math.random() * 4)] : t === EventDataTypes.Guard ? 198 : [100, 1000, 5000][Math.floor(Math.random() * 3)],
      guard_level: t === EventDataTypes.Guard ? GuardLevel.Jianzhang : GuardLevel.None,
      open_id: '', time: Date.now(), fans_medal_level: 0, fans_medal_name: '', fans_medal_wearing_status: false, ouid: '',
    } as EventModel)
  }

  return {
    giftWindow, settings, isGiftWindowOpen: isWindowOpened, giftList, rankMap,
    openWindow, closeWindow, setSize, setPosition, updateWindowPosition,
    clearGifts, clearRank, sendTestGift, init,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGiftWindow, import.meta.hot))
}