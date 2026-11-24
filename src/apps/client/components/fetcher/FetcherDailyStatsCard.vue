<script setup lang="ts">
import { BarChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { TrendingUp } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import VChart from 'vue-echarts'

import { currentStatistic, getHistoricalStatistics } from '@/apps/client/data/info'
import type { FetcherStatisticData } from '@/apps/client/data/models'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { isDarkMode } from '@/shared/utils'

use([
  CanvasRenderer,
  BarChart,
  TooltipComponent,
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  DataZoomComponent,
])

const historicalData = ref<FetcherStatisticData[]>([])
const isLoadingHistory = ref(false)

const sortedTodayTypes = computed(() => {
  if (!currentStatistic.value?.eventTypeCounts) return []
  return Object.entries(currentStatistic.value.eventTypeCounts).toSorted(([, countA], [, countB]) => countB - countA)
})

const todayTypeTableData = computed(() =>
  sortedTodayTypes.value.map(([type, count], index) => ({
    key: type,
    rank: index + 1,
    type,
    count,
  })),
)

const historyOption = computed(() => {
  const dark = isDarkMode.value
  const textColor = dark ? '#a1a1aa' : '#52525b'
  const splitLineColor = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '5%', bottom: '12%', containLabel: true },
    xAxis: [
      {
        type: 'category',
        data: historicalData.value.map((d) => d.date.substring(5)),
        axisTick: { alignWithLabel: true },
        axisLabel: { color: textColor, fontSize: 11 },
      },
    ],
    yAxis: [
      {
        type: 'value',
        name: '事件总数',
        nameTextStyle: { color: textColor, fontSize: 11 },
        axisLabel: { color: textColor, fontSize: 11 },
        splitLine: { lineStyle: { color: splitLineColor } },
      },
    ],
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', start: 0, end: 100, bottom: 4, height: 18 },
    ],
    series: [
      {
        name: '每日事件数',
        type: 'bar',
        barWidth: '58%',
        data: historicalData.value.map((d) => d.count),
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
        markPoint: {
          data: [
            { type: 'max', name: '最大值' },
            { type: 'min', name: '最小值' },
          ],
        },
        markLine: { data: [{ type: 'average', name: '平均值' }] },
      },
    ],
  }
})

async function loadHistoricalData() {
  isLoadingHistory.value = true
  try {
    historicalData.value = await getHistoricalStatistics(30)
  } catch (error) {
    console.error('Failed to load historical statistics:', error)
  } finally {
    isLoadingHistory.value = false
  }
}

watch(
  currentStatistic,
  (newDailyStat) => {
    if (!newDailyStat) return
    const todayIndex = historicalData.value.findIndex((d) => d.date === newDailyStat.date)
    if (todayIndex !== -1) {
      historicalData.value[todayIndex].count = newDailyStat.count
    } else {
      historicalData.value.push(JSON.parse(JSON.stringify(newDailyStat)))
      historicalData.value.sort((a, b) => a.date.localeCompare(b.date))
    }
  },
  { deep: true },
)

onMounted(loadHistoricalData)
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 今日统计 -->
    <Card class="w-full">
      <CardHeader class="p-3 border-b flex-row items-center justify-between space-y-0">
        <CardTitle>今日统计</CardTitle>
        <span class="text-xs text-muted-foreground font-mono tabular-nums">
          {{ currentStatistic?.date ?? 'N/A' }}
        </span>
      </CardHeader>

      <CardContent class="p-3">
        <div
          v-if="currentStatistic"
          class="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <!-- 今日接收总数 -->
          <div class="flex flex-col justify-center p-3 bg-muted/20 rounded-md border border-border">
            <span class="text-xs text-muted-foreground">今日接收总数</span>
            <div class="flex items-center gap-2 mt-1.5">
              <TrendingUp class="size-5 text-primary shrink-0" />
              <span class="text-2xl font-bold text-foreground font-mono tabular-nums">
                {{ currentStatistic.count?.toLocaleString() ?? 0 }}
              </span>
            </div>
          </div>

          <!-- 类型明细 -->
          <div class="space-y-2 min-w-0">
            <span class="text-xs font-semibold text-foreground block">类型明细</span>
            <div
              v-if="todayTypeTableData.length > 0"
              class="border border-border rounded-md overflow-hidden max-h-[220px] overflow-y-auto scrollbar-thin"
            >
              <Table>
                <TableHeader>
                  <TableRow class="hover:bg-transparent">
                    <TableHead class="w-12 text-center">排名</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead class="text-right w-24">事件数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="row in todayTypeTableData"
                    :key="row.key"
                  >
                    <TableCell class="text-center font-mono tabular-nums">
                      {{ row.rank }}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="brand"
                        size="xs"
                        class="truncate max-w-full"
                      >
                        {{ row.type }}
                      </Badge>
                    </TableCell>
                    <TableCell class="text-right font-mono tabular-nums">
                      {{ row.count.toLocaleString() }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <Empty
              v-else
              description="今日暂无事件数据"
              class="py-4"
            />
          </div>
        </div>

        <Empty
          v-else
          description="正在加载今日统计..."
          class="py-6"
        />
      </CardContent>
    </Card>

    <!-- 历史统计 -->
    <Card class="w-full">
      <CardHeader class="p-3 border-b">
        <CardTitle>历史事件量 (近 30 日)</CardTitle>
      </CardHeader>
      <CardContent class="p-3">
        <div class="h-[280px] relative">
          <div
            v-if="isLoadingHistory"
            class="absolute inset-0 bg-background/50 backdrop-blur-xs flex-center z-10"
          >
            <Spin
              :show="true"
              size="small"
            />
          </div>

          <VChart
            v-if="historicalData.length > 0"
            :option="historyOption"
            autoresize
          />
          <Empty
            v-else
            description="暂无历史统计数据"
            class="h-full flex-center"
          />
        </div>
      </CardContent>
    </Card>
  </div>
</template>
