<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed } from 'vue'

import type { SupportTicketModel } from '@/api/generated/model'
import { supportTicketStatusMeta, supportTicketTypeLabel } from '@/shared/supportTicket'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

const props = defineProps<{
  ticket: SupportTicketModel
}>()

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
    variant="outline"
    class="flex min-w-0 min-h-24 h-auto overflow-hidden p-0 rounded-lg text-left font-normal items-stretch justify-start"
  >
    <img
      v-if="ticket.images[0]"
      class="size-24 shrink-0 self-center object-cover border-r border-border"
      :src="ticket.images[0].path"
      :alt="ticket.images[0].name"
    />
    <div class="flex min-w-0 flex-1 flex-col gap-2 py-3 px-3.5">
      <div class="flex-between gap-2.5 text-muted-foreground text-xs">
        <Badge :variant="badgeVariant">
          {{ supportTicketStatusMeta[ticket.status].label }}
        </Badge>
        <span>{{ supportTicketTypeLabel(ticket.type) }}</span>
      </div>
      <h2 class="line-clamp-2 m-0 text-foreground text-[15px] font-semibold leading-normal wrap-anywhere">
        {{ ticket.title }}
      </h2>
      <div class="flex-between gap-2.5 text-muted-foreground text-xs mt-auto">
        <span>#{{ ticket.id }}</span>
        <span>{{ relativeTime }}</span>
      </div>
    </div>
  </Button>
</template>
