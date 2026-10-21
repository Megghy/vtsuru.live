<script setup lang="ts">
import { BarChartOutline } from '@vicons/ionicons5'
import { BarChart, GaugeChart, LineChart, PieChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import VChart from 'vue-echarts'

import { useWebFetcher } from '@/store/useWebFetcher'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'

// 复用此组件树内多个图表所需的 ECharts 模块, 统一注册一次
use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  GaugeChart,
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  MarkLineComponent,
  MarkPointComponent,
  DataZoomComponent,
])

const webfetcher = useWebFetcher()

const isConnected = computed(() => webfetcher.state === 'connected')
const showCharts = ref(false)
const eventsPerSecond = ref(0)

const gaugeChart = shallowRef()
const typeDistributionChart = shallowRef()
const gaugeOption = ref({})
const typeDistributionOption = ref({})

let epsTimer: number | undefined
let lastEventCount = 0

function calculateEPS() {
  const currentCount = webfetcher.sessionEventCount
  eventsPerSecond.value = currentCount - lastEventCount
  lastEventCount = currentCount
}

function updateGaugeChart() {
  const option = {
    tooltip: { formatter: '{a} <br/>{b} : {c}/s' },
    series: [
      {
        name: '实时速率',
        type: 'gauge',
        min: 0,
        max: 20,
        splitNumber: 5,
        progress: { show: true, width: 12 },
        axisLine: { lineStyle: { width: 12 } },
        axisTick: { show: false },
        splitLine: { length: 8, lineStyle: { width: 2, color: '#94a3b8' } },
        axisLabel: { distance: 15, color: '#64748b', fontSize: 12 },
        anchor: { show: true, showAbove: true, size: 15, itemStyle: { borderWidth: 8 } },
        title: { show: false },
        detail: { valueAnimation: true, fontSize: 24, offsetCenter: [0, '60%'], formatter: '{value}/s' },
        data: [{ value: eventsPerSecond.value, name: '事件/秒' }],
      },
    ],
  }
  gaugeOption.value ??= option
  if (gaugeChart.value) {
    gaugeChart.value.setOption(option, false)
  }
}

function updateTypeDistributionChart() {
  const typeData = Object.entries(webfetcher.sessionEventTypeCounts || {})
    .map(([name, value]) => ({ name, value }))
    .toSorted((a, b) => b.value - a.value)
  const option = {
    tooltip: { trigger: 'item', formatter: '{a} <br/>{b}: {c} ({d}%)' },
    legend: { type: 'scroll', orient: 'vertical', right: 10, top: 20, bottom: 20, data: typeData.map((d) => d.name) },
    series: [
      {
        name: '事件类型分布 (本次)',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 5, borderColor: '#ffffff', borderWidth: 1 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: '16', fontWeight: 'bold' } },
        labelLine: { show: false },
        data: typeData,
      },
    ],
  }
  typeDistributionOption.value ??= option
  if (typeDistributionChart.value) {
    typeDistributionChart.value.setOption(option, false)
  }
}

function startSession() {
  showCharts.value = true
  lastEventCount = webfetcher.sessionEventCount
  if (!epsTimer) {
    epsTimer = window.setInterval(() => {
      calculateEPS()
      updateGaugeChart()
    }, 1000)
  }
  nextTick(() => {
    updateGaugeChart()
    updateTypeDistributionChart()
  })
}

function stopSession() {
  clearInterval(epsTimer)
  epsTimer = undefined
  eventsPerSecond.value = 0
  showCharts.value = false
}

watch(
  () => webfetcher.state,
  (newState) => {
    if (newState === 'connected') {
      startSession()
    } else {
      stopSession()
    }
  },
)

watch(
  () => webfetcher.sessionEventTypeCounts,
  () => {
    if (isConnected.value) {
      updateTypeDistributionChart()
    }
  },
  { deep: true },
)

onMounted(() => {
  if (webfetcher.state === 'connected') {
    startSession()
  }
})
onUnmounted(stopSession)
</script>

<template>
  <Card class="border bg-card w-full">
    <CardHeader class="p-3 pb-2 border-b">
      <CardTitle class="text-sm font-semibold">会话实时统计</CardTitle>
    </CardHeader>
    <CardContent class="p-3">
      <div v-if="isConnected && showCharts">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <!-- 实时速率 -->
          <Card class="border bg-muted/20">
            <CardHeader class="p-2.5 pb-1 border-b">
              <CardTitle class="text-xs font-semibold">实时速率</CardTitle>
            </CardHeader>
            <CardContent class="p-2">
              <div class="h-[180px]">
                <VChart
                  ref="gaugeChart"
                  :option="gaugeOption"
                  :manual-update="true"
                  autoresize
                />
              </div>
            </CardContent>
          </Card>

          <!-- 事件类型分布 -->
          <Card class="border bg-muted/20">
            <CardHeader class="p-2.5 pb-1 border-b">
              <CardTitle class="text-xs font-semibold">事件类型分布</CardTitle>
            </CardHeader>
            <CardContent class="p-2">
              <div class="h-[180px]">
                <VChart
                  ref="typeDistributionChart"
                  :option="typeDistributionOption"
                  :manual-update="true"
                  autoresize
                />
              </div>
            </CardContent>
          </Card>

          <!-- 会话摘要 -->
          <Card class="border bg-muted/20 col-span-1 sm:col-span-2 lg:col-span-1">
            <CardHeader class="p-2.5 pb-1 border-b">
              <CardTitle class="text-xs font-semibold">会话摘要</CardTitle>
            </CardHeader>
            <CardContent class="p-3 flex flex-col justify-around h-[180px]">
              <div>
                <span class="text-xs text-muted-foreground block">会话事件总数</span>
                <div class="flex items-center gap-1.5 text-xl font-bold text-foreground mt-1">
                  <BarChartOutline class="size-5 text-primary" />
                  <span>{{ webfetcher.sessionEventCount?.toLocaleString() ?? 0 }}</span>
                </div>
              </div>
              <div>
                <span class="text-xs text-muted-foreground block">已发送</span>
                <span class="text-xl font-bold text-foreground mt-1 block">
                  {{ ((webfetcher.bytesSentSession ?? 0) / 1024 / 1024).toFixed(2) }} Mb
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <Empty
        v-else-if="!isConnected"
        description="EventFetcher 未连接"
        class="py-6"
      />
      <div
        v-else
        class="flex flex-col items-center justify-center py-6 gap-2 text-xs text-muted-foreground"
      >
        <Spin :show="true" size="small" />
        <span>正在加载实时统计...</span>
      </div>
    </CardContent>
  </Card>
</template>
