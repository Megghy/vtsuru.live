<script lang="ts" setup>
import {
  ArrowClockwise24Regular,
  ArrowDown24Regular,
  ArrowTrending24Regular,
  ArrowUpRight24Regular,
  CalendarClock24Regular,
  CalendarLtr24Regular,
  ChatMultiple24Regular,
  Clock24Regular,
  DataTrending24Regular,
  Grid24Regular,
  Heart24Regular,
  MoneyHand24Regular,
  People24Regular,
  Sparkle24Regular,
  Star24Regular,
  Table24Regular,
  Tag24Regular,
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
import {
  NButton,
  NButtonGroup,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NCollapse,
  NCollapseItem,
  NDatePicker,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NFlex,
  NGrid,
  NGridItem,
  NIcon,
  NNumberAnimation,
  NProgress,
  NSkeleton,
  NSwitch,
  NTable,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
  useThemeVars,
} from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { QueryGetAPI } from '@/api/query'
import EventFetcherAlert from '@/apps/manage/components/event-fetcher/EventFetcherAlert.vue'
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
  type AnalyzeRangeSummary,
  type AnalyzeSessionItem,
  type AnalyzeTopUser,
} from '@/apps/manage/composables/analyzeRange'
import { formatCurrency, formatDate, formatNumber } from '@/apps/manage/composables/formatters'
import { ANALYZE_API_URL } from '@/shared/config'

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

interface BackendChartItem {
  income: number
  giftIncome?: number
  scIncome?: number
  guardIncome?: number
  totalIncomeWithGuard?: number
  interactionCount: number
  danmakuCount: number
  payingUsers: number
  interactionUsers: number
  liveMinutes: number
  likeCount: number
  sessionCount?: number
}

interface BackendPeriodSummary {
  totalIncome: number
  giftIncome?: number
  scIncome?: number
  guardIncome?: number
  totalIncomeWithGuard?: number
  totalInteractions: number
  totalDanmakuCount: number
  totalLiveMinutes: number
  dailyAvgIncome: number
  dailyAvgDanmaku: number
  incomeTrend?: number
  interactionTrend?: number
  danmakuTrend?: number
  activeLiveDays: number
  interactionUsers: number
  payingUsers: number
  interactionUsersTrend?: number
  payingUsersTrend?: number
}

interface BackendAnalyzeData {
  summary: {
    last7Days: BackendPeriodSummary
    last30Days: BackendPeriodSummary
  }
  chartData: Record<string, BackendChartItem>
  sessions?: AnalyzeSessionItem[]
  areaStats?: AnalyzeAreaStat[]
  topSpenders?: AnalyzeTopUser[]
  topChatters?: AnalyzeTopUser[]
}

// 状态管理
const loading = ref(true)
const refreshing = ref(false)
const message = useMessage()
const analyzeData = ref<BackendAnalyzeData>()
const themeVars = useThemeVars()
const lastUpdateTime = ref<number>(0)
const hasData = computed(() => {
  if (!analyzeData.value) return false
  const chartKeys = Object.keys(analyzeData.value.chartData || {})
  const hasSessions = (analyzeData.value.sessions?.length || 0) > 0
  const hasSummary =
    (analyzeData.value.summary?.last30Days?.totalLiveMinutes || 0) > 0 ||
    (analyzeData.value.summary?.last30Days?.totalDanmakuCount || 0) > 0 ||
    (analyzeData.value.summary?.last30Days?.totalIncome || 0) > 0
  return chartKeys.length > 0 || hasSessions || hasSummary
})

// 区间预设与选择
type RangePreset = '7d' | '30d' | '60d' | 'all' | 'custom'
const activePreset = ref<RangePreset>('30d')
const dateRange = ref<[number, number] | null>([
  startOfDay(addDays(new Date(), -29)).getTime(),
  endOfDay(new Date()).getTime(),
])

const isDark = computed(() => themeVars.value.baseColor !== '#FFF' && themeVars.value.baseColor !== '#ffffff')

function setPreset(preset: RangePreset) {
  activePreset.value = preset
  const now = new Date()
  if (preset === '7d') {
    dateRange.value = [startOfDay(addDays(now, -6)).getTime(), endOfDay(now).getTime()]
  } else if (preset === '30d') {
    dateRange.value = [startOfDay(addDays(now, -29)).getTime(), endOfDay(now).getTime()]
  } else if (preset === '60d') {
    dateRange.value = [startOfDay(addDays(now, -59)).getTime(), endOfDay(now).getTime()]
  } else if (preset === 'all') {
    dateRange.value = null
  }
}

function handleDateRangeChange(val: [number, number] | null) {
  if (val) {
    activePreset.value = 'custom'
  } else {
    activePreset.value = 'all'
  }
}

// 格式化全部图表点数组（按日期升序）
function getChartDataArray(): Array<AnalyzeDayPoint & { date: string }> {
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
}

// 过滤后的时间序列数据
const filteredChartData = computed(() => {
  const all = getChartDataArray()
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
  }
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

// 单场高光 Top 5 场次
const topSessionsByIncome = computed(() => {
  return currentFilteredSessions.value.toSorted((a, b) => b.totalIncome - a.totalIncome).slice(0, 5)
})
const topSessionsByDanmaku = computed(() => {
  return currentFilteredSessions.value.toSorted((a, b) => b.danmakuCount - a.danmakuCount).slice(0, 5)
})
const topSessionsByDuration = computed(() => {
  return currentFilteredSessions.value.toSorted((a, b) => b.liveMinutes - a.liveMinutes).slice(0, 5)
})

const activeTopSessionTab = ref<'income' | 'danmaku' | 'duration'>('income')

// 每日明细复盘表配置
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
  { label: '总收益', value: 'income', color: '#f59e0b', unit: '¥', yAxisIndex: 1 },
  { label: '普通礼物', value: 'giftIncome', color: '#fbbf24', unit: '¥', yAxisIndex: 1 },
  { label: '醒目留言', value: 'scIncome', color: '#f97316', unit: '¥', yAxisIndex: 1 },
  { label: '大航海', value: 'guardIncome', color: '#d97706', unit: '¥', yAxisIndex: 1 },
  { label: '弹幕数', value: 'danmakuCount', color: '#10b981', unit: '条', yAxisIndex: 0 },
  { label: '互动人次', value: 'interactionCount', color: '#3b82f6', unit: '次', yAxisIndex: 0 },
  { label: '点赞数', value: 'likeCount', color: '#f43f5e', unit: '次', yAxisIndex: 0 },
  { label: '互动人数', value: 'interactionUsers', color: '#06b6d4', unit: '人', yAxisIndex: 0 },
  { label: '付费人数', value: 'payingUsers', color: '#8b5cf6', unit: '人', yAxisIndex: 0 },
  { label: '时长(小时)', value: 'liveHours', color: '#a855f7', unit: 'h', yAxisIndex: 0 },
])

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

  const isIncomeMetric = (m: string) => ['income', 'giftIncome', 'scIncome', 'guardIncome'].includes(m)
  const showRightAxis = selectedMetrics.value.some(isIncomeMetric)
  const showLeftAxis = selectedMetrics.value.some((m) => !isIncomeMetric(m))

  const textColor = isDark.value ? '#a1a1aa' : '#52525b'
  const textHeadingColor = isDark.value ? '#fafafa' : '#18181b'
  const borderColor = isDark.value ? 'rgba(255, 255, 255, 0.1)' : '#e4e4e7'
  const dividerColor = isDark.value ? 'rgba(255, 255, 255, 0.05)' : '#f4f4f5'
  const tooltipBg = isDark.value ? 'rgba(18, 20, 28, 0.96)' : 'rgba(255, 255, 255, 0.96)'

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

  const yAxis: echarts.YAXisComponentOption[] = []

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
            unit === '¥' ? formatCurrency(param.value) : `${formatNumber(param.value)} <span style="font-size:11px; opacity:0.8;">${unit}</span>`
          html += `<div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin: 3px 0; font-size: 11.5px;">
            <span style="display:flex; align-items:center; gap:6px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${param.color};"></span>
              <span style="color:${textColor};">${param.seriesName}</span>
            </span>
            <span style="font-weight:600; font-family:var(--n-font-family-mono, monospace);">${val}</span>
          </div>`
        })
        if (rawPoint && rawPoint.liveMinutes > 0) {
          html += `<div style="margin-top:6px; pt-1; border-top:1px dashed ${dividerColor}; font-size:11px; color:${textColor}; text-align:right;">开播约 ${(rawPoint.liveMinutes / 60).toFixed(1)} 小时</div>`
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
        backgroundColor: isDark.value ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        fillerColor: isDark.value ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.25)',
        handleStyle: {
          color: '#f59e0b',
          borderColor: isDark.value ? '#18181b' : '#ffffff',
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

// 加载数据
async function loadData() {
  try {
    loading.value = true
    const response = await QueryGetAPI<BackendAnalyzeData>(`${ANALYZE_API_URL}all`)
    if (response.code === 200 && response.data) {
      analyzeData.value = response.data
      lastUpdateTime.value = Date.now()
    } else {
      throw new Error(response.message || '获取分析数据失败')
    }
  } catch (err: any) {
    message.error(err?.message || '获取分析数据失败')
  } finally {
    loading.value = false
    await nextTick()
    initChart()
  }
}

async function refreshData() {
  try {
    refreshing.value = true
    const response = await QueryGetAPI<BackendAnalyzeData>(`${ANALYZE_API_URL}all`)
    if (response.code === 200 && response.data) {
      analyzeData.value = response.data
      lastUpdateTime.value = Date.now()
      message.success('数据已刷新')
    } else {
      throw new Error(response.message || '刷新数据失败')
    }
  } catch (err: any) {
    message.error(err?.message || '刷新数据失败')
  } finally {
    refreshing.value = false
    await nextTick()
    updateChartOption()
  }
}

watch([filteredChartData, selectedMetrics, isDark, chartViewType], () => {
  updateChartOption()
})

onMounted(() => {
  loadData()
})

onUnmounted(() => {
  if (chartResizeObserver) chartResizeObserver.disconnect()
  if (mainChart) mainChart.dispose()
})
</script>

<template>
  <div class="analyze-dashboard">
    <!-- 顶部标题与控制栏 -->
    <ManagePageHeader title="直播数据罗盘" description="沉淀过去 60 天多维全景直播战报，透视收益构成、粉丝互动深度与开播偏好。">
      <template #action>
        <NFlex align="center" :size="8" wrap>
          <!-- 预设选择器 -->
          <NButtonGroup size="small">
            <NButton
              :type="activePreset === '7d' ? 'primary' : 'default'"
              :secondary="activePreset !== '7d'"
              @click="setPreset('7d')"
            >
              近7天
            </NButton>
            <NButton
              :type="activePreset === '30d' ? 'primary' : 'default'"
              :secondary="activePreset !== '30d'"
              @click="setPreset('30d')"
            >
              近30天
            </NButton>
            <NButton
              :type="activePreset === '60d' ? 'primary' : 'default'"
              :secondary="activePreset !== '60d'"
              @click="setPreset('60d')"
            >
              近60天
            </NButton>
            <NButton
              :type="activePreset === 'all' ? 'primary' : 'default'"
              :secondary="activePreset !== 'all'"
              @click="setPreset('all')"
            >
              全部
            </NButton>
          </NButtonGroup>

          <!-- 自定义日历选择 -->
          <NDatePicker
            v-model:value="dateRange"
            type="daterange"
            size="small"
            clearable
            placeholder="自定义统计范围"
            class="range-datepicker"
            @update:value="handleDateRangeChange"
          />

          <!-- 刷新按钮 -->
          <NButton size="small" secondary :loading="refreshing" @click="refreshData">
            <template #icon>
              <NIcon><ArrowClockwise24Regular /></NIcon>
            </template>
            刷新
          </NButton>
        </NFlex>
      </template>
    </ManagePageHeader>

    <!-- 异常状态提示 -->
    <EventFetcherAlert />

    <!-- 加载骨架屏 -->
    <div v-if="loading" class="dashboard-skeleton">
      <NGrid :cols="4" :x-gap="12" :y-gap="12" responsive="screen">
        <NGridItem v-for="i in 4" :key="i">
          <NSkeleton height="116px" :sharp="false" />
        </NGridItem>
        <NGridItem :span="4">
          <NSkeleton height="380px" :sharp="false" />
        </NGridItem>
      </NGrid>
    </div>

    <!-- 空数据态 -->
    <div v-else-if="!hasData" class="dashboard-empty">
      <NCard class="empty-card" :bordered="false">
        <NEmpty description="暂无直播分析数据" size="large">
          <template #extra>
            <NText depth="3">系统会自动采集并维护你的直播数据，开播后将在此生成全景图表与复盘洞察。</NText>
          </template>
        </NEmpty>
      </NCard>
    </div>

    <!-- 主体内容 -->
    <div v-else class="dashboard-content">
      <!-- 峰值高光胶囊条 (Milestones Ribbon) -->
      <div v-if="currentMilestones.maxIncomeDay || currentMilestones.maxDanmakuDay" class="milestone-ribbon">
        <div class="ribbon-title">
          <NIcon><Trophy24Regular /></NIcon>
          <span>{{ currentSummary.titlePrefix }}高光</span>
        </div>
        <div class="ribbon-scroll">
          <div v-if="currentMilestones.maxIncomeDay" class="milestone-pill is-gold">
            <span class="pill-badge">单日最高收益</span>
            <span class="pill-value">¥{{ formatNumber(currentMilestones.maxIncomeDay.value) }}</span>
            <span class="pill-date">{{ currentMilestones.maxIncomeDay.dateStr }}</span>
          </div>
          <div v-if="currentMilestones.maxDanmakuDay" class="milestone-pill is-green">
            <span class="pill-badge">单日弹幕狂欢</span>
            <span class="pill-value">{{ formatNumber(currentMilestones.maxDanmakuDay.value) }} 条</span>
            <span class="pill-date">{{ currentMilestones.maxDanmakuDay.dateStr }}</span>
          </div>
          <div v-if="currentMilestones.maxDurationDay" class="milestone-pill is-purple">
            <span class="pill-badge">单日最长开播</span>
            <span class="pill-value">{{ (currentMilestones.maxDurationDay.value / 60).toFixed(1) }} 小时</span>
            <span class="pill-date">{{ currentMilestones.maxDurationDay.dateStr }}</span>
          </div>
          <div v-if="currentMilestones.maxInteractionDay" class="milestone-pill is-cyan">
            <span class="pill-badge">单日互动峰值</span>
            <span class="pill-value">{{ formatNumber(currentMilestones.maxInteractionDay.value) }} 人</span>
            <span class="pill-date">{{ currentMilestones.maxInteractionDay.dateStr }}</span>
          </div>
          <div v-if="currentMilestones.maxPayingRateDay" class="milestone-pill is-amber">
            <span class="pill-badge">最高付费转化</span>
            <span class="pill-value">{{ currentMilestones.maxPayingRateDay.value.toFixed(1) }}%</span>
            <span class="pill-date">{{ currentMilestones.maxPayingRateDay.dateStr }}</span>
          </div>
        </div>
      </div>

      <!-- Section 1: 4 宫格 Bento 核心指标大卡 -->
      <div class="bento-metric-grid">
        <!-- Card 1: 收益总览 -->
        <div class="bento-card is-revenue">
          <div class="bento-card-header">
            <div class="header-tag">
              <div class="icon-avatar is-gold"><Wallet24Regular /></div>
              <span class="header-label">{{ currentSummary.titlePrefix }}总收益</span>
            </div>
            <NTag
              v-if="currentSummary.incomeTrend !== undefined"
              size="small"
              :bordered="false"
              :type="currentSummary.incomeTrend >= 0 ? 'success' : 'error'"
              class="trend-tag"
            >
              <template #icon>
                <NIcon>
                  <ArrowTrending24Regular v-if="currentSummary.incomeTrend >= 0" />
                  <ArrowDown24Regular v-else />
                </NIcon>
              </template>
              {{ Math.abs(currentSummary.incomeTrend) }}%
            </NTag>
          </div>

          <div class="bento-card-body">
            <div class="primary-metric-val">
              <span class="currency-symbol">¥</span>
              <NNumberAnimation :from="0" :to="currentSummary.totalIncome" :precision="2" :duration="800" />
            </div>

            <!-- 收入构成细分胶囊条 -->
            <div class="income-split-bar">
              <div class="split-info">
                <span>礼物 ¥{{ formatNumber(currentSummary.giftIncome) }}</span>
                <span>SC ¥{{ formatNumber(currentSummary.scIncome) }}</span>
                <span v-if="currentSummary.guardIncome > 0">舰长 ¥{{ formatNumber(currentSummary.guardIncome) }}</span>
              </div>
              <div class="split-progress-track">
                <div
                  class="split-seg is-gift"
                  :style="{
                    width: `${currentSummary.totalIncome > 0 ? (currentSummary.giftIncome / currentSummary.totalIncome) * 100 : 0}%`,
                  }"
                ></div>
                <div
                  class="split-seg is-sc"
                  :style="{
                    width: `${currentSummary.totalIncome > 0 ? (currentSummary.scIncome / currentSummary.totalIncome) * 100 : 0}%`,
                  }"
                ></div>
                <div
                  v-if="currentSummary.guardIncome > 0"
                  class="split-seg is-guard"
                  :style="{
                    width: `${currentSummary.totalIncome > 0 ? (currentSummary.guardIncome / currentSummary.totalIncome) * 100 : 0}%`,
                  }"
                ></div>
              </div>
            </div>
          </div>

          <div class="bento-card-footer">
            <div class="sub-stat">
              <span class="sub-stat-lbl">开播时薪</span>
              <span class="sub-stat-val">¥{{ currentSummary.hourlyIncome.toFixed(1) }}/h</span>
            </div>
            <div class="sub-stat-sep"></div>
            <div class="sub-stat">
              <span class="sub-stat-lbl">场均收益</span>
              <span class="sub-stat-val">¥{{ currentSummary.dailyAvgIncome.toFixed(1) }}</span>
            </div>
          </div>
        </div>

        <!-- Card 2: 弹幕与互动 -->
        <div class="bento-card is-danmaku">
          <div class="bento-card-header">
            <div class="header-tag">
              <div class="icon-avatar is-green"><ChatMultiple24Regular /></div>
              <span class="header-label">{{ currentSummary.titlePrefix }}弹幕总量</span>
            </div>
            <NTag
              v-if="currentSummary.danmakuTrend !== undefined"
              size="small"
              :bordered="false"
              :type="currentSummary.danmakuTrend >= 0 ? 'success' : 'error'"
              class="trend-tag"
            >
              <template #icon>
                <NIcon>
                  <ArrowTrending24Regular v-if="currentSummary.danmakuTrend >= 0" />
                  <ArrowDown24Regular v-else />
                </NIcon>
              </template>
              {{ Math.abs(currentSummary.danmakuTrend) }}%
            </NTag>
          </div>

          <div class="bento-card-body">
            <div class="primary-metric-val">
              <NNumberAnimation :from="0" :to="currentSummary.totalDanmakuCount" :duration="800" />
              <span class="metric-unit">条</span>
            </div>
            <div class="metric-context-text">
              <span class="context-label">观众互动粘性</span>
              <span class="context-highlight">{{ currentSummary.avgDanmakuPerUser.toFixed(1) }} 条/人</span>
            </div>
          </div>

          <div class="bento-card-footer">
            <div class="sub-stat">
              <span class="sub-stat-lbl">互动总人次</span>
              <span class="sub-stat-val">{{ formatNumber(currentSummary.totalInteractions) }}</span>
            </div>
            <div class="sub-stat-sep"></div>
            <div class="sub-stat">
              <span class="sub-stat-lbl">点赞总数</span>
              <span class="sub-stat-val">{{ formatNumber(currentSummary.totalLikeCount) }}</span>
            </div>
          </div>
        </div>

        <!-- Card 3: 粉丝与转化 -->
        <div class="bento-card is-audience">
          <div class="bento-card-header">
            <div class="header-tag">
              <div class="icon-avatar is-cyan"><People24Regular /></div>
              <span class="header-label">{{ currentSummary.titlePrefix }}互动与付费</span>
            </div>
            <NTag size="small" :bordered="false" type="info" class="trend-tag">
              转化率 {{ currentSummary.payingRate.toFixed(1) }}%
            </NTag>
          </div>

          <div class="bento-card-body">
            <div class="primary-metric-val">
              <NNumberAnimation :from="0" :to="currentSummary.interactionUsers" :duration="800" />
              <span class="metric-unit">人互动</span>
            </div>
            <div class="metric-context-text">
              <span class="context-label">付费用户</span>
              <span class="context-highlight">{{ formatNumber(currentSummary.payingUsers) }} 人</span>
              <span class="context-sub">· 客单价 ¥{{ currentSummary.avgIncomePerPayingUser.toFixed(1) }}</span>
            </div>
          </div>

          <div class="bento-card-footer">
            <div class="sub-stat">
              <span class="sub-stat-lbl">付费渗透率</span>
              <span class="sub-stat-val">{{ currentSummary.payingRate.toFixed(1) }}%</span>
            </div>
            <div class="sub-stat-sep"></div>
            <div class="sub-stat">
              <span class="sub-stat-lbl">日均互动人</span>
              <span class="sub-stat-val">{{ currentSummary.dailyAvgInteractions.toFixed(0) }} 人</span>
            </div>
          </div>
        </div>

        <!-- Card 4: 开播勤奋度与时长 -->
        <div class="bento-card is-duration">
          <div class="bento-card-header">
            <div class="header-tag">
              <div class="icon-avatar is-purple"><Timer24Regular /></div>
              <span class="header-label">{{ currentSummary.titlePrefix }}直播时长</span>
            </div>
            <NTag size="small" :bordered="false" type="warning" class="trend-tag">
              开播 {{ currentSummary.activeLiveDays }} 天
            </NTag>
          </div>

          <div class="bento-card-body">
            <div class="primary-metric-val">
              <NNumberAnimation :from="0" :to="Math.round((currentSummary.totalLiveMinutes / 60) * 10) / 10" :precision="1" :duration="800" />
              <span class="metric-unit">小时</span>
            </div>
            <div class="metric-context-text">
              <span class="context-label">周期开播率</span>
              <span class="context-highlight">
                {{ filteredChartData.length > 0 ? ((currentSummary.activeLiveDays / filteredChartData.length) * 100).toFixed(0) : 0 }}%
              </span>
              <span class="context-sub">({{ currentSummary.activeLiveDays }}/{{ filteredChartData.length }}天)</span>
            </div>
          </div>

          <div class="bento-card-footer">
            <div class="sub-stat">
              <span class="sub-stat-lbl">场均开播</span>
              <span class="sub-stat-val">{{ (currentSummary.avgLiveMinutesPerSession / 60).toFixed(1) }} 小时</span>
            </div>
            <div class="sub-stat-sep"></div>
            <div class="sub-stat">
              <span class="sub-stat-lbl">总开播场次</span>
              <span class="sub-stat-val">{{ currentSummary.totalSessions }} 场</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: 全维交互主趋势看板 (Interactive Multi-Series Chart) -->
      <NCard class="dashboard-chart-card" :bordered="false">
        <div class="chart-header-bar">
          <div class="chart-title-group">
            <div class="chart-title">
              <NIcon><DataTrending24Regular /></NIcon>
              <span>{{ currentSummary.titlePrefix }}直播多维演进趋势</span>
            </div>
            <div class="chart-presets">
              <NButtonGroup size="tiny">
                <NButton :secondary="activeMetricPreset !== 'income'" :type="activeMetricPreset === 'income' ? 'primary' : 'default'" @click="applyMetricPreset('income')">
                  收益拆解
                </NButton>
                <NButton :secondary="activeMetricPreset !== 'danmaku'" :type="activeMetricPreset === 'danmaku' ? 'primary' : 'default'" @click="applyMetricPreset('danmaku')">
                  弹幕与互动
                </NButton>
                <NButton :secondary="activeMetricPreset !== 'audience'" :type="activeMetricPreset === 'audience' ? 'primary' : 'default'" @click="applyMetricPreset('audience')">
                  观众与付费
                </NButton>
                <NButton :secondary="activeMetricPreset !== 'all'" :type="activeMetricPreset === 'all' ? 'primary' : 'default'" @click="applyMetricPreset('all')">
                  全维概览
                </NButton>
              </NButtonGroup>
            </div>
          </div>

          <div class="chart-view-switch">
            <NButtonGroup size="tiny">
              <NButton :secondary="chartViewType !== 'trend'" :type="chartViewType === 'trend' ? 'primary' : 'default'" @click="chartViewType = 'trend'">
                折线趋势
              </NButton>
              <NButton :secondary="chartViewType !== 'bar'" :type="chartViewType === 'bar' ? 'primary' : 'default'" @click="chartViewType = 'bar'">
                柱状对比
              </NButton>
            </NButtonGroup>
          </div>
        </div>

        <!-- 指标多选复选框 -->
        <div class="chart-metric-selector">
          <NCheckboxGroup v-model:value="selectedMetrics">
            <NFlex :size="12" wrap>
              <NCheckbox
                v-for="metric in chartMetrics"
                :key="metric.value"
                :value="metric.value"
                :style="{ '--metric-color': metric.color }"
                class="metric-checkbox"
              >
                <span class="metric-pill" :style="{ backgroundColor: metric.color }"></span>
                <span>{{ metric.label }}</span>
              </NCheckbox>
            </NFlex>
          </NCheckboxGroup>
        </div>

        <!-- ECharts 容器 -->
        <div ref="chartRef" class="main-echart-box"></div>
      </NCard>

      <!-- Section 3: 双列深度洞察 Bento (收入结构与周度偏好) -->
      <div class="insight-bento-grid">
        <!-- 左列: 收入结构与付费转化深度剖析 -->
        <NCard class="insight-card" :bordered="false">
          <div class="insight-card-header">
            <div class="insight-title">
              <NIcon><MoneyHand24Regular /></NIcon>
              <span>{{ currentSummary.titlePrefix }}收入结构与变现盘面</span>
            </div>
          </div>

          <div class="revenue-breakdown-content">
            <div class="revenue-pie-summary">
              <div class="pie-stat-row">
                <div class="pie-stat-item">
                  <div class="stat-dot is-gift"></div>
                  <div class="stat-meta">
                    <span class="meta-label">普通打赏礼物</span>
                    <span class="meta-val">¥{{ formatNumber(currentSummary.giftIncome) }}</span>
                  </div>
                  <span class="stat-pct">
                    {{ currentSummary.totalIncome > 0 ? ((currentSummary.giftIncome / currentSummary.totalIncome) * 100).toFixed(1) : 0 }}%
                  </span>
                </div>

                <div class="pie-stat-item">
                  <div class="stat-dot is-sc"></div>
                  <div class="stat-meta">
                    <span class="meta-label">SuperChat (醒目留言)</span>
                    <span class="meta-val">¥{{ formatNumber(currentSummary.scIncome) }}</span>
                  </div>
                  <span class="stat-pct">
                    {{ currentSummary.totalIncome > 0 ? ((currentSummary.scIncome / currentSummary.totalIncome) * 100).toFixed(1) : 0 }}%
                  </span>
                </div>

                <div v-if="currentSummary.guardIncome > 0" class="pie-stat-item">
                  <div class="stat-dot is-guard"></div>
                  <div class="stat-meta">
                    <span class="meta-label">大航海 (舰长/提督/总督)</span>
                    <span class="meta-val">¥{{ formatNumber(currentSummary.guardIncome) }}</span>
                  </div>
                  <span class="stat-pct">
                    {{ currentSummary.totalIncome > 0 ? ((currentSummary.guardIncome / currentSummary.totalIncome) * 100).toFixed(1) : 0 }}%
                  </span>
                </div>
              </div>
            </div>

            <!-- 付费转化漏斗阶梯 -->
            <div class="monetization-funnel">
              <div class="funnel-title">互动观众变现转化阶梯</div>
              <div class="funnel-steps">
                <div class="funnel-step">
                  <div class="step-bar is-active" style="width: 100%"></div>
                  <div class="step-meta">
                    <span>互动用户 {{ formatNumber(currentSummary.interactionUsers) }} 人</span>
                    <span>100%</span>
                  </div>
                </div>
                <div class="funnel-step">
                  <div
                    class="step-bar is-paying"
                    :style="{
                      width: `${Math.max(8, currentSummary.payingRate)}%`,
                    }"
                  ></div>
                  <div class="step-meta">
                    <span>付费观众 {{ formatNumber(currentSummary.payingUsers) }} 人</span>
                    <span class="is-highlight">{{ currentSummary.payingRate.toFixed(1) }}% 转化</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </NCard>

        <!-- 右列: 周开播习惯与黄金周期分布 -->
        <NCard class="insight-card" :bordered="false">
          <div class="insight-card-header">
            <div class="insight-title">
              <NIcon><CalendarLtr24Regular /></NIcon>
              <span>周开播习惯与黄金周期分布</span>
            </div>
            <NTag v-if="bestDayInsight" size="small" type="success" :bordered="false" class="best-day-tag">
              推荐黄金日: {{ bestDayInsight.income.dayName }}
            </NTag>
          </div>

          <div class="dow-stats-container">
            <div class="dow-grid">
              <div
                v-for="item in currentDayOfWeekStats"
                :key="item.dayOfWeek"
                class="dow-col"
                :class="{ 'is-active-day': item.liveDaysCount > 0, 'is-best': bestDayInsight?.income.dayOfWeek === item.dayOfWeek }"
              >
                <div class="dow-header">
                  <span class="dow-name">{{ item.dayName }}</span>
                  <span class="dow-count">{{ item.liveDaysCount }}次</span>
                </div>

                <div class="dow-bars">
                  <!-- 收益条 -->
                  <div class="bar-track">
                    <div
                      class="bar-fill is-gold"
                      :style="{
                        height: `${bestDayInsight && bestDayInsight.income.avgIncome > 0 ? (item.avgIncome / bestDayInsight.income.avgIncome) * 100 : 0}%`,
                      }"
                      :title="`场均收益: ¥${item.avgIncome.toFixed(1)}`"
                    ></div>
                  </div>
                  <!-- 弹幕条 -->
                  <div class="bar-track">
                    <div
                      class="bar-fill is-green"
                      :style="{
                        height: `${bestDayInsight && bestDayInsight.danmaku.avgDanmaku > 0 ? (item.avgDanmaku / bestDayInsight.danmaku.avgDanmaku) * 100 : 0}%`,
                      }"
                      :title="`场均弹幕: ${item.avgDanmaku.toFixed(0)}条`"
                    ></div>
                  </div>
                </div>

                <div class="dow-footer-val">
                  <span class="footer-income">¥{{ Math.round(item.avgIncome) }}</span>
                </div>
              </div>
            </div>

            <!-- 小贴士 -->
            <div v-if="bestDayInsight" class="dow-insight-tip">
              <NIcon><Sparkle24Regular /></NIcon>
              <span>
                <strong>{{ bestDayInsight.income.dayName }}</strong> 场均收益最高 (¥{{ bestDayInsight.income.avgIncome.toFixed(1) }})，
                <strong>{{ bestDayInsight.danmaku.dayName }}</strong> 场均弹幕最活跃 ({{ bestDayInsight.danmaku.avgDanmaku.toFixed(0) }}条)。建议重要活动优先安排在黄金日。
              </span>
            </div>
          </div>
        </NCard>
      </div>

      <!-- Section 4: 分区效能矩阵 & 单场高光 Top Sessions -->
      <div class="area-session-bento-grid">
        <!-- 分区效能表现 -->
        <NCard class="area-card" :bordered="false">
          <div class="insight-card-header">
            <div class="insight-title">
              <NIcon><Grid24Regular /></NIcon>
              <span>{{ currentSummary.titlePrefix }}直播分区效能矩阵</span>
            </div>
          </div>

          <div v-if="currentAreaStats.length === 0" class="sub-empty-hint">
            <NText depth="3">当前区间无分区直播记录</NText>
          </div>

          <div v-else class="area-table-box">
            <NTable size="small" :single-line="false" class="clean-area-table">
              <thead>
                <tr>
                  <th>分区名称</th>
                  <th style="text-align: right">场次</th>
                  <th style="text-align: right">总时长</th>
                  <th style="text-align: right">总收益</th>
                  <th style="text-align: right">场均收益</th>
                  <th style="text-align: right">场均弹幕</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="area in currentAreaStats" :key="`${area.parentArea}-${area.area}`">
                  <td>
                    <span class="area-parent-badge">{{ area.parentArea }}</span>
                    <span class="area-name-text">{{ area.area }}</span>
                  </td>
                  <td style="text-align: right">{{ area.sessionCount }} 场</td>
                  <td style="text-align: right">{{ (area.totalLiveMinutes / 60).toFixed(1) }} h</td>
                  <td style="text-align: right; font-weight: 600; color: #f59e0b">¥{{ formatNumber(area.totalIncome) }}</td>
                  <td style="text-align: right">¥{{ area.avgIncome.toFixed(1) }}</td>
                  <td style="text-align: right">{{ formatNumber(area.avgDanmaku) }} 条</td>
                </tr>
              </tbody>
            </NTable>
          </div>
        </NCard>

        <!-- 单场高光排行 Top 5 -->
        <NCard class="top-sessions-card" :bordered="false">
          <div class="insight-card-header">
            <div class="insight-title">
              <NIcon><Star24Regular /></NIcon>
              <span>单场直播高光 TOP 5</span>
            </div>
            <NTabs v-model:value="activeTopSessionTab" type="segment" size="small">
              <NTabPane name="income" tab="最高收益" />
              <NTabPane name="danmaku" tab="最密弹幕" />
              <NTabPane name="duration" tab="最长开播" />
            </NTabs>
          </div>

          <div class="top-sessions-list">
            <div
              v-for="(session, idx) in (activeTopSessionTab === 'income' ? topSessionsByIncome : activeTopSessionTab === 'danmaku' ? topSessionsByDanmaku : topSessionsByDuration)"
              :key="session.id"
              class="top-session-item"
            >
              <div class="session-rank-badge" :class="`is-rank-${idx + 1}`">
                {{ idx + 1 }}
              </div>
              <div class="session-main-meta">
                <div class="session-title-row">
                  <span class="session-title-text" :title="session.title">{{ session.title }}</span>
                  <NTag size="tiny" :bordered="false" class="session-area-tag">
                    {{ session.parentArea }} · {{ session.area }}
                  </NTag>
                </div>
                <div class="session-time-row">
                  <span>{{ formatDate(session.startTime) }}</span>
                  <span class="time-sep">·</span>
                  <span>时长 {{ (session.liveMinutes / 60).toFixed(1) }} 小时</span>
                </div>
              </div>
              <div class="session-highlight-stat">
                <template v-if="activeTopSessionTab === 'income'">
                  <span class="stat-highlight is-gold">¥{{ formatNumber(session.totalIncome) }}</span>
                  <span class="stat-sub">弹幕 {{ formatNumber(session.danmakuCount) }}</span>
                </template>
                <template v-else-if="activeTopSessionTab === 'danmaku'">
                  <span class="stat-highlight is-green">{{ formatNumber(session.danmakuCount) }} 条</span>
                  <span class="stat-sub">收益 ¥{{ formatNumber(session.totalIncome) }}</span>
                </template>
                <template v-else>
                  <span class="stat-highlight is-purple">{{ (session.liveMinutes / 60).toFixed(1) }} 小时</span>
                  <span class="stat-sub">收益 ¥{{ formatNumber(session.totalIncome) }}</span>
                </template>
              </div>
            </div>

            <div v-if="currentFilteredSessions.length === 0" class="sub-empty-hint">
              <NText depth="3">暂无单场直播记录</NText>
            </div>
          </div>
        </NCard>
      </div>

      <!-- Section 5: 60 天开播活跃热力日历 (Activity Heatmap Grid) -->
      <NCard class="heatmap-card" :bordered="false">
        <div class="insight-card-header">
          <div class="insight-title">
            <NIcon><CalendarClock24Regular /></NIcon>
            <span>60 天开播活跃热力矩阵</span>
          </div>
          <div class="heatmap-legend">
            <span class="legend-lbl">少</span>
            <div class="legend-cell lvl-0"></div>
            <div class="legend-cell lvl-1"></div>
            <div class="legend-cell lvl-2"></div>
            <div class="legend-cell lvl-3"></div>
            <div class="legend-cell lvl-4"></div>
            <span class="legend-lbl">多</span>
          </div>
        </div>

        <div class="heatmap-grid-box">
          <div class="heatmap-grid">
            <NTooltip v-for="point in getChartDataArray()" :key="point.timestamp" trigger="hover">
              <template #trigger>
                <div
                  class="heatmap-day-cell"
                  :class="[
                    point.liveMinutes === 0
                      ? 'lvl-0'
                      : point.liveMinutes < 120
                        ? 'lvl-1'
                        : point.liveMinutes < 240
                          ? 'lvl-2'
                          : point.liveMinutes < 360
                            ? 'lvl-3'
                            : 'lvl-4',
                  ]"
                ></div>
              </template>
              <div class="heatmap-tooltip">
                <div class="tooltip-date">📅 {{ point.date }}</div>
                <div v-if="point.liveMinutes > 0" class="tooltip-body">
                  <div>⏱️ 时长: {{ (point.liveMinutes / 60).toFixed(1) }} 小时</div>
                  <div>💰 收益: ¥{{ formatNumber(point.income) }}</div>
                  <div>💬 弹幕: {{ formatNumber(point.danmakuCount) }} 条</div>
                  <div>👥 互动: {{ formatNumber(point.interactionUsers) }} 人</div>
                </div>
                <div v-else class="tooltip-body is-rest">
                  <span>💤 未开播 / 休整日</span>
                </div>
              </div>
            </NTooltip>
          </div>
        </div>
      </NCard>

      <!-- Section 6: 高频粉丝贡献与互动画像 (Top Supporters & Chatters) -->
      <div v-if="(analyzeData?.topSpenders && analyzeData.topSpenders.length > 0) || (analyzeData?.topChatters && analyzeData.topChatters.length > 0)" class="supporters-grid">
        <!-- 打赏榜 Top 10 -->
        <NCard v-if="analyzeData?.topSpenders && analyzeData.topSpenders.length > 0" class="supporter-card" :bordered="false">
          <div class="insight-card-header">
            <div class="insight-title">
              <NIcon><Trophy24Regular /></NIcon>
              <span>近 60 天核心打赏金主 TOP 10</span>
            </div>
          </div>
          <div class="supporter-list">
            <div v-for="(user, idx) in analyzeData.topSpenders" :key="user.name" class="supporter-item">
              <div class="supporter-rank" :class="`is-rank-${idx + 1}`">{{ idx + 1 }}</div>
              <div class="supporter-info">
                <span class="supporter-name">{{ user.name }}</span>
                <span v-if="user.lastTime" class="supporter-time">最近互动: {{ formatDate(user.lastTime) }}</span>
              </div>
              <div class="supporter-val is-gold">
                ¥{{ formatNumber(user.totalPaid || 0) }}
                <span v-if="user.payCount" class="supporter-count">({{ user.payCount }}次)</span>
              </div>
            </div>
          </div>
        </NCard>

        <!-- 弹幕狂热榜 Top 10 -->
        <NCard v-if="analyzeData?.topChatters && analyzeData.topChatters.length > 0" class="supporter-card" :bordered="false">
          <div class="insight-card-header">
            <div class="insight-title">
              <NIcon><ChatMultiple24Regular /></NIcon>
              <span>近 60 天弹幕活跃真爱粉 TOP 10</span>
            </div>
          </div>
          <div class="supporter-list">
            <div v-for="(user, idx) in analyzeData.topChatters" :key="user.name" class="supporter-item">
              <div class="supporter-rank" :class="`is-rank-${idx + 1}`">{{ idx + 1 }}</div>
              <div class="supporter-info">
                <span class="supporter-name">{{ user.name }}</span>
                <span v-if="user.lastTime" class="supporter-time">最近发言: {{ formatDate(user.lastTime) }}</span>
              </div>
              <div class="supporter-val is-green">
                {{ formatNumber(user.danmakuCount || 0) }} 条
              </div>
            </div>
          </div>
        </NCard>
      </div>

      <!-- Section 7: 每日直播明细复盘表 (可折叠) -->
      <NCard class="daily-table-card" :bordered="false">
        <NCollapse :default-expanded-names="[]">
          <NCollapseItem name="daily-table">
            <template #header>
              <div class="table-collapse-header">
                <div class="insight-title">
                  <NIcon><Table24Regular /></NIcon>
                  <span>{{ currentSummary.titlePrefix }}每日明细复盘表 (共 {{ dailyTableData.length }} 条记录)</span>
                </div>
              </div>
            </template>

            <div class="table-toolbar">
              <NFlex align="center" justify="space-between" style="width: 100%">
                <NFlex align="center" :size="12">
                  <NSwitch v-model:value="showOnlyLiveDays" size="small" />
                  <span class="switch-lbl">仅显示开播日期 (已过滤未开播休整日)</span>
                </NFlex>
              </NFlex>
            </div>

            <div class="daily-breakdown-table-box">
              <NTable size="small" :single-line="false" class="clean-daily-table">
                <thead>
                  <tr>
                    <th class="clickable-th" @click="toggleDailySort('date')">
                      日期 {{ dailyTableSortKey === 'date' ? (dailyTableSortAsc ? '↑' : '↓') : '' }}
                    </th>
                    <th class="clickable-th" style="text-align: right" @click="toggleDailySort('income')">
                      收益 (¥) {{ dailyTableSortKey === 'income' ? (dailyTableSortAsc ? '↑' : '↓') : '' }}
                    </th>
                    <th class="clickable-th" style="text-align: right" @click="toggleDailySort('danmaku')">
                      弹幕数 {{ dailyTableSortKey === 'danmaku' ? (dailyTableSortAsc ? '↑' : '↓') : '' }}
                    </th>
                    <th class="clickable-th" style="text-align: right" @click="toggleDailySort('interactions')">
                      互动人次 {{ dailyTableSortKey === 'interactions' ? (dailyTableSortAsc ? '↑' : '↓') : '' }}
                    </th>
                    <th style="text-align: right">付费人数</th>
                    <th class="clickable-th" style="text-align: right" @click="toggleDailySort('duration')">
                      开播时长 {{ dailyTableSortKey === 'duration' ? (dailyTableSortAsc ? '↑' : '↓') : '' }}
                    </th>
                    <th style="text-align: right">点赞数</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in dailyTableData" :key="row.timestamp">
                    <td>
                      <span class="table-date-cell">{{ row.date }}</span>
                    </td>
                    <td style="text-align: right; font-weight: 600; color: #f59e0b">
                      {{ row.income > 0 ? `¥${formatCurrency(row.income)}` : '-' }}
                    </td>
                    <td style="text-align: right">
                      {{ row.danmakuCount > 0 ? formatNumber(row.danmakuCount) : '-' }}
                    </td>
                    <td style="text-align: right">
                      {{ row.interactionCount > 0 ? formatNumber(row.interactionCount) : '-' }}
                    </td>
                    <td style="text-align: right">
                      {{ row.payingUsers > 0 ? `${row.payingUsers} 人` : '-' }}
                    </td>
                    <td style="text-align: right">
                      <NTag v-if="row.liveMinutes > 0" size="tiny" :bordered="false" type="info">
                        {{ row.liveHours }} h
                      </NTag>
                      <span v-else class="text-muted-dash">-</span>
                    </td>
                    <td style="text-align: right">
                      {{ row.likeCount > 0 ? formatNumber(row.likeCount) : '-' }}
                    </td>
                  </tr>
                </tbody>
              </NTable>
            </div>
          </NCollapseItem>
        </NCollapse>
      </NCard>
    </div>
  </div>
</template>

<style scoped>
.analyze-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 32px;
}

.range-datepicker {
  width: 240px;
}

/* 骨架屏与空状态 */
.dashboard-skeleton,
.dashboard-empty {
  margin-top: 8px;
}

.empty-card {
  border-radius: 12px;
  background: var(--vtsuru-bg-elevated);
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 峰值战报胶囊条 */
.milestone-ribbon {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 10px;
  padding: 8px 14px;
  overflow-x: auto;
}

.ribbon-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vtsuru-fg);
  white-space: nowrap;
  flex-shrink: 0;
}

.ribbon-scroll {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
}

.milestone-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--vtsuru-bg);
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  padding: 3px 10px;
  font-size: 11.5px;
  white-space: nowrap;
  flex-shrink: 0;
}

.pill-badge {
  color: var(--vtsuru-fg-muted);
}

.pill-value {
  font-weight: 700;
  font-family: var(--n-font-family-mono, monospace);
}

.milestone-pill.is-gold .pill-value {
  color: #f59e0b;
}

.milestone-pill.is-green .pill-value {
  color: #10b981;
}

.milestone-pill.is-purple .pill-value {
  color: #8b5cf6;
}

.milestone-pill.is-cyan .pill-value {
  color: #06b6d4;
}

.milestone-pill.is-amber .pill-value {
  color: #f97316;
}

.pill-date {
  font-size: 10.5px;
  color: var(--vtsuru-fg-muted);
  opacity: 0.8;
}

/* 4 宫格 Bento 核心指标大卡 */
.bento-metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

@media (max-width: 1200px) {
  .bento-metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .bento-metric-grid {
    grid-template-columns: 1fr;
  }
}

.bento-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 12px;
  padding: 16px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.bento-card:hover {
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.bento-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.header-tag {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-avatar {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.icon-avatar.is-gold {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.icon-avatar.is-green {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.icon-avatar.is-cyan {
  background: rgba(6, 182, 212, 0.15);
  color: #06b6d4;
}

.icon-avatar.is-purple {
  background: rgba(139, 92, 246, 0.15);
  color: #8b5cf6;
}

.header-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.bento-card-body {
  margin-bottom: 12px;
}

.primary-metric-val {
  font-size: 26px;
  font-weight: 800;
  font-family: var(--n-font-family-mono, monospace);
  color: var(--vtsuru-fg);
  line-height: 1.1;
  display: flex;
  align-items: baseline;
  gap: 3px;
  margin-bottom: 8px;
}

.currency-symbol {
  font-size: 18px;
  font-weight: 600;
  color: #f59e0b;
}

.metric-unit {
  font-size: 13px;
  font-weight: 500;
  color: var(--vtsuru-fg-muted);
  margin-left: 2px;
}

.income-split-bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}

.split-info {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}

.split-progress-track {
  display: flex;
  height: 4px;
  background: var(--vtsuru-bg);
  border-radius: 2px;
  overflow: hidden;
  gap: 1px;
}

.split-seg.is-gift {
  background: #f59e0b;
}

.split-seg.is-sc {
  background: #f97316;
}

.split-seg.is-guard {
  background: #ef4444;
}

.metric-context-text {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.context-highlight {
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.context-sub {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}

.bento-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid var(--vtsuru-border);
  font-size: 11.5px;
}

.sub-stat {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sub-stat-lbl {
  color: var(--vtsuru-fg-muted);
}

.sub-stat-val {
  font-weight: 600;
  color: var(--vtsuru-fg);
  font-family: var(--n-font-family-mono, monospace);
}

.sub-stat-sep {
  width: 1px;
  height: 12px;
  background: var(--vtsuru-border);
}

/* 主图表卡片 */
.dashboard-chart-card {
  border-radius: 12px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
}

.chart-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 12px;
}

.chart-title-group {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.chart-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 700;
  color: var(--vtsuru-fg);
}

.chart-metric-selector {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--vtsuru-bg);
  border-radius: 8px;
  border: 1px solid var(--vtsuru-border);
}

.metric-pill {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
}

.main-echart-box {
  width: 100%;
  height: 380px;
}

/* 深度洞察 Bento */
.insight-bento-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

@media (max-width: 900px) {
  .insight-bento-grid {
    grid-template-columns: 1fr;
  }
}

.insight-card {
  border-radius: 12px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
}

.insight-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.insight-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--vtsuru-fg);
}

.revenue-breakdown-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pie-stat-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pie-stat-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--vtsuru-bg);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
}

.stat-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-right: 10px;
}

.stat-dot.is-gift {
  background: #f59e0b;
}

.stat-dot.is-sc {
  background: #f97316;
}

.stat-dot.is-guard {
  background: #ef4444;
}

.stat-meta {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.meta-label {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.meta-val {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--vtsuru-fg);
  font-family: var(--n-font-family-mono, monospace);
}

.stat-pct {
  font-size: 13px;
  font-weight: 700;
  color: var(--vtsuru-fg-muted);
}

.monetization-funnel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--vtsuru-border);
}

.funnel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--vtsuru-fg-muted);
}

.funnel-steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.funnel-step {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.step-bar {
  height: 6px;
  border-radius: 3px;
}

.step-bar.is-active {
  background: #3b82f6;
}

.step-bar.is-paying {
  background: #8b5cf6;
}

.step-meta {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}

.step-meta .is-highlight {
  font-weight: 600;
  color: #8b5cf6;
}

/* 周开播习惯柱状图 */
.dow-stats-container {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dow-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  height: 180px;
  align-items: flex-end;
  padding: 10px 0;
}

.dow-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  height: 100%;
  justify-content: flex-end;
  padding: 6px;
  border-radius: 8px;
  background: var(--vtsuru-bg);
  border: 1px solid transparent;
  transition: all 0.2s;
}

.dow-col.is-active-day {
  border-color: var(--vtsuru-border);
}

.dow-col.is-best {
  border-color: rgba(245, 158, 11, 0.4);
  background: rgba(245, 158, 11, 0.05);
}

.dow-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.dow-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.dow-count {
  font-size: 9.5px;
  color: var(--vtsuru-fg-muted);
}

.dow-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 80px;
  width: 100%;
  justify-content: center;
}

.bar-track {
  width: 8px;
  height: 100%;
  display: flex;
  align-items: flex-end;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 3px;
  overflow: hidden;
}

.bar-fill {
  width: 100%;
  border-radius: 3px 3px 0 0;
  transition: height 0.3s;
}

.bar-fill.is-gold {
  background: #f59e0b;
}

.bar-fill.is-green {
  background: #10b981;
}

.dow-footer-val {
  font-size: 10px;
  font-weight: 600;
  color: var(--vtsuru-fg-muted);
  font-family: var(--n-font-family-mono, monospace);
}

.dow-insight-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(16, 185, 129, 0.08);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 8px;
  font-size: 11.5px;
  color: var(--vtsuru-fg);
  line-height: 1.4;
}

/* 分区与单场高光 Bento */
.area-session-bento-grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 14px;
}

@media (max-width: 960px) {
  .area-session-bento-grid {
    grid-template-columns: 1fr;
  }
}

.area-card,
.top-sessions-card {
  border-radius: 12px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
}

.clean-area-table {
  background: transparent;
  font-size: 12px;
}

.area-parent-badge {
  display: inline-block;
  padding: 1px 5px;
  background: var(--vtsuru-bg);
  border: 1px solid var(--vtsuru-border);
  border-radius: 4px;
  font-size: 10px;
  color: var(--vtsuru-fg-muted);
  margin-right: 6px;
}

.area-name-text {
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.top-sessions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.top-session-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--vtsuru-bg);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  transition: all 0.2s;
}

.top-session-item:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.session-rank-badge {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  background: var(--vtsuru-bg-elevated);
  color: var(--vtsuru-fg-muted);
  flex-shrink: 0;
}

.session-rank-badge.is-rank-1 {
  background: #f59e0b;
  color: #000;
}

.session-rank-badge.is-rank-2 {
  background: #94a3b8;
  color: #000;
}

.session-rank-badge.is-rank-3 {
  background: #b45309;
  color: #fff;
}

.session-main-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.session-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.session-title-text {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--vtsuru-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-area-tag {
  font-size: 10px;
  flex-shrink: 0;
}

.session-time-row {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}

.time-sep {
  margin: 0 4px;
}

.session-highlight-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.stat-highlight {
  font-size: 13px;
  font-weight: 700;
  font-family: var(--n-font-family-mono, monospace);
}

.stat-highlight.is-gold {
  color: #f59e0b;
}

.stat-highlight.is-green {
  color: #10b981;
}

.stat-highlight.is-purple {
  color: #8b5cf6;
}

.stat-sub {
  font-size: 10.5px;
  color: var(--vtsuru-fg-muted);
}

.sub-empty-hint {
  padding: 24px;
  text-align: center;
}

/* 60 天开播热力矩阵 */
.heatmap-card {
  border-radius: 12px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}

.legend-cell {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.heatmap-grid-box {
  overflow-x: auto;
  padding: 8px 0;
}

.heatmap-grid {
  display: grid;
  grid-template-rows: repeat(5, 1fr);
  grid-auto-flow: column;
  gap: 5px;
}

.heatmap-day-cell {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  transition: transform 0.15s, opacity 0.15s;
  cursor: pointer;
}

.heatmap-day-cell:hover {
  transform: scale(1.25);
}

.lvl-0 {
  background: rgba(255, 255, 255, 0.05);
}

.lvl-1 {
  background: rgba(16, 185, 129, 0.25);
}

.lvl-2 {
  background: rgba(16, 185, 129, 0.5);
}

.lvl-3 {
  background: rgba(16, 185, 129, 0.75);
}

.lvl-4 {
  background: #10b981;
}

.heatmap-tooltip {
  font-size: 11.5px;
  padding: 2px;
}

.tooltip-date {
  font-weight: 700;
  margin-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 2px;
}

.tooltip-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tooltip-body.is-rest {
  color: var(--vtsuru-fg-muted);
}

/* 金主与粉丝榜 */
.supporters-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

@media (max-width: 900px) {
  .supporters-grid {
    grid-template-columns: 1fr;
  }
}

.supporter-card {
  border-radius: 12px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
}

.supporter-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.supporter-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: var(--vtsuru-bg);
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
}

.supporter-rank {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background: var(--vtsuru-bg-elevated);
  color: var(--vtsuru-fg-muted);
}

.supporter-rank.is-rank-1 {
  background: #f59e0b;
  color: #000;
}

.supporter-rank.is-rank-2 {
  background: #94a3b8;
  color: #000;
}

.supporter-rank.is-rank-3 {
  background: #b45309;
  color: #fff;
}

.supporter-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.supporter-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.supporter-time {
  font-size: 10px;
  color: var(--vtsuru-fg-muted);
}

.supporter-val {
  font-size: 12.5px;
  font-weight: 700;
  font-family: var(--n-font-family-mono, monospace);
}

.supporter-val.is-gold {
  color: #f59e0b;
}

.supporter-val.is-green {
  color: #10b981;
}

.supporter-count {
  font-size: 10px;
  font-weight: normal;
  color: var(--vtsuru-fg-muted);
}

/* 每日复盘明细卡片 */
.daily-table-card {
  border-radius: 12px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
}

.table-collapse-header {
  display: flex;
  align-items: center;
  width: 100%;
}

.table-toolbar {
  margin-bottom: 10px;
  padding: 6px 0;
}

.switch-lbl {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.daily-breakdown-table-box {
  max-height: 420px;
  overflow-y: auto;
}

.clean-daily-table {
  background: transparent;
  font-size: 12px;
}

.clickable-th {
  cursor: pointer;
  user-select: none;
}

.clickable-th:hover {
  color: var(--vtsuru-fg);
}

.table-date-cell {
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.text-muted-dash {
  color: var(--vtsuru-fg-muted);
}
</style>
