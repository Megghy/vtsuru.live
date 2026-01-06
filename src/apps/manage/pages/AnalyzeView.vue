<script lang="ts" setup>
import {
  BarChartOutline,
  ChatbubblesOutline,
  PeopleOutline,
  RefreshOutline,
  TimeOutline,
  TrendingDown,
  TrendingUp,
  WalletOutline,
} from '@vicons/ionicons5'
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
import {
  NButton,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NGrid,
  NGridItem,
  NIcon,
  NNumberAnimation,
  NProgress,
  NSkeleton,
  NSpace,
  NTag,
  NTime,
  NTooltip,
  useMessage,
  useThemeVars,
} from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { QueryGetAPI } from '@/api/query'
import { ANALYZE_API_URL } from '@/shared/config'
import EventFetcherAlert from '@/apps/manage/components/event-fetcher/EventFetcherAlert.vue'

// 注册必要的组件
echarts.use([
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

// types.ts
interface ChartItem {
  income: number
  interactionCount: number
  danmakuCount: number
  payingUsers: number
  interactionUsers: number
  liveMinutes: number
  likeCount: number
}

interface Summary {
  last7Days: {
    totalIncome: number
    totalInteractions: number
    totalDanmakuCount: number
    totalLiveMinutes: number
    dailyAvgIncome: number
    dailyAvgDanmaku: number
    incomeTrend: number
    interactionTrend: number
    danmakuTrend: number
    activeLiveDays: number
    interactionUsers: number
    payingUsers: number
    interactionUsersTrend: number
    payingUsersTrend: number
  }
  last30Days: {
    totalIncome: number
    totalInteractions: number
    totalDanmakuCount: number
    totalLiveMinutes: number
    dailyAvgIncome: number
    dailyAvgDanmaku: number
    incomeTrend: number
    interactionTrend: number
    danmakuTrend: number
    activeLiveDays: number
    interactionUsers: number
    payingUsers: number
  }
}

interface AnalyzeData {
  summary: Summary
  chartData: Record<number, ChartItem> // 键是Unix时间戳，值是对应的数据
}

// 状态管理
const loading = ref(true)
const refreshing = ref(false)
const message = useMessage()
const analyzeData = ref<AnalyzeData>()
const summaryData = computed(() => analyzeData.value?.summary)
const themeVars = useThemeVars()
const lastUpdateTime = ref<number>(0)
const hasData = computed(() => analyzeData.value && Object.keys(analyzeData.value.chartData || {}).length > 0)

// 图表配置状态
const chartRef = ref<HTMLElement | null>(null)
let mainChart: echarts.ECharts | null = null
const selectedMetrics = ref<string[]>(['income', 'interactionCount'])
const chartMetrics = [
  { label: '收入', value: 'income', color: '#f5a623', type: 'line', yAxisIndex: 1 },
  { label: '互动数', value: 'interactionCount', color: '#2080f0', type: 'line', yAxisIndex: 0 },
  { label: '弹幕数', value: 'danmakuCount', color: '#18a058', type: 'line', yAxisIndex: 0 },
  { label: '点赞数', value: 'likeCount', color: '#d03050', type: 'line', yAxisIndex: 0 },
  { label: '互动人数', value: 'interactionUsers', color: '#8a2be2', type: 'bar', yAxisIndex: 0 },
  { label: '付费人数', value: 'payingUsers', color: '#ff69b4', type: 'bar', yAxisIndex: 0 },
]

// 格式化工具函数
function formatCurrency(value: number): string {
  return `¥${value.toFixed(2)}`
}

function formatNumber(value: number): string {
  return value.toLocaleString()
}

function getTrendType(value: number): 'success' | 'error' | 'info' {
  if (value > 0) return 'success'
  if (value < 0) return 'error'
  return 'info'
}

// 格式化时间戳为日期
function formatDate(timestamp: number): string {
  // 如果时间戳超过 100亿，说明是毫秒，否则是秒
  const date = new Date(timestamp > 10000000000 ? timestamp : timestamp * 1000)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

// 从ChartData对象转换为数组，并按时间戳排序
function getChartDataArray() {
  if (!analyzeData.value?.chartData) return []

  return Object.entries(analyzeData.value.chartData)
    .map(([timestamp, data]) => ({
      timestamp: Number.parseInt(timestamp, 10),
      date: formatDate(Number.parseInt(timestamp, 10)),
      ...data,
    }))
    .sort((a, b) => a.timestamp - b.timestamp)
}

// 获取主题色配置
function getThemeColors() {
  return {
    textColor: themeVars.value.textColor2,
    axisLineColor: themeVars.value.borderColor,
    splitLineColor: themeVars.value.dividerColor,
    cardColor: themeVars.value.cardColor,
  }
}

// 初始化图表
function initChart() {
  if (!chartRef.value) return
  const chartData = getChartDataArray()
  if (chartData.length === 0) return

  mainChart = echarts.init(chartRef.value)
  updateChartOption()
}

// 更新图表配置
function updateChartOption() {
  if (!mainChart) return
  const chartData = getChartDataArray()
  const dates = chartData.map(item => item.date)
  const themeColors = getThemeColors()

  // 确定哪些 Y 轴需要显示
  const showRightAxis = selectedMetrics.value.includes('income')
  const showLeftAxis = selectedMetrics.value.some(m => m !== 'income')

  const series = selectedMetrics.value.map((metricKey) => {
    const metricConfig = chartMetrics.find(m => m.value === metricKey)
    if (!metricConfig) return null

    return {
      name: metricConfig.label,
      type: metricConfig.type,
      data: chartData.map(item => (item as any)[metricKey]),
      smooth: true,
      yAxisIndex: (metricKey === 'income' && showLeftAxis) ? 1 : 0, // 如果同时显示左轴，收入走右轴；否则走左轴
      itemStyle: {
        color: metricConfig.color,
      },
      areaStyle: metricConfig.type === 'line' ? {
        opacity: 0.1,
        color: metricConfig.color,
      } : undefined,
      barMaxWidth: metricConfig.type === 'bar' ? '20%' : undefined,
    }
  }).filter(Boolean)

  const yAxis = []
  
  // 左轴 (默认)
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
      // 只有金额，显示在左边
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

  // 右轴 (仅当同时显示数量和金额时)
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

  const option = {
    backgroundColor: 'transparent',
    textStyle: {
      color: themeColors.textColor,
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: themeVars.value.cardColor,
      borderColor: themeVars.value.borderColor,
      textStyle: { color: themeColors.textColor },
      axisPointer: { type: 'shadow' },
    },
    legend: {
      data: series.map(s => s!.name),
      textStyle: { color: themeColors.textColor },
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '3%',
      bottom: '10%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: themeColors.axisLineColor } },
      axisLabel: { color: themeColors.textColor },
    },
    yAxis,
    series,
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
      },
      {
        show: true,
        type: 'slider',
        bottom: 35,
        height: 20,
        start: 0,
        end: 100,
        borderColor: themeColors.axisLineColor,
        textStyle: { color: themeColors.textColor },
      },
    ],
  }

  mainChart.setOption(option, true)
}

// 监听指标选择变化
watch(selectedMetrics, () => {
  updateChartOption()
})

// 获取分析数据
async function fetchAnalyzeData(isRefresh = false) {
  try {
    if (isRefresh) {
      refreshing.value = true
    } else {
      loading.value = true
    }
    const data = await QueryGetAPI<AnalyzeData>(`${ANALYZE_API_URL}all`)

    if (data.code === 200) {
      analyzeData.value = data.data
      lastUpdateTime.value = Date.now()
      nextTick(() => initChart())
      if (isRefresh) {
        message.success('数据已刷新')
      }
    } else {
      message.error(`获取数据失败: ${data.message}`)
    }
  } catch (error) {
    message.error(`获取数据出错:${(error as Error).message}`)
    console.error('获取数据出错:', error)
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

// 刷新数据
function handleRefresh() {
  fetchAnalyzeData(true)
}

// 窗口大小变化时重绘图表
function handleResize() {
  mainChart?.resize()
}

// 监听主题变化
watch(() => themeVars.value, () => {
  nextTick(() => updateChartOption())
}, { deep: true })

// 组件挂载时初始化
onMounted(() => {
  fetchAnalyzeData()
  window.addEventListener('resize', handleResize)
})

// 组件卸载时清理
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  mainChart?.dispose()
})
</script>

<template>
  <div class="analyze-container">
    <!-- 顶部操作栏 -->
    <NSpace align="center" justify="space-between" class="header-actions">
      <NSpace align="center">
        <h2 style="margin: 0; font-weight: 500; font-size: 20px;">
          <NIcon :component="BarChartOutline" style="vertical-align: middle; margin-right: 8px;" />
          数据分析
        </h2>
      </NSpace>
      <NSpace align="center">
        <EventFetcherAlert />
        <NTooltip v-if="lastUpdateTime > 0">
          <template #trigger>
            <NTag size="small" :bordered="false">
              <NIcon :component="TrendingUp" style="margin-right: 4px;" />
              <NTime :time="lastUpdateTime" type="relative" />更新
            </NTag>
          </template>
          <NTime :time="lastUpdateTime" />
        </NTooltip>
        <NButton :loading="refreshing" :disabled="loading" size="small" @click="handleRefresh">
          <template #icon>
            <NIcon :component="RefreshOutline" />
          </template>
          刷新
        </NButton>
      </NSpace>
    </NSpace>

    <!-- 加载骨架屏 -->
    <div v-if="loading" class="skeleton-container">
      <NGrid cols="1 800:2 1200:4" :x-gap="16" :y-gap="16">
        <NGridItem v-for="i in 4" :key="i">
          <NCard size="small">
            <NSkeleton text width="40%" style="margin-bottom: 12px;" />
            <NSkeleton text height="30px" width="80%" />
          </NCard>
        </NGridItem>
      </NGrid>
      <div style="margin-top: 20px;">
        <NSkeleton height="400px" width="100%" border-radius="8px" />
      </div>
    </div>

    <!-- 空状态 -->
    <NEmpty v-else-if="!hasData" description="暂无数据" size="large" style="margin: 60px 0">
      <template #extra>
        <NButton @click="() => fetchAnalyzeData()">
          重新加载
        </NButton>
      </template>
    </NEmpty>

    <!-- 数据展示 -->
    <template v-else>
      <!-- 核心指标卡片 -->
      <div class="core-metrics">
        <NGrid cols="1 600:2 1000:4" :x-gap="16" :y-gap="16">
          <!-- 收入 -->
          <NGridItem>
            <NCard size="small" class="metric-card income-card">
              <div class="metric-content">
                <div class="metric-header">
                  <span class="metric-label">近30天收入</span>
                  <NIcon :component="WalletOutline" class="metric-icon" />
                </div>
                <div class="metric-value">
                  <NNumberAnimation :from="0" :to="summaryData?.last30Days?.totalIncome || 0" :precision="2" />
                  <span class="currency-symbol">¥</span>
                </div>
                <div class="metric-footer">
                  <div class="trend-info">
                    <span :class="getTrendType(summaryData?.last30Days?.incomeTrend || 0)">
                      <NIcon :component="(summaryData?.last30Days?.incomeTrend || 0) >= 0 ? TrendingUp : TrendingDown" />
                      {{ Math.abs(summaryData?.last30Days?.incomeTrend || 0) }}%
                    </span>
                    <span class="trend-label">环比</span>
                  </div>
                  <div class="sub-stat">
                    日均 ¥{{ (summaryData?.last30Days?.dailyAvgIncome || 0).toFixed(0) }}
                  </div>
                </div>
              </div>
            </NCard>
          </NGridItem>

          <!-- 互动 -->
          <NGridItem>
            <NCard size="small" class="metric-card interaction-card">
              <div class="metric-content">
                <div class="metric-header">
                  <span class="metric-label">近30天互动</span>
                  <NIcon :component="ChatbubblesOutline" class="metric-icon" />
                </div>
                <div class="metric-value">
                  <NNumberAnimation :from="0" :to="summaryData?.last30Days?.totalInteractions || 0" show-separator />
                </div>
                <div class="metric-footer">
                  <div class="trend-info">
                    <span :class="getTrendType(summaryData?.last30Days?.interactionTrend || 0)">
                      <NIcon :component="(summaryData?.last30Days?.interactionTrend || 0) >= 0 ? TrendingUp : TrendingDown" />
                      {{ Math.abs(summaryData?.last30Days?.interactionTrend || 0) }}%
                    </span>
                    <span class="trend-label">环比</span>
                  </div>
                  <div class="sub-stat">
                    {{ formatNumber(summaryData?.last30Days?.totalDanmakuCount || 0) }} 弹幕
                  </div>
                </div>
              </div>
            </NCard>
          </NGridItem>

          <!-- 用户 -->
          <NGridItem>
            <NCard size="small" class="metric-card users-card">
              <div class="metric-content">
                <div class="metric-header">
                  <span class="metric-label">互动/付费人数</span>
                  <NIcon :component="PeopleOutline" class="metric-icon" />
                </div>
                <div class="metric-value">
                  <span>{{ formatNumber(summaryData?.last30Days?.interactionUsers || 0) }}</span>
                  <span class="separator">/</span>
                  <span class="highlight">{{ formatNumber(summaryData?.last30Days?.payingUsers || 0) }}</span>
                </div>
                <div class="metric-footer">
                  <div class="trend-info">
                    <NProgress
                      type="line"
                      :percentage="Math.min(100, Math.round(((summaryData?.last30Days?.payingUsers || 0) / (summaryData?.last30Days?.interactionUsers || 1) * 100) * 10) / 10)"
                      :height="6"
                      color="#ff69b4"
                      rail-color="rgba(255, 105, 180, 0.2)"
                      :show-indicator="false"
                      style="width: 60px; margin-right: 8px;"
                    />
                    <span class="trend-label">{{ ((summaryData?.last30Days?.payingUsers || 0) / (summaryData?.last30Days?.interactionUsers || 1) * 100).toFixed(1) }}% 付费率</span>
                  </div>
                </div>
              </div>
            </NCard>
          </NGridItem>

          <!-- 直播 -->
          <NGridItem>
            <NCard size="small" class="metric-card time-card">
              <div class="metric-content">
                <div class="metric-header">
                  <span class="metric-label">近30天直播</span>
                  <NIcon :component="TimeOutline" class="metric-icon" />
                </div>
                <div class="metric-value">
                  {{ ((summaryData?.last30Days?.totalLiveMinutes || 0) / 60).toFixed(1) }}
                  <span class="unit">小时</span>
                </div>
                <div class="metric-footer">
                  <div class="trend-info">
                    <span class="trend-label">活跃 {{ summaryData?.last30Days?.activeLiveDays || 0 }} 天</span>
                  </div>
                  <div class="sub-stat">
                    场均 {{ ((summaryData?.last30Days?.totalLiveMinutes || 0) / (summaryData?.last30Days?.activeLiveDays || 1) / 60).toFixed(1) }}h
                  </div>
                </div>
              </div>
            </NCard>
          </NGridItem>
        </NGrid>
      </div>

      <!-- 图表区域 -->
      <NCard size="small" title="趋势分析" class="chart-card" style="margin-top: 16px;">
        <template #header-extra>
          <NCheckboxGroup v-model:value="selectedMetrics">
            <NSpace>
              <NCheckbox v-for="metric in chartMetrics" :key="metric.value" :value="metric.value">
                <span :style="{ color: metric.color }">{{ metric.label }}</span>
              </NCheckbox>
            </NSpace>
          </NCheckboxGroup>
        </template>
        <div ref="chartRef" class="main-chart" />
      </NCard>

      <!-- 详细数据对比 -->
      <div class="details-section" style="margin-top: 16px;">
        <NGrid cols="1 900:2" :x-gap="16" :y-gap="16">
          <NGridItem>
            <NCard size="small" title="近7天详细数据">
              <template #header-extra>
                <NTag type="info" size="small" :bordered="false">
                  短期表现
                </NTag>
              </template>
              <NDescriptions label-placement="left" :column="2" bordered>
                <NDescriptionsItem label="总收入">
                  {{ formatCurrency(summaryData?.last7Days?.totalIncome || 0) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="日均收入">
                  {{ formatCurrency(summaryData?.last7Days?.dailyAvgIncome || 0) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="总互动">
                  {{ formatNumber(summaryData?.last7Days?.totalInteractions || 0) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="弹幕数">
                  {{ formatNumber(summaryData?.last7Days?.totalDanmakuCount || 0) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="直播时长">
                  {{ ((summaryData?.last7Days?.totalLiveMinutes || 0) / 60).toFixed(1) }}h
                </NDescriptionsItem>
                <NDescriptionsItem label="活跃天数">
                  {{ summaryData?.last7Days?.activeLiveDays || 0 }}天
                </NDescriptionsItem>
                <NDescriptionsItem label="互动人数">
                  {{ formatNumber(summaryData?.last7Days?.interactionUsers || 0) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="付费人数">
                  {{ formatNumber(summaryData?.last7Days?.payingUsers || 0) }}
                </NDescriptionsItem>
              </NDescriptions>
              
              <div class="mini-funnel" style="margin-top: 16px;">
                <div class="funnel-row">
                  <span class="label">互动转化</span>
                  <NProgress
                    type="line"
                    :percentage="Math.min(100, Math.round(((summaryData?.last7Days?.payingUsers || 0) / (summaryData?.last7Days?.interactionUsers || 1) * 100) * 10) / 10)"
                    :height="12"
                    color="#18a058"
                    rail-color="rgba(24, 160, 88, 0.1)"
                  >
                    {{ ((summaryData?.last7Days?.payingUsers || 0) / (summaryData?.last7Days?.interactionUsers || 1) * 100).toFixed(1) }}%
                  </NProgress>
                </div>
              </div>
            </NCard>
          </NGridItem>

          <NGridItem>
            <NCard size="small" title="近30天详细数据">
              <template #header-extra>
                <NTag type="warning" size="small" :bordered="false">
                  中期表现
                </NTag>
              </template>
              <NDescriptions label-placement="left" :column="2" bordered>
                <NDescriptionsItem label="总收入">
                  {{ formatCurrency(summaryData?.last30Days?.totalIncome || 0) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="日均收入">
                  {{ formatCurrency(summaryData?.last30Days?.dailyAvgIncome || 0) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="总互动">
                  {{ formatNumber(summaryData?.last30Days?.totalInteractions || 0) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="弹幕数">
                  {{ formatNumber(summaryData?.last30Days?.totalDanmakuCount || 0) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="直播时长">
                  {{ ((summaryData?.last30Days?.totalLiveMinutes || 0) / 60).toFixed(1) }}h
                </NDescriptionsItem>
                <NDescriptionsItem label="活跃天数">
                  {{ summaryData?.last30Days?.activeLiveDays || 0 }}天
                </NDescriptionsItem>
                <NDescriptionsItem label="互动人数">
                  {{ formatNumber(summaryData?.last30Days?.interactionUsers || 0) }}
                </NDescriptionsItem>
                <NDescriptionsItem label="付费人数">
                  {{ formatNumber(summaryData?.last30Days?.payingUsers || 0) }}
                </NDescriptionsItem>
              </NDescriptions>

              <div class="mini-funnel" style="margin-top: 16px;">
                <div class="funnel-row">
                  <span class="label">互动转化</span>
                  <NProgress
                    type="line"
                    :percentage="Math.min(100, Math.round(((summaryData?.last30Days?.payingUsers || 0) / (summaryData?.last30Days?.interactionUsers || 1) * 100) * 10) / 10)"
                    :height="12"
                    color="#f5a623"
                    rail-color="rgba(245, 166, 35, 0.1)"
                  >
                    {{ ((summaryData?.last30Days?.payingUsers || 0) / (summaryData?.last30Days?.interactionUsers || 1) * 100).toFixed(1) }}%
                  </NProgress>
                </div>
              </div>
            </NCard>
          </NGridItem>
        </NGrid>
      </div>
    </template>
  </div>
</template>

<style scoped>
.analyze-container {
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 4px;
}

.header-actions {
  margin-bottom: 16px;
}

.metric-card {
  height: 100%;
  transition: all 0.3s ease;
  border: 1px solid transparent;
}

.metric-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.metric-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: var(--n-text-color-3);
}

.metric-label {
  font-size: 13px;
}

.metric-icon {
  font-size: 16px;
  opacity: 0.7;
}

.metric-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  display: flex;
  align-items: baseline;
}

.currency-symbol {
  font-size: 14px;
  margin-left: 4px;
  font-weight: normal;
  color: var(--n-text-color-3);
}

.unit {
  font-size: 14px;
  margin-left: 4px;
  font-weight: normal;
  color: var(--n-text-color-3);
}

.separator {
  margin: 0 4px;
  color: var(--n-text-color-3);
  font-size: 16px;
}

.highlight {
  color: #ff69b4;
}

.metric-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  font-size: 12px;
}

.trend-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.success { color: var(--n-success-color); }
.error { color: var(--n-error-color); }
.info { color: var(--n-text-color-3); }

.trend-label {
  color: var(--n-text-color-3);
}

.sub-stat {
  color: var(--n-text-color-3);
}

/* 特定卡片样式微调 */
.income-card .metric-icon { color: #f5a623; }
.interaction-card .metric-icon { color: #2080f0; }
.users-card .metric-icon { color: #ff69b4; }
.time-card .metric-icon { color: #18a058; }

.chart-card {
  min-height: 400px;
}

.main-chart {
  width: 100%;
  height: 400px;
}

.mini-funnel {
  padding: 0 8px;
}

.funnel-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.funnel-row .label {
  font-size: 12px;
  color: var(--n-text-color-3);
  width: 60px;
}
</style>
