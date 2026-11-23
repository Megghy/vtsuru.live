import { BarChart, LineChart } from 'echarts/charts'
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
import type { Ref } from 'vue'

let echartsRegistered = false
function ensureEchartsRegistered() {
  if (echartsRegistered) return
  echartsRegistered = true

  ;(echarts as any).use([
    TitleComponent,
    TooltipComponent,
    GridComponent,
    LegendComponent,
    LineChart,
    BarChart,
    CanvasRenderer,
    MarkPointComponent,
    MarkLineComponent,
    DataZoomComponent,
  ])
}

export interface OrgAnalyzeChartMetric {
  label: string
  value: string
  color: string
  type: 'line' | 'bar'
  yAxisIndex?: number
}

type OrgChartDataItem = { timestamp: number; date: string } & Record<string, unknown>

function resolveCssColor(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return val || fallback
}

export function useOrgAnalyzeChart(options: {
  chartRef: Ref<HTMLElement | null>
  analyzeData: Ref<{ chartData?: Record<string, any> } | null>
  formatDate: (timestamp: number) => string
  selectedMetrics: Ref<string[]>
  chartMetrics: OrgAnalyzeChartMetric[]
}) {
  let mainChart: echarts.ECharts | null = null
  let resizeObserver: ResizeObserver | null = null
  let observedEl: HTMLElement | null = null

  function getChartDataArray(): OrgChartDataItem[] {
    if (!options.analyzeData.value?.chartData) return []
    return Object.entries(options.analyzeData.value.chartData)
      .map(([timestamp, data]) => ({
        timestamp: Number.parseInt(timestamp, 10),
        date: options.formatDate(Number.parseInt(timestamp, 10)),
        ...(data as Record<string, unknown>),
      }))
      .toSorted((a, b) => a.timestamp - b.timestamp)
  }

  function getThemeColors() {
    // CanvasRenderer 无法解析 CSS var(...)，必须读取计算后的真实色值
    return {
      textColor: resolveCssColor('--muted-foreground', '#71717a'),
      axisLineColor: resolveCssColor('--border', '#27272a'),
      splitLineColor: resolveCssColor('--border', '#27272a'),
      tooltipBg: resolveCssColor('--popover', '#18181b'),
      tooltipText: resolveCssColor('--popover-foreground', '#fafafa'),
      tooltipBorder: resolveCssColor('--border', '#27272a'),
    }
  }

  function bindResizeObserver(el: HTMLElement) {
    if (observedEl === el && resizeObserver) return
    resizeObserver?.disconnect()
    observedEl = el
    if (typeof ResizeObserver === 'undefined') return
    resizeObserver = new ResizeObserver(() => {
      mainChart?.resize()
    })
    resizeObserver.observe(el)
  }

  function renderChart() {
    const el = options.chartRef.value
    const chartData = getChartDataArray()
    if (!el || chartData.length === 0) return

    ensureEchartsRegistered()
    if (!mainChart || mainChart.getDom() !== el) {
      disposeChart()
      mainChart = echarts.init(el)
    }
    bindResizeObserver(el)
    updateChartOption()
  }

  function updateChartOption() {
    if (!mainChart) return
    const chartData = getChartDataArray()
    if (chartData.length === 0) return

    const dates = chartData.map((item) => item.date)
    const themeColors = getThemeColors()

    const showRightAxis = options.selectedMetrics.value.includes('income')
    const showLeftAxis = options.selectedMetrics.value.some((m) => m !== 'income')

    const series = options.selectedMetrics.value
      .map((metricKey) => {
        const metricConfig = options.chartMetrics.find((m) => m.value === metricKey)
        if (!metricConfig) return null

        return {
          name: metricConfig.label,
          type: metricConfig.type,
          data: chartData.map((item) => Number(item[metricKey] ?? 0)),
          smooth: true,
          yAxisIndex: metricKey === 'income' && showLeftAxis ? 1 : 0,
          itemStyle: { color: metricConfig.color },
          areaStyle: metricConfig.type === 'line' ? { opacity: 0.12, color: metricConfig.color } : undefined,
          barMaxWidth: metricConfig.type === 'bar' ? '24%' : undefined,
        }
      })
      .filter((s): s is Exclude<typeof s, null> => s !== null)

    const yAxis: any[] = []
    if (showLeftAxis) {
      yAxis.push({
        type: 'value',
        position: 'left',
        name: '数量 / 时长',
        axisLine: { show: true, lineStyle: { color: themeColors.axisLineColor } },
        axisLabel: { color: themeColors.textColor },
        splitLine: { lineStyle: { color: themeColors.splitLineColor, opacity: 0.35 } },
        nameTextStyle: { color: themeColors.textColor },
      })
    } else if (showRightAxis) {
      yAxis.push({
        type: 'value',
        position: 'left',
        name: '金额 (¥)',
        axisLine: { show: true, lineStyle: { color: themeColors.axisLineColor } },
        axisLabel: { color: themeColors.textColor },
        splitLine: { lineStyle: { color: themeColors.splitLineColor, opacity: 0.35 } },
        nameTextStyle: { color: themeColors.textColor },
      })
    }

    if (showLeftAxis && showRightAxis) {
      yAxis.push({
        type: 'value',
        position: 'right',
        name: '金额 (¥)',
        axisLine: { show: true, lineStyle: { color: themeColors.axisLineColor } },
        axisLabel: { color: themeColors.textColor },
        splitLine: { show: false },
        nameTextStyle: { color: themeColors.textColor },
      })
    }

    mainChart.setOption(
      {
        tooltip: {
          trigger: 'axis',
          backgroundColor: themeColors.tooltipBg,
          borderColor: themeColors.tooltipBorder,
          textStyle: { color: themeColors.tooltipText, fontSize: 12 },
        },
        legend: {
          data: options.selectedMetrics.value
            .map((m) => options.chartMetrics.find((x) => x.value === m)?.label)
            .filter(Boolean),
          textStyle: { color: themeColors.textColor },
        },
        grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
        dataZoom: [
          { type: 'inside', start: 0, end: 100 },
          { type: 'slider', start: 0, end: 100, height: 18, bottom: 2, borderColor: themeColors.axisLineColor },
        ],
        xAxis: {
          type: 'category',
          data: dates,
          axisLabel: { color: themeColors.textColor },
          axisLine: { lineStyle: { color: themeColors.axisLineColor } },
        },
        yAxis,
        series,
      },
      true,
    )
  }

  function disposeChart() {
    resizeObserver?.disconnect()
    resizeObserver = null
    observedEl = null
    if (mainChart) {
      mainChart.dispose()
      mainChart = null
    }
  }

  return {
    renderChart,
    updateChartOption,
    disposeChart,
  }
}
