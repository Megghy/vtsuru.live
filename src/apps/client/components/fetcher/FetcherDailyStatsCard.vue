<script setup lang="ts">
import { TrendingUpOutline } from '@vicons/ionicons5'
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
import { computed, onMounted, ref, watch } from 'vue'
import VChart from 'vue-echarts'

import { currentStatistic, getHistoricalStatistics } from '@/apps/client/data/info'
import type { FetcherStatisticData } from '@/apps/client/data/models'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

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
const historyChart = ref()
const historyOption = ref({})

const sortedTodayTypes = computed(() => {
  if (!currentStatistic.value || !currentStatistic.value.eventTypeCounts) return []
  return Object.entries(currentStatistic.value.eventTypeCounts).toSorted(([, countA], [, countB]) => countB - countA)
})

interface TodayTypeRow {
  key: string
  rank: number
  type: string
  count: number
}

const todayTypeTableData = computed<TodayTypeRow[]>(() =>
  sortedTodayTypes.value.map(([type, count], index) => ({ key: type, rank: index + 1, type, count })),
)

function updateHistoryChart() {
  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '5%', bottom: '10%', containLabel: true },
    xAxis: [
      {
        type: 'category',
        data: historicalData.value.map((d) => d.date.substring(5)),
        axisTick: { alignWithLabel: true },
      },
    ],
    yAxis: [{ type: 'value', name: '事件总数' }],
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', start: 0, end: 100, bottom: 5 },
    ],
    series: [
      {
        name: '每日事件数',
        type: 'bar',
        barWidth: '60%',
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
  historyOption.value ??= option
  if (historyChart.value) {
    historyChart.value.setOption(option, false)
  }
}

async function loadHistoricalData() {
  isLoadingHistory.value = true
  try {
    historicalData.value = await getHistoricalStatistics(30)
    updateHistoryChart()
  } catch (error) {
    console.error('Failed to load historical statistics:', error)
  } finally {
    isLoadingHistory.value = false
  }
}

watch(
  currentStatistic,
  (newDailyStat) => {
    if (newDailyStat && historicalData.value.length > 0) {
      const todayIndex = historicalData.value.findIndex((d) => d.date === newDailyStat.date)
      if (todayIndex !== -1) {
        historicalData.value[todayIndex].count = newDailyStat.count
        updateHistoryChart()
      } else {
        historicalData.value.push(JSON.parse(JSON.stringify(newDailyStat)))
        historicalData.value.sort((a, b) => a.date.localeCompare(b.date))
        updateHistoryChart()
      }
    } else if (newDailyStat && historicalData.value.length === 0) {
      historicalData.value = [JSON.parse(JSON.stringify(newDailyStat))]
      updateHistoryChart()
    }
  },
  { deep: true },
)

onMounted(loadHistoricalData)
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 今日统计 -->
    <Card class="border bg-card w-full">
      <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
        <CardTitle class="text-sm font-semibold">今日统计</CardTitle>
        <span class="text-xs text-muted-foreground">
          {{ currentStatistic?.date ?? 'N/A' }}
        </span>
      </CardHeader>
      <CardContent class="p-3">
        <div v-if="currentStatistic">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- 今日接收总数 -->
            <div class="flex flex-col justify-center p-3 bg-muted/20 rounded-md border">
              <span class="text-xs text-muted-foreground">今日接收总数</span>
              <div class="flex items-center gap-2 mt-1">
                <TrendingUpOutline class="size-6 text-primary" />
                <span class="text-2xl font-bold text-foreground">
                  {{ currentStatistic.count?.toLocaleString() ?? 0 }}
                </span>
              </div>
            </div>

            <!-- 类型明细 -->
            <div class="space-y-2">
              <span class="text-xs font-semibold text-foreground block">类型明细</span>
              <div
                v-if="todayTypeTableData.length > 0"
                class="border rounded-md overflow-hidden max-h-[220px] overflow-y-auto"
              >
                <Table>
                  <TableHeader>
                    <TableRow class="hover:bg-transparent">
                      <TableHead class="text-[11px] h-7 w-12 text-center">排名</TableHead>
                      <TableHead class="text-[11px] h-7">类型</TableHead>
                      <TableHead class="text-[11px] h-7 text-right w-24">事件数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow
                      v-for="row in todayTypeTableData"
                      :key="row.key"
                      class="h-7"
                    >
                      <TableCell class="text-[11px] py-1 text-center font-mono">
                        {{ row.rank }}
                      </TableCell>
                      <TableCell class="text-[11px] py-1">
                        <Badge
                          variant="outline"
                          class="text-[10px] h-4.5 px-1.5 border-sky-500/40 text-sky-600 bg-sky-500/10 truncate max-w-full"
                        >
                          {{ row.type }}
                        </Badge>
                      </TableCell>
                      <TableCell class="text-[11px] py-1 text-right font-mono">
                        {{ row.count.toLocaleString() }}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <Empty
                v-else
                description="今日暂无数据"
                class="py-4"
              />
            </div>
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
    <Card class="border bg-card w-full">
      <CardHeader class="p-3 pb-2 border-b">
        <CardTitle class="text-sm font-semibold">历史事件量 (近30日)</CardTitle>
      </CardHeader>
      <CardContent class="p-3">
        <div class="h-[280px] relative">
          <div
            v-if="isLoadingHistory"
            class="absolute inset-0 bg-background/50 backdrop-blur-xs flex items-center justify-center z-10"
          >
            <Spin
              :show="true"
              size="small"
            />
          </div>

          <VChart
            v-if="historicalData.length > 0"
            ref="historyChart"
            :option="historyOption"
            :manual-update="true"
            autoresize
          />
          <Empty
            v-else
            description="无历史数据"
            class="h-full flex items-center justify-center"
          />
        </div>
      </CardContent>
    </Card>
  </div>
</template>
