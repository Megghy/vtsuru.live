export interface UserBasicInfo {
  name: string
  id: number
  isBiliAuthed: boolean
  faceUrl?: string
}

export interface OrgInfoModel {
  id: number
  name: string
  ownerUserId: number
  role: number
}

export interface ChartItem {
  income: number
  interactionCount: number
  danmakuCount: number
  payingUsers: number
  interactionUsers: number
  liveMinutes: number
  likeCount: number
}

export interface SummaryRangeData {
  totalIncome: number
  totalInteractions: number
  totalDanmakuCount: number
  totalLiveMinutes: number
  dailyAvgIncome: number
  dailyAvgDanmaku: number
  incomeTrend: number
  interactionTrend: number
  danmakuTrend: number
  activeLiveDays: number
  interactionUsers: number
  payingUsers: number
  interactionUsersTrend?: number
  payingUsersTrend?: number
}

export interface Summary {
  last7Days: SummaryRangeData
  last30Days: SummaryRangeData
}

export interface AnalyzeData {
  summary: Summary
  chartData: Record<number, ChartItem>
}

export type SummaryRange = 'last7Days' | 'last30Days'

export interface LiveInfoModel {
  liveId: string
  isFinish: boolean
  parentArea: string
  area: string
  coverUrl: string
  danmakusCount: number
  startAt: number
  stopAt: number | null
  title: string
  totalIncome: number
  totalIncomeWithGuard: number
  likeCount: number
  paymentCount: number
  interactionCount: number
}

export interface OrgLiveItem {
  streamer: UserBasicInfo
  live: LiveInfoModel
}

export interface OrgStreamerItem {
  streamer: UserBasicInfo
  status: number
  addedAt: number
  respondedAt: number | null
  addedByUserId: number
}

export interface OrgMemberItem {
  user: UserBasicInfo
  role: number
  joinedAt: number
}

export interface StreamerLiveSummary {
  totalIncome: number
  totalIncomeWithGuard: number
  totalDanmakuCount: number
  totalInteractionCount: number
  totalLikeCount: number
  totalPayCount: number
  totalLiveMinutes: number
  totalUniqueInteractionUsers: number
  totalUniquePayingUsers: number
  liveCount: number
}

export interface HeatmapDataItem {
  timestamp: number
  value: number
}

export interface OrgStreamerDetailModel {
  streamer: UserBasicInfo
  status: number
  note: string | null
  addedAt: number
  respondedAt: number | null
  summary: StreamerLiveSummary
  heatmap: HeatmapDataItem[]
  lives: LiveInfoModel[]
  page: number
  pageSize: number
}

export interface OrgInviteResponseModel {
  token: string
  expiresAt: number
  joinUrl: string
}

export interface OrgInviteMemberListItem {
  token: string
  joinUrl: string
  expiresAt: number
  status: number
  role: number
  createdByUserId: number
  createdByUserName: string | null
  targetUserId: number | null
  targetUserName: string | null
  usedCount: number
  lastUsedAt: number | null
  isRevoked: boolean
}

export interface OrgInviteStreamerListItem {
  token: string
  joinUrl: string
  expiresAt: number
  status: number
  createdByUserId: number
  createdByUserName: string | null
  targetStreamerUserId: number | null
  targetStreamerUserName: string | null
  usedCount: number
  lastUsedAt: number | null
  isRevoked: boolean
}

export type StreamerOption = {
  label: string
  value: number
}
