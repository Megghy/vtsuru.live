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

type OrgChartDataItem = { timestamp: number, date: string } & Record<string, unknown>

export function useOrgAnalyzeChart(options: {
  chartRef: Ref<HTMLElement | null>
  analyzeData: Ref<{ chartData?: Record<string, any> } | null>
  formatDate: (timestamp: number) => string
  themeVars: Ref<{ textColor2: string, borderColor: string, dividerColor: string }>
  selectedMetrics: Ref<string[]>
  chartMetrics: OrgAnalyzeChartMetric[]
}) {
  let mainChart: echarts.ECharts | null = null

  function getChartDataArray(): OrgChartDataItem[] {
    if (!options.analyzeData.value?.chartData) return []
    return Object.entries(options.analyzeData.value.chartData)
      .map(([timestamp, data]) => ({
        timestamp: Number.parseInt(timestamp, 10),
        date: options.formatDate(Number.parseInt(timestamp, 10)),
        ...(data as Record<string, unknown>),
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  function getThemeColors() {
    return {
      textColor: options.themeVars.value.textColor2,
      axisLineColor: options.themeVars.value.borderColor,
      splitLineColor: options.themeVars.value.dividerColor,
    }
  }

  function initChart() {
    if (!options.chartRef.value) return
    const chartData = getChartDataArray()
    if (chartData.length === 0) return

    ensureEchartsRegistered()
    mainChart = echarts.init(options.chartRef.value)
    updateChartOption()
  }

  function updateChartOption() {
    if (!mainChart) return
    const chartData = getChartDataArray()
    const dates = chartData.map(item => item.date)
    const themeColors = getThemeColors()

    const showRightAxis = options.selectedMetrics.value.includes('income')
    const showLeftAxis = options.selectedMetrics.value.some(m => m !== 'income')

    const series = options.selectedMetrics.value
      .map((metricKey) => {
        const metricConfig = options.chartMetrics.find(m => m.value === metricKey)
        if (!metricConfig) return null

        return {
          name: metricConfig.label,
          type: metricConfig.type,
          data: chartData.map(item => item[metricKey]),
          smooth: true,
          yAxisIndex: (metricKey === 'income' && showLeftAxis) ? 1 : 0,
          itemStyle: { color: metricConfig.color },
          areaStyle: metricConfig.type === 'line'
            ? { opacity: 0.1, color: metricConfig.color }
            : undefined,
          barMaxWidth: metricConfig.type === 'bar' ? '20%' : undefined,
        }
      })
      .filter((s): s is Exclude<typeof s, null> => s !== null)

    const yAxis: any[] = []
    if (showLeftAxis) {
      yAxis.push({
        type: 'value',
        position: 'left',
        name: '数量',
        axisLine: { show: true, lineStyle: { color: themeColors.axisLineColor } },
        axisLabel: { color: themeColors.textColor },
        splitLine: { lineStyle: { color: themeColors.splitLineColor } },
        nameTextStyle: { color: themeColors.textColor },
      })
    } else if (showRightAxis) {
      yAxis.push({
        type: 'value',
        position: 'left',
        name: '金额',
        axisLine: { show: true, lineStyle: { color: themeColors.axisLineColor } },
        axisLabel: { color: themeColors.textColor },
        splitLine: { lineStyle: { color: themeColors.splitLineColor } },
        nameTextStyle: { color: themeColors.textColor },
      })
    }

    if (showLeftAxis && showRightAxis) {
      yAxis.push({
        type: 'value',
        position: 'right',
        name: '金额',
        axisLine: { show: true, lineStyle: { color: themeColors.axisLineColor } },
        axisLabel: { color: themeColors.textColor },
        splitLine: { show: false },
        nameTextStyle: { color: themeColors.textColor },
      })
    }

    mainChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: {
        data: options.selectedMetrics.value
          .map(m => options.chartMetrics.find(x => x.value === m)?.label)
          .filter(Boolean),
        textStyle: { color: themeColors.textColor },
      },
      grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
      dataZoom: [
        { type: 'inside', start: 0, end: 100 },
        { type: 'slider', start: 0, end: 100, height: 20, bottom: 0 },
      ],
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { color: themeColors.textColor },
        axisLine: { lineStyle: { color: themeColors.axisLineColor } },
      },
      yAxis,
      series,
    })
  }

  function disposeChart() {
    if (mainChart) {
      mainChart.dispose()
      mainChart = null
    }
  }

  return {
    initChart,
    updateChartOption,
    disposeChart,
  }
}

