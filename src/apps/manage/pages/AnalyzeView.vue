<script lang="ts" setup>
import {
  ArrowClockwise24Regular,
  ArrowDown24Regular,
  ArrowTrending24Regular,
  CalendarClock24Regular,
  CalendarLtr24Regular,
  ChatMultiple24Regular,
  ChevronDown24Regular,
  ChevronUp24Regular,
  DataTrending24Regular,
  Grid24Regular,
  MoneyHand24Regular,
  People24Regular,
  Sparkle24Regular,
  Star24Regular,
  Table24Regular,
  Timer24Regular,
  Trophy24Regular,
  Wallet24Regular,
} from '@vicons/fluent'
import { addDays, endOfDay, format, startOfDay } from 'date-fns'
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
import { storeToRefs } from 'pinia'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import {
  computeAreaStatsFromSessions,
  computeDayOfWeekStats,
  computeMilestones,
  computeRangeSummary,
  filterChartDataByRange,
  filterSessionsByRange,
  type AnalyzeAreaStat,
  type AnalyzeDayOfWeekStat,
  type AnalyzeDayPoint,
  type AnalyzeMilestones,
  type AnalyzeOfflineEventItem,
  type AnalyzeRangeSummary,
  type AnalyzeSessionItem,
} from '@/apps/manage/composables/analyzeRange'
import { formatCurrency, formatDate, formatNumber } from '@/apps/manage/composables/formatters'
import { useAnalyzeStore } from '@/apps/manage/composables/useAnalyzeStore'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { DateRangePicker } from '@/shared/ui/date-picker'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'
import { Switch } from '@/shared/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { isDarkMode, toast } from '@/shared/utils'

// 注册 ECharts 必要组件
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

// 状态管理（SWR 跨页面保活）
const analyzeStore = useAnalyzeStore()
const { analyzeData, loading, refreshing, hasData } = storeToRefs(analyzeStore)

// 区间预设与选择
type RangePreset = '7d' | '30d' | '60d' | 'all' | 'custom'
const activePreset = ref<RangePreset>('30d')
const dateRange = ref<[number, number] | null>([
  startOfDay(addDays(new Date(), -29)).getTime(),
  endOfDay(new Date()).getTime(),
])

const customStartDate = ref(format(addDays(new Date(), -29), 'yyyy-MM-dd'))
const customEndDate = ref(format(new Date(), 'yyyy-MM-dd'))

function setPreset(preset: RangePreset) {
  activePreset.value = preset
  const now = new Date()
  if (preset === '7d') {
    dateRange.value = [startOfDay(addDays(now, -6)).getTime(), endOfDay(now).getTime()]
    customStartDate.value = format(addDays(now, -6), 'yyyy-MM-dd')
    customEndDate.value = format(now, 'yyyy-MM-dd')
  } else if (preset === '30d') {
    dateRange.value = [startOfDay(addDays(now, -29)).getTime(), endOfDay(now).getTime()]
    customStartDate.value = format(addDays(now, -29), 'yyyy-MM-dd')
    customEndDate.value = format(now, 'yyyy-MM-dd')
  } else if (preset === '60d') {
    dateRange.value = [startOfDay(addDays(now, -59)).getTime(), endOfDay(now).getTime()]
    customStartDate.value = format(addDays(now, -59), 'yyyy-MM-dd')
    customEndDate.value = format(now, 'yyyy-MM-dd')
  } else if (preset === 'all') {
    dateRange.value = null
  }
}

function handleCustomDateApply() {
  if (!customStartDate.value || !customEndDate.value) return
  activePreset.value = 'custom'
  const start = startOfDay(new Date(customStartDate.value)).getTime()
  const end = endOfDay(new Date(customEndDate.value)).getTime()
  if (start <= end) {
    dateRange.value = [start, end]
  } else {
    dateRange.value = [end, start]
  }
}

// 格式化全部图表点数组（按日期升序）
const allChartPoints = computed<Array<AnalyzeDayPoint & { date: string }>>(() => {
  if (!analyzeData.value?.chartData) return []

  return Object.entries(analyzeData.value.chartData)
    .map(([timestampStr, data]) => {
      const rawTs = Number.parseInt(timestampStr, 10)
      const ts = rawTs < 10_000_000_000 && rawTs > 100_000_000 ? rawTs * 1_000 : rawTs
      return {
        timestamp: ts,
        date: formatDate(ts),
        income: data.income || 0,
        giftIncome: data.giftIncome ?? data.income ?? 0,
        scIncome: data.scIncome ?? 0,
        guardIncome: data.guardIncome ?? 0,
        offlineIncome: data.offlineIncome ?? 0,
        offlineGuardIncome: data.offlineGuardIncome ?? 0,
        offlineScIncome: data.offlineScIncome ?? 0,
        grandTotalIncome: data.grandTotalIncome ?? (data.income || 0) + (data.offlineIncome || 0),
        totalIncomeWithGuard: data.totalIncomeWithGuard ?? (data.income || 0) + (data.guardIncome || 0),
        interactionCount: data.interactionCount || 0,
        danmakuCount: data.danmakuCount || 0,
        payingUsers: data.payingUsers || 0,
        interactionUsers: data.interactionUsers || 0,
        liveMinutes: data.liveMinutes || 0,
        likeCount: data.likeCount || 0,
        sessionCount: data.sessionCount || ((data.liveMinutes || 0) > 0 ? 1 : 0),
      }
    })
    .toSorted((a, b) => a.timestamp - b.timestamp)
})

// 过滤后的时间序列数据
const filteredChartData = computed(() => {
  const all = allChartPoints.value
  if (!dateRange.value) return all
  return filterChartDataByRange(all, dateRange.value[0], dateRange.value[1]).map((p) => ({
    ...p,
    date: formatDate(p.timestamp),
  }))
})

// 单一真源聚合模型
interface UnifiedSummary extends AnalyzeRangeSummary {
  titlePrefix: string
  incomeTrend?: number
  interactionTrend?: number
  danmakuTrend?: number
  offlineGuardCount?: number
}

const currentSummary = computed<UnifiedSummary>(() => {
  const chartPoints = filteredChartData.value
  const calculated = computeRangeSummary(chartPoints)

  if (activePreset.value === '7d' && analyzeData.value?.summary?.last7Days) {
    const s7 = analyzeData.value.summary.last7Days
    return {
      ...calculated,
      totalIncome: s7.totalIncome ?? calculated.totalIncome,
      giftIncome: s7.giftIncome ?? calculated.giftIncome,
      scIncome: s7.scIncome ?? calculated.scIncome,
      guardIncome: s7.guardIncome ?? calculated.guardIncome,
      offlineIncome: s7.offlineIncome ?? calculated.offlineIncome,
      offlineGuardIncome: s7.offlineGuardIncome ?? calculated.offlineGuardIncome,
      offlineScIncome: s7.offlineScIncome ?? calculated.offlineScIncome,
      grandTotalIncome: s7.grandTotalIncome ?? calculated.grandTotalIncome,
      offlineGuardCount: s7.offlineGuardCount ?? 0,
      totalIncomeWithGuard: s7.totalIncomeWithGuard ?? calculated.totalIncomeWithGuard,
      totalInteractions: s7.totalInteractions ?? calculated.totalInteractions,
      totalDanmakuCount: s7.totalDanmakuCount ?? calculated.totalDanmakuCount,
      totalLiveMinutes: s7.totalLiveMinutes ?? calculated.totalLiveMinutes,
      activeLiveDays: s7.activeLiveDays ?? calculated.activeLiveDays,
      interactionUsers: s7.interactionUsers ?? calculated.interactionUsers,
      payingUsers: s7.payingUsers ?? calculated.payingUsers,
      dailyAvgIncome: s7.dailyAvgIncome ?? calculated.dailyAvgIncome,
      dailyAvgDanmaku: s7.dailyAvgDanmaku ?? calculated.dailyAvgDanmaku,
      titlePrefix: '近7天',
      incomeTrend: s7.incomeTrend,
      interactionTrend: s7.interactionTrend,
      danmakuTrend: s7.danmakuTrend,
    }
  }

  if (activePreset.value === '30d' && analyzeData.value?.summary?.last30Days) {
    const s30 = analyzeData.value.summary.last30Days
    return {
      ...calculated,
      totalIncome: s30.totalIncome ?? calculated.totalIncome,
      giftIncome: s30.giftIncome ?? calculated.giftIncome,
      scIncome: s30.scIncome ?? calculated.scIncome,
      guardIncome: s30.guardIncome ?? calculated.guardIncome,
      offlineIncome: s30.offlineIncome ?? calculated.offlineIncome,
      offlineGuardIncome: s30.offlineGuardIncome ?? calculated.offlineGuardIncome,
      offlineScIncome: s30.offlineScIncome ?? calculated.offlineScIncome,
      grandTotalIncome: s30.grandTotalIncome ?? calculated.grandTotalIncome,
      offlineGuardCount: s30.offlineGuardCount ?? 0,
      totalIncomeWithGuard: s30.totalIncomeWithGuard ?? calculated.totalIncomeWithGuard,
      totalInteractions: s30.totalInteractions ?? calculated.totalInteractions,
      totalDanmakuCount: s30.totalDanmakuCount ?? calculated.totalDanmakuCount,
      totalLiveMinutes: s30.totalLiveMinutes ?? calculated.totalLiveMinutes,
      activeLiveDays: s30.activeLiveDays ?? calculated.activeLiveDays,
      interactionUsers: s30.interactionUsers ?? calculated.interactionUsers,
      payingUsers: s30.payingUsers ?? calculated.payingUsers,
      dailyAvgIncome: s30.dailyAvgIncome ?? calculated.dailyAvgIncome,
      dailyAvgDanmaku: s30.dailyAvgDanmaku ?? calculated.dailyAvgDanmaku,
      titlePrefix: '近30天',
      incomeTrend: s30.incomeTrend,
      interactionTrend: s30.interactionTrend,
      danmakuTrend: s30.danmakuTrend,
    }
  }

  const prefix =
    activePreset.value === '60d'
      ? '近60天'
      : activePreset.value === 'all'
        ? '历史全量'
        : dateRange.value
          ? `${formatDate(dateRange.value[0])} ~ ${formatDate(dateRange.value[1])}`
          : '所选区间'

  return {
    ...calculated,
    titlePrefix: prefix,
    incomeTrend: undefined,
    interactionTrend: undefined,
    danmakuTrend: undefined,
    offlineGuardCount: filteredOfflineEvents.value.filter((e) => e.type === 0).length,
  }
})

// 过滤后的离线事件流水
const filteredOfflineEvents = computed<AnalyzeOfflineEventItem[]>(() => {
  const all = analyzeData.value?.offlineEvents || []
  if (!dateRange.value) return all
  const start = Math.min(dateRange.value[0], dateRange.value[1])
  const end = Math.max(dateRange.value[0], dateRange.value[1])
  return all.filter((e) => {
    const ts = e.time < 10_000_000_000 && e.time > 100_000_000 ? e.time * 1_000 : e.time
    return ts >= start && ts <= end
  })
})

// 区间里程碑峰值
const currentMilestones = computed<AnalyzeMilestones>(() => computeMilestones(filteredChartData.value))

// 过滤后的场次列表
const currentFilteredSessions = computed<AnalyzeSessionItem[]>(() => {
  const allSessions = analyzeData.value?.sessions || []
  if (!dateRange.value) return allSessions
  return filterSessionsByRange(allSessions, dateRange.value[0], dateRange.value[1])
})

// 分区效能表现
const currentAreaStats = computed<AnalyzeAreaStat[]>(() => {
  if (currentFilteredSessions.value.length > 0) {
    return computeAreaStatsFromSessions(currentFilteredSessions.value)
  }
  return analyzeData.value?.areaStats || []
})

// 周一至周日开播分布
const currentDayOfWeekStats = computed<AnalyzeDayOfWeekStat[]>(() => computeDayOfWeekStats(filteredChartData.value))

// 最佳开播日提炼小贴士
const bestDayInsight = computed(() => {
  const stats = currentDayOfWeekStats.value.filter((d) => d.liveDaysCount > 0)
  if (stats.length === 0) return null

  const bestIncomeDay = stats.toSorted((a, b) => b.avgIncome - a.avgIncome)[0]
  const bestDanmakuDay = stats.toSorted((a, b) => b.avgDanmaku - a.avgDanmaku)[0]

  return {
    income: bestIncomeDay,
    danmaku: bestDanmakuDay,
  }
})

// 活跃矩阵等级判定与节奏统计
function getHeatmapLevel(liveMinutes: number): number {
  if (liveMinutes === 0) return 0
  if (liveMinutes < 120) return 1
  if (liveMinutes < 240) return 2
  if (liveMinutes < 360) return 3
  return 4
}

const heatmapDays = computed(() => allChartPoints.value)

const heatmapStats = computed(() => {
  const days = heatmapDays.value
  if (days.length === 0) return { totalDays: 0, liveDays: 0, restDays: 0, rate: 0 }
  let liveDays = 0
  for (const d of days) {
    if (d.liveMinutes > 0) liveDays++
  }
  const restDays = days.length - liveDays
  const rate = Math.round((liveDays / days.length) * 100)
  return {
    totalDays: days.length,
    liveDays,
    restDays,
    rate,
  }
})

// 单场高光 Top 5
const topSessionsByIncome = computed(() =>
  currentFilteredSessions.value.toSorted((a, b) => b.totalIncome - a.totalIncome).slice(0, 5),
)
const topSessionsByDanmaku = computed(() =>
  currentFilteredSessions.value.toSorted((a, b) => b.danmakuCount - a.danmakuCount).slice(0, 5),
)
const topSessionsByDuration = computed(() =>
  currentFilteredSessions.value.toSorted((a, b) => b.liveMinutes - a.liveMinutes).slice(0, 5),
)

const activeTopSessionTab = ref<'income' | 'danmaku' | 'duration'>('income')

// 每日明细复盘表配置
const isDailyTableExpanded = ref(false)
const showOnlyLiveDays = ref(true)
const dailyTableSortKey = ref<'date' | 'income' | 'danmaku' | 'duration' | 'interactions'>('date')
const dailyTableSortAsc = ref(false)

const dailyTableData = computed(() => {
  let list = filteredChartData.value.map((p) => ({
    ...p,
    liveHours: Math.round(((p.liveMinutes || 0) / 60) * 10) / 10,
  }))

  if (showOnlyLiveDays.value) {
    list = list.filter((p) => (p.liveMinutes || 0) > 0 || (p.income || 0) > 0 || (p.danmakuCount || 0) > 0)
  }

  return list.toSorted((a, b) => {
    let diff = 0
    if (dailyTableSortKey.value === 'date') diff = a.timestamp - b.timestamp
    else if (dailyTableSortKey.value === 'income') diff = a.income - b.income
    else if (dailyTableSortKey.value === 'danmaku') diff = a.danmakuCount - b.danmakuCount
    else if (dailyTableSortKey.value === 'duration') diff = a.liveMinutes - b.liveMinutes
    else if (dailyTableSortKey.value === 'interactions') diff = a.interactionCount - b.interactionCount

    return dailyTableSortAsc.value ? diff : -diff
  })
})

function toggleDailySort(key: 'date' | 'income' | 'danmaku' | 'duration' | 'interactions') {
  if (dailyTableSortKey.value === key) {
    dailyTableSortAsc.value = !dailyTableSortAsc.value
  } else {
    dailyTableSortKey.value = key
    dailyTableSortAsc.value = false
  }
}

// 主趋势图表与视角配置
const chartRef = ref<HTMLElement | null>(null)
let mainChart: echarts.ECharts | null = null
let chartResizeObserver: ResizeObserver | null = null

type ChartViewType = 'trend' | 'bar'
const chartViewType = ref<ChartViewType>('trend')

type MetricPreset = 'all' | 'income' | 'danmaku' | 'audience'
const activeMetricPreset = ref<MetricPreset>('income')

const selectedMetrics = ref<string[]>(['income', 'giftIncome', 'scIncome', 'interactionCount', 'danmakuCount'])

function applyMetricPreset(preset: MetricPreset) {
  activeMetricPreset.value = preset
  if (preset === 'all') {
    selectedMetrics.value = ['income', 'danmakuCount', 'interactionUsers', 'payingUsers', 'liveHours']
  } else if (preset === 'income') {
    selectedMetrics.value = ['income', 'giftIncome', 'scIncome', 'guardIncome']
  } else if (preset === 'danmaku') {
    selectedMetrics.value = ['danmakuCount', 'interactionCount', 'likeCount']
  } else if (preset === 'audience') {
    selectedMetrics.value = ['interactionUsers', 'payingUsers', 'danmakuCount']
  }
}

const chartMetrics = computed(() => [
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
])

function toggleMetric(value: string) {
  if (selectedMetrics.value.includes(value)) {
    if (selectedMetrics.value.length > 1) {
      selectedMetrics.value = selectedMetrics.value.filter((m) => m !== value)
    }
  } else {
    selectedMetrics.value = [...selectedMetrics.value, value]
  }
}

function initChart() {
  if (!chartRef.value) return
  if (filteredChartData.value.length === 0) return

  if (!mainChart) {
    mainChart = echarts.init(chartRef.value)
    if (chartResizeObserver) chartResizeObserver.disconnect()
    chartResizeObserver = new ResizeObserver(() => mainChart?.resize())
    chartResizeObserver.observe(chartRef.value)
  }
  updateChartOption()
}

function updateChartOption() {
  if (!mainChart) return
  const chartData = filteredChartData.value
  const dates = chartData.map((item) => item.date)

  const isIncomeMetric = (m: string) =>
    ['income', 'giftIncome', 'scIncome', 'guardIncome', 'offlineIncome', 'grandTotalIncome'].includes(m)
  const showRightAxis = selectedMetrics.value.some(isIncomeMetric)
  const showLeftAxis = selectedMetrics.value.some((m) => !isIncomeMetric(m))

  const textColor = isDarkMode.value ? '#a1a1aa' : '#52525b'
  const textHeadingColor = isDarkMode.value ? '#fafafa' : '#18181b'
  const borderColor = isDarkMode.value ? 'rgba(255, 255, 255, 0.1)' : '#e4e4e7'
  const dividerColor = isDarkMode.value ? 'rgba(255, 255, 255, 0.05)' : '#f4f4f5'
  const tooltipBg = isDarkMode.value ? 'rgba(18, 20, 28, 0.96)' : 'rgba(255, 255, 255, 0.96)'

  const series = selectedMetrics.value
    .map((metricKey) => {
      const metricConfig = chartMetrics.value.find((m) => m.value === metricKey)
      if (!metricConfig) return null

      const isInc = isIncomeMetric(metricKey)
      const dataValues = chartData.map((item) => {
        if (metricKey === 'liveHours') return Math.round(((item.liveMinutes || 0) / 60) * 10) / 10
        return (item as any)[metricKey] || 0
      })

      const isBar = chartViewType.value === 'bar'

      return {
        name: metricConfig.label,
        type: isBar ? 'bar' : 'line',
        data: dataValues,
        smooth: !isBar,
        yAxisIndex: isInc && showLeftAxis ? 1 : 0,
        itemStyle: {
          color: metricConfig.color,
          borderRadius: isBar ? [3, 3, 0, 0] : 0,
        },
        areaStyle:
          !isBar && metricKey === 'income'
            ? {
                opacity: 0.15,
                color: metricConfig.color,
              }
            : undefined,
        barMaxWidth: isBar ? 20 : undefined,
      }
    })
    .filter(Boolean)

  const yAxis: any[] = []

  if (showLeftAxis) {
    yAxis.push({
      type: 'value',
      position: 'left',
      name: '频次 / 人数 / 条数',
      axisLine: { show: true, lineStyle: { color: borderColor } },
      axisLabel: { color: textColor, fontSize: 11 },
      splitLine: { lineStyle: { color: dividerColor } },
      nameTextStyle: { color: textColor, fontSize: 11 },
    })
  } else if (showRightAxis) {
    yAxis.push({
      type: 'value',
      position: 'left',
      name: '金额 (¥)',
      axisLine: { show: true, lineStyle: { color: borderColor } },
      axisLabel: { color: textColor, fontSize: 11 },
      splitLine: { lineStyle: { color: dividerColor } },
      nameTextStyle: { color: textColor, fontSize: 11 },
    })
  }

  if (showRightAxis && showLeftAxis) {
    yAxis.push({
      type: 'value',
      position: 'right',
      name: '金额 (¥)',
      axisLine: { show: true, lineStyle: { color: borderColor } },
      axisLabel: { color: textColor, fontSize: 11 },
      splitLine: { show: false },
      nameTextStyle: { color: textColor, fontSize: 11 },
    })
  }

  const option: echarts.EChartsCoreOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: borderColor,
      borderWidth: 1,
      textStyle: { color: textHeadingColor, fontSize: 12 },
      extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.35); border-radius: 8px; backdrop-filter: blur(8px);',
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return ''
        const dateStr = params[0].name
        const rawPoint = filteredChartData.value.find((p) => p.date === dateStr)
        let html = `<div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid ${dividerColor}; padding-bottom: 4px;">📅 ${dateStr}</div>`
        params.forEach((param: any) => {
          const cfg = chartMetrics.value.find((m) => m.label === param.seriesName)
          const unit = cfg?.unit || ''
          const val =
            unit === '¥'
              ? formatCurrency(param.value)
              : `${formatNumber(param.value)} <span style="font-size:11px; opacity:0.8;">${unit}</span>`
          html += `<div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin: 3px 0; font-size: 11.5px;">
            <span style="display:flex; align-items:center; gap:6px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${param.color};"></span>
              <span style="color:${textColor};">${param.seriesName}</span>
            </span>
            <span style="font-weight:600; font-family:monospace;">${val}</span>
          </div>`
        })
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
      axisLabel: { color: textColor, fontSize: 11 },
    },
    yAxis,
    dataZoom: [
      {
        type: 'slider',
        show: true,
        bottom: 4,
        height: 18,
        borderColor: borderColor,
        backgroundColor: isDarkMode.value ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        fillerColor: isDarkMode.value ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.25)',
        handleStyle: {
          color: '#f59e0b',
          borderColor: isDarkMode.value ? '#18181b' : '#ffffff',
        },
        textStyle: { color: textColor, fontSize: 10 },
      },
      {
        type: 'inside',
      },
    ],
    series,
  }

  mainChart.setOption(option, true)
}

async function loadData() {
  try {
    await analyzeStore.loadData()
  } catch (err: any) {
    toast.error(err?.message || '获取分析数据失败')
  } finally {
    await nextTick()
    initChart()
  }
}

async function refreshData() {
  try {
    await analyzeStore.loadData()
    toast.success('数据已刷新')
  } catch (err: any) {
    toast.error(err?.message || '刷新数据失败')
  } finally {
    await nextTick()
    updateChartOption()
  }
}

watch([filteredChartData, selectedMetrics, isDarkMode, chartViewType], () => {
  updateChartOption()
})

onMounted(async () => {
  if (hasData.value) {
    await nextTick()
    initChart()
  }
  await loadData()
})

onUnmounted(() => {
  if (chartResizeObserver) chartResizeObserver.disconnect()
  if (mainChart) mainChart.dispose()
})
</script>

<template>
  <div class="space-y-4 w-full">
    <!-- 顶部标题与控制栏 -->
    <ManagePageHeader
      title="直播数据罗盘"
      subtitle="沉淀过去 60 天多维全景直播战报，透视收益构成、粉丝互动深度与开播偏好"
    >
      <template #action>
        <div class="flex items-center gap-2 flex-wrap">
          <!-- 预设选择器 -->
          <ToggleGroup
            v-model="activePreset"
            type="single"
          >
            <ToggleGroupItem
              value="7d"
              @click="setPreset('7d')"
              >近7天</ToggleGroupItem
            >
            <ToggleGroupItem
              value="30d"
              @click="setPreset('30d')"
              >近30天</ToggleGroupItem
            >
            <ToggleGroupItem
              value="60d"
              @click="setPreset('60d')"
              >近60天</ToggleGroupItem
            >
            <ToggleGroupItem
              value="all"
              @click="setPreset('all')"
              >全部</ToggleGroupItem
            >
          </ToggleGroup>

          <!-- 自定义日期区间 -->
          <DateRangePicker
            v-model:start="customStartDate"
            v-model:end="customEndDate"
            size="sm"
            @update:start="handleCustomDateApply"
            @update:end="handleCustomDateApply"
          />

          <!-- 刷新按钮 -->
          <Button
            variant="outline"
            :loading="refreshing"
            @click="refreshData"
          >
            <component
              :is="ArrowClockwise24Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            刷新
          </Button>
        </div>
      </template>
    </ManagePageHeader>

    <!-- 异常状态提示 -->
    <EventFetcherStatusCard />

    <!-- 骨架屏 -->
    <div
      v-if="loading"
      class="space-y-4"
    >
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <div class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
        <span>正在盘点过去 60 天直播战报与全盘指标…</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Skeleton
          v-for="i in 4"
          :key="i"
          class="h-40 rounded-xl"
        />
      </div>

      <Skeleton class="h-96 rounded-xl" />
    </div>

    <!-- 空数据态 -->
    <Card
      v-else-if="!hasData"
      class="p-12 text-center"
    >
      <div class="text-muted-foreground text-sm">暂无直播分析数据</div>
      <div class="text-xs text-muted-foreground/70 mt-1">
        系统会自动采集并维护你的直播数据，开播后将在此生成全景图表与复盘洞察。
      </div>
    </Card>

    <!-- 主体内容 -->
    <div
      v-else
      class="space-y-4"
    >
      <!-- 峰值高光胶囊条 (Milestones Ribbon) -->
      <div
        v-if="currentMilestones.maxIncomeDay || currentMilestones.maxDanmakuDay"
        class="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card overflow-x-auto text-xs"
      >
        <div class="flex items-center gap-1.5 font-semibold shrink-0 text-foreground">
          <component
            :is="Trophy24Regular"
            class="h-4 w-4 text-amber-500"
          />
          <span>{{ currentSummary.titlePrefix }}高光:</span>
        </div>

        <div
          v-if="currentMilestones.maxIncomeDay"
          class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border shrink-0"
        >
          <span class="text-muted-foreground">单日最高收益</span>
          <span class="font-bold text-amber-500 font-mono"
            >¥{{ formatNumber(currentMilestones.maxIncomeDay.value) }}</span
          >
          <span class="text-[10px] text-muted-foreground">{{ currentMilestones.maxIncomeDay.dateStr }}</span>
        </div>

        <div
          v-if="currentMilestones.maxDanmakuDay"
          class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border shrink-0"
        >
          <span class="text-muted-foreground">单日弹幕狂欢</span>
          <span class="font-bold text-emerald-500 font-mono"
            >{{ formatNumber(currentMilestones.maxDanmakuDay.value) }} 条</span
          >
          <span class="text-[10px] text-muted-foreground">{{ currentMilestones.maxDanmakuDay.dateStr }}</span>
        </div>

        <div
          v-if="currentMilestones.maxDurationDay"
          class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border shrink-0"
        >
          <span class="text-muted-foreground">最长开播</span>
          <span class="font-bold text-purple-500 font-mono"
            >{{ (currentMilestones.maxDurationDay.value / 60).toFixed(1) }} 小时</span
          >
          <span class="text-[10px] text-muted-foreground">{{ currentMilestones.maxDurationDay.dateStr }}</span>
        </div>

        <div
          v-if="currentMilestones.maxInteractionDay"
          class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border shrink-0"
        >
          <span class="text-muted-foreground">互动峰值</span>
          <span class="font-bold text-cyan-500 font-mono"
            >{{ formatNumber(currentMilestones.maxInteractionDay.value) }} 人</span
          >
          <span class="text-[10px] text-muted-foreground">{{ currentMilestones.maxInteractionDay.dateStr }}</span>
        </div>
      </div>

      <!-- Section 1: 4 宫格 Bento 核心指标大卡 -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <!-- Card 1: 收益总览 -->
        <Card class="flex flex-col justify-between">
          <CardHeader class="p-3.5 pb-2 flex-row items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded bg-amber-500/15 text-amber-500 flex items-center justify-center">
                <component
                  :is="Wallet24Regular"
                  class="h-3.5 w-3.5"
                />
              </div>
              <span class="text-xs font-semibold">{{ currentSummary.titlePrefix }}总收益</span>
            </div>
            <Badge
              v-if="currentSummary.incomeTrend !== undefined"
              :variant="currentSummary.incomeTrend >= 0 ? 'brand' : 'destructive'"
              class="text-[10px] px-1 py-0 h-4"
            >
              <component
                :is="currentSummary.incomeTrend >= 0 ? ArrowTrending24Regular : ArrowDown24Regular"
                class="h-3 w-3 mr-0.5"
              />
              {{ Math.abs(currentSummary.incomeTrend) }}%
            </Badge>
          </CardHeader>

          <CardContent class="p-3.5 pt-0 space-y-2">
            <div class="text-2xl font-extrabold font-mono text-foreground flex items-baseline gap-1">
              <span class="text-amber-500 text-lg">¥</span>
              {{ formatNumber(currentSummary.grandTotalIncome) }}
            </div>

            <!-- 收入构成细分 -->
            <div class="space-y-1 text-[11px] text-muted-foreground">
              <div class="flex justify-between">
                <span>礼物 ¥{{ formatNumber(currentSummary.giftIncome) }}</span>
                <span>SC ¥{{ formatNumber(currentSummary.scIncome) }}</span>
              </div>
              <div class="h-1.5 rounded-full bg-muted flex overflow-hidden gap-0.5">
                <div
                  class="bg-amber-500 h-full"
                  :style="{
                    width: `${currentSummary.grandTotalIncome > 0 ? (currentSummary.giftIncome / currentSummary.grandTotalIncome) * 100 : 0}%`,
                  }"
                />
                <div
                  class="bg-orange-500 h-full"
                  :style="{
                    width: `${currentSummary.grandTotalIncome > 0 ? (currentSummary.scIncome / currentSummary.grandTotalIncome) * 100 : 0}%`,
                  }"
                />
                <div
                  v-if="currentSummary.guardIncome > 0"
                  class="bg-blue-500 h-full"
                  :style="{
                    width: `${currentSummary.grandTotalIncome > 0 ? (currentSummary.guardIncome / currentSummary.grandTotalIncome) * 100 : 0}%`,
                  }"
                />
              </div>
            </div>

            <div class="pt-2 border-t border-border flex justify-between text-[11px] text-muted-foreground">
              <span
                >时薪:
                <strong class="text-foreground font-mono">¥{{ currentSummary.hourlyIncome.toFixed(1) }}</strong></span
              >
              <span
                >场均:
                <strong class="text-foreground font-mono">¥{{ currentSummary.dailyAvgIncome.toFixed(1) }}</strong></span
              >
            </div>
          </CardContent>
        </Card>

        <!-- Card 2: 弹幕与互动 -->
        <Card class="flex flex-col justify-between">
          <CardHeader class="p-3.5 pb-2 flex-row items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                <component
                  :is="ChatMultiple24Regular"
                  class="h-3.5 w-3.5"
                />
              </div>
              <span class="text-xs font-semibold">{{ currentSummary.titlePrefix }}弹幕数</span>
            </div>
            <Badge
              v-if="currentSummary.danmakuTrend !== undefined"
              :variant="currentSummary.danmakuTrend >= 0 ? 'brand' : 'destructive'"
              class="text-[10px] px-1 py-0 h-4"
            >
              {{ Math.abs(currentSummary.danmakuTrend) }}%
            </Badge>
          </CardHeader>

          <CardContent class="p-3.5 pt-0 space-y-2">
            <div class="text-2xl font-extrabold font-mono text-foreground flex items-baseline gap-1">
              {{ formatNumber(currentSummary.totalDanmakuCount) }}
              <span class="text-xs font-normal text-muted-foreground">条</span>
            </div>

            <div class="text-xs text-muted-foreground flex items-center justify-between">
              <span>观众互动粘性</span>
              <span class="font-semibold text-foreground">{{ currentSummary.avgDanmakuPerUser.toFixed(1) }} 条/人</span>
            </div>

            <div class="pt-2 border-t border-border flex justify-between text-[11px] text-muted-foreground">
              <span
                >互动:
                <strong class="text-foreground font-mono">{{
                  formatNumber(currentSummary.totalInteractions)
                }}</strong></span
              >
              <span
                >点赞:
                <strong class="text-foreground font-mono">{{
                  formatNumber(currentSummary.totalLikeCount)
                }}</strong></span
              >
            </div>
          </CardContent>
        </Card>

        <!-- Card 3: 粉丝与转化 -->
        <Card class="flex flex-col justify-between">
          <CardHeader class="p-3.5 pb-2 flex-row items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded bg-cyan-500/15 text-cyan-500 flex items-center justify-center">
                <component
                  :is="People24Regular"
                  class="h-3.5 w-3.5"
                />
              </div>
              <span class="text-xs font-semibold">{{ currentSummary.titlePrefix }}互动人数</span>
            </div>
            <Badge
              variant="secondary"
              class="text-[10px] px-1 py-0 h-4"
            >
              转化率 {{ currentSummary.payingRate.toFixed(1) }}%
            </Badge>
          </CardHeader>

          <CardContent class="p-3.5 pt-0 space-y-2">
            <div class="text-2xl font-extrabold font-mono text-foreground flex items-baseline gap-1">
              {{ formatNumber(currentSummary.interactionUsers) }}
              <span class="text-xs font-normal text-muted-foreground">人</span>
            </div>

            <div class="text-xs text-muted-foreground flex items-center justify-between">
              <span
                >付费观众:
                <strong class="text-foreground">{{ formatNumber(currentSummary.payingUsers) }}人</strong></span
              >
              <span>客单价: ¥{{ currentSummary.avgIncomePerPayingUser.toFixed(1) }}</span>
            </div>

            <div class="pt-2 border-t border-border flex justify-between text-[11px] text-muted-foreground">
              <span
                >渗透率:
                <strong class="text-foreground font-mono">{{ currentSummary.payingRate.toFixed(1) }}%</strong></span
              >
              <span
                >日均:
                <strong class="text-foreground font-mono"
                  >{{ currentSummary.dailyAvgInteractions.toFixed(0) }}人</strong
                ></span
              >
            </div>
          </CardContent>
        </Card>

        <!-- Card 4: 开播时长 -->
        <Card class="flex flex-col justify-between">
          <CardHeader class="p-3.5 pb-2 flex-row items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded bg-purple-500/15 text-purple-500 flex items-center justify-center">
                <component
                  :is="Timer24Regular"
                  class="h-3.5 w-3.5"
                />
              </div>
              <span class="text-xs font-semibold">{{ currentSummary.titlePrefix }}直播时长</span>
            </div>
            <Badge
              variant="secondary"
              class="text-[10px] px-1 py-0 h-4"
            >
              开播 {{ currentSummary.activeLiveDays }} 天
            </Badge>
          </CardHeader>

          <CardContent class="p-3.5 pt-0 space-y-2">
            <div class="text-2xl font-extrabold font-mono text-foreground flex items-baseline gap-1">
              {{ (currentSummary.totalLiveMinutes / 60).toFixed(1) }}
              <span class="text-xs font-normal text-muted-foreground">小时</span>
            </div>

            <div class="text-xs text-muted-foreground flex items-center justify-between">
              <span>周期开播率</span>
              <span class="font-semibold text-foreground">
                {{
                  filteredChartData.length > 0
                    ? ((currentSummary.activeLiveDays / filteredChartData.length) * 100).toFixed(0)
                    : 0
                }}%
              </span>
            </div>

            <div class="pt-2 border-t border-border flex justify-between text-[11px] text-muted-foreground">
              <span
                >场均:
                <strong class="text-foreground font-mono"
                  >{{ (currentSummary.avgLiveMinutesPerSession / 60).toFixed(1) }}h</strong
                ></span
              >
              <span
                >总场次: <strong class="text-foreground font-mono">{{ currentSummary.totalSessions }}场</strong></span
              >
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Section 2: 全维交互主趋势看板 -->
      <Card class="p-4 space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2 text-xs font-semibold">
            <component
              :is="DataTrending24Regular"
              class="h-4 w-4 text-brand"
            />
            <span>{{ currentSummary.titlePrefix }}直播多维演进趋势</span>
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

        <!-- 显隐指标勾选条 -->
        <div class="flex items-center gap-3 p-2 rounded-md bg-muted/40 border border-border flex-wrap text-xs">
          <div
            v-for="metric in chartMetrics"
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

        <!-- ECharts 容器 -->
        <div
          ref="chartRef"
          class="w-full h-80"
        />
      </Card>

      <!-- Section 3: 双列深度洞察 Bento -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <!-- 收入结构卡片 -->
        <Card class="p-4 space-y-3">
          <div class="flex items-center gap-2 text-xs font-semibold">
            <component
              :is="MoneyHand24Regular"
              class="h-4 w-4 text-amber-500"
            />
            <span>{{ currentSummary.titlePrefix }}收入结构与变现盘面</span>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between p-2 rounded bg-muted/40 border border-border text-xs">
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>普通打赏礼物</span>
              </div>
              <div class="font-mono font-semibold">
                ¥{{ formatNumber(currentSummary.giftIncome) }}
                <span class="text-muted-foreground font-normal ml-1">
                  ({{
                    currentSummary.grandTotalIncome > 0
                      ? ((currentSummary.giftIncome / currentSummary.grandTotalIncome) * 100).toFixed(1)
                      : 0
                  }}%)
                </span>
              </div>
            </div>

            <div class="flex items-center justify-between p-2 rounded bg-muted/40 border border-border text-xs">
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span>醒目留言 (SC)</span>
              </div>
              <div class="font-mono font-semibold">
                ¥{{ formatNumber(currentSummary.scIncome) }}
                <span class="text-muted-foreground font-normal ml-1">
                  ({{
                    currentSummary.grandTotalIncome > 0
                      ? ((currentSummary.scIncome / currentSummary.grandTotalIncome) * 100).toFixed(1)
                      : 0
                  }}%)
                </span>
              </div>
            </div>

            <div
              v-if="currentSummary.guardIncome > 0"
              class="flex items-center justify-between p-2 rounded bg-muted/40 border border-border text-xs"
            >
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>直播大航海</span>
              </div>
              <div class="font-mono font-semibold">
                ¥{{ formatNumber(currentSummary.guardIncome) }}
                <span class="text-muted-foreground font-normal ml-1">
                  ({{
                    currentSummary.grandTotalIncome > 0
                      ? ((currentSummary.guardIncome / currentSummary.grandTotalIncome) * 100).toFixed(1)
                      : 0
                  }}%)
                </span>
              </div>
            </div>

            <div
              v-if="currentSummary.offlineIncome > 0"
              class="flex items-center justify-between p-2 rounded bg-muted/40 border border-border text-xs"
            >
              <div class="flex items-center gap-2">
                <div class="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>下播/未开播支持</span>
              </div>
              <div class="font-mono font-semibold text-emerald-500">
                ¥{{ formatNumber(currentSummary.offlineIncome) }}
                <span class="text-muted-foreground font-normal ml-1">
                  ({{
                    currentSummary.grandTotalIncome > 0
                      ? ((currentSummary.offlineIncome / currentSummary.grandTotalIncome) * 100).toFixed(1)
                      : 0
                  }}%)
                </span>
              </div>
            </div>
          </div>

          <!-- 付费转化漏斗 -->
          <div class="pt-2 border-t border-border space-y-1.5">
            <span class="text-xs font-semibold text-muted-foreground">观众变现转化</span>
            <div class="space-y-1 text-xs">
              <div class="flex justify-between text-muted-foreground text-[11px]">
                <span>互动观众: {{ formatNumber(currentSummary.interactionUsers) }} 人</span>
                <span>100%</span>
              </div>
              <div class="h-2 rounded bg-blue-500/20 overflow-hidden">
                <div class="h-full bg-blue-500 w-full" />
              </div>

              <div class="flex justify-between text-muted-foreground text-[11px] pt-1">
                <span>付费观众: {{ formatNumber(currentSummary.payingUsers) }} 人</span>
                <span class="text-purple-500 font-semibold">{{ currentSummary.payingRate.toFixed(1) }}% 转化</span>
              </div>
              <div class="h-2 rounded bg-purple-500/20 overflow-hidden">
                <div
                  class="h-full bg-purple-500"
                  :style="{ width: `${Math.max(5, currentSummary.payingRate)}%` }"
                />
              </div>
            </div>
          </div>
        </Card>

        <!-- 周开播黄金日与出勤热力 -->
        <Card class="p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs font-semibold">
              <component
                :is="CalendarLtr24Regular"
                class="h-4 w-4 text-brand"
              />
              <span>周开播习惯与黄金日</span>
            </div>
            <Badge
              v-if="bestDayInsight"
              variant="brand"
              class="text-[10px] px-1 py-0 h-4"
            >
              黄金日: {{ bestDayInsight.income.dayName }}
            </Badge>
          </div>

          <!-- 周一至周日柱状分布 -->
          <div class="grid grid-cols-7 gap-1.5 pt-2 text-center text-xs">
            <div
              v-for="item in currentDayOfWeekStats"
              :key="item.dayOfWeek"
              class="p-1.5 rounded border border-border/50 bg-muted/20 flex flex-col items-center justify-between h-28"
              :class="{ 'border-brand/40 bg-brand/5': bestDayInsight?.income.dayOfWeek === item.dayOfWeek }"
            >
              <span class="font-semibold text-[11px]">{{ item.dayName }}</span>

              <div class="flex items-end gap-1 h-14 w-full justify-center">
                <div
                  class="w-2 rounded-t bg-amber-500"
                  :style="{
                    height: `${bestDayInsight && bestDayInsight.income.avgIncome > 0 ? (item.avgIncome / bestDayInsight.income.avgIncome) * 100 : 0}%`,
                  }"
                  :title="`场均收益 ¥${item.avgIncome.toFixed(0)}`"
                />
                <div
                  class="w-2 rounded-t bg-emerald-500"
                  :style="{
                    height: `${bestDayInsight && bestDayInsight.danmaku.avgDanmaku > 0 ? (item.avgDanmaku / bestDayInsight.danmaku.avgDanmaku) * 100 : 0}%`,
                  }"
                  :title="`场均弹幕 ${item.avgDanmaku.toFixed(0)}`"
                />
              </div>

              <span class="text-[10px] text-muted-foreground font-mono">¥{{ Math.round(item.avgIncome) }}</span>
            </div>
          </div>

          <div
            v-if="bestDayInsight"
            class="p-2 rounded bg-brand/5 border border-brand/20 text-xs text-foreground flex items-center gap-2"
          >
            <component
              :is="Sparkle24Regular"
              class="h-4 w-4 text-brand shrink-0"
            />
            <span>
              <strong>{{ bestDayInsight.income.dayName }}</strong> 场均收益最高 (¥{{
                bestDayInsight.income.avgIncome.toFixed(1)
              }})，建议将关键活动安排在该日。
            </span>
          </div>
        </Card>
      </div>

      <!-- Section 4: 分区效能与单场高光 -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <!-- 分区效能 -->
        <Card class="p-4 space-y-3">
          <div class="flex items-center gap-2 text-xs font-semibold">
            <component
              :is="Grid24Regular"
              class="h-4 w-4 text-brand"
            />
            <span>{{ currentSummary.titlePrefix }}直播分区效能</span>
          </div>

          <div
            v-if="currentAreaStats.length === 0"
            class="text-xs text-muted-foreground text-center py-8"
          >
            当前区间无分区直播记录
          </div>
          <div
            v-else
            class="space-y-2 max-h-80 overflow-y-auto pr-1"
          >
            <div
              v-for="area in currentAreaStats"
              :key="`${area.parentArea}-${area.area}`"
              class="p-2.5 rounded-lg border border-border bg-card/60 flex items-center justify-between text-xs"
            >
              <div>
                <div class="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    class="text-[10px] px-1 py-0 h-4"
                  >
                    {{ area.parentArea }}
                  </Badge>
                  <span class="font-semibold">{{ area.area }}</span>
                </div>
                <div class="text-[11px] text-muted-foreground mt-1">
                  {{ area.sessionCount }} 场直播 · {{ (area.totalLiveMinutes / 60).toFixed(1) }} 小时 · 场均
                  {{ formatNumber(area.avgDanmaku) }} 弹幕
                </div>
              </div>
              <div class="text-right font-mono">
                <span class="font-bold text-amber-500">¥{{ formatNumber(area.totalIncome) }}</span>
                <span class="text-[10px] text-muted-foreground block">场均 ¥{{ area.avgIncome.toFixed(0) }}</span>
              </div>
            </div>
          </div>
        </Card>

        <!-- 单场高光排行 Top 5 -->
        <Card class="p-4 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs font-semibold">
              <component
                :is="Star24Regular"
                class="h-4 w-4 text-amber-500"
              />
              <span>单场直播高光 TOP 5</span>
            </div>

            <ToggleGroup
              v-model="activeTopSessionTab"
              type="single"
              size="xs"
            >
              <ToggleGroupItem value="income">最高收益</ToggleGroupItem>
              <ToggleGroupItem value="danmaku">最密弹幕</ToggleGroupItem>
              <ToggleGroupItem value="duration">最长开播</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div
            v-if="currentFilteredSessions.length === 0"
            class="text-xs text-muted-foreground text-center py-8"
          >
            暂无单场直播记录
          </div>
          <div
            v-else
            class="space-y-2 max-h-80 overflow-y-auto pr-1"
          >
            <div
              v-for="(session, idx) in activeTopSessionTab === 'income'
                ? topSessionsByIncome
                : activeTopSessionTab === 'danmaku'
                  ? topSessionsByDanmaku
                  : topSessionsByDuration"
              :key="session.id"
              class="p-2.5 rounded-lg border border-border bg-card/60 flex items-center gap-2.5 text-xs"
            >
              <div
                class="w-5 h-5 rounded flex items-center justify-center font-bold text-[11px] shrink-0"
                :class="{
                  'bg-amber-500 text-black': idx === 0,
                  'bg-slate-400 text-black': idx === 1,
                  'bg-amber-700 text-white': idx === 2,
                  'bg-muted text-muted-foreground': idx > 2,
                }"
              >
                {{ idx + 1 }}
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <span
                    class="font-semibold truncate"
                    :title="session.title"
                    >{{ session.title }}</span
                  >
                  <Badge
                    variant="outline"
                    class="text-[9px] px-1 py-0 h-3.5 shrink-0"
                  >
                    {{ session.area }}
                  </Badge>
                </div>
                <div class="text-[11px] text-muted-foreground mt-0.5">
                  {{ formatDate(session.startTime) }} · {{ (session.liveMinutes / 60).toFixed(1) }} 小时
                </div>
              </div>

              <div class="text-right font-mono shrink-0">
                <template v-if="activeTopSessionTab === 'income'">
                  <span class="font-bold text-amber-500">¥{{ formatNumber(session.totalIncome) }}</span>
                  <span class="text-[10px] text-muted-foreground block"
                    >{{ formatNumber(session.danmakuCount) }} 条弹幕</span
                  >
                </template>
                <template v-else-if="activeTopSessionTab === 'danmaku'">
                  <span class="font-bold text-emerald-500">{{ formatNumber(session.danmakuCount) }} 条</span>
                  <span class="text-[10px] text-muted-foreground block">¥{{ formatNumber(session.totalIncome) }}</span>
                </template>
                <template v-else>
                  <span class="font-bold text-purple-500">{{ (session.liveMinutes / 60).toFixed(1) }} 小时</span>
                  <span class="text-[10px] text-muted-foreground block">¥{{ formatNumber(session.totalIncome) }}</span>
                </template>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <!-- Section 5: 每日直播明细复盘表 (可折叠) -->
      <Card class="p-4 space-y-3">
        <div
          class="flex items-center justify-between cursor-pointer select-none"
          @click="isDailyTableExpanded = !isDailyTableExpanded"
        >
          <div class="flex items-center gap-2 text-xs font-semibold">
            <component
              :is="Table24Regular"
              class="h-4 w-4 text-brand"
            />
            <span>{{ currentSummary.titlePrefix }}每日明细复盘表 (共 {{ dailyTableData.length }} 条记录)</span>
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
              <component :is="isDailyTableExpanded ? ChevronUp24Regular : ChevronDown24Regular" />
            </Button>
          </div>
        </div>

        <div
          v-if="isDailyTableExpanded"
          class="pt-2 border-t border-border overflow-x-auto"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  class="cursor-pointer"
                  @click="toggleDailySort('date')"
                >
                  日期 {{ dailyTableSortKey === 'date' ? (dailyTableSortAsc ? '↑' : '↓') : '' }}
                </TableHead>
                <TableHead
                  class="text-right cursor-pointer"
                  @click="toggleDailySort('income')"
                >
                  收益 (¥) {{ dailyTableSortKey === 'income' ? (dailyTableSortAsc ? '↑' : '↓') : '' }}
                </TableHead>
                <TableHead
                  class="text-right cursor-pointer"
                  @click="toggleDailySort('danmaku')"
                >
                  弹幕数 {{ dailyTableSortKey === 'danmaku' ? (dailyTableSortAsc ? '↑' : '↓') : '' }}
                </TableHead>
                <TableHead
                  class="text-right cursor-pointer"
                  @click="toggleDailySort('interactions')"
                >
                  互动人次 {{ dailyTableSortKey === 'interactions' ? (dailyTableSortAsc ? '↑' : '↓') : '' }}
                </TableHead>
                <TableHead class="text-right"> 付费人数 </TableHead>
                <TableHead
                  class="text-right cursor-pointer"
                  @click="toggleDailySort('duration')"
                >
                  开播时长 {{ dailyTableSortKey === 'duration' ? (dailyTableSortAsc ? '↑' : '↓') : '' }}
                </TableHead>
                <TableHead class="text-right"> 点赞数 </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="row in dailyTableData"
                :key="row.timestamp"
              >
                <TableCell class="font-mono text-xs">
                  {{ row.date }}
                </TableCell>
                <TableCell class="text-right font-mono font-semibold text-amber-500 text-xs">
                  {{ row.income > 0 ? `¥${formatCurrency(row.income)}` : '-' }}
                </TableCell>
                <TableCell class="text-right font-mono text-xs">
                  {{ row.danmakuCount > 0 ? formatNumber(row.danmakuCount) : '-' }}
                </TableCell>
                <TableCell class="text-right font-mono text-xs">
                  {{ row.interactionCount > 0 ? formatNumber(row.interactionCount) : '-' }}
                </TableCell>
                <TableCell class="text-right text-xs">
                  {{ row.payingUsers > 0 ? `${row.payingUsers} 人` : '-' }}
                </TableCell>
                <TableCell class="text-right text-xs">
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
                <TableCell class="text-right font-mono text-xs">
                  {{ row.likeCount > 0 ? formatNumber(row.likeCount) : '-' }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  </div>
</template>
