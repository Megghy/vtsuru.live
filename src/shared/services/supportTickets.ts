import type {
  CreateSupportTicketRequest,
  SupportTicketDetail,
  SupportTicketMessage,
  SupportTicketSummary,
} from '@/api/api-models'
import { QueryGetAPI, QueryPatchAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import { SUPPORT_TICKET_API_URL } from '@/shared/config'

export async function getMySupportTickets() {
  const response = await QueryGetAPI<SupportTicketSummary[]>(`${SUPPORT_TICKET_API_URL}mine`)
  return unwrapOk(response, '无法获取我的工单')
}

export async function getPublicSupportTickets() {
  const response = await QueryGetAPI<SupportTicketSummary[]>(`${SUPPORT_TICKET_API_URL}public`)
  return unwrapOk(response, '无法获取公开工单')
}

export async function getSupportTicket(id: number) {
  const response = await QueryGetAPI<SupportTicketDetail>(`${SUPPORT_TICKET_API_URL}${id}`)
  return unwrapOk(response, '无法获取工单详情')
}

export async function createSupportTicket(request: CreateSupportTicketRequest) {
  const response = await QueryPostAPI<SupportTicketDetail>(SUPPORT_TICKET_API_URL, request)
  return unwrapOk(response, '创建工单失败')
}

export async function addSupportTicketMessage(id: number, content: string) {
  const response = await QueryPostAPI<SupportTicketMessage>(`${SUPPORT_TICKET_API_URL}${id}/messages`, { content })
  return unwrapOk(response, '回复失败')
}

export async function updateSupportTicketPreferences(
  id: number,
  preferences: { isPublic: boolean, emailOnStaffReply: boolean },
) {
  const response = await QueryPatchAPI<unknown>(`${SUPPORT_TICKET_API_URL}${id}/preferences`, preferences)
  unwrapOk(response, '保存偏好失败')
}

export async function resolveSupportTicket(id: number) {
  const response = await QueryPostAPI<unknown>(`${SUPPORT_TICKET_API_URL}${id}/resolve`)
  unwrapOk(response, '更新工单状态失败')
}
