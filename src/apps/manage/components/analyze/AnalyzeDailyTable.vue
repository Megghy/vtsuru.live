<script lang="ts" setup>
import ChevronDown24Regular from '@vicons/fluent/es/ChevronDown24Regular'
import ChevronUp24Regular from '@vicons/fluent/es/ChevronUp24Regular'
import Table24Regular from '@vicons/fluent/es/Table24Regular'
import { computed, ref } from 'vue'

import { formatCurrency, formatNumber } from '@/apps/manage/composables/formatters'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Switch } from '@/shared/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

import type { ChartDayPoint } from './types'

const props = defineProps<{
  chartData: ChartDayPoint[]
  titlePrefix: string
}>()

type SortKey = 'date' | 'income' | 'danmaku' | 'duration' | 'interactions'

const isExpanded = ref(false)
const showOnlyLiveDays = ref(true)
const sortKey = ref<SortKey>('date')
const sortAsc = ref(false)

const tableRows = computed(() => {
  let list = props.chartData.map((p) => ({
    ...p,
    liveHours: Math.round(((p.liveMinutes || 0) / 60) * 10) / 10,
  }))

  if (showOnlyLiveDays.value) {
    list = list.filter((p) => (p.liveMinutes || 0) > 0 || (p.income || 0) > 0 || (p.danmakuCount || 0) > 0)
  }

  return list.toSorted((a, b) => {
    let diff = 0
    if (sortKey.value === 'date') diff = a.timestamp - b.timestamp
    else if (sortKey.value === 'income') diff = a.income - b.income
    else if (sortKey.value === 'danmaku') diff = a.danmakuCount - b.danmakuCount
    else if (sortKey.value === 'duration') diff = a.liveMinutes - b.liveMinutes
    else if (sortKey.value === 'interactions') diff = a.interactionCount - b.interactionCount

    return sortAsc.value ? diff : -diff
  })
})

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = false
  }
}
</script>

<template>
  <Card class="p-4 space-y-3">
    <div
      class="flex-between cursor-pointer select-none"
      @click="isExpanded = !isExpanded"
    >
      <div class="flex items-center gap-2 text-xs font-semibold">
        <component
          :is="Table24Regular"
          class="h-4 w-4 text-brand"
        />
        <span>{{ titlePrefix }}每日明细复盘表 (共 {{ tableRows.length }} 条记录)</span>
      </div>

      <div class="flex items-center gap-2">
        <div
          class="flex items-center gap-1.5 text-xs text-muted-foreground mr-2"
          @click.stop
        >
          <Switch
            :checked="showOnlyLiveDays"
            @update:checked="(val) => (showOnlyLiveDays = val)"
          />
          <span>仅开播日</span>
        </div>
        <Button
          size="icon-xs"
          variant="ghost"
        >
          <component :is="isExpanded ? ChevronUp24Regular : ChevronDown24Regular" />
        </Button>
      </div>
    </div>

    <div
      v-if="isExpanded"
      class="pt-2 border-t border-border overflow-x-auto"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              class="cursor-pointer"
              @click="toggleSort('date')"
            >
              日期 {{ sortKey === 'date' ? (sortAsc ? '↑' : '↓') : '' }}
            </TableHead>
            <TableHead
              class="text-right cursor-pointer"
              @click="toggleSort('income')"
            >
              收益 (¥) {{ sortKey === 'income' ? (sortAsc ? '↑' : '↓') : '' }}
            </TableHead>
            <TableHead
              class="text-right cursor-pointer"
              @click="toggleSort('danmaku')"
            >
              弹幕数 {{ sortKey === 'danmaku' ? (sortAsc ? '↑' : '↓') : '' }}
            </TableHead>
            <TableHead
              class="text-right cursor-pointer"
              @click="toggleSort('interactions')"
            >
              互动人次 {{ sortKey === 'interactions' ? (sortAsc ? '↑' : '↓') : '' }}
            </TableHead>
            <TableHead class="text-right"> 付费人数 </TableHead>
            <TableHead
              class="text-right cursor-pointer"
              @click="toggleSort('duration')"
            >
              开播时长 {{ sortKey === 'duration' ? (sortAsc ? '↑' : '↓') : '' }}
            </TableHead>
            <TableHead class="text-right"> 点赞数 </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="row in tableRows"
            :key="row.timestamp"
          >
            <TableCell class="font-mono">
              {{ row.date }}
            </TableCell>
            <TableCell class="text-right font-mono font-semibold text-amber-500">
              {{ row.income > 0 ? `¥${formatCurrency(row.income)}` : '-' }}
            </TableCell>
            <TableCell class="text-right font-mono">
              {{ row.danmakuCount > 0 ? formatNumber(row.danmakuCount) : '-' }}
            </TableCell>
            <TableCell class="text-right font-mono">
              {{ row.interactionCount > 0 ? formatNumber(row.interactionCount) : '-' }}
            </TableCell>
            <TableCell class="text-right">
              {{ row.payingUsers > 0 ? `${row.payingUsers} 人` : '-' }}
            </TableCell>
            <TableCell class="text-right">
              <Badge
                v-if="row.liveMinutes > 0"
                variant="outline"
                class="text-[10px] px-1 py-0 h-4"
              >
                {{ row.liveHours }} h
              </Badge>
              <span
                v-else
                class="text-muted-foreground"
                >-</span
              >
            </TableCell>
            <TableCell class="text-right font-mono">
              {{ row.likeCount > 0 ? formatNumber(row.likeCount) : '-' }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </Card>
</template>
