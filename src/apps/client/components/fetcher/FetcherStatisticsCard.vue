<script setup lang="ts">
import { BarChartOutline } from '@vicons/ionicons5'
import { BarChart, GaugeChart, LineChart, PieChart } from 'echarts/charts'
import {
  DataZoomComponent, GridComponent, LegendComponent, MarkLineComponent, MarkPointComponent, TitleComponent, ToolboxComponent, TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useThemeVars } from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import VChart from 'vue-echarts'
import { useWebFetcher } from '@/store/useWebFetcher'

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
const themeVars = useThemeVars()

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
    series: [{
      name: '实时速率',
      type: 'gauge',
      min: 0,
      max: 20,
      splitNumber: 5,
      progress: { show: true, width: 12 },
      axisLine: { lineStyle: { width: 12 } },
      axisTick: { show: false },
      splitLine: { length: 8, lineStyle: { width: 2, color: themeVars.value.textColor3 } },
      axisLabel: { distance: 15, color: themeVars.value.textColor3, fontSize: 12 },
      anchor: { show: true, showAbove: true, size: 15, itemStyle: { borderWidth: 8 } },
      title: { show: false },
      detail: { valueAnimation: true, fontSize: 24, offsetCenter: [0, '60%'], formatter: '{value}/s' },
      data: [{ value: eventsPerSecond.value, name: '事件/秒' }],
    }],
  }
  gaugeOption.value ??= option
  if (gaugeChart.value) {
    gaugeChart.value.setOption(option, false)
  }
}

function updateTypeDistributionChart() {
  const typeData = Object.entries(webfetcher.sessionEventTypeCounts || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
  const option = {
    tooltip: { trigger: 'item', formatter: '{a} <br/>{b}: {c} ({d}%)' },
    legend: { type: 'scroll', orient: 'vertical', right: 10, top: 20, bottom: 20, data: typeData.map(d => d.name) },
    series: [{
      name: '事件类型分布 (本次)',
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 5, borderColor: themeVars.value.cardColor, borderWidth: 1 },
      label: { show: false, position: 'center' },
      emphasis: { label: { show: true, fontSize: '16', fontWeight: 'bold' } },
      labelLine: { show: false },
      data: typeData,
    }],
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

watch(() => webfetcher.state, (newState) => {
  if (newState === 'connected') {
    startSession()
  } else {
    stopSession()
  }
})

watch(() => webfetcher.sessionEventTypeCounts, () => {
  if (isConnected.value) {
    updateTypeDistributionChart()
  }
}, { deep: true })

onMounted(() => {
  if (webfetcher.state === 'connected') {
    startSession()
  }
})
onUnmounted(stopSession)
</script>

<template>
  <NCard title="会话实时统计" size="small" bordered style="width: 100%;">
    <div v-if="isConnected && showCharts">
      <NGrid :x-gap="16" :y-gap="16" cols="1 s:2 l:3" responsive="screen">
        <NGi>
          <NCard title="实时速率" size="small" bordered :segmented="{ content: true }">
            <div style="height: 180px;">
              <VChart
                ref="gaugeChart"
                :option="gaugeOption"
                :manual-update="true"
                autoresize
              />
            </div>
          </NCard>
        </NGi>
        <NGi>
          <NCard title="事件类型分布" size="small" bordered :segmented="{ content: true }">
            <div style="height: 180px;">
              <VChart
                ref="typeDistributionChart"
                :option="typeDistributionOption"
                :manual-update="true"
                autoresize
              />
            </div>
          </NCard>
        </NGi>
        <NGi span="1 s:2 l:1">
          <NCard
            title="会话摘要"
            size="small"
            bordered
            :segmented="{ content: true }"
            style="height: 100%;"
          >
            <NFlex vertical justify="space-around" style="height: 100%;">
              <NStatistic label="会话事件总数">
                <NIcon :component="BarChartOutline" /> {{ webfetcher.sessionEventCount?.toLocaleString() ?? 0 }}
              </NStatistic>
              <NStatistic label="已发送">
                {{ ((webfetcher.bytesSentSession ?? 0) / 1024 / 1024).toFixed(2) }} Mb
              </NStatistic>
            </NFlex>
          </NCard>
        </NGi>
      </NGrid>
    </div>
    <NEmpty v-else-if="!isConnected" description="EventFetcher 未连接" />
    <NFlex v-else justify="center" style="padding: 16px 0;">
      <NSpin size="small" description="正在加载实时统计..." />
    </NFlex>
  </NCard>
</template>
