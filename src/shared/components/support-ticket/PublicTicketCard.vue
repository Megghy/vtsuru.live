<script setup lang="ts">
import type { SupportTicketSummary } from '@/api/api-models'
import { NTag, NTime } from 'naive-ui'

defineProps<{
  ticket: SupportTicketSummary
}>()

const statusLabels = ['待处理', '处理中', '等待回复', '已解决']
const statusTypes = ['default', 'info', 'warning', 'success'] as const
const typeLabels = ['产品问题', '功能建议', '账号问题', '其他']
</script>

<template>
  <button type="button" class="public-ticket-card">
    <img
      v-if="ticket.images[0]"
      class="public-ticket-card__image"
      :src="ticket.images[0].path"
      :alt="ticket.images[0].name"
    >
    <div class="public-ticket-card__body">
      <div class="public-ticket-card__tags">
        <NTag size="small" :type="statusTypes[ticket.status]" :bordered="false">
          {{ statusLabels[ticket.status] }}
        </NTag>
        <span>{{ typeLabels[ticket.type] }}</span>
      </div>
      <h2>{{ ticket.title }}</h2>
      <div class="public-ticket-card__meta">
        <span>#{{ ticket.id }}</span>
        <NTime :time="ticket.lastMessageTime" type="relative" />
      </div>
    </div>
  </button>
</template>

<style scoped>
.public-ticket-card {
  display: grid;
  min-width: 0;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  color: var(--vtsuru-fg);
  background: var(--vtsuru-bg);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.public-ticket-card:hover {
  border-color: var(--vtsuru-brand);
  background: var(--vtsuru-bg-muted);
}

.public-ticket-card__image {
  width: 100%;
  aspect-ratio: 16 / 8;
  object-fit: cover;
  border-bottom: 1px solid var(--vtsuru-border);
}

.public-ticket-card__body {
  display: flex;
  min-height: 132px;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
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
