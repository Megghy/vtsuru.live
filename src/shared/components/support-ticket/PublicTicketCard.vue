<script setup lang="ts">
import { NTag, NTime } from 'naive-ui'

import type { SupportTicketSummary } from '@/api/api-models'
import { supportTicketStatusMeta, supportTicketTypeLabel } from '@/shared/supportTicket'

defineProps<{
  ticket: SupportTicketSummary
}>()
</script>

<template>
  <button
    type="button"
    class="public-ticket-card"
  >
    <img
      v-if="ticket.images[0]"
      class="public-ticket-card__image"
      :src="ticket.images[0].path"
      :alt="ticket.images[0].name"
    />
    <div class="public-ticket-card__body">
      <div class="public-ticket-card__tags">
        <NTag
          size="small"
          :type="supportTicketStatusMeta[ticket.status].type"
          :bordered="false"
        >
          {{ supportTicketStatusMeta[ticket.status].label }}
        </NTag>
        <span>{{ supportTicketTypeLabel(ticket.type) }}</span>
      </div>
      <h2>{{ ticket.title }}</h2>
      <div class="public-ticket-card__meta">
        <span>#{{ ticket.id }}</span>
        <NTime
          :time="ticket.lastMessageTime"
          type="relative"
        />
      </div>
    </div>
  </button>
</template>

<style scoped>
.public-ticket-card {
  display: flex;
  min-width: 0;
  min-height: 96px;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  color: var(--vtsuru-fg);
  background: var(--vtsuru-bg);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
}

.public-ticket-card:hover {
  border-color: var(--vtsuru-brand);
  background: var(--vtsuru-bg-muted);
}

.public-ticket-card__image {
  width: 96px;
  height: 96px;
  flex: 0 0 96px;
  align-self: center;
  object-fit: cover;
  border-right: 1px solid var(--vtsuru-border);
}

.public-ticket-card__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
}

.public-ticket-card__tags,
.public-ticket-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.public-ticket-card h2 {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--vtsuru-fg);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  letter-spacing: 0;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.public-ticket-card__meta {
  margin-top: auto;
}
</style>
