import { computed, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'

import {
  addFanMemory,
  type FanDashboardActivityItem,
  type FanProfileDashboardItem,
  type FanReminderItem,
  getFanDashboardIndex,
  importLocalFanNotes,
  saveQuickFanNote,
  summarizeFanAi,
  toggleFanStar,
} from '@/api/fanProfile'
import { EventDataTypes } from '@/api/generated/model'

import { dashboardDB } from '../core/db'
import type { DashboardEvent } from '../core/types'

export interface FanLiveAlert {
  id: string
  kind: 'birthday' | 'anniversary' | 'dormant' | 'renamed'
  title: string
  detail: string
  event: DashboardEvent
  createdAt: number
}

export interface FanInlineMeta {
  profile?: FanProfileDashboardItem
  isStarred: boolean
  nickname: string
  pronunciation: string
  tags: string[]
  taboos: string
  isBirthdayToday: boolean
  isAnniversaryToday: boolean
  anniversaryTitle: string
  renamedFrom: string
  dormantDays: number | null
  hasProfile: boolean
}

const DORMANT_THRESHOLD_DAYS = 30
const DORMANT_MIN_LIVES = 3

function isTodayMonthDay(month?: number | null, day?: number | null): boolean {
  if (!month || !day) return false
  const now = new Date()
  return now.getMonth() + 1 === month && now.getDate() === day
}

function isTodayDateStr(dateStr?: string | null, repeatYearly = true): boolean {
  if (!dateStr) return false
  const parts = dateStr.slice(0, 10).split('-').map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return false
  const [y, m, d] = parts
  const now = new Date()
  if (now.getMonth() + 1 !== m || now.getDate() !== d) return false
  return repeatYearly ? now.getFullYear() >= y : now.getFullYear() === y
}

function matchTodayAnniversary(profile?: FanProfileDashboardItem): string {
  if (!profile) return ''
  for (const item of profile.anniversaries ?? []) {
    if (isTodayDateStr(item.date, item.repeatYearly)) {
      return item.title || '纪念日'
    }
  }
  if (isTodayDateStr(profile.anniversaryDate, true)) {
    return '入坑纪念日'
  }
  return ''
}

export function useFanProfiles() {
  const byOuid = reactive(new Map<string, FanProfileDashboardItem>())
  const byUid = reactive(new Map<number, FanProfileDashboardItem>())
  const activityByOuid = reactive(new Map<string, FanDashboardActivityItem>())
  const activityByUid = reactive(new Map<number, FanDashboardActivityItem>())

  const loaded = ref(false)
  const loading = ref(false)
  const upcomingReminders = ref<FanReminderItem[]>([])
  const todayReminders = computed(() => upcomingReminders.value.filter((r) => r.daysUntil === 0))
  const todayReminderDialogOpen = ref(false)
  const alerts = ref<FanLiveAlert[]>([])
  const unsyncedLocalNoteCount = ref(0)
  const syncingNotes = ref(false)

  /** 同场会话每个粉丝每类提醒最多触发一次 */
  const triggeredKeys = new Set<string>()

  function indexProfile(p: FanProfileDashboardItem) {
    if (p.canonicalOUId) byOuid.set(p.canonicalOUId.toLowerCase(), p)
    for (const alias of p.aliasOUIds ?? []) {
      if (alias) byOuid.set(alias.toLowerCase(), p)
    }
    if (p.uId && p.uId > 0) byUid.set(p.uId, p)
  }

  async function load() {
    if (loading.value) return
    loading.value = true
    try {
      const res = await getFanDashboardIndex()
      if (res.code !== 200 || !res.data) return

      byOuid.clear()
      byUid.clear()
      activityByOuid.clear()
      activityByUid.clear()

      for (const p of res.data.profiles) {
        indexProfile(p)
      }
      for (const act of res.data.recentActivity) {
        if (act.oUId) activityByOuid.set(act.oUId.toLowerCase(), act)
        if (act.uId && act.uId > 0) activityByUid.set(act.uId, act)
      }
      upcomingReminders.value = res.data.upcomingReminders ?? []
      loaded.value = true
      await checkUnsyncedLocalNotes()
    } catch (err) {
      console.warn('[FanProfiles] 加载云端粉丝索引失败', err)
    } finally {
      loading.value = false
    }
  }

  async function checkUnsyncedLocalNotes() {
    const localNotes = await dashboardDB.notes.toArray()
    let count = 0
    for (const n of localNotes) {
      if (!n.note?.trim()) continue
      const key = n.userKey
      let cloud: FanProfileDashboardItem | undefined
      if (key.startsWith('u:')) {
        cloud = byUid.get(Number(key.slice(2)))
      } else if (key.startsWith('o:')) {
        cloud = byOuid.get(key.slice(2).toLowerCase())
      }
      if (!cloud || !cloud.note?.trim()) {
        count++
      }
    }
    unsyncedLocalNoteCount.value = count
  }

  async function syncLocalNotesToCloud() {
    if (syncingNotes.value) return
    syncingNotes.value = true
    try {
      const localNotes = await dashboardDB.notes.toArray()
      const entries = localNotes
        .filter((n) => n.note?.trim())
        .map((n) => ({
          userKey: n.userKey,
          uName: n.uname ?? '',
          note: n.note.trim(),
        }))
      if (entries.length === 0) {
        unsyncedLocalNoteCount.value = 0
        return
      }
      const res = await importLocalFanNotes(entries)
      if (res.code === 200 && res.data) {
        toast.success(`已同步本地备注到云端：新增 ${res.data.imported}，更新 ${res.data.updated}`)
        await load()
      } else {
        toast.error(res.message || '同步备注失败')
      }
    } finally {
      syncingNotes.value = false
    }
  }

  function resolveProfile(event: Pick<DashboardEvent, 'uid' | 'ouid'>): FanProfileDashboardItem | undefined {
    if (event.ouid) {
      const hit = byOuid.get(event.ouid.toLowerCase())
      if (hit) return hit
    }
    if (event.uid > 0) {
      return byUid.get(event.uid)
    }
    return undefined
  }

  function resolveActivity(event: Pick<DashboardEvent, 'uid' | 'ouid'>): FanDashboardActivityItem | undefined {
    if (event.ouid) {
      const hit = activityByOuid.get(event.ouid.toLowerCase())
      if (hit) return hit
    }
    if (event.uid > 0) {
      return activityByUid.get(event.uid)
    }
    return undefined
  }

  function getInlineMeta(event: Pick<DashboardEvent, 'uid' | 'ouid' | 'uname'>): FanInlineMeta {
    const profile = resolveProfile(event)
    const activity = resolveActivity(event)

    const isBirthdayToday = isTodayMonthDay(profile?.birthdayMonth, profile?.birthdayDay)
    const anniversaryTitle = matchTodayAnniversary(profile)
    const isAnniversaryToday = !!anniversaryTitle

    const knownPrev = profile?.latestKnownName || activity?.lastName || ''
    const renamedFrom =
      knownPrev && event.uname && knownPrev !== event.uname && !!profile ? knownPrev : ''

    let dormantDays: number | null = null
    const lastActive = profile?.lastActiveAt || activity?.lastActiveAt
    const liveCount = Math.max(profile?.liveCount ?? 0, activity?.liveCount ?? 0)
    if (lastActive && liveCount >= DORMANT_MIN_LIVES) {
      const diffDays = Math.floor((Date.now() - new Date(lastActive).getTime()) / 86_400_000)
      if (diffDays >= DORMANT_THRESHOLD_DAYS) {
        dormantDays = diffDays
      }
    }

    return {
      profile,
      isStarred: !!profile?.isStarred,
      nickname: profile?.nickname || '',
      pronunciation: profile?.pronunciation || '',
      tags: (profile?.tags ?? []).slice(0, 2),
      taboos: profile?.taboos || '',
      isBirthdayToday,
      isAnniversaryToday,
      anniversaryTitle,
      renamedFrom,
      dormantDays,
      hasProfile: !!(
        profile &&
        (profile.isStarred ||
          profile.nickname ||
          profile.note ||
          profile.tags.length > 0 ||
          profile.aiSummary ||
          profile.birthdayMonth ||
          (profile.anniversaries?.length ?? 0) > 0)
      ),
    }
  }

  function pushAlert(alert: Omit<FanLiveAlert, 'id' | 'createdAt'>) {
    const item: FanLiveAlert = {
      ...alert,
      id: `${alert.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    }
    alerts.value = [item, ...alerts.value].slice(0, 4)
  }

  function dismissAlert(id: string) {
    alerts.value = alerts.value.filter((a) => a.id !== id)
  }

  function evaluateRealtimeTriggers(event: DashboardEvent) {
    if (!loaded.value) return
    if (!event.ouid && event.uid <= 0) return

    const idKey = event.ouid ? event.ouid.toLowerCase() : `u:${event.uid}`
    const meta = getInlineMeta(event)
    const displayName = meta.nickname
      ? `${meta.nickname} (${event.uname})`
      : event.uname || `UID ${event.uid}`

    if (meta.isBirthdayToday && !triggeredKeys.has(`bday:${idKey}`)) {
      triggeredKeys.add(`bday:${idKey}`)
      pushAlert({
        kind: 'birthday',
        title: `${displayName} 今天过生日`,
        detail: meta.profile?.taboos ? `注意：${meta.profile.taboos}` : '可以顺口送上一句生日祝福',
        event,
      })
    } else if (meta.isAnniversaryToday && !triggeredKeys.has(`ann:${idKey}`)) {
      triggeredKeys.add(`ann:${idKey}`)
      pushAlert({
        kind: 'anniversary',
        title: `${displayName} 今天是「${meta.anniversaryTitle || '入坑纪念日'}」`,
        detail: meta.profile?.note ? meta.profile.note.slice(0, 40) : '老粉纪念日到了',
        event,
      })
    }

    if (meta.dormantDays !== null && !triggeredKeys.has(`dormant:${idKey}`)) {
      triggeredKeys.add(`dormant:${idKey}`)
      pushAlert({
        kind: 'dormant',
        title: `久别重逢：${displayName}`,
        detail: `距上次出现已过 ${meta.dormantDays} 天`,
        event,
      })
    }

    if (meta.renamedFrom && !triggeredKeys.has(`rename:${idKey}`)) {
      triggeredKeys.add(`rename:${idKey}`)
      pushAlert({
        kind: 'renamed',
        title: `${displayName} 改名了`,
        detail: `此前昵称：${meta.renamedFrom}`,
        event,
      })
    }
  }

  async function quickSave(
    event: Pick<DashboardEvent, 'uid' | 'ouid' | 'uname'>,
    patch: { nickname?: string; note?: string; tags?: string[] },
  ) {
    const res = await saveQuickFanNote({
      oUId: event.ouid || undefined,
      uId: event.uid > 0 ? event.uid : undefined,
      latestKnownName: event.uname || undefined,
      ...patch,
    })
    if (res.code === 200 && res.data) {
      indexProfile(res.data)
      return res.data
    }
    toast.error(res.message || '保存粉丝档案失败')
    return null
  }

  async function rememberEvent(event: DashboardEvent) {
    const content =
      event.type === EventDataTypes.Gift
        ? `赠送 ${event.msg || '礼物'} ×${event.num}${event.price > 0 ? ` (¥${event.price})` : ''}`
        : event.type === EventDataTypes.Guard
          ? `${event.msg || '开通大航海'}${event.price > 0 ? ` (¥${event.price})` : ''}`
          : event.msg?.trim() || ''
    if (!content) {
      toast.warning('该条事件没有可收藏的文字内容')
      return false
    }
    const res = await addFanMemory({
      oUId: event.ouid || undefined,
      uId: event.uid > 0 ? event.uid : undefined,
      latestKnownName: event.uname || undefined,
      content,
      context: `中控台收藏 · ${event.uname}`,
      eventType: event.type,
      price: event.price > 0 ? event.price : undefined,
    })
    if (res.code === 200) {
      const existing = resolveProfile(event)
      if (existing) existing.memoryCount++
      else void load()
      toast.success('已收藏为粉丝记忆片段')
      return true
    }
    toast.error(res.message || '收藏失败')
    return false
  }

  async function toggleStar(event: Pick<DashboardEvent, 'uid' | 'ouid' | 'uname'>) {
    if (!event.ouid && event.uid <= 0) return false
    const existing = resolveProfile(event)
    const next = !existing?.isStarred
    const res = await toggleFanStar({
      oUId: event.ouid || undefined,
      uId: event.uid > 0 ? event.uid : undefined,
      latestKnownName: event.uname || undefined,
      isStarred: next,
    })
    if (res.code === 200) {
      if (existing) {
        existing.isStarred = next
      } else {
        void load()
      }
      toast.success(next ? '已设为重点粉丝' : '已取消重点粉丝')
      return true
    }
    toast.error(res.message || '切换重点粉丝失败')
    return false
  }

  async function summarize(event: Pick<DashboardEvent, 'uid' | 'ouid' | 'uname'>) {
    const res = await summarizeFanAi({
      oUId: event.ouid || undefined,
      uId: event.uid > 0 ? event.uid : undefined,
      latestKnownName: event.uname || undefined,
    })
    if (res.code === 200 && res.data) {
      const d = res.data
      if (d.profileId) {
        indexProfile({
          profileId: d.profileId,
          canonicalOUId: d.canonicalOUId,
          uId: d.uId,
          aliasOUIds: d.aliasOUIds,
          isStarred: d.isStarred,
          nickname: d.nickname,
          pronunciation: d.pronunciation,
          birthdayMonth: d.birthdayMonth,
          birthdayDay: d.birthdayDay,
          anniversaryDate: d.anniversaryDate,
          anniversaries: d.anniversaries ?? [],
          tags: d.tags,
          taboos: d.taboos,
          note: d.note,
          latestKnownName: d.latestKnownName,
          aiSummary: d.aiSummary,
          aiStyle: d.aiStyle,
          memoryCount: d.memories.length,
          pendingFactCount: d.pendingFacts.length,
          liveCount: d.liveCount,
          totalPrice: d.totalPrice,
          lastActiveAt: d.lastActiveAt,
          guardLevel: d.guard?.guardLevel ?? 0,
          isActiveGuard: d.guard?.isActive ?? false,
        })
      }
      toast.success('AI 粉丝画像已更新')
      return res.data
    }
    toast.error(res.message || 'AI 画像生成失败')
    return null
  }

  return reactive({
    loaded,
    loading,
    byOuid,
    byUid,
    upcomingReminders,
    todayReminders,
    todayReminderDialogOpen,
    alerts,
    unsyncedLocalNoteCount,
    syncingNotes,
    load,
    syncLocalNotesToCloud,
    resolveProfile,
    resolveActivity,
    getInlineMeta,
    evaluateRealtimeTriggers,
    dismissAlert,
    quickSave,
    toggleStar,
    rememberEvent,
    summarize,
  })
}
