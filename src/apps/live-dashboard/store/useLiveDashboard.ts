import { useIntervalFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowRef, triggerRef, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { EventModel } from '@/api/client-types'
import { EventDataTypes, GuardLevel } from '@/api/generated/model'
import { isTauri } from '@/shared/config'
import { fetchOfficialLiveStats, officialLiveStats } from '@/shared/services/officialLiveStats'
import { getDeletedSuperChatIds } from '@/shared/utils/danmakuWindowEvents'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import { pruneArchive } from '../core/archive'
import { CardGrid } from '../core/cardGrid'
import type { LiveHighlightMarker } from '../core/db'
import { dashboardDB } from '../core/db'
import { createSearchPredicate } from '../core/search'
import type { DashboardEvent } from '../core/types'
import { normalizeEvent, panelOf, userKeyOf } from '../core/types'
import { filterByPaidReadMode, useDashboardSettings } from './settings'
import { useDashboardStats } from './stats'
import { useFanProfiles } from './fanProfiles'
import { useUserNotes } from './userNotes'

const MAX_MESSAGES = 3000
const MAX_INTERACTIONS = 500
const MAX_PAID = 2000
const MAX_TRACKED_KEYS = 10_000
const FLUSH_MS = 1000
const RELOAD_COMMAND = '/vt reload'

function addBoundedKey(set: Set<string>, key: string, max = MAX_TRACKED_KEYS) {
  if (set.has(key)) return
  if (set.size >= max) {
    const oldest = set.values().next().value
    if (oldest !== undefined) set.delete(oldest)
  }
  set.add(key)
}

export interface UserFilter {
  userKey: string
  uname: string
  /** 进入筛选前的阅读位置，「转至上下文」时回到这里 */
  contextKey?: string
}

export interface DanmakuDisplayEvent extends DashboardEvent {
  repeatCount?: number
}

const QUESTION_RE = /[?？@＠]|^(?:请问|怎么|为什么|啥|什么|谁|哪里|哪个|多少|几|吗|呢|能不能|可以|是不是)/

export const useLiveDashboard = defineStore('LiveDashboard', () => {
  const client = useDanmakuClient()
  const account = useAccount()
  const settings = useDashboardSettings()
  const notes = useUserNotes()
  const fans = useFanProfiles()

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
  const onlyCurrentSession = ref(false)
  const questionOnly = ref(false)
  /** 共享 30s 相对时间时钟，避免每张卡片独立创建定时器 */
  const minuteNow = ref(Date.now())
  /** 请求面板滚动到指定事件（转至上下文） */
  const scrollTarget = ref<string>()
  const cardGrid = reactive(new CardGrid(settings.value.card.size))
  const stats = useDashboardStats(paid)
  const officialOnline = ref<number | null>(null)
  const markers = ref<LiveHighlightMarker[]>([])
  let officialTimer: ReturnType<typeof setInterval> | undefined
  const minuteClock = useIntervalFn(
    () => {
      minuteNow.value = Date.now()
    },
    30_000,
    { immediate: false },
  )

  const pageLoadedAt = Date.now()
  let pendingWrites = new Map<string, DashboardEvent>()
  let flushTimer: ReturnType<typeof setTimeout> | undefined
  let historyQuerySeq = 0
  let started = false

  watch(
    () => settings.value.card.size,
    (size) => cardGrid.resize(size),
  )

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
      addBoundedKey(deletedKeys, event.key)
      queueWrite({ ...event, deleted: true, read: readKeys.has(event.key) })
    }
  }

  function ingest(model: EventModel) {
    if (model.type === EventDataTypes.SCDel) return handleSuperChatDelete(model)
    const event = normalizeEvent(model)
    if (known.has(event.key)) return
    known.add(event.key)

    if (
      event.type === EventDataTypes.Message &&
      event.msg.trim() === RELOAD_COMMAND &&
      event.uid > 0 &&
      event.uid === account.value.biliId &&
      event.time > pageLoadedAt
    ) {
      location.reload()
      return
    }

    const panel = panelOf(event.type)
    if (panel === 'danmaku') {
      append(messages, event, MAX_MESSAGES)
      cardGrid.ingest(event, settings.value.card)
    } else if (panel === 'interaction') append(interactions, event, MAX_INTERACTIONS)
    else append(paid, event, MAX_PAID)
    stats.record(event)
    queueWrite(event)
    if (event.time > pageLoadedAt) {
      fans.evaluateRealtimeTriggers(event)
      if (event.type === EventDataTypes.Message && isTauri()) {
        void import('@/apps/client/store/useStreamClipRecorder').then(({ useStreamClipRecorder }) => {
          useStreamClipRecorder().recordDanmakuForBurst()
        })
      }
    }

    // 弹幕打点指令识别（例如 !mark 精彩五杀）
    const markPrefix = settings.value.highlight.danmakuMarkPrefix?.trim()
    if (event.type === EventDataTypes.Message && markPrefix && event.time > pageLoadedAt) {
      const text = event.msg.trim()
      if (text.toLowerCase().startsWith(markPrefix.toLowerCase())) {
        const role = settings.value.highlight.danmakuMarkRole
        const isOwner = event.uid > 0 && event.uid === account.value.biliId
        const isGuard = event.guardLevel !== GuardLevel.None
        if (role === 'all' || (role === 'guard' && (isOwner || isGuard)) || (role === 'owner' && isOwner)) {
          const note = text.slice(markPrefix.length).trim() || '弹幕打点'
          void addMarker(note, 'danmaku', event.uname)
        }
      }
    }
  }

  async function loadRecent() {
    const since = Date.now() - settings.value.historyHours * 3600_000
    const events = await dashboardDB.events.where('time').aboveOrEqual(since).sortBy('time')
    const buckets: Record<'danmaku' | 'interaction' | 'paid', DashboardEvent[]> = {
      danmaku: [],
      interaction: [],
      paid: [],
    }
    known.clear()
    readKeys.clear()
    deletedKeys.clear()
    for (const event of events) {
      const panel = panelOf(event.type)
      buckets[panel === 'danmaku' || panel === 'interaction' ? panel : 'paid'].push(event)
      if (event.read) addBoundedKey(readKeys, event.key)
      if (event.deleted) addBoundedKey(deletedKeys, event.key)
    }
    messages.value = buckets.danmaku.slice(-MAX_MESSAGES)
    interactions.value = buckets.interaction.slice(-MAX_INTERACTIONS)
    paid.value = buckets.paid.slice(-MAX_PAID)
    for (const list of [messages.value, interactions.value, paid.value]) {
      for (const event of list) known.add(event.key)
    }
    cardGrid.clear()
    for (const event of messages.value) cardGrid.ingest(event, settings.value.card)
    markers.value = (await dashboardDB.markers.where('time').aboveOrEqual(since).sortBy('time')).toReversed()
  }

  async function reloadArchive() {
    await flushWrites()
    await loadRecent()
    if (historyRange.value) await setHistoryRange(historyRange.value)
  }

  async function addMarker(
    label = '高光时刻',
    source: LiveHighlightMarker['source'] = 'manual',
    author?: string,
    saveReplay?: boolean,
  ) {
    const cleanLabel = label.trim() || '高光时刻'
    let replaySaved = false
    const shouldSaveReplay = saveReplay ?? settings.value.highlight.autoSaveReplayOnMark
    if (shouldSaveReplay && isTauri()) {
      try {
        const { useStreamClipRecorder } = await import('@/apps/client/store/useStreamClipRecorder')
        const recorder = useStreamClipRecorder()
        if (recorder.isBuffering) {
          await recorder.saveClip(cleanLabel)
          replaySaved = true
        }
      } catch {
        // 本地流切片异常时不阻塞打点与 OBS 回放保存
      }
      try {
        const { useOBSStore } = await import('@/apps/client/store/useOBSStore')
        const obsStore = useOBSStore()
        const res = await obsStore.saveReplayBuffer()
        replaySaved = replaySaved || res.ok
        if (!res.ok && saveReplay && !replaySaved) {
          toast.warning(res.message)
        }
      } catch {
        // 客户端 OBS Store 加载失败时不阻塞本地打点
      }
    }

    const entry: LiveHighlightMarker = {
      time: Date.now(),
      label: cleanLabel,
      source,
      author,
      replaySaved,
    }
    const id = await dashboardDB.markers.add(entry)
    markers.value.unshift({ ...entry, id })
    if (markers.value.length > 200) markers.value.pop()
    toast.success(replaySaved ? `已打点并保存回放：${cleanLabel}` : `已打点：${cleanLabel}`)
  }

  async function removeMarker(id: number) {
    await dashboardDB.markers.delete(id)
    markers.value = markers.value.filter((m) => m.id !== id)
  }

  /** 页面入口调用；网页端按开放平台连接，客户端内复用已建立的连接 */
  async function start() {
    if (started) return
    started = true
    await Promise.all([loadRecent(), notes.load()])
    void fans.load()
    void pruneArchive(Math.max(settings.value.historyHours, 168)).catch(() => {})
    client.onEvent('all', ingest)
    await client.ensureOpenlive()
    resumePolling()
  }

  function pausePolling() {
    if (officialTimer) clearInterval(officialTimer)
    officialTimer = undefined
    stats.pause()
    minuteClock.pause()
  }

  function resumePolling() {
    if (!started) return
    stats.resume()
    minuteNow.value = Date.now()
    minuteClock.resume()
    if (!officialTimer) {
      void refreshOfficialStats()
      officialTimer = setInterval(() => void refreshOfficialStats(), 15_000)
    }
  }

  async function stop() {
    if (!started) return
    started = false
    client.offEvent('all', ingest)
    pausePolling()
    if (flushTimer) {
      clearTimeout(flushTimer)
      flushTimer = undefined
    }
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
      if (read) addBoundedKey(readKeys, event.key)
      else readKeys.delete(event.key)
      queueWrite({ ...event, read, deleted: deletedKeys.has(event.key) })
    }
  }

  function toggleRead(event: DashboardEvent) {
    setRead([event], !isRead(event))
  }

  async function setHistoryRange(range: [number, number] | null) {
    const seq = ++historyQuerySeq
    historyRange.value = range
    if (!range) {
      historyEvents.value = null
      return
    }
    await flushWrites()
    if (seq !== historyQuerySeq) return
    const loaded = await dashboardDB.events.where('time').between(range[0], range[1], true, true).sortBy('time')
    if (seq !== historyQuerySeq) return
    historyEvents.value = loaded
    for (const event of loaded) {
      if (event.read) addBoundedKey(readKeys, event.key)
      if (event.deleted) addBoundedKey(deletedKeys, event.key)
    }
  }

  function filterByUser(event: DashboardEvent, contextKey?: string) {
    userFilter.value = { userKey: userKeyOf(event), uname: event.uname, contextKey }
  }

  function backToContext() {
    const contextKey = userFilter.value?.contextKey
    userFilter.value = null
    scrollTarget.value = contextKey
  }

  const basePredicate = computed(() => {
    const searchPredicate = createSearchPredicate(search.value, (event) => notes.get(userKeyOf(event))?.note)
    const user = userFilter.value?.userKey
    const sessionSince = onlyCurrentSession.value && !historyRange.value ? stats.since.value : undefined
    if (!searchPredicate && !user && sessionSince === undefined) return undefined
    return (event: DashboardEvent) =>
      (sessionSince === undefined || event.time >= sessionSince) &&
      (!user || userKeyOf(event) === user) &&
      (!searchPredicate || searchPredicate(event))
  })

  const predicate = computed(() => {
    const base = basePredicate.value
    const hideRead = settings.value.hideRead
    if (!base && !hideRead) return undefined
    return (event: DashboardEvent) => (!hideRead || !readKeys.has(event.key)) && (!base || base(event))
  })

  const source = computed(() => {
    const history = historyEvents.value
    if (!history) return { messages: messages.value, interactions: interactions.value, paid: paid.value }
    const split = {
      messages: [] as DashboardEvent[],
      interactions: [] as DashboardEvent[],
      paid: [] as DashboardEvent[],
    }
    for (const event of history) {
      const panel = panelOf(event.type)
      split[panel === 'danmaku' ? 'messages' : panel === 'interaction' ? 'interactions' : 'paid'].push(event)
    }
    return split
  })

  // 源列表原地追加，必须产出新数组，否则下游 computed 视为未变化
  const applyFilter = (list: DashboardEvent[]) => (predicate.value ? list.filter(predicate.value) : list.slice())
  const applyBaseFilter = (list: DashboardEvent[]) =>
    basePredicate.value ? list.filter(basePredicate.value) : list.slice()

  const filterByReadMode = (list: DashboardEvent[], mode: Parameters<typeof filterByPaidReadMode>[2]) =>
    filterByPaidReadMode(list, readKeys, mode, settings.value.hideRead)

  const sortPaid = (list: DashboardEvent[], sort: 'time' | 'price') =>
    list.toSorted(sort === 'price' ? (a, b) => b.price - a.price || b.time - a.time : (a, b) => b.time - a.time)

  const danmakuList = computed<DanmakuDisplayEvent[]>(() => {
    let list = applyFilter(source.value.messages)
    if (questionOnly.value) {
      list = list.filter((e) => !e.emoji && QUESTION_RE.test(e.msg.trim()))
    }
    if (!settings.value.collapseRepeated || list.length <= 1) return list
    const collapsed: DanmakuDisplayEvent[] = []
    for (const item of list) {
      const text = item.emoji ? '' : item.msg.trim()
      const prev = collapsed[collapsed.length - 1]
      if (text && prev && !prev.emoji && prev.msg.trim() === text) {
        collapsed[collapsed.length - 1] = { ...item, repeatCount: (prev.repeatCount ?? 1) + 1 }
      } else {
        collapsed.push(item)
      }
    }
    return collapsed
  })
  const interactionList = computed(() => applyFilter(source.value.interactions))
  const scBaseList = computed(() =>
    applyBaseFilter(source.value.paid.filter((e) => e.type === EventDataTypes.SC && !deletedKeys.has(e.key))),
  )
  const giftBaseList = computed(() => {
    const { giftMinPrice, showFreeGift } = settings.value
    return applyBaseFilter(
      source.value.paid.filter(
        (e) =>
          e.type === EventDataTypes.Guard ||
          (e.type === EventDataTypes.Gift && (e.price > 0 || showFreeGift) && e.price >= giftMinPrice),
      ),
    )
  })
  const scList = computed(() =>
    sortPaid(filterByReadMode(scBaseList.value, settings.value.paidReadFilter.sc), settings.value.sort.sc),
  )
  const giftList = computed(() =>
    sortPaid(filterByReadMode(giftBaseList.value, settings.value.paidReadFilter.gift), settings.value.sort.gift),
  )

  const unreadCounts = computed(() => {
    const unread = (list: DashboardEvent[]) => list.reduce((n, e) => n + (readKeys.has(e.key) ? 0 : 1), 0)
    return { danmaku: 0, sc: unread(scBaseList.value), gift: unread(giftBaseList.value) }
  })

  return {
    settings,
    notes,
    fans,
    stats,
    officialOnline,
    officialStats: officialLiveStats,
    markers,
    client,
    readKeys,
    cardGrid,
    search,
    userFilter,
    onlyCurrentSession,
    questionOnly,
    minuteNow,
    scrollTarget,
    historyRange,
    danmakuList,
    rawMessages: messages,
    interactionList,
    scList,
    giftList,
    unreadCounts,
    start,
    stop,
    pausePolling,
    resumePolling,
    reloadArchive,
    ingest,
    isRead,
    setRead,
    toggleRead,
    setHistoryRange,
    filterByUser,
    backToContext,
    flushWrites,
    addMarker,
    removeMarker,
  }
})
