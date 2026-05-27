import type { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { EventModel } from '@/api/api-models'
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi'
import { getAllWebviewWindows } from '@tauri-apps/api/webviewWindow'
import { EventDataTypes } from '@/api/api-models'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { usePersistedStorage } from '@/shared/storage/persist'

export interface EnergyRankSettings {
  width: number
  height: number
  x: number
  y: number
  opacity: number
  fontSize: number
  backgroundColor: string
  windowBackgroundColor: string
  textColor: string
  alwaysOnTop: boolean
  interactive: boolean
  borderRadius: number
  displayCount: number
  rankBy: 'paid' | 'danmaku' | 'combined'
}

export interface RankEntry {
  uid: number
  uname: string
  uface: string
  totalPaid: number
  danmakuCount: number
  score: number
}

export const ENERGY_RANK_BROADCAST_CHANNEL = 'channel.energy.rank'

export type EnergyRankBCData =
  | { type: 'rank-list'; data: RankEntry[] }
  | { type: 'update-setting'; data: EnergyRankSettings }
  | { type: 'window-ready' }
  | { type: 'clear' }

export const useEnergyRank = defineStore('energyRank', () => {
  const rankWindow = ref<WebviewWindow>()
  const settings = usePersistedStorage<EnergyRankSettings>('Setting.EnergyRank', {
    width: 300,
    height: 600,
    x: 200,
    y: 100,
    opacity: 0.95,
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.8)',
    windowBackgroundColor: 'rgba(0,0,0,0)',
    textColor: '#ffffff',
    alwaysOnTop: true,
    interactive: false,
    borderRadius: 8,
    displayCount: 50,
    rankBy: 'paid',
  })

  const danmakuClient = useDanmakuClient()
  const isWindowOpened = ref(false)
  const rankMap = ref(new Map<number, RankEntry>())
  let bc: BroadcastChannel | undefined
  let isInited = false

  function closeWindow() {
    rankWindow.value?.hide()
    isWindowOpened.value = false
  }

  function openWindow() {
    if (!isInited) init()
    applyWindowSettings()
    rankWindow.value?.show()
    isWindowOpened.value = true
  }

  function setSize(width: number, height: number) {
    settings.value.width = width
    settings.value.height = height
    rankWindow.value?.setSize(new PhysicalSize(width, height))
  }

  function setPosition(x: number, y: number) {
    settings.value.x = x
    settings.value.y = y
    rankWindow.value?.setPosition(new PhysicalPosition(x, y))
  }

  function updateWindowPosition() {
    rankWindow.value?.setPosition(new PhysicalPosition(settings.value.x, settings.value.y))
  }

  async function applyWindowSettings() {
    await rankWindow.value?.setAlwaysOnTop(settings.value.alwaysOnTop)
    await rankWindow.value?.setIgnoreCursorEvents(settings.value.interactive)
  }

  function onEvent(data: EventModel) {
    if (!isWindowOpened.value) return
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

    entry.score = computeScore(entry)
    sendRankList()
  }

  function computeScore(entry: RankEntry): number {
    switch (settings.value.rankBy) {
      case 'paid': return entry.totalPaid
      case 'danmaku': return entry.danmakuCount
      case 'combined': return entry.totalPaid + entry.danmakuCount * 10
    }
  }

  function getRankedList(): RankEntry[] {
    return Array.from(rankMap.value.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, settings.value.displayCount)
  }

  function sendRankList() {
    bc?.postMessage({ type: 'rank-list', data: getRankedList() } satisfies EnergyRankBCData)
  }

  function clearRank() {
    rankMap.value.clear()
    bc?.postMessage({ type: 'clear' } satisfies EnergyRankBCData)
  }

  async function init() {
    if (isInited) return
    rankWindow.value = (await getAllWebviewWindows()).find(w => w.label === 'energy-rank-window')
    if (!rankWindow.value) return

    rankWindow.value.onCloseRequested((event) => {
      event.preventDefault()
      closeWindow()
    })
    rankWindow.value.onMoved(({ payload: pos }) => {
      settings.value.x = pos.x
      settings.value.y = pos.y
    })

    bc = new BroadcastChannel(ENERGY_RANK_BROADCAST_CHANNEL)
    bc.onmessage = (event: MessageEvent<EnergyRankBCData>) => {
      if (event.data.type === 'window-ready') {
        bc?.postMessage({ type: 'update-setting', data: toRaw(settings.value) })
        sendRankList()
      }
    }
    bc.postMessage({ type: 'window-ready' })
    bc.postMessage({ type: 'update-setting', data: toRaw(settings.value) })

    danmakuClient.onEvent('danmaku', e => onEvent(e))
    danmakuClient.onEvent('gift', e => onEvent(e))
    danmakuClient.onEvent('sc', e => onEvent(e))
    danmakuClient.onEvent('guard', e => onEvent(e))

    watch(() => settings, (v) => {
      rankMap.value.forEach(entry => { entry.score = computeScore(entry) })
      bc?.postMessage({ type: 'update-setting', data: toRaw(v.value) })
      sendRankList()
      applyWindowSettings()
    }, { deep: true })

    isInited = true
  }

  return {
    rankWindow,
    settings,
    isEnergyRankOpen: isWindowOpened,
    rankMap,
    openWindow,
    closeWindow,
    setSize,
    setPosition,
    updateWindowPosition,
    clearRank,
    getRankedList,
    init,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useEnergyRank, import.meta.hot))
}
