import { ref } from 'vue'

import type { APIRoot } from '@/api/client-types'
import type {
  APIFileModel,
  GoodsStatus,
  GoodsTypes,
  GuardLevel,
  ResponsePointOrder2UserModel,
  ResponseUserBasicInfo,
  ServiceConfigData,
  ShippingAddressInfo,
} from '@/api/generated/model'
import { vtsuruMutator } from '@/api/orval-mutator'
import { unwrapOk } from '@/api/query'

export const GuardLevelMatchMode = {
  Exact: 0,
  AtLeast: 1,
} as const
export type GuardLevelMatchMode = (typeof GuardLevelMatchMode)[keyof typeof GuardLevelMatchMode]

export const GuardQuantityMode = {
  Fixed: 0,
  PerMonth: 1,
} as const
export type GuardQuantityMode = (typeof GuardQuantityMode)[keyof typeof GuardQuantityMode]

export const GrantLimitMode = {
  Unlimited: 0,
  OncePerMonth: 1,
  OnceForever: 2,
} as const
export type GrantLimitMode = (typeof GrantLimitMode)[keyof typeof GrantLimitMode]

export const RewardGrantStatus = {
  Unclaimed: 0,
  Claimed: 1,
  Expired: 2,
  Revoked: 3,
  Failed: 4,
} as const
export type RewardGrantStatus = (typeof RewardGrantStatus)[keyof typeof RewardGrantStatus]

export const RewardGrantSource = {
  GuardAuto: 0,
  Manual: 1,
} as const
export type RewardGrantSource = (typeof RewardGrantSource)[keyof typeof RewardGrantSource]

export interface GrantRuleModel {
  id: number
  name: string
  enabled: boolean
  triggerType: number
  guardLevel: GuardLevel
  guardMatchMode: GuardLevelMatchMode
  goodsId: number
  subItemId?: number | null
  goodsName: string
  subItemName?: string | null
  goodsType: GoodsTypes
  goodsStatus: GoodsStatus
  remainingStock?: number | null
  quantityMode: GuardQuantityMode
  quantity: number
  limitMode: GrantLimitMode
  expireDays?: number | null
  remark?: string | null
  createAt: number
}

export interface SaveGrantRulePayload {
  id?: number
  name?: string
  enabled: boolean
  guardLevel: GuardLevel
  guardMatchMode: GuardLevelMatchMode
  goodsId: number
  subItemId?: number | null
  quantityMode: GuardQuantityMode
  quantity: number
  limitMode: GrantLimitMode
  expireDays?: number | null
  remark?: string
}

export interface ManualGrantRecipient {
  uId?: number
  ouId?: string
  name?: string
}

export interface ManualGrantPayload {
  goodsId: number
  subItemId?: number | null
  quantity: number
  expireDays?: number | null
  remark?: string
  recipients: ManualGrantRecipient[]
}

export interface OwnerGrantRecordModel {
  id: number
  ruleId?: number | null
  source: RewardGrantSource
  ouId: string
  uId?: number | null
  authId?: number | null
  isAuthed: boolean
  receiverName: string
  goodsId: number
  subItemId?: number | null
  goodsName: string
  subItemName?: string | null
  goodsType: GoodsTypes
  quantity: number
  status: RewardGrantStatus
  failReason?: string | null
  remark?: string | null
  createAt: number
  expireAt?: number | null
  claimedAt?: number | null
  orderId?: number | null
}

export interface OwnerGrantListResponse {
  items: OwnerGrantRecordModel[]
  total: number
  unclaimedCount: number
  claimedCount: number
  failedCount: number
}

export interface UserGrantRecordModel {
  id: number
  owner?: ResponseUserBasicInfo | null
  source: RewardGrantSource
  goodsId: number
  subItemId?: number | null
  goodsName: string
  subItemName?: string | null
  goodsDescription?: string | null
  goodsType: GoodsTypes
  cover?: APIFileModel | null
  quantity: number
  needAddress: boolean
  collectUrl?: string | null
  embedCollectUrl: boolean
  serviceConfig?: ServiceConfigData | null
  hasPrivateAttachments: boolean
  status: RewardGrantStatus
  remark?: string | null
  createAt: number
  expireAt?: number | null
  claimedAt?: number | null
  orderId?: number | null
}

export interface ClaimGrantPayload {
  grantId: number
  address?: ShippingAddressInfo
  answers?: Record<string, string>
  remark?: string
}

export interface ActiveGuardMemberItem {
  guardOUId: string
  username: string
  guardLevel: string
  accompanyDays: number
  isActive: boolean
  lastUpdateTime: string
}

// 观众侧全局待领取红点数量，便于侧边栏与页面即时联动
export const userUnclaimedGrantCount = ref(0)

export async function fetchGrantRules(): Promise<GrantRuleModel[]> {
  return unwrapOk(await vtsuruMutator<APIRoot<GrantRuleModel[]>>('/api/point/grant-rules'), '获取自动发放规则失败')
}

export async function saveGrantRule(payload: SaveGrantRulePayload): Promise<GrantRuleModel> {
  return unwrapOk(
    await vtsuruMutator<APIRoot<GrantRuleModel>>('/api/point/grant-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    '保存自动发放规则失败',
  )
}

export async function toggleGrantRule(id: number, enabled: boolean): Promise<boolean> {
  return unwrapOk(
    await vtsuruMutator<APIRoot<boolean>>('/api/point/grant-rules/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    }),
    '更新规则状态失败',
  )
}

export async function deleteGrantRule(id: number): Promise<boolean> {
  return unwrapOk(
    await vtsuruMutator<APIRoot<boolean>>('/api/point/grant-rules/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }),
    '删除规则失败',
  )
}

export async function manualGrantRewards(payload: ManualGrantPayload): Promise<OwnerGrantRecordModel[]> {
  return unwrapOk(
    await vtsuruMutator<APIRoot<OwnerGrantRecordModel[]>>('/api/point/grants/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    '手动发放失败',
  )
}

export async function fetchOwnerGrants(params?: {
  status?: RewardGrantStatus
  source?: RewardGrantSource
  keyword?: string
  page?: number
  pageSize?: number
}): Promise<OwnerGrantListResponse> {
  const qs = new URLSearchParams()
  if (params?.status !== undefined) qs.set('status', String(params.status))
  if (params?.source !== undefined) qs.set('source', String(params.source))
  if (params?.keyword?.trim()) qs.set('keyword', params.keyword.trim())
  if (params?.page) qs.set('page', String(params.page))
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return unwrapOk(
    await vtsuruMutator<APIRoot<OwnerGrantListResponse>>(`/api/point/grants${suffix}`),
    '获取发放记录失败',
  )
}

export async function revokeGrant(id: number): Promise<OwnerGrantRecordModel> {
  return unwrapOk(
    await vtsuruMutator<APIRoot<OwnerGrantRecordModel>>('/api/point/grants/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }),
    '撤回发放失败',
  )
}

export async function retryGrant(id: number): Promise<OwnerGrantRecordModel> {
  return unwrapOk(
    await vtsuruMutator<APIRoot<OwnerGrantRecordModel>>('/api/point/grants/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }),
    '重新发放失败',
  )
}

export async function fetchActiveGuardMembers(activeOnly = true): Promise<ActiveGuardMemberItem[]> {
  return unwrapOk(
    await vtsuruMutator<APIRoot<ActiveGuardMemberItem[]>>(`/api/history/guards-list?activeOnly=${activeOnly}`),
    '获取在舰成员列表失败',
  )
}

export async function fetchUserUnclaimedGrantCount(headers: HeadersInit): Promise<number> {
  const count = unwrapOk(
    await vtsuruMutator<APIRoot<number>>('/api/point/user/grants/count', { headers }),
    '获取待领取数量失败',
  )
  userUnclaimedGrantCount.value = count
  return count
}

export async function fetchUserGrants(
  headers: HeadersInit,
  status?: RewardGrantStatus,
): Promise<UserGrantRecordModel[]> {
  const suffix = status !== undefined ? `?status=${status}` : ''
  const list = unwrapOk(
    await vtsuruMutator<APIRoot<UserGrantRecordModel[]>>(`/api/point/user/grants${suffix}`),
    '获取待领取列表失败',
  )
  if (status === undefined) {
    userUnclaimedGrantCount.value = list.filter((item) => item.status === RewardGrantStatus.Unclaimed).length
  }
  return list
}

export async function claimUserGrant(
  headers: HeadersInit,
  payload: ClaimGrantPayload,
): Promise<ResponsePointOrder2UserModel> {
  const order = unwrapOk(
    await vtsuruMutator<APIRoot<ResponsePointOrder2UserModel>>('/api/point/user/grants/claim', {
      method: 'POST',
      headers: {
        ...Object.fromEntries(new Headers(headers).entries()),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }),
    '领取礼物失败',
  )
  userUnclaimedGrantCount.value = Math.max(0, userUnclaimedGrantCount.value - 1)
  return order
}
