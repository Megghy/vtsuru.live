<script lang="ts" setup>
import { TrendingDown, TrendingUp } from '@vicons/ionicons5'
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
import { NCard, NDivider, NGrid, NGridItem, NIcon, NSpace, NSpin, NStatistic, NTabPane, NTabs, NTag, useMessage, useThemeVars } from 'naive-ui'

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { QueryGetAPI } from '@/api/query'
import { ANALYZE_API_URL } from '@/data/constants'

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
const message = useMessage()
const analyzeData = ref<AnalyzeData>()
const summaryData = computed(() => analyzeData.value?.summary)
const activeChart = ref('income')
const themeVars = useThemeVars()

// 处理标签页变化
function onTabChange(value: string) {
  nextTick(() => {
    handleResize()
  })
}

// 图表引用
const incomeChartRef = ref<HTMLElement | null>(null)
const interactionChartRef = ref<HTMLElement | null>(null)
const usersChartRef = ref<HTMLElement | null>(null)

// 图表实例
let incomeChart: echarts.ECharts | null = null
let interactionChart: echarts.ECharts | null = null
let usersChart: echarts.ECharts | null = null

// 格式化工具函数
function formatCurrency(value: number): string {
  return `¥${value.toFixed(2)}`
}

function formatTrend(value: number): string {
  return value >= 0 ? `+${value}%` : `${value}%`
}

function getTrendType(value: number): 'success' | 'error' | 'info' {
  if (value > 0) return 'success'
  if (value < 0) return 'error'
  return 'info'
}

// 格式化时间戳为日期
function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return `${date.getMonth() + 1}/${date.getDate()}`
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
    seriesColors: [
      themeVars.value.primaryColor,
      themeVars.value.infoColor,
      themeVars.value.successColor,
      themeVars.value.warningColor,
      themeVars.value.errorColor,
    ],
  }
}

// 初始化图表
function initCharts() {
  const chartData = getChartDataArray()
  if (chartData.length === 0) return

  const dates = chartData.map(item => item.date)
  const themeColors = getThemeColors()

  const baseOption = {
    textStyle: {
      color: themeColors.textColor,
    },
    legend: {
      textStyle: {
        color: themeColors.textColor,
      },
    },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: {
        lineStyle: {
          color: themeColors.axisLineColor,
        },
      },
      axisLabel: {
        color: themeColors.textColor,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: {
        lineStyle: {
          color: themeColors.axisLineColor,
        },
      },
      splitLine: {
        lineStyle: {
          color: themeColors.splitLineColor,
        },
      },
      axisLabel: {
        color: themeColors.textColor,
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: themeVars.value.cardColor,
      borderColor: themeVars.value.borderColor,
      textStyle: {
        color: themeColors.textColor,
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '60px',
      containLabel: true,
    },
    color: themeColors.seriesColors,
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
      },
      {
        start: 0,
        end: 100,
      },
    ],
  }

  // 收入图表
  if (incomeChartRef.value) {
    incomeChart = echarts.init(incomeChartRef.value)
    incomeChart.setOption({
      ...baseOption,
      title: {
        text: '收益趋势',
        textStyle: {
          color: themeColors.textColor,
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        name: '收益(元)',
        nameTextStyle: {
          color: themeColors.textColor,
        },
      },
      series: [
        {
          name: '收益',
          type: 'line',
          data: chartData.map(item => item.income),
          areaStyle: {
            opacity: 0.3,
          },
          smooth: true,
          markPoint: {
            data: [
              { type: 'max', name: '最高值' },
              { type: 'min', name: '最低值' },
            ],
          },
          markLine: {
            data: [
              { type: 'average', name: '平均值' },
            ],
          },
        },
      ],
    })
  }

  // 互动图表
  if (interactionChartRef.value) {
    interactionChart = echarts.init(interactionChartRef.value)
    interactionChart.setOption({
      ...baseOption,
      title: {
        text: '互动趋势',
        textStyle: {
          color: themeColors.textColor,
        },
      },
      legend: {
        data: ['互动数', '弹幕数', '点赞数'],
        textStyle: {
          color: themeColors.textColor,
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        name: '数量',
        nameTextStyle: {
          color: themeColors.textColor,
        },
      },
      series: [
        {
          name: '互动数',
          type: 'line',
          data: chartData.map(item => item.interactionCount),
          smooth: true,
        },
        {
          name: '弹幕数',
          type: 'line',
          data: chartData.map(item => item.danmakuCount),
          smooth: true,
        },
        {
          name: '点赞数',
          type: 'line',
          data: chartData.map(item => item.likeCount),
          smooth: true,
        },
      ],
    })
  }

  // 用户图表
  if (usersChartRef.value) {
    usersChart = echarts.init(usersChartRef.value)
    usersChart.setOption({
      ...baseOption,
      title: {
        text: '用户趋势',
        textStyle: {
          color: themeColors.textColor,
        },
      },
      legend: {
        data: ['互动用户', '付费用户'],
        textStyle: {
          color: themeColors.textColor,
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        name: '用户数',
        nameTextStyle: {
          color: themeColors.textColor,
        },
      },
      series: [
        {
          name: '互动用户',
          type: 'bar',
          data: chartData.map(item => item.interactionUsers),
          barMaxWidth: '40%',
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
          },
        },
        {
          name: '付费用户',
          type: 'bar',
          data: chartData.map(item => item.payingUsers),
          barMaxWidth: '40%',
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
          },
        },
      ],
    })
  }
}

// 更新图表主题
function updateChartTheme() {
  const themeColors = getThemeColors();

  [incomeChart, interactionChart, usersChart].forEach((chart) => {
    if (!chart) return

    const option = chart.getOption()

    // 更新文本颜色
    option.textStyle = { color: themeColors.textColor }

    // 更新标题颜色
    if (option.title && Array.isArray(option.title) && option.title[0]) {
      option.title[0].textStyle = { color: themeColors.textColor }
    }

    // 更新坐标轴颜色
    if (option.xAxis && Array.isArray(option.xAxis) && option.xAxis[0]) {
      option.xAxis[0].axisLine.lineStyle.color = themeColors.axisLineColor
      option.xAxis[0].axisLabel.color = themeColors.textColor
    }

    if (option.yAxis && Array.isArray(option.yAxis) && option.yAxis[0]) {
      option.yAxis[0].axisLine.lineStyle.color = themeColors.axisLineColor
      option.yAxis[0].splitLine.lineStyle.color = themeColors.splitLineColor
      option.yAxis[0].axisLabel.color = themeColors.textColor
      option.yAxis[0].nameTextStyle = { color: themeColors.textColor }
    }

    // 更新图例颜色
    if (option.legend && Array.isArray(option.legend) && option.legend[0]) {
      option.legend[0].textStyle = { color: themeColors.textColor }
    }

    // 更新提示框颜色
    if (option.tooltip && Array.isArray(option.tooltip) && option.tooltip[0]) {
      option.tooltip[0].backgroundColor = themeVars.value.cardColor
      option.tooltip[0].borderColor = themeVars.value.borderColor
      option.tooltip[0].textStyle = { color: themeColors.textColor }
    }

    // 更新系列颜色
    option.color = themeColors.seriesColors

    chart.setOption(option)
  })
}

// 获取分析数据
async function fetchAnalyzeData() {
  try {
    loading.value = true
    const data = await QueryGetAPI<AnalyzeData>(`${ANALYZE_API_URL}all`)

    if (data.code === 200) {
      analyzeData.value = data.data
      nextTick(() => initCharts())
    } else {
      message.error(`获取数据失败: ${data.message}`)
    }
  } catch (error) {
    message.error(`获取数据出错:${(error as Error).message}`)
    console.error('获取数据出错:', error)
  } finally {
    loading.value = false
  }
}

// 窗口大小变化时重绘图表
function handleResize() {
  incomeChart?.resize()
  interactionChart?.resize()
  usersChart?.resize()
}

// 监听主题变化
watch(() => themeVars.value, () => {
  nextTick(() => updateChartTheme())
}, { deep: true })

// 组件挂载时初始化
onMounted(() => {
  fetchAnalyzeData()
  window.addEventListener('resize', handleResize)
})

// 组件卸载时清理
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  incomeChart?.dispose()
  interactionChart?.dispose()
  usersChart?.dispose()
})
</script>

<template>
  <div>
    <NSpace
      align="center"
    >
      <EventFetcherAlert />
      <EventFetcherStatusCard />
    </NSpace>
    <NDivider />
    <NSpin :show="loading">
      <!-- 数据概览卡片 -->
      <div class="summary-cards">
        <NGrid
          cols="1 800:2 1200:3"
          :x-gap="12"
          :y-gap="12"
        >
          <NGridItem>
            <NCard
              title="近7天统计"
              size="small"
              class="summary-card"
            >
              <div class="stat-grid">
                <NStatistic
                  label="总收入"
                  :value="formatCurrency(summaryData?.last7Days?.totalIncome || 0)"
                />
                <NStatistic
                  label="总互动数"
                  :value="summaryData?.last7Days?.totalInteractions || 0"
                />
                <NStatistic
                  label="弹幕数"
                  :value="summaryData?.last7Days?.totalDanmakuCount || 0"
                />
                <NStatistic
                  label="直播时长(小时)"
                  :value="((summaryData?.last7Days?.totalLiveMinutes || 0) / 60).toFixed(1)"
                />
                <NStatistic
                  label="互动人数"
                  :value="summaryData?.last7Days?.interactionUsers || 0"
                >
                  <template #suffix>
                    <NTag
                      :type="getTrendType(summaryData?.last7Days?.interactionUsersTrend || 0)"
                      size="small"
                    >
                      {{ formatTrend(summaryData?.last7Days?.interactionUsersTrend || 0) }}
                    </NTag>
                  </template>
                </NStatistic>
                <NStatistic
                  label="付费人数"
                  :value="summaryData?.last7Days?.payingUsers || 0"
                >
                  <template #suffix>
                    <NTag
                      :type="getTrendType(summaryData?.last7Days?.payingUsersTrend || 0)"
                      size="small"
                    >
                      {{ formatTrend(summaryData?.last7Days?.payingUsersTrend || 0) }}
                    </NTag>
                  </template>
                </NStatistic>
                <NStatistic
                  label="日均收入"
                  :value="formatCurrency(summaryData?.last7Days?.dailyAvgIncome || 0)"
                />
                <NStatistic
                  label="日均弹幕"
                  :value="summaryData?.last7Days?.dailyAvgDanmaku || 0"
                />
                <NStatistic
                  label="活跃直播天数"
                  :value="summaryData?.last7Days?.activeLiveDays || 0"
                />
              </div>
            </NCard>
          </NGridItem>
          <NGridItem>
            <NCard
              title="近30天统计"
              size="small"
              class="summary-card"
            >
              <div class="stat-grid">
                <NStatistic
                  label="总收入"
                  :value="formatCurrency(summaryData?.last30Days?.totalIncome || 0)"
                />
                <NStatistic
                  label="总互动数"
                  :value="summaryData?.last30Days?.totalInteractions || 0"
                />
                <NStatistic
                  label="弹幕数"
                  :value="summaryData?.last30Days?.totalDanmakuCount || 0"
                />
                <NStatistic
                  label="直播时长(小时)"
                  :value="((summaryData?.last30Days?.totalLiveMinutes || 0) / 60).toFixed(1)"
                />
                <NStatistic
                  label="互动人数"
                  :value="summaryData?.last30Days?.interactionUsers || 0"
                >
                  <template #suffix>
                    <NTag
                      :type="getTrendType(summaryData?.last30Days?.interactionTrend || 0)"
                      size="small"
                    >
                      {{ formatTrend(summaryData?.last30Days?.interactionTrend || 0) }}
                    </NTag>
                  </template>
                </NStatistic>
                <NStatistic
                  label="付费人数"
                  :value="summaryData?.last30Days?.payingUsers || 0"
                >
                  <template #suffix>
                    <NTag
                      :type="getTrendType(summaryData?.last30Days?.incomeTrend || 0)"
                      size="small"
                    >
                      {{ formatTrend(summaryData?.last30Days?.incomeTrend || 0) }}
                    </NTag>
                  </template>
                </NStatistic>
                <NStatistic
                  label="日均收入"
                  :value="formatCurrency(summaryData?.last30Days?.dailyAvgIncome || 0)"
                />
                <NStatistic
                  label="日均弹幕"
                  :value="summaryData?.last30Days?.dailyAvgDanmaku || 0"
                />
                <NStatistic
                  label="活跃直播天数"
                  :value="summaryData?.last30Days?.activeLiveDays || 0"
                />
              </div>
            </NCard>
          </NGridItem>
          <NGridItem>
            <NCard
              title="关键指标"
              size="small"
              class="summary-card"
            >
              <div class="stat-grid">
                <NStatistic
                  label="月收入增长"
                  :value="formatTrend(summaryData?.last30Days?.incomeTrend || 0)"
                >
                  <template #prefix>
                    <NIcon :color="(summaryData?.last30Days?.incomeTrend || 0) >= 0 ? '#18A058' : '#D03050'">
                      <TrendingUp v-if="(summaryData?.last30Days?.incomeTrend || 0) >= 0" />
                      <TrendingDown v-else />
                    </NIcon>
                  </template>
                </NStatistic>
                <NStatistic
                  label="月互动增长"
                  :value="formatTrend(summaryData?.last30Days?.interactionTrend || 0)"
                >
                  <template #prefix>
                    <NIcon
                      :component="(summaryData?.last30Days?.interactionTrend || 0) >= 0 ? TrendingUp : TrendingDown"
                      :color="(summaryData?.last30Days?.interactionTrend || 0) >= 0 ? '#18A058' : '#D03050'"
                    >
                      <TrendingUp v-if="(summaryData?.last30Days?.interactionTrend || 0) >= 0" />
                      <TrendingDown v-else />
                    </NIcon>
                  </template>
                </NStatistic>
                <NStatistic
                  label="单次直播平均时长"
                  :value="`${((summaryData?.last30Days?.totalLiveMinutes || 0) / (summaryData?.last30Days?.activeLiveDays || 1) / 60).toFixed(1)}小时`"
                />
                <NStatistic
                  label="互动转化率"
                  :value="`${((summaryData?.last30Days?.payingUsers || 0) / (summaryData?.last30Days?.interactionUsers || 1) * 100).toFixed(1)}%`"
                />
                <NStatistic
                  label="每付费用户平均打米"
                  :value="formatCurrency((summaryData?.last30Days?.totalIncome || 0) / (summaryData?.last30Days?.payingUsers || 1))"
                />
              </div>
            </NCard>
          </NGridItem>
        </NGrid>
      </div>
      <NDivider />
      <!-- 图表选择器 -->
      <div class="chart-selector">
        <NTabs
          v-model:value="activeChart"
          type="line"
          animated
          @update:value="onTabChange"
        >
          <NTabPane
            name="income"
            tab="收入分析"
            display-directive="show"
          >
            <div
              ref="incomeChartRef"
              class="chart"
            />
          </NTabPane>
          <NTabPane
            name="interaction"
            tab="互动分析"
            display-directive="show"
          >
            <div
              ref="interactionChartRef"
              class="chart"
            />
          </NTabPane>
          <NTabPane
            name="users"
            tab="用户分析"
            display-directive="show"
          >
            <div
              ref="usersChartRef"
              class="chart"
            />
          </NTabPane>
        </NTabs>
      </div>
      <NDivider />
    </NSpin>
  </div>
</template>

<style scoped>
.analyze-card {
  margin-bottom: 20px;
}

.summary-cards {
  margin-bottom: 20px;
}

.summary-card {
  height: 100%;
  transition: all 0.3s;
}

.summary-card:hover {
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.chart-selector {
  margin-top: 20px;
}

.chart {
  height: 450px;
  width: 100%;
  margin-top: 10px;
}

@media (max-width: 768px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
