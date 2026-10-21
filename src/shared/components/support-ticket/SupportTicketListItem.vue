<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed } from 'vue'

import type { SupportTicketSummary } from '@/api/api-models'
import { SupportTicketStatus } from '@/api/api-models'
import { supportTicketStatusMeta, supportTicketTypeLabel } from '@/shared/supportTicket'
import { Badge } from '@/shared/ui/badge'

const props = defineProps<{
  ticket: SupportTicketSummary
  active: boolean
}>()

function hasUnread(ticket: SupportTicketSummary) {
  return (
    ticket.status !== SupportTicketStatus.Resolved && (ticket.lastMessageId ?? 0) > (ticket.userLastReadMessageId ?? 0)
  )
}

const relativeTime = computed(() => {
  try {
    return formatDistanceToNow(new Date(props.ticket.lastMessageTime), { addSuffix: true, locale: zhCN })
  } catch {
    return String(props.ticket.lastMessageTime)
  }
})

const badgeVariant = computed(() => {
  const type = supportTicketStatusMeta[props.ticket.status].type
  if (type === 'success') return 'default'
  if (type === 'info') return 'secondary'
  return 'outline'
})
</script>

<template>
  <button
    type="button"
    class="ticket-item"
    :class="{ active }"
  >
    <span class="ticket-item__heading">
      <span
        v-if="hasUnread(ticket)"
        class="ticket-item__unread"
        aria-label="有新消息"
      />
      <span class="ticket-item__title">{{ ticket.title }}</span>
      <Badge
        :variant="badgeVariant"
        class="text-[10px] h-4.5 px-1.5 font-normal shrink-0"
      >
        {{ supportTicketStatusMeta[ticket.status].label }}
      </Badge>
    </span>
    <span class="ticket-item__meta">
      <span>#{{ ticket.id }} · {{ supportTicketTypeLabel(ticket.type) }}</span>
      <span>{{ relativeTime }}</span>
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
  border-bottom: 1px solid var(--border);
  color: var(--foreground);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.ticket-item:hover,
.ticket-item.active {
  background: var(--muted);
}

.ticket-item.active {
  box-shadow: inset 3px 0 var(--brand);
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
  color: var(--muted-foreground);
  font-size: 12px;
}

.ticket-item__unread {
  width: 7px;
  height: 7px;
  flex: 0 0 7px;
  border-radius: 50%;
  background: var(--brand);
}
</style>
