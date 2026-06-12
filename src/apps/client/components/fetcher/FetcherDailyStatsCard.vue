<script setup lang="ts">
import type { FetcherStatisticData } from '@/apps/client/data/models'
import type { DataTableColumns } from 'naive-ui'
import { TrendingUpOutline } from '@vicons/ionicons5'
import { BarChart } from 'echarts/charts'
import { DataZoomComponent, GridComponent, MarkLineComponent, MarkPointComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { NTag } from 'naive-ui'
import { computed, h, onMounted, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { currentStatistic, getHistoricalStatistics } from '@/apps/client/data/info'

use([CanvasRenderer, BarChart, TooltipComponent, GridComponent, MarkLineComponent, MarkPointComponent, DataZoomComponent])

const historicalData = ref<FetcherStatisticData[]>([])
const isLoadingHistory = ref(false)
const historyChart = ref()
const historyOption = ref({})

const sortedTodayTypes = computed(() => {
  if (!currentStatistic.value || !currentStatistic.value.eventTypeCounts) return []
  return Object.entries(currentStatistic.value.eventTypeCounts)
    .sort(([, countA], [, countB]) => countB - countA)
})

interface TodayTypeRow {
  key: string
  rank: number
  type: string
  count: number
}

const todayTypeColumns: DataTableColumns<TodayTypeRow> = [
  { title: '排名', key: 'rank', align: 'center', width: 72 },
  {
    title: '类型',
    key: 'type',
    minWidth: 160,
    ellipsis: { tooltip: true },
    render: row => h(
      NTag,
      { size: 'small', type: 'info', bordered: false, style: 'max-width: 100%; justify-content: flex-start;' },
      { default: () => row.type },
    ),
  },
  { title: '事件数', key: 'count', align: 'right', width: 120, render: row => row.count.toLocaleString() },
]

const todayTypeTableData = computed<TodayTypeRow[]>(() =>
  sortedTodayTypes.value.map(([type, count], index) => ({ key: type, rank: index + 1, type, count })))

const todayTypeRowKey = (row: TodayTypeRow) => row.key

function updateHistoryChart() {
  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '5%', bottom: '10%', containLabel: true },
    xAxis: [{ type: 'category', data: historicalData.value.map(d => d.date.substring(5)), axisTick: { alignWithLabel: true } }],
    yAxis: [{ type: 'value', name: '事件总数' }],
    dataZoom: [{ type: 'inside', start: 0, end: 100 }, { type: 'slider', start: 0, end: 100, bottom: 5 }],
    series: [{
      name: '每日事件数',
      type: 'bar',
      barWidth: '60%',
      data: historicalData.value.map(d => d.count),
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      emphasis: { focus: 'series' },
      markPoint: { data: [{ type: 'max', name: '最大值' }, { type: 'min', name: '最小值' }] },
      markLine: { data: [{ type: 'average', name: '平均值' }] },
    }],
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

watch(currentStatistic, (newDailyStat) => {
  if (newDailyStat && historicalData.value.length > 0) {
    const todayIndex = historicalData.value.findIndex(d => d.date === newDailyStat.date)
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
}, { deep: true })

onMounted(loadHistoricalData)
</script>

<template>
  <NFlex vertical :size="12">
    <!-- 今日统计 -->
    <NCard title="今日统计" size="small" bordered style="width: 100%;">
      <template #header-extra>
        <NText depth="3">
          {{ currentStatistic?.date ?? 'N/A' }}
        </NText>
      </template>
      <div v-if="currentStatistic">
        <NGrid :x-gap="16" :y-gap="16" cols="1 s:2" responsive="screen">
          <NGi>
            <NStatistic label="今日接收总数">
              <template #prefix>
                <NIcon :component="TrendingUpOutline" />
              </template>
              <span style="font-size: 1.8em; font-weight: 500;">{{ currentStatistic.count?.toLocaleString() ?? 0 }}</span>
            </NStatistic>
          </NGi>
          <NGi>
            <NText strong>
              类型明细:
            </NText>
            <div style="margin-top: 8px;">
              <NDataTable
                v-if="todayTypeTableData.length > 0"
                :columns="todayTypeColumns"
                :data="todayTypeTableData"
                :row-key="todayTypeRowKey"
                size="small"
                :bordered="false"
                striped
                :pagination="false"
                :max-height="220"
                single-line
                :scrollbar-props="{ size: 6 }"
              />
              <NEmpty v-else description="今日暂无数据" size="small" />
            </div>
          </NGi>
        </NGrid>
      </div>
      <NEmpty v-else description="正在加载今日统计..." />
    </NCard>

    <!-- 历史统计 -->
    <NCard title="历史事件量 (近30日)" size="small" bordered style="width: 100%;">
      <NSpin :show="isLoadingHistory">
        <div style="height: 280px;">
          <VChart
            v-if="historicalData.length > 0"
            ref="historyChart"
            :option="historyOption"
            :manual-update="true"
            autoresize
          />
          <NEmpty
            v-else
            description="无历史数据"
            style="height: 100%; display: flex; align-items: center; justify-content: center;"
          />
        </div>
      </NSpin>
    </NCard>
  </NFlex>
</template>
