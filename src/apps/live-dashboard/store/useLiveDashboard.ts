import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowRef, triggerRef, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { EventModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import { fetchOfficialLiveStats, officialLiveStats } from '@/shared/services/officialLiveStats'
import { getDeletedSuperChatIds } from '@/shared/utils/danmakuWindowEvents'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import { CardGrid } from '../core/cardGrid'
import { dashboardDB } from '../core/db'
import { createSearchPredicate } from '../core/search'
import type { DashboardEvent } from '../core/types'
import { normalizeEvent, panelOf, userKeyOf } from '../core/types'
import { useDashboardSettings } from './settings'
import { useDashboardStats } from './stats'
import { useUserNotes } from './userNotes'

const MAX_MESSAGES = 3000
const MAX_INTERACTIONS = 500
const FLUSH_MS = 1000
const RELOAD_COMMAND = '/vt reload'

export interface UserFilter {
  userKey: string
  uname: string
  /** 进入筛选前的阅读位置，「转至上下文」时回到这里 */
  contextKey?: string
}

export const useLiveDashboard = defineStore('LiveDashboard', () => {
  const client = useDanmakuClient()
  const account = useAccount()
  const settings = useDashboardSettings()
  const notes = useUserNotes()

  // 列表只做追加/裁剪，条目字段不可变；已读与删除状态单独用响应式 Set 承载，避免整表重渲染
  const messages = shallowRef<DashboardEvent[]>([])
  const interactions = shallowRef<DashboardEvent[]>([])
  const paid = shallowRef<DashboardEvent[]>([])
  const readKeys = reactive(new Set<string>())
  const deletedKeys = reactive(new Set<string>())
  const known = new Set<string>()

  const historyRange = ref<[number, number] | null>(null)
  const historyEvents = shallowRef<DashboardEvent[] | null>(null)
  const search = ref('')
  const userFilter = ref<UserFilter | null>(null)
  /** 请求面板滚动到指定事件（转至上下文） */
  const scrollTarget = ref<string>()
  const cardGrid = reactive(new CardGrid(settings.value.card.size))
  const stats = useDashboardStats(paid)
  const officialOnline = ref<number | null>(null)
  let officialTimer: ReturnType<typeof setInterval> | undefined

  const pageLoadedAt = Date.now()
  let pendingWrites = new Map<string, DashboardEvent>()
  let flushTimer: ReturnType<typeof setTimeout> | undefined
  let started = false

  watch(() => settings.value.card.size, (size) => cardGrid.resize(size))

  function queueWrite(event: DashboardEvent) {
    pendingWrites.set(event.key, event)
    flushTimer ??= setTimeout(() => void flushWrites(), FLUSH_MS)
  }

  async function flushWrites() {
    flushTimer = undefined
    if (!pendingWrites.size) return
    const batch = [...pendingWrites.values()]
    pendingWrites = new Map()
    await dashboardDB.events.bulkPut(batch)
  }

  function append(target: typeof messages, event: DashboardEvent, max = Infinity) {
    const list = target.value
    list.push(event)
    if (list.length > max) for (const removed of list.splice(0, list.length - max)) known.delete(removed.key)
    triggerRef(target)
  }

  function handleSuperChatDelete(model: EventModel) {
    const ids = getDeletedSuperChatIds(model)
    for (const event of paid.value) {
      if (event.type !== EventDataTypes.SC || event.scId === undefined || !ids.has(String(event.scId))) continue
      deletedKeys.add(event.key)
      queueWrite({ ...event, deleted: true, read: readKeys.has(event.key) })
    }
  }

  function ingest(model: EventModel) {
    if (model.type === EventDataTypes.SCDel) return handleSuperChatDelete(model)
    const event = normalizeEvent(model)
    if (known.has(event.key)) return
    known.add(event.key)

    if (
      event.type === EventDataTypes.Message
      && event.msg.trim() === RELOAD_COMMAND
      && event.uid > 0
      && event.uid === account.value.biliId
      && event.time > pageLoadedAt
    ) {
      location.reload()
      return
    }

    const panel = panelOf(event.type)
    if (panel === 'danmaku') {
      append(messages, event, MAX_MESSAGES)
      cardGrid.ingest(event, settings.value.card)
    } else if (panel === 'interaction') append(interactions, event, MAX_INTERACTIONS)
    else append(paid, event)
    stats.record(event)
    queueWrite(event)
  }

  async function loadRecent() {
    const since = Date.now() - settings.value.historyHours * 3600_000
    const events = await dashboardDB.events.where('time').aboveOrEqual(since).sortBy('time')
    const buckets: Record<'danmaku' | 'interaction' | 'paid', DashboardEvent[]> = { danmaku: [], interaction: [], paid: [] }
    for (const event of events) {
      const panel = panelOf(event.type)
      buckets[panel === 'danmaku' || panel === 'interaction' ? panel : 'paid'].push(event)
      known.add(event.key)
      if (event.read) readKeys.add(event.key)
      if (event.deleted) deletedKeys.add(event.key)
    }
    messages.value = buckets.danmaku.slice(-MAX_MESSAGES)
    interactions.value = buckets.interaction.slice(-MAX_INTERACTIONS)
    paid.value = buckets.paid
    for (const event of messages.value) cardGrid.ingest(event, settings.value.card)
  }

  /** 页面入口调用；网页端按开放平台连接，客户端内复用已建立的连接 */
  async function start() {
    if (started) return
    started = true
    await Promise.all([loadRecent(), notes.load()])
    client.onEvent('all', ingest)
    await client.ensureOpenlive()
    await refreshOfficialStats()
    officialTimer = setInterval(() => void refreshOfficialStats(), 15_000)
  }

  async function stop() {
    if (!started) return
    started = false
    client.offEvent('all', ingest)
    if (officialTimer) clearInterval(officialTimer)
    officialTimer = undefined
    if (flushTimer) clearTimeout(flushTimer)
    await flushWrites()
  }

  async function refreshOfficialStats() {
    const roomId = account.value.biliRoomId
    if (!roomId) return
    const uid = account.value.biliId
    try {
      await fetchOfficialLiveStats(roomId, uid)
      if (officialLiveStats.value.popularity !== null) {
        officialOnline.value = officialLiveStats.value.popularity
      }
    } catch (error) {
      console.warn('[LiveDashboard] 获取官方数据失败', error)
    }
  }

  function isRead(event: DashboardEvent) {
    return readKeys.has(event.key)
  }

  function setRead(events: DashboardEvent[], read: boolean) {
    for (const event of events) {
      if (read) readKeys.add(event.key)
      else readKeys.delete(event.key)
      queueWrite({ ...event, read, deleted: deletedKeys.has(event.key) })
    }
  }

  function toggleRead(event: DashboardEvent) {
    setRead([event], !isRead(event))
  }

  async function setHistoryRange(range: [number, number] | null) {
    historyRange.value = range
    if (!range) {
      historyEvents.value = null
      return
    }
    await flushWrites()
    historyEvents.value = await dashboardDB.events.where('time').between(range[0], range[1], true, true).sortBy('time')
    for (const event of historyEvents.value) if (event.read) readKeys.add(event.key)
  }

  function filterByUser(event: DashboardEvent, contextKey?: string) {
    userFilter.value = { userKey: userKeyOf(event), uname: event.uname, contextKey }
  }

  function backToContext() {
    const contextKey = userFilter.value?.contextKey
    userFilter.value = null
    scrollTarget.value = contextKey
  }

  const predicate = computed(() => {
    const searchPredicate = createSearchPredicate(search.value, (event) => notes.get(userKeyOf(event))?.note)
    const user = userFilter.value?.userKey
    const hideRead = settings.value.hideRead
    if (!searchPredicate && !user && !hideRead) return undefined
    return (event: DashboardEvent) =>
      (!user || userKeyOf(event) === user)
      && (!hideRead || !readKeys.has(event.key))
      && (!searchPredicate || searchPredicate(event))
  })

  const source = computed(() => {
    const history = historyEvents.value
    if (!history) return { messages: messages.value, interactions: interactions.value, paid: paid.value }
    const split = { messages: [] as DashboardEvent[], interactions: [] as DashboardEvent[], paid: [] as DashboardEvent[] }
    for (const event of history) {
      const panel = panelOf(event.type)
      split[panel === 'danmaku' ? 'messages' : panel === 'interaction' ? 'interactions' : 'paid'].push(event)
    }
    return split
  })

  // 源列表原地追加，必须产出新数组，否则下游 computed 视为未变化
  const applyFilter = (list: DashboardEvent[]) => (predicate.value ? list.filter(predicate.value) : list.slice())

  const sortPaid = (list: DashboardEvent[], sort: 'time' | 'price') =>
    list.toSorted(sort === 'price' ? (a, b) => b.price - a.price || b.time - a.time : (a, b) => b.time - a.time)

  const danmakuList = computed(() => applyFilter(source.value.messages))
  const interactionList = computed(() => applyFilter(source.value.interactions))
  const scList = computed(() =>
    sortPaid(applyFilter(source.value.paid.filter((e) => e.type === EventDataTypes.SC && !deletedKeys.has(e.key))), settings.value.sort.sc),
  )
  const giftList = computed(() => {
    const { giftMinPrice, showFreeGift } = settings.value
    return sortPaid(
      applyFilter(source.value.paid.filter((e) =>
        e.type === EventDataTypes.Guard
        || (e.type === EventDataTypes.Gift && (e.price > 0 || showFreeGift) && e.price >= giftMinPrice))),
      settings.value.sort.gift,
    )
  })

  const unreadCounts = computed(() => {
    const unread = (list: DashboardEvent[]) => list.reduce((n, e) => n + (readKeys.has(e.key) ? 0 : 1), 0)
    return { danmaku: 0, sc: unread(scList.value), gift: unread(giftList.value) }
  })

  return {
    settings,
    notes,
    stats,
    officialOnline,
    officialStats: officialLiveStats,
    client,
    readKeys,
    cardGrid,
    search,
    userFilter,
    scrollTarget,
    historyRange,
    danmakuList,
    interactionList,
    scList,
    giftList,
    unreadCounts,
    start,
    stop,
    ingest,
    isRead,
    setRead,
    toggleRead,
    setHistoryRange,
    filterByUser,
    backToContext,
    flushWrites,
  }
})
