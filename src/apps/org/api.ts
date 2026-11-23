import type { PointOrderStatus, ResponsePointOrder2OwnerModel } from '@/api/generated/model'
import { vtsuruMutator } from '@/api/orval-mutator'

import type {
  MyAuthorizedOrgItem,
  OrgAuditItem,
  OrgAuditListResult,
  OrgInfoModel,
  OrgPointGoodsItem,
} from './types'

interface ApiResp<T> {
  code: number
  message: string
  data: T
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined | null>) {
  if (!params) return path
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v))
  }
  const q = sp.toString()
  return q ? `${path}?${q}` : path
}

function postJson<T>(url: string, data?: unknown) {
  return vtsuruMutator<ApiResp<T>>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
}

export function postOrgCreate(payload: { name: string; description?: string }) {
  return postJson<OrgInfoModel>('/api/org/create', payload)
}

export function postOrgUpdate(orgId: number, payload: { name: string; description?: string }) {
  return postJson<unknown>(`/api/org/${orgId}/update`, payload)
}

export function postOrgRenameLegacy(orgId: number, payload: { name: string }) {
  return postJson<unknown>(`/api/org/${orgId}/rename`, payload)
}

export function postOrgMemberPermission(orgId: number, payload: { targetUserId: number; canViewRevenue: boolean }) {
  return postJson<unknown>(`/api/org/${orgId}/member/permission`, payload)
}

export function getMyAuthorizedOrgs() {
  return vtsuruMutator<ApiResp<MyAuthorizedOrgItem[]>>('/api/org/my-authorized', {
    method: 'GET',
  })
}

export function postRevokeSelfStreamerAuth(orgId: number) {
  return postJson<unknown>(`/api/org/${orgId}/streamer/revoke-self`)
}

export function postUpdateSelfStreamerPermission(orgId: number, allowPointManage: boolean) {
  return postJson<unknown>(`/api/org/${orgId}/streamer/self-permission`, { allowPointManage })
}

export function getOrgAuditsPaged(
  orgId: number,
  params: { take?: number; skip?: number; actionPrefix?: string },
) {
  return vtsuruMutator<ApiResp<OrgAuditListResult | OrgAuditItem[]>>(
    buildUrl(`/api/org/${orgId}/audit`, params),
    { method: 'GET' },
  )
}

export function getOrgPointGoodsPaged(
  orgId: number,
  params?: { streamerId?: number; page?: number; pageSize?: number },
) {
  return vtsuruMutator<ApiResp<OrgPointGoodsItem[]> & { total?: number }>(
    buildUrl(`/api/org/${orgId}/points/goods`, params),
    { method: 'GET' },
  )
}

export function postOrgServiceOrderUpdate(
  orgId: number,
  payload: {
    orderId: number
    status?: PointOrderStatus
    reason?: string
    appointmentAt?: number
    deliveryUrl?: string
    message?: string
  },
) {
  return postJson<ResponsePointOrder2OwnerModel>(`/api/org/${orgId}/points/orders/service-update`, payload)
}
