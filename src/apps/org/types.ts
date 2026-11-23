import type { ResponseLiveInfoModel } from '@/api/generated/model/responseLiveInfoModel'
import type { ResponseOrgStreamerDetailModel } from '@/api/generated/model/responseOrgStreamerDetailModel'

export interface UserBasicInfo {
  name: string
  id: number
  isBiliAuthed: boolean
  faceUrl?: string
}

export interface OrgInfoModel {
  id: number
  name: string
  description?: string | null
  ownerUserId: number
  ownerName?: string | null
  role: number
  canViewRevenue?: boolean
  memberCount?: number
  streamerCount?: number
  liveStreamerCount?: number
}

export interface MyAuthorizedOrgItem {
  orgId: number
  orgName: string
  orgDescription?: string | null
  ownerUserId: number
  ownerName?: string | null
  allowPointManage: boolean
  addedAt: number
  respondedAt?: number | null
}

export interface ChartItem {
  income: number
  interactionCount: number
  danmakuCount: number
  payingUsers: number
  interactionUsers: number
  liveMinutes: number
}

export interface SummaryRangeData {
  totalIncome: number
  totalInteractions: number
  totalDanmakuCount: number
  totalLiveMinutes: number
  incomeTrend: number
  interactionTrend: number
  danmakuTrend: number
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

export type LiveInfoModel = ResponseLiveInfoModel

export interface OrgLiveItem {
  streamer: UserBasicInfo
  live: LiveInfoModel
}

export interface OrgStreamerItem {
  streamer: UserBasicInfo
  status: number
  allowPointManage?: boolean
  note?: string | null
  addedAt: number
  respondedAt: number | null
  addedByUserId: number
}

export interface OrgMemberItem {
  user: UserBasicInfo
  role: number
  canViewRevenue?: boolean
  joinedAt: number
}

export type OrgStreamerDetailModel = ResponseOrgStreamerDetailModel & {
  totalLives?: number
  allowPointManage?: boolean
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
  createdByName?: string | null
  createdByUserName?: string | null
  targetUserId: number | null
  targetUserName: string | null
  usedCount: number
  maxUses?: number | null
  lastUsedAt: number | null
  isRevoked: boolean
}

export interface OrgInviteStreamerListItem {
  token: string
  joinUrl: string
  expiresAt: number
  status: number
  createdByUserId: number
  createdByName?: string | null
  createdByUserName?: string | null
  targetStreamerUserId: number | null
  targetStreamerUserName: string | null
  usedCount: number
  maxUses?: number | null
  allowPointManage?: boolean
  lastUsedAt: number | null
  isRevoked: boolean
}

export interface OrgPointGoodsItem {
  id: number
  name: string
  description?: string | null
  price: number
  stock: number
  streamerId?: number
  streamerName?: string | null
  status?: number
}

export interface OrgAuditItem {
  id: number
  action: string
  detail: string
  createdAt: number
  userId: number
  userName?: string | null
}

export interface OrgAuditListResult {
  items: OrgAuditItem[]
  total: number
}

export type StreamerOption = {
  label: string
  value: number
}
