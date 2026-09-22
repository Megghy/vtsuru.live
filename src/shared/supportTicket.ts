import type { SupportTicketMessage, SupportTicketSummary } from '@/api/api-models'
import { SupportTicketAuthorType, SupportTicketStatus, SupportTicketType } from '@/api/api-models'

export const supportTicketStatusMeta: Record<
  SupportTicketStatus,
  { label: string; type: 'default' | 'info' | 'warning' | 'success' }
> = {
  [SupportTicketStatus.Open]: { label: '待处理', type: 'default' },
  [SupportTicketStatus.InProgress]: { label: '处理中', type: 'info' },
  [SupportTicketStatus.WaitingForUser]: { label: '等待回复', type: 'warning' },
  [SupportTicketStatus.Resolved]: { label: '已解决', type: 'success' },
}

export const supportTicketTypeOptions = [
  { label: '产品问题', value: SupportTicketType.Bug },
  { label: '功能建议', value: SupportTicketType.Feature },
  { label: '账号问题', value: SupportTicketType.Account },
  { label: '其他', value: SupportTicketType.Other },
]

export const supportTicketStatusOptions = (
  Object.values(SupportTicketStatus).filter((value) => typeof value === 'number') as SupportTicketStatus[]
).map((value) => ({ label: supportTicketStatusMeta[value].label, value }))

const typeLabels = Object.fromEntries(supportTicketTypeOptions.map((option) => [option.value, option.label])) as Record<
  SupportTicketType,
  string
>

export function supportTicketTypeLabel(type: SupportTicketType) {
  return typeLabels[type]
}

export function filterSupportTickets(
  tickets: SupportTicketSummary[],
  query: { keyword?: string; status?: SupportTicketStatus | null; type?: SupportTicketType | null },
) {
  const keyword = query.keyword?.trim().toLowerCase() ?? ''
  return tickets.filter((ticket) => {
    if (query.status != null && ticket.status !== query.status) return false
    if (query.type != null && ticket.type !== query.type) return false
    if (!keyword) return true
    return ticket.title.toLowerCase().includes(keyword) || String(ticket.id).includes(keyword)
  })
}

export function imagesForMessage(
  ticket: SupportTicketSummary | undefined,
  message: SupportTicketMessage,
  index: number,
) {
  if (!ticket || message.images?.length) return message.images ?? []
  const messages = ticket.messages ?? []
  const attachedIds = new Set(messages.flatMap((item) => item.images ?? []).map((image) => image.id))
  const legacy = ticket.images.filter((image) => !attachedIds.has(image.id))
  if (!legacy.length) return []
  const firstUserIndex = messages.findIndex((item) => item.authorType === SupportTicketAuthorType.User)
  return index === (firstUserIndex === -1 ? 0 : firstUserIndex) ? legacy : []
}

export function isOwnTicketMessage(editable: boolean, authorType: SupportTicketAuthorType) {
  return editable && authorType === SupportTicketAuthorType.User
}
