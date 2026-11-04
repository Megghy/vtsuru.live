<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed } from 'vue'

import type { SupportTicketModel } from '@/api/generated/model'
import { SupportTicketStatus } from '@/api/generated/model'
import { supportTicketStatusMeta, supportTicketTypeLabel } from '@/shared/supportTicket'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

const props = defineProps<{
  ticket: SupportTicketModel
  active: boolean
}>()

function hasUnread(ticket: SupportTicketModel) {
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
  <Button
    variant="ghost"
    class="grid gap-2 w-full h-auto py-3 px-3.5 border-0 border-b border-border rounded-none text-left font-normal"
    :class="{ 'bg-muted shadow-[inset_3px_0_var(--brand)]': active }"
  >
    <span class="flex items-center gap-2 min-w-0">
      <span
        v-if="hasUnread(ticket)"
        class="size-1.5 shrink-0 rounded-full bg-[var(--brand)]"
        aria-label="有新消息"
      />
      <span class="flex-1 overflow-hidden text-sm font-semibold truncate">{{ ticket.title }}</span>
      <Badge :variant="badgeVariant">
        {{ supportTicketStatusMeta[ticket.status].label }}
      </Badge>
    </span>
    <span class="flex-between gap-2 min-w-0 text-muted-foreground text-xs">
      <span>#{{ ticket.id }} · {{ supportTicketTypeLabel(ticket.type) }}</span>
      <span>{{ relativeTime }}</span>
    </span>
  </Button>
</template>
