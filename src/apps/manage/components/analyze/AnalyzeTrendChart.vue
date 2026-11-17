<script lang="ts" setup>
import DataTrending24Regular from '@vicons/fluent/es/DataTrending24Regular'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { formatCurrency, formatNumber } from '@/apps/manage/composables/formatters'
import { Card } from '@/shared/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { isDarkMode } from '@/shared/utils'

import type { ChartDayPoint } from './types'

const props = defineProps<{
  chartData: ChartDayPoint[]
  titlePrefix: string
}>()

echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  LineChart,
  BarChart,
  PieChart,
  CanvasRenderer,
  MarkPointComponent,
  MarkLineComponent,
  DataZoomComponent,
])

type ChartViewType = 'trend' | 'bar'
type MetricPreset = 'all' | 'income' | 'danmaku' | 'audience'
type MetricKey =
  | 'grandTotalIncome'
  | 'income'
  | 'giftIncome'
  | 'scIncome'
  | 'guardIncome'
  | 'offlineIncome'
  | 'danmakuCount'
  | 'interactionCount'
  | 'likeCount'
  | 'interactionUsers'
  | 'payingUsers'
  | 'liveHours'

interface MetricOption {
  label: string
  value: MetricKey
  color: string
  unit: string
  yAxisIndex: 0 | 1
}

const CHART_METRICS: MetricOption[] = [
  { label: '全盘总收益', value: 'grandTotalIncome', color: '#eab308', unit: '¥', yAxisIndex: 1 },
  { label: '直播收益', value: 'income', color: '#f59e0b', unit: '¥', yAxisIndex: 1 },
  { label: '普通礼物', value: 'giftIncome', color: '#fbbf24', unit: '¥', yAxisIndex: 1 },
  { label: '醒目留言', value: 'scIncome', color: '#f97316', unit: '¥', yAxisIndex: 1 },
  { label: '直播舰长', value: 'guardIncome', color: '#3b82f6', unit: '¥', yAxisIndex: 1 },
  { label: '下播上舰', value: 'offlineIncome', color: '#10b981', unit: '¥', yAxisIndex: 1 },
  { label: '弹幕数', value: 'danmakuCount', color: '#10b981', unit: '条', yAxisIndex: 0 },
  { label: '互动人次', value: 'interactionCount', color: '#3b82f6', unit: '次', yAxisIndex: 0 },
  { label: '点赞数', value: 'likeCount', color: '#f43f5e', unit: '次', yAxisIndex: 0 },
  { label: '互动人数', value: 'interactionUsers', color: '#06b6d4', unit: '人', yAxisIndex: 0 },
  { label: '付费人数', value: 'payingUsers', color: '#8b5cf6', unit: '人', yAxisIndex: 0 },
  { label: '时长(小时)', value: 'liveHours', color: '#a855f7', unit: 'h', yAxisIndex: 0 },
]

const INCOME_METRIC_SET = new Set<MetricKey>([
  'income',
  'giftIncome',
  'scIncome',
  'guardIncome',
  'offlineIncome',
  'grandTotalIncome',
])

const PRESET_METRICS: Record<MetricPreset, MetricKey[]> = {
  all: ['income', 'danmakuCount', 'interactionUsers', 'payingUsers', 'liveHours'],
  income: ['income', 'giftIncome', 'scIncome', 'guardIncome'],
  danmaku: ['danmakuCount', 'interactionCount', 'likeCount'],
  audience: ['interactionUsers', 'payingUsers', 'danmakuCount'],
}

const chartRef = ref<HTMLElement | null>(null)
let mainChart: echarts.ECharts | null = null
let chartResizeObserver: ResizeObserver | null = null

const chartViewType = ref<ChartViewType>('trend')
const activeMetricPreset = ref<MetricPreset>('income')
const selectedMetrics = ref<MetricKey[]>(['income', 'giftIncome', 'scIncome', 'interactionCount', 'danmakuCount'])

function applyMetricPreset(preset: MetricPreset) {
  activeMetricPreset.value = preset
  selectedMetrics.value = [...PRESET_METRICS[preset]]
}

function toggleMetric(value: MetricKey) {
  if (selectedMetrics.value.includes(value)) {
    if (selectedMetrics.value.length > 1) {
      selectedMetrics.value = selectedMetrics.value.filter((m) => m !== value)
    }
  } else {
    selectedMetrics.value = [...selectedMetrics.value, value]
  }
}

function getMetricValue(item: ChartDayPoint, key: MetricKey): number {
  if (key === 'liveHours') return Math.round(((item.liveMinutes || 0) / 60) * 10) / 10
  return item[key] ?? 0
}

interface TooltipSeriesParam {
  name?: string
  seriesName?: string
  value?: number
  color?: string
}

function updateChartOption() {
  if (!mainChart) return
  const chartData = props.chartData
  const dates = chartData.map((item) => item.date)

  const showRightAxis = selectedMetrics.value.some((m) => INCOME_METRIC_SET.has(m))
  const showLeftAxis = selectedMetrics.value.some((m) => !INCOME_METRIC_SET.has(m))

  const textColor = isDarkMode.value ? '#a1a1aa' : '#52525b'
  const textHeadingColor = isDarkMode.value ? '#fafafa' : '#18181b'
  const borderColor = isDarkMode.value ? 'rgba(255, 255, 255, 0.1)' : '#e4e4e7'
  const dividerColor = isDarkMode.value ? 'rgba(255, 255, 255, 0.05)' : '#f4f4f5'
  const tooltipBg = isDarkMode.value ? 'rgba(18, 20, 28, 0.96)' : 'rgba(255, 255, 255, 0.96)'
  const isBar = chartViewType.value === 'bar'

  const series = selectedMetrics.value
    .map((metricKey) => {
      const metricConfig = CHART_METRICS.find((m) => m.value === metricKey)
      if (!metricConfig) return null

      const isInc = INCOME_METRIC_SET.has(metricKey)
      return {
        name: metricConfig.label,
        type: isBar ? 'bar' : 'line',
        data: chartData.map((item) => getMetricValue(item, metricKey)),
        smooth: !isBar,
        yAxisIndex: isInc && showLeftAxis ? 1 : 0,
        itemStyle: {
          color: metricConfig.color,
          borderRadius: isBar ? [3, 3, 0, 0] : 0,
        },
        areaStyle: !isBar && metricKey === 'income' ? { opacity: 0.15, color: metricConfig.color } : undefined,
        barMaxWidth: isBar ? 20 : undefined,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  const yAxis: Array<Record<string, unknown>> = []
  const axisLabel = { color: textColor, fontSize: 11 }
  const axisLine = { show: true, lineStyle: { color: borderColor } }

  if (showLeftAxis) {
    yAxis.push({
      type: 'value',
      position: 'left',
      name: '频次 / 人数 / 条数',
      axisLine,
      axisLabel,
      splitLine: { lineStyle: { color: dividerColor } },
      nameTextStyle: axisLabel,
    })
  } else if (showRightAxis) {
    yAxis.push({
      type: 'value',
      position: 'left',
      name: '金额 (¥)',
      axisLine,
      axisLabel,
      splitLine: { lineStyle: { color: dividerColor } },
      nameTextStyle: axisLabel,
    })
  }

  if (showRightAxis && showLeftAxis) {
    yAxis.push({
      type: 'value',
      position: 'right',
      name: '金额 (¥)',
      axisLine,
      axisLabel,
      splitLine: { show: false },
      nameTextStyle: axisLabel,
    })
  }

  const option: echarts.EChartsCoreOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor,
      borderWidth: 1,
      textStyle: { color: textHeadingColor, fontSize: 12 },
      extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.35); border-radius: 8px; backdrop-filter: blur(8px);',
      formatter: (rawParams: unknown) => {
        if (!Array.isArray(rawParams) || rawParams.length === 0) return ''
        const params = rawParams as TooltipSeriesParam[]
        const dateStr = params[0]?.name ?? ''
        const rawPoint = chartData.find((p) => p.date === dateStr)
        let html = `<div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid ${dividerColor}; padding-bottom: 4px;">📅 ${dateStr}</div>`
        for (const param of params) {
          const cfg = CHART_METRICS.find((m) => m.label === param.seriesName)
          const unit = cfg?.unit ?? ''
          const numericVal = typeof param.value === 'number' ? param.value : 0
          const val =
            unit === '¥'
              ? formatCurrency(numericVal)
              : `${formatNumber(numericVal)} <span style="font-size:11px; opacity:0.8;">${unit}</span>`
          html += `<div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin: 3px 0; font-size: 11.5px;">
            <span style="display:flex; align-items:center; gap:6px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${param.color ?? ''};"></span>
              <span style="color:${textColor};">${param.seriesName ?? ''}</span>
            </span>
            <span style="font-weight:600; font-family:monospace;">${val}</span>
          </div>`
        }
        if (rawPoint && rawPoint.liveMinutes > 0) {
          html += `<div style="margin-top:6px; padding-top:4px; border-top:1px dashed ${dividerColor}; font-size:11px; color:${textColor}; text-align:right;">开播约 ${(rawPoint.liveMinutes / 60).toFixed(1)} 小时</div>`
        }
        return html
      },
    },
    legend: {
      show: true,
      top: 0,
      right: 12,
      textStyle: { color: textColor, fontSize: 11 },
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 6,
    },
    grid: {
      left: '3%',
      right: showRightAxis && showLeftAxis ? '4%' : '3%',
      bottom: '12%',
      top: '12%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: borderColor } },
      axisLabel,
    },
    yAxis,
    dataZoom: [
      {
        type: 'slider',
        show: true,
        bottom: 4,
        height: 18,
        borderColor,
        backgroundColor: isDarkMode.value ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        fillerColor: isDarkMode.value ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.25)',
        handleStyle: {
          color: '#f59e0b',
          borderColor: isDarkMode.value ? '#18181b' : '#ffffff',
        },
        textStyle: { color: textColor, fontSize: 10 },
      },
      { type: 'inside' },
    ],
    series,
  }

  mainChart.setOption(option, true)
}

async function ensureChartInit() {
  await nextTick()
  if (!chartRef.value || props.chartData.length === 0) return
  if (!mainChart) {
    mainChart = echarts.init(chartRef.value)
    chartResizeObserver?.disconnect()
    chartResizeObserver = new ResizeObserver(() => mainChart?.resize())
    chartResizeObserver.observe(chartRef.value)
  }
  updateChartOption()
}

watch(
  () => [props.chartData, selectedMetrics.value, isDarkMode.value, chartViewType.value] as const,
  () => {
    if (!mainChart) {
      void ensureChartInit()
    } else {
      updateChartOption()
    }
  },
)

onMounted(() => {
  void ensureChartInit()
})

onUnmounted(() => {
  chartResizeObserver?.disconnect()
  mainChart?.dispose()
})
</script>

<template>
  <Card class="p-4 space-y-3">
    <div class="flex-between flex-wrap gap-2">
      <div class="flex items-center gap-2 text-xs font-semibold">
        <component
          :is="DataTrending24Regular"
          class="h-4 w-4 text-brand"
        />
        <span>{{ titlePrefix }}直播多维演进趋势</span>
      </div>

      <div class="flex items-center gap-2">
        <ToggleGroup
          v-model="activeMetricPreset"
          type="single"
          size="xs"
        >
          <ToggleGroupItem
            value="income"
            @click="applyMetricPreset('income')"
            >收益拆解</ToggleGroupItem
          >
          <ToggleGroupItem
            value="danmaku"
            @click="applyMetricPreset('danmaku')"
            >弹幕互动</ToggleGroupItem
          >
          <ToggleGroupItem
            value="audience"
            @click="applyMetricPreset('audience')"
            >观众付费</ToggleGroupItem
          >
          <ToggleGroupItem
            value="all"
            @click="applyMetricPreset('all')"
            >全维概览</ToggleGroupItem
          >
        </ToggleGroup>

        <ToggleGroup
          v-model="chartViewType"
          type="single"
          size="xs"
        >
          <ToggleGroupItem value="trend">折线</ToggleGroupItem>
          <ToggleGroupItem value="bar">柱状</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>

    <div class="flex items-center gap-3 p-2 rounded-md bg-muted/40 border border-border flex-wrap text-xs">
      <div
        v-for="metric in CHART_METRICS"
        :key="metric.value"
        class="flex items-center gap-1.5 cursor-pointer select-none"
        @click="toggleMetric(metric.value)"
      >
        <div
          class="w-2.5 h-2.5 rounded-full"
          :style="{ backgroundColor: metric.color }"
        />
        <span
          :class="{
            'font-semibold text-foreground': selectedMetrics.includes(metric.value),
            'text-muted-foreground/60': !selectedMetrics.includes(metric.value),
          }"
        >
          {{ metric.label }}
        </span>
      </div>
    </div>

    <div
      ref="chartRef"
      class="w-full h-80"
    />
  </Card>
</template>
