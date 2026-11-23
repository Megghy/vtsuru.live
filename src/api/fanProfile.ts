import { EventDataTypes } from '@/api/generated/model'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { getCurrentAPIUrl } from '@/shared/config'

function fanApi(path: string) {
  return new URL(`/api/fan-profile/${path}`, getCurrentAPIUrl()).toString()
}

export interface FanMemoryItem {
  id: string
  content: string
  context?: string | null
  eventType?: EventDataTypes | null
  price?: number | null
  sourceLiveId?: string | null
  createdAt: string
}

export interface FanAnniversaryItem {
  id: string
  title: string
  date: string
  repeatYearly: boolean
}

export interface FanMilestoneItem {
  key: string
  kind: 'first_seen' | 'first_guard' | 'peak_interact' | 'peak_spend' | 'milestone_lives' | 'anniversary' | string
  title: string
  date: string
  detail: string
}

export interface FanCandidateFact {
  id: string
  kind: 'birthday' | 'nickname' | 'tag' | 'note' | 'taboo' | 'memory' | string
  label: string
  value: string
  evidence: string
  sourceLiveId?: string | null
  createdAt: string
}

export interface FanProfileDashboardItem {
  profileId: number
  canonicalOUId: string
  uId?: number | null
  aliasOUIds: string[]
  isStarred: boolean
  nickname: string
  pronunciation: string
  birthdayMonth?: number | null
  birthdayDay?: number | null
  anniversaryDate?: string | null
  anniversaries: FanAnniversaryItem[]
  tags: string[]
  taboos: string
  note: string
  latestKnownName: string
  aiSummary: string
  aiStyle: string
  memoryCount: number
  pendingFactCount: number
  liveCount: number
  totalPrice: number
  lastActiveAt?: string | null
  guardLevel: number
  isActiveGuard: boolean
}

export interface FanDashboardActivityItem {
  oUId: string
  uId?: number | null
  liveCount: number
  interactCount: number
  totalPrice: number
  lastActiveAt: string
  lastName: string
}

export interface FanReminderItem {
  profileId: number
  canonicalOUId: string
  uId?: number | null
  displayName: string
  latestKnownName: string
  avatar?: string | null
  kind: 'birthday' | 'anniversary' | string
  title: string
  daysUntil: number
  month: number
  day: number
  dateLabel: string
  years?: number | null
}

export interface FanDashboardIndexResponse {
  profiles: FanProfileDashboardItem[]
  recentActivity: FanDashboardActivityItem[]
  upcomingReminders: FanReminderItem[]
}

export interface FanOverviewStats {
  totalProfiles: number
  starredCount: number
  upcomingBirthdays: number
  pendingFactsCount: number
  activeGuardsCount: number
  dormantOldFansCount: number
}

export interface FanListItem {
  profileId?: number | null
  canonicalOUId: string
  uId?: number | null
  isStarred: boolean
  displayName: string
  latestKnownName: string
  avatar?: string | null
  nickname: string
  pronunciation: string
  birthdayMonth?: number | null
  birthdayDay?: number | null
  daysUntilBirthday?: number | null
  anniversaryDate?: string | null
  tags: string[]
  notePreview: string
  aiSummary: string
  aiStyle: string
  memoryCount: number
  pendingFactCount: number
  liveCount: number
  danmakuCount: number
  interactCount: number
  totalPrice: number
  firstActiveAt?: string | null
  lastActiveAt?: string | null
  dormantDays?: number | null
  guardLevel: number
  isActiveGuard: boolean
  accompanyDays: number
  updatedAt?: string | null
}

export interface FanListResponse {
  stats: FanOverviewStats
  total: number
  items: FanListItem[]
  upcomingReminders: FanReminderItem[]
}

export interface FanLiveHistoryItem {
  liveId: string
  title: string
  startDate: string
  danmakuCount: number
  giftCount: number
  scCount: number
  guardCount: number
  interactCount: number
  totalPrice: number
  firstTime: string
  lastTime: string
  lastName: string
}

export interface FanDanmakuItem {
  time: string
  type: EventDataTypes
  name: string
  message: string
  num: number
  price: number
  emojiUrl?: string | null
  mysteryBoxName?: string | null
}

export interface FanDetailResponse {
  profileId?: number | null
  canonicalOUId: string
  uId?: number | null
  aliasOUIds: string[]
  avatar?: string | null
  isAuthed: boolean

  isStarred: boolean
  nickname: string
  pronunciation: string
  birthdayMonth?: number | null
  birthdayDay?: number | null
  daysUntilBirthday?: number | null
  anniversaryDate?: string | null
  anniversaries: FanAnniversaryItem[]
  tags: string[]
  taboos: string
  note: string
  latestKnownName: string
  nameHistory: string[]

  memories: FanMemoryItem[]
  milestones: FanMilestoneItem[]

  aiSummary: string
  aiStyle: string
  aiPersonaTags: string[]
  aiSharedMemes: string[]
  aiUpdatedAt?: string | null

  pendingFacts: FanCandidateFact[]

  liveCount: number
  danmakuCount: number
  giftCount: number
  scCount: number
  guardCount: number
  interactCount: number
  totalPrice: number
  firstActiveAt?: string | null
  lastActiveAt?: string | null

  guard?: {
    guardLevel: number
    isActive: boolean
    accompanyDays: number
    lastUpdateTime: string
  } | null
  point?: {
    point: number
    consecutiveCheckInDays: number
    totalCheckInDays: number
    lastCheckInTime?: string | null
    orderCount: number
  } | null
  recentLives: FanLiveHistoryItem[]
  recentDanmakus: FanDanmakuItem[]
  recentOrders: {
    id: number
    goodsName: string
    count: number
    point: number
    status: string
    remark?: string | null
    createdAt: string
  }[]
  recentSongRequests: {
    id: number
    songName: string
    from: string
    status: string
    price?: number | null
    createdAt: string
  }[]
  recentQAs: {
    id: number
    question: string
    answer?: string | null
    tag?: string | null
    createdAt: string
  }[]
}

export interface ExtractLiveFactsResponse {
  liveId: string
  scannedMessages: number
  newFactsCount: number
  items: {
    canonicalOUId: string
    uId?: number | null
    fanName: string
    fact: FanCandidateFact
  }[]
}

export function getFanDashboardIndex() {
  return QueryGetAPI<FanDashboardIndexResponse>(fanApi('dashboard-index'))
}

export function getFanList(params: {
  keyword?: string
  filter?: string
  tag?: string
  sort?: string
  page?: number
  pageSize?: number
}) {
  return QueryGetAPI<FanListResponse>(fanApi('list'), params)
}

export function getFanDetail(params: { ouid?: string; uid?: number }) {
  return QueryGetAPI<FanDetailResponse>(fanApi('detail'), params)
}

export function getFanDanmakus(params: {
  ouid?: string
  uid?: number
  type?: EventDataTypes
  liveId?: string
  limit?: number
  offset?: number
}) {
  return QueryGetAPI<FanDanmakuItem[]>(fanApi('danmakus'), params)
}

export function saveFanProfile(body: {
  oUId?: string
  uId?: number
  latestKnownName?: string
  isStarred?: boolean
  nickname?: string
  pronunciation?: string
  birthdayMonth?: number | null
  birthdayDay?: number | null
  anniversaryDate?: string | null
  anniversaries?: FanAnniversaryItem[]
  tags?: string[]
  taboos?: string
  note?: string
}) {
  return QueryPostAPI<FanDetailResponse>(fanApi('save'), body)
}

export function saveQuickFanNote(body: {
  oUId?: string
  uId?: number
  latestKnownName?: string
  isStarred?: boolean
  nickname?: string
  note?: string
  tags?: string[]
}) {
  return QueryPostAPI<FanProfileDashboardItem>(fanApi('quick-note'), body)
}

export function addFanMemory(body: {
  oUId?: string
  uId?: number
  latestKnownName?: string
  content: string
  context?: string
  eventType?: EventDataTypes
  price?: number
  sourceLiveId?: string
}) {
  return QueryPostAPI<FanMemoryItem>(fanApi('memory/add'), body)
}

export function deleteFanMemory(body: { oUId?: string; uId?: number; memoryId: string }) {
  return QueryPostAPI<boolean>(fanApi('memory/delete'), body)
}

export function resolveFanCandidateFact(body: {
  oUId?: string
  uId?: number
  factId: string
  accept: boolean
}) {
  return QueryPostAPI<FanDetailResponse>(fanApi('fact/resolve'), body)
}

export function summarizeFanAi(body: { oUId?: string; uId?: number; latestKnownName?: string }) {
  return QueryPostAPI<FanDetailResponse>(fanApi('ai/summarize'), body)
}

export function extractLiveFanFacts(liveId: string) {
  return QueryPostAPI<ExtractLiveFactsResponse>(fanApi('ai/extract-live'), { liveId })
}

export function mergeFanProfiles(body: {
  targetOUId?: string
  targetUId?: number
  sourceOUId?: string
  sourceUId?: number
}) {
  return QueryPostAPI<FanDetailResponse>(fanApi('merge'), body)
}

export function importLocalFanNotes(
  entries: { userKey: string; oUId?: string; uId?: number; uName: string; note: string }[],
) {
  return QueryPostAPI<{ imported: number; updated: number; skipped: number }>(fanApi('import-notes'), { entries })
}

export interface FanCalendarEventItem {
  profileId: number
  canonicalOUId: string
  uId?: number | null
  displayName: string
  latestKnownName: string
  avatar?: string | null
  kind: 'birthday' | 'anniversary'
  title: string
  date: string
  month: number
  day: number
  years?: number | null
}

export interface FanExportResponse {
  exportedAt: string
  count: number
  profiles: Record<string, unknown>[]
}

export function toggleFanStar(body: { oUId?: string; uId?: number; latestKnownName?: string; isStarred: boolean }) {
  return QueryPostAPI<boolean>(fanApi('star'), body)
}

export function createManualFanProfile(body: {
  uId: number
  displayName?: string
  nickname?: string
  isStarred?: boolean
  birthdayMonth?: number | null
  birthdayDay?: number | null
  tags?: string[]
  note?: string
}) {
  return QueryPostAPI<FanDetailResponse>(fanApi('create'), body)
}

export function exportFanProfiles() {
  return QueryGetAPI<FanExportResponse>(fanApi('export'))
}

export function getFanCalendarEvents(params: { year: number; month: number }) {
  return QueryGetAPI<FanCalendarEventItem[]>(fanApi('calendar-events'), params)
}
