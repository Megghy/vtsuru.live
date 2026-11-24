<script setup lang="ts">
import { GaugeChart, PieChart } from 'echarts/charts'
import { LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart3 } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import VChart from 'vue-echarts'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { isDarkMode } from '@/shared/utils'
import { useWebFetcher } from '@/store/useWebFetcher'

use([CanvasRenderer, PieChart, GaugeChart, TooltipComponent, LegendComponent])

const webfetcher = useWebFetcher()

const isConnected = computed(() => webfetcher.state === 'connected')
const eventsPerSecond = ref(0)
const peakEps = ref(0)

let epsTimer: number | undefined
let lastEventCount = 0
let lastSampleAt = Date.now()

function sampleEPS() {
  const now = Date.now()
  const currentCount = webfetcher.sessionEventCount
  const elapsedSec = Math.max(0.5, (now - lastSampleAt) / 1000)
  const delta = Math.max(0, currentCount - lastEventCount)
  const eps = Number((delta / elapsedSec).toFixed(1))

  eventsPerSecond.value = eps
  if (eps > peakEps.value) {
    peakEps.value = eps
  }
  lastEventCount = currentCount
  lastSampleAt = now
}

function startSampling() {
  lastEventCount = webfetcher.sessionEventCount
  lastSampleAt = Date.now()
  if (!epsTimer) {
    epsTimer = window.setInterval(sampleEPS, 1000)
  }
}

function stopSampling() {
  if (epsTimer !== undefined) {
    clearInterval(epsTimer)
    epsTimer = undefined
  }
  eventsPerSecond.value = 0
  peakEps.value = 0
}

watch(
  () => webfetcher.state,
  (next) => {
    if (next === 'connected') {
      startSampling()
    } else {
      stopSampling()
    }
  },
)

onMounted(() => {
  if (isConnected.value) {
    startSampling()
  }
})
onUnmounted(stopSampling)

const gaugeMax = computed(() => {
  if (peakEps.value <= 20) return 20
  return Math.ceil(peakEps.value / 10) * 10
})

const gaugeOption = computed(() => {
  const dark = isDarkMode.value
  const labelColor = dark ? '#a1a1aa' : '#52525b'
  const lineColor = dark ? '#3f3f46' : '#e4e4e7'
  const valueColor = dark ? '#fafafa' : '#09090b'

  return {
    tooltip: { formatter: '{a}<br/>{b}: {c}/s' },
    series: [
      {
        name: '实时速率',
        type: 'gauge',
        min: 0,
        max: gaugeMax.value,
        splitNumber: 4,
        progress: { show: true, width: 10 },
        axisLine: { lineStyle: { width: 10, color: [[1, lineColor]] } },
        axisTick: { show: false },
        splitLine: { length: 6, lineStyle: { width: 1.5, color: labelColor } },
        axisLabel: { distance: 14, color: labelColor, fontSize: 11 },
        anchor: { show: true, showAbove: true, size: 12, itemStyle: { borderWidth: 6 } },
        title: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 20,
          color: valueColor,
          offsetCenter: [0, '62%'],
          formatter: '{value}/s',
        },
        data: [{ value: eventsPerSecond.value, name: '事件/秒' }],
      },
    ],
  }
})

const typeDistributionOption = computed(() => {
  const dark = isDarkMode.value
  const borderColor = dark ? '#18181b' : '#ffffff'
  const legendColor = dark ? '#d4d4d8' : '#3f3f46'
  const typeData = Object.entries(webfetcher.sessionEventTypeCounts || {})
    .map(([name, value]) => ({ name, value }))
    .toSorted((a, b) => b.value - a.value)

  return {
    tooltip: { trigger: 'item', formatter: '{a}<br/>{b}: {c} ({d}%)' },
    legend: {
      type: 'scroll',
      orient: 'vertical',
      right: 6,
      top: 16,
      bottom: 16,
      textStyle: { color: legendColor, fontSize: 11 },
      data: typeData.map((d) => d.name),
    },
    series: [
      {
        name: '事件类型分布',
        type: 'pie',
        radius: ['42%', '72%'],
        center: ['36%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor, borderWidth: 1.5 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 13, fontWeight: 'bold' } },
        labelLine: { show: false },
        data: typeData,
      },
    ],
  }
})

const formattedSentSize = computed(() => {
  const bytes = webfetcher.bytesSentSession ?? 0
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
})
</script>

<template>
  <Card class="w-full">
    <CardHeader class="p-3 border-b">
      <CardTitle>会话实时统计</CardTitle>
    </CardHeader>

    <CardContent class="p-3">
      <div
        v-if="isConnected"
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        <!-- 实时速率 -->
        <Card class="border bg-muted/20">
          <CardHeader class="p-2.5 pb-1 border-b">
            <CardTitle class="text-xs">实时速率</CardTitle>
          </CardHeader>
          <CardContent class="p-2">
            <div class="h-[180px]">
              <VChart
                :option="gaugeOption"
                autoresize
              />
            </div>
          </CardContent>
        </Card>

        <!-- 事件类型分布 -->
        <Card class="border bg-muted/20">
          <CardHeader class="p-2.5 pb-1 border-b">
            <CardTitle class="text-xs">事件类型分布</CardTitle>
          </CardHeader>
          <CardContent class="p-2">
            <div class="h-[180px]">
              <VChart
                v-if="webfetcher.sessionEventCount > 0"
                :option="typeDistributionOption"
                autoresize
              />
              <Empty
                v-else
                description="等待事件到达"
                class="h-full flex-center"
              />
            </div>
          </CardContent>
        </Card>

        <!-- 会话摘要 -->
        <Card class="border bg-muted/20 col-span-1 sm:col-span-2 lg:col-span-1">
          <CardHeader class="p-2.5 pb-1 border-b">
            <CardTitle class="text-xs">会话摘要</CardTitle>
          </CardHeader>
          <CardContent class="p-3 flex flex-col justify-around h-[180px]">
            <div>
              <span class="text-xs text-muted-foreground block">会话事件总数</span>
              <div class="flex items-center gap-1.5 text-xl font-bold text-foreground mt-1 font-mono tabular-nums">
                <BarChart3 class="size-5 text-primary shrink-0" />
                <span>{{ webfetcher.sessionEventCount?.toLocaleString() ?? 0 }}</span>
              </div>
            </div>
            <div>
              <span class="text-xs text-muted-foreground block">累计发送体积 (压缩后)</span>
              <span class="text-xl font-bold text-foreground mt-1 block font-mono tabular-nums">
                {{ formattedSentSize }}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Empty
        v-else
        description="EventFetcher 未连接，连接后将显示实时速率与会话分布"
        class="py-6"
      />
    </CardContent>
  </Card>
</template>
