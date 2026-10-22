<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { EventDataTypes } from '@/api/api-models'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'

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
  <div class="grid gap-1.5 text-xs">
    <div
      v-if="history"
      class="flex-between text-muted-foreground"
    >
      <span>本地记录 {{ history.length }} 条</span>
      <span v-if="summary.spent > 0">累计消费 {{ formatPrice(summary.spent) }}</span>
    </div>
    <div
      v-if="summary.names.length > 1"
      class="text-muted-foreground wrap-anywhere"
    >
      曾用名：{{ summary.names.join('、') }}
    </div>
    <div
      v-if="summary.medals.length"
      class="text-muted-foreground wrap-anywhere"
    >
      勋章：
      <span
        v-for="[name, m] in summary.medals"
        :key="name"
        class="history__medal"
        >{{ name }} {{ m.first === m.current ? m.current : `${m.first}→${m.current}`
        }}<template v-if="m.max > m.current">（最高 {{ m.max }}）</template></span
      >
    </div>
    <Tabs
      v-model="tab"
      class="w-full"
    >
      <TabsList
        size="xs"
        class="grid w-full grid-cols-5"
      >
        <TabsTrigger value="all"> 全部 </TabsTrigger>
        <TabsTrigger value="message"> 弹幕 </TabsTrigger>
        <TabsTrigger value="sc"> SC </TabsTrigger>
        <TabsTrigger
          value="gift"
          class="text-xs py-1"
        >
          礼物
        </TabsTrigger>
        <TabsTrigger
          value="interaction"
          class="text-xs py-1"
        >
          互动
        </TabsTrigger>
      </TabsList>
    </Tabs>
    <div class="max-h-[240px] overflow-y-auto grid gap-0.5 content-start">
      <div
        v-for="e in list"
        :key="e.key"
        class="flex gap-1.5 items-baseline"
      >
        <span class="text-muted-foreground shrink-0 tabular-nums">{{
          new Date(e.time).toLocaleString('zh-CN', {
            hour12: false,
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        }}</span>
        <span class="text-muted-foreground shrink-0 tabular-nums">{{ EVENT_TYPE_LABELS[e.type] }}</span>
        <span class="flex-1 min-w-0 wrap-anywhere">{{ describe(e) }}</span>
        <span
          v-if="PAID_TYPES.has(e.type) && e.price > 0"
          class="shrink-0 font-semibold"
          >{{ formatPrice(e.price) }}</span
        >
      </div>
      <div
        v-if="history && !list.length"
        class="text-muted-foreground text-center py-2"
      >
        没有记录
      </div>
    </div>
  </div>
</template>

<style scoped>
.history__medal + .history__medal::before {
  content: '、';
}
</style>
