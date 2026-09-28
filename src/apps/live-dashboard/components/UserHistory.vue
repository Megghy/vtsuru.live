<script setup lang="ts">
import { NTabPane, NTabs } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { EventDataTypes } from '@/api/api-models'

import { queryUserHistory } from '../core/archive'
import { formatPrice, paidSummary } from '../core/format'
import type { DashboardEvent } from '../core/types'
import { EVENT_TYPE_LABELS, INTERACTION_TYPES, PAID_TYPES } from '../core/types'
import { useLiveDashboard } from '../store/useLiveDashboard'

const props = defineProps<{ event: DashboardEvent }>()
const dashboard = useLiveDashboard()

type Tab = 'all' | 'message' | 'sc' | 'gift' | 'interaction'
const tab = ref<Tab>('all')
const history = ref<DashboardEvent[]>()

watch(
  () => props.event.key,
  async () => {
    history.value = undefined
    await dashboard.flushWrites()
    history.value = await queryUserHistory(props.event)
  },
  { immediate: true },
)

const TAB_FILTER: Record<Tab, (e: DashboardEvent) => boolean> = {
  all: () => true,
  message: (e) => e.type === EventDataTypes.Message,
  sc: (e) => e.type === EventDataTypes.SC,
  gift: (e) => e.type === EventDataTypes.Gift || e.type === EventDataTypes.Guard,
  interaction: (e) => INTERACTION_TYPES.has(e.type),
}

const list = computed(() => (history.value ?? []).filter(TAB_FILTER[tab.value]).slice(0, 200))

const summary = computed(() => {
  const events = history.value ?? []
  const spent = events.reduce((sum, e) => sum + (PAID_TYPES.has(e.type) ? e.price : 0), 0)
  // 按最近出现排序（history 已按时间倒序）
  const names = [...new Set(events.map((e) => e.uname).filter(Boolean))]
  const medals = new Map<string, { first: number; max: number; current: number }>()
  for (const e of events.toReversed()) {
    if (!e.medalName || e.medalLevel <= 0) continue
    const m = medals.get(e.medalName)
    if (!m) medals.set(e.medalName, { first: e.medalLevel, max: e.medalLevel, current: e.medalLevel })
    else {
      m.max = Math.max(m.max, e.medalLevel)
      m.current = e.medalLevel
    }
  }
  return { spent, names, medals: [...medals] }
})

function describe(e: DashboardEvent) {
  if (e.type === EventDataTypes.Message || e.type === EventDataTypes.SC) return e.emoji ? '[表情]' : e.msg
  if (e.type === EventDataTypes.Gift || e.type === EventDataTypes.Guard) return paidSummary(e)
  return EVENT_TYPE_LABELS[e.type]
}
</script>

<template>
  <div class="history">
    <div
      v-if="history"
      class="history__summary"
    >
      <span>本地记录 {{ history.length }} 条</span>
      <span v-if="summary.spent > 0">累计消费 {{ formatPrice(summary.spent) }}</span>
    </div>
    <div
      v-if="summary.names.length > 1"
      class="history__meta"
    >
      曾用名：{{ summary.names.join('、') }}
    </div>
    <div
      v-if="summary.medals.length"
      class="history__meta"
    >
      勋章：
      <span
        v-for="[name, m] in summary.medals"
        :key="name"
        class="history__medal"
      >{{ name }} {{ m.first === m.current ? m.current : `${m.first}→${m.current}` }}<template v-if="m.max > m.current">（最高 {{ m.max }}）</template></span>
    </div>
    <NTabs
      v-model:value="tab"
      size="small"
      type="segment"
    >
      <NTabPane
        name="all"
        tab="全部"
      />
      <NTabPane
        name="message"
        tab="弹幕"
      />
      <NTabPane
        name="sc"
        tab="SC"
      />
      <NTabPane
        name="gift"
        tab="礼物"
      />
      <NTabPane
        name="interaction"
        tab="互动"
      />
    </NTabs>
    <div class="history__list">
      <div
        v-for="e in list"
        :key="e.key"
        class="history__row"
      >
        <span class="history__time">{{ new Date(e.time).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) }}</span>
        <span class="history__type">{{ EVENT_TYPE_LABELS[e.type] }}</span>
        <span class="history__text">{{ describe(e) }}</span>
        <span
          v-if="PAID_TYPES.has(e.type) && e.price > 0"
          class="history__price"
        >{{ formatPrice(e.price) }}</span>
      </div>
      <div
        v-if="history && !list.length"
        class="history__empty"
      >
        没有记录
      </div>
    </div>
  </div>
</template>

<style scoped>
.history {
  display: grid;
  gap: 6px;
  font-size: 12px;
}

.history__summary {
  display: flex;
  justify-content: space-between;
  color: var(--vtsuru-fg-muted);
}

.history__meta {
  color: var(--vtsuru-fg-muted);
  overflow-wrap: anywhere;
}

.history__medal + .history__medal::before {
  content: '、';
}

.history__list {
  max-height: 240px;
  overflow-y: auto;
  display: grid;
  gap: 2px;
  align-content: start;
}

.history__row {
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.history__time,
.history__type {
  color: var(--vtsuru-fg-muted);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.history__text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.history__price {
  flex-shrink: 0;
  font-weight: 600;
}

.history__empty {
  color: var(--vtsuru-fg-disabled);
  text-align: center;
  padding: 8px 0;
}
</style>
