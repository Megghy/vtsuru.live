<script setup lang="ts">
import type { SupportTicketSummary } from '@/api/api-models'
import { SupportTicketStatus } from '@/api/api-models'
import { NTag, NTime } from 'naive-ui'

defineProps<{
  ticket: SupportTicketSummary
  active: boolean
}>()

const statusLabels = ['待处理', '处理中', '等待回复', '已解决']
const statusTypes = ['default', 'info', 'warning', 'success'] as const
const typeLabels = ['问题', '功能建议', '账号', '其他']

function hasUnread(ticket: SupportTicketSummary) {
  return ticket.status !== SupportTicketStatus.Resolved
    && (ticket.lastMessageId ?? 0) > (ticket.userLastReadMessageId ?? 0)
}
</script>

<template>
  <button
    type="button"
    class="ticket-item"
    :class="{ active }"
  >
    <span class="ticket-item__heading">
      <span v-if="hasUnread(ticket)" class="ticket-item__unread" aria-label="有新消息" />
      <span class="ticket-item__title">{{ ticket.title }}</span>
      <NTag size="small" :type="statusTypes[ticket.status]" :bordered="false">
        {{ statusLabels[ticket.status] }}
      </NTag>
    </span>
    <span class="ticket-item__meta">
      <span>#{{ ticket.id }} · {{ typeLabels[ticket.type] }}</span>
      <NTime :time="ticket.lastMessageTime" type="relative" />
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
