<script setup lang="ts">
import type { SupportTicketSummary } from '@/api/api-models'

import { formatTicketTime, hasUnreadTicketMessage, ticketStatusColors, ticketStatusLabels } from './ticketPresentation'

defineProps<{
  ticket: SupportTicketSummary
  active: boolean
}>()

const typeLabels = ['问题', '功能建议', '账号', '其他']
</script>

<template>
  <button
    type="button"
    class="ticket-item"
    :class="{ active }"
  >
    <span class="ticket-item__heading">
      <span
        v-if="hasUnreadTicketMessage(ticket)"
        class="ticket-item__unread"
        aria-label="有新消息"
      />
      <span class="ticket-item__title">{{ ticket.title }}</span>
      <UBadge
        size="sm"
        :color="ticketStatusColors[ticket.status]"
        :label="ticketStatusLabels[ticket.status]"
      />
    </span>
    <span class="ticket-item__meta">
      <span>#{{ ticket.id }} · {{ typeLabels[ticket.type] }}</span>
      <span>{{ formatTicketTime(ticket.lastMessageTime) }}</span>
    </span>
  </button>
</template>

<style scoped>
.ticket-item {
  display: grid;
  gap: 8px;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-bottom: 1px solid var(--vtsuru-border);
  color: var(--vtsuru-fg);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.ticket-item:hover,
.ticket-item.active {
  background: var(--vtsuru-bg-muted);
}

.ticket-item.active {
  box-shadow: inset 3px 0 var(--vtsuru-brand);
}

.ticket-item__heading,
.ticket-item__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.ticket-item__title {
  flex: 1;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ticket-item__meta {
  justify-content: space-between;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.ticket-item__unread {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: var(--vtsuru-brand);
}
</style>
