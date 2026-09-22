import { describe, expect, it } from 'vitest'

import type { SupportTicketMessage, SupportTicketSummary } from '@/api/api-models'
import { SupportTicketAuthorType, SupportTicketSource, SupportTicketStatus, SupportTicketType } from '@/api/api-models'
import { filterSupportTickets, imagesForMessage, isOwnTicketMessage } from '@/shared/supportTicket'

function ticket(partial: Partial<SupportTicketSummary> = {}): SupportTicketSummary {
  return {
    id: 7,
    title: '弹幕延迟',
    type: SupportTicketType.Bug,
    status: SupportTicketStatus.Open,
    source: SupportTicketSource.User,
    isPublic: false,
    emailOnStaffReply: false,
    createTime: 1,
    updateTime: 1,
    lastMessageTime: 1,
    images: [],
    ...partial,
  }
}

function message(partial: Partial<SupportTicketMessage> = {}): SupportTicketMessage {
  return {
    id: 1,
    authorType: SupportTicketAuthorType.User,
    content: '第一条',
    createTime: 1,
    ...partial,
  }
}

describe('support ticket presentation', () => {
  it('filters by status, type, title and id', () => {
    const tickets = [
      ticket(),
      ticket({ id: 8, title: '积分没到账', type: SupportTicketType.Account, status: SupportTicketStatus.Resolved }),
    ]

    expect(filterSupportTickets(tickets, { status: SupportTicketStatus.Resolved }).map((item) => item.id)).toEqual([8])
    expect(filterSupportTickets(tickets, { type: SupportTicketType.Bug }).map((item) => item.id)).toEqual([7])
    expect(filterSupportTickets(tickets, { keyword: '积分' }).map((item) => item.id)).toEqual([8])
    expect(filterSupportTickets(tickets, { keyword: '7' }).map((item) => item.id)).toEqual([7])
  })

  it('keeps legacy ticket images on the first user message until messages carry their own', () => {
    const image = { id: 3, path: '/a.png', name: 'a.png', size: 10 }
    const current = ticket({
      images: [image],
      messages: [message(), message({ id: 2, authorType: SupportTicketAuthorType.Staff, content: '收到' })],
    })

    expect(imagesForMessage(current, current.messages![0], 0)).toEqual([image])
    expect(imagesForMessage(current, current.messages![1], 1)).toEqual([])

    const attached = message({ images: [image] })
    expect(imagesForMessage(ticket({ images: [image], messages: [attached] }), attached, 0)).toEqual([image])

    const added = { id: 4, path: '/b.png', name: 'b.png', size: 11 }
    const reply = message({ id: 2, images: [added] })
    const mixed = ticket({ images: [image, added], messages: [message(), reply] })
    expect(imagesForMessage(mixed, mixed.messages![0], 0)).toEqual([image])
    expect(imagesForMessage(mixed, reply, 1)).toEqual([added])
  })

  it('treats only the owner view of a user message as their own', () => {
    expect(isOwnTicketMessage(true, SupportTicketAuthorType.User)).toBe(true)
    expect(isOwnTicketMessage(true, SupportTicketAuthorType.Staff)).toBe(false)
    expect(isOwnTicketMessage(false, SupportTicketAuthorType.User)).toBe(false)
  })
})
