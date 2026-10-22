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
    class="grid gap-2 w-full py-3 px-3.5 border-0 border-b border-border text-foreground bg-transparent text-left cursor-pointer transition-colors hover:bg-muted"
    :class="{ 'bg-muted shadow-[inset_3px_0_var(--brand)]': active }"
  >
    <span class="flex items-center gap-2 min-w-0">
      <span
        v-if="hasUnread(ticket)"
        class="size-1.5 shrink-0 rounded-full bg-[var(--brand)]"
        aria-label="有新消息"
      />
      <span class="flex-1 overflow-hidden text-sm font-semibold truncate">{{ ticket.title }}</span>
      <Badge
        :variant="badgeVariant"
        class="text-[10px] h-4.5 px-1.5 font-normal shrink-0"
      >
        {{ supportTicketStatusMeta[ticket.status].label }}
      </Badge>
    </span>
    <span class="flex items-center justify-between gap-2 min-w-0 text-muted-foreground text-xs">
      <span>#{{ ticket.id }} · {{ supportTicketTypeLabel(ticket.type) }}</span>
      <span>{{ relativeTime }}</span>
    </span>
  </button>
</template>
