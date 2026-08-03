import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

import { SupportTicketStatus } from '@/api/api-models'

export const ticketStatusLabels = ['待处理', '处理中', '等待回复', '已解决']
export const ticketStatusColors = ['neutral', 'info', 'warning', 'success'] as const

export function formatTicketTime(time: number | string | Date) {
  return formatDistanceToNow(new Date(time), { addSuffix: true, locale: zhCN })
}

export function hasUnreadTicketMessage(ticket: {
  status: SupportTicketStatus
  lastMessageId?: number
  userLastReadMessageId?: number
}) {
  return (
    ticket.status !== SupportTicketStatus.Resolved && (ticket.lastMessageId ?? 0) > (ticket.userLastReadMessageId ?? 0)
  )
}
