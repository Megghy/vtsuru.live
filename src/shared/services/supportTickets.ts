import type { CreateSupportTicketRequest } from '@/api/api-models'
import {
  getApiSupportTicketsId,
  getApiSupportTicketsMine,
  getApiSupportTicketsPublic,
  patchApiSupportTicketsIdPreferences,
  postApiSupportTickets,
  postApiSupportTicketsIdMessages,
  postApiSupportTicketsIdResolve,
} from '@/api/generated/support-ticket/support-ticket'
import { unwrapOk } from '@/api/query'

export async function getMySupportTickets() {
  return unwrapOk(await getApiSupportTicketsMine(), '无法获取我的工单')
}

export async function getPublicSupportTickets() {
  return unwrapOk(await getApiSupportTicketsPublic(), '无法获取公开工单')
}

export async function getSupportTicket(id: number) {
  return unwrapOk(await getApiSupportTicketsId(id), '无法获取工单详情')
}

export async function createSupportTicket(request: CreateSupportTicketRequest) {
  return unwrapOk(await postApiSupportTickets(request), '创建工单失败')
}

export async function addSupportTicketMessage(id: number, content: string, imageFileIds: number[] = []) {
  return unwrapOk(await postApiSupportTicketsIdMessages(id, { content, imageFileIds }), '回复失败')
}

export async function updateSupportTicketPreferences(
  id: number,
  preferences: { isPublic: boolean; emailOnStaffReply: boolean },
) {
  unwrapOk(await patchApiSupportTicketsIdPreferences(id, preferences), '保存偏好失败')
}

export async function resolveSupportTicket(id: number) {
  unwrapOk(await postApiSupportTicketsIdResolve(id), '更新工单状态失败')
}
