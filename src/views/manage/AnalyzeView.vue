<script lang="ts" setup>
import { RefreshOutline, TrendingDown, TrendingUp } from '@vicons/ionicons5'
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
import { NButton, NCard, NDivider, NEmpty, NGrid, NGridItem, NIcon, NSpace, NSpin, NStatistic, NTabPane, NTabs, NTag, NTime, NTooltip, useMessage, useThemeVars } from 'naive-ui'

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
const refreshing = ref(false)
const message = useMessage()
const analyzeData = ref<AnalyzeData>()
const summaryData = computed(() => analyzeData.value?.summary)
const activeChart = ref('income')
const themeVars = useThemeVars()
const lastUpdateTime = ref<number>(0)
const hasData = computed(() => analyzeData.value && Object.keys(analyzeData.value.chartData || {}).length > 0)

// 处理标签页变化
function onTabChange(_value: string) {
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
      bottom: '15%',
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
      nextTick(() => initCharts())
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
  <div class="analyze-container">
    <!-- 顶部操作栏 -->
    <NSpace
      align="center"
      justify="space-between"
      class="header-actions"
    >
      <NSpace align="center">
        <EventFetcherAlert />
        <EventFetcherStatusCard />
      </NSpace>
      <NSpace align="center">
        <NTooltip v-if="lastUpdateTime > 0">
          <template #trigger>
            <NTag size="small" :bordered="false">
              <NIcon :component="TrendingUp" style="margin-right: 4px;" />
              <NTime :time="lastUpdateTime" type="relative" />更新
            </NTag>
          </template>
          <NTime :time="lastUpdateTime" />
        </NTooltip>
        <NButton
          :loading="refreshing"
          :disabled="loading"
          @click="handleRefresh"
        >
          <template #icon>
            <NIcon :component="RefreshOutline" />
          </template>
          刷新数据
        </NButton>
      </NSpace>
    </NSpace>
    <NDivider />

    <NSpin :show="loading">
      <!-- 空状态 -->
      <NEmpty
        v-if="!loading && !hasData"
        description="暂无数据"
        size="large"
        style="margin: 60px 0"
      >
        <template #extra>
          <NButton @click="() => fetchAnalyzeData()">
            重新加载
          </NButton>
        </template>
      </NEmpty>

      <!-- 数据展示 -->
      <template v-else>
        <!-- 数据概览卡片 -->
        <div class="summary-cards">
          <NGrid
            cols="1 800:2 1200:3"
            :x-gap="16"
            :y-gap="16"
          >
            <NGridItem>
              <NCard
                title="近7天统计"
                size="small"
                class="summary-card"
                hoverable
              >
                <template #header-extra>
                  <NTag :bordered="false" size="small" type="info">
                    最近一周
                  </NTag>
                </template>
                <div class="stat-grid">
                  <NStatistic
                    label="总收入"
                    tabular-nums
                  >
                    <template #default>
                      <span class="stat-value-primary">
                        {{ formatCurrency(summaryData?.last7Days?.totalIncome || 0) }}
                      </span>
                    </template>
                  </NStatistic>
                  <NStatistic
                    label="总互动数"
                    :value="summaryData?.last7Days?.totalInteractions || 0"
                    tabular-nums
                  />
                  <NStatistic
                    label="弹幕数"
                    :value="summaryData?.last7Days?.totalDanmakuCount || 0"
                    tabular-nums
                  />
                  <NStatistic
                    label="直播时长"
                    tabular-nums
                  >
                    <template #default>
                      {{ ((summaryData?.last7Days?.totalLiveMinutes || 0) / 60).toFixed(1) }} 小时
                    </template>
                  </NStatistic>
                  <NStatistic
                    label="互动人数"
                    :value="summaryData?.last7Days?.interactionUsers || 0"
                    tabular-nums
                  >
                    <template #suffix>
                      <NTag
                        :type="getTrendType(summaryData?.last7Days?.interactionUsersTrend || 0)"
                        size="small"
                        :bordered="false"
                      >
                        <NIcon v-if="(summaryData?.last7Days?.interactionUsersTrend || 0) > 0" :component="TrendingUp" style="vertical-align: -0.15em; margin-right: 2px;" />
                        <NIcon v-else-if="(summaryData?.last7Days?.interactionUsersTrend || 0) < 0" :component="TrendingDown" style="vertical-align: -0.15em; margin-right: 2px;" />
                        {{ formatTrend(summaryData?.last7Days?.interactionUsersTrend || 0) }}
                      </NTag>
                    </template>
                  </NStatistic>
                  <NStatistic
                    label="付费人数"
                    :value="summaryData?.last7Days?.payingUsers || 0"
                    tabular-nums
                  >
                    <template #suffix>
                      <NTag
                        :type="getTrendType(summaryData?.last7Days?.payingUsersTrend || 0)"
                        size="small"
                        :bordered="false"
                      >
                        <NIcon v-if="(summaryData?.last7Days?.payingUsersTrend || 0) > 0" :component="TrendingUp" style="vertical-align: -0.15em; margin-right: 2px;" />
                        <NIcon v-else-if="(summaryData?.last7Days?.payingUsersTrend || 0) < 0" :component="TrendingDown" style="vertical-align: -0.15em; margin-right: 2px;" />
                        {{ formatTrend(summaryData?.last7Days?.payingUsersTrend || 0) }}
                      </NTag>
                    </template>
                  </NStatistic>
                  <NStatistic
                    label="日均收入"
                    tabular-nums
                  >
                    <template #default>
                      {{ formatCurrency(summaryData?.last7Days?.dailyAvgIncome || 0) }}
                    </template>
                  </NStatistic>
                  <NStatistic
                    label="日均弹幕"
                    :value="(summaryData?.last7Days?.dailyAvgDanmaku || 0).toFixed(0)"
                    tabular-nums
                  />
                  <NStatistic
                    label="活跃直播天数"
                    :value="summaryData?.last7Days?.activeLiveDays || 0"
                    tabular-nums
                  />
                </div>
              </NCard>
            </NGridItem>

            <NGridItem>
              <NCard
                title="近30天统计"
                size="small"
                class="summary-card"
                hoverable
              >
                <template #header-extra>
                  <NTag :bordered="false" size="small" type="warning">
                    最近一月
                  </NTag>
                </template>
                <div class="stat-grid">
                  <NStatistic
                    label="总收入"
                    tabular-nums
                  >
                    <template #default>
                      <span class="stat-value-primary">
                        {{ formatCurrency(summaryData?.last30Days?.totalIncome || 0) }}
                      </span>
                    </template>
                  </NStatistic>
                  <NStatistic
                    label="总互动数"
                    :value="summaryData?.last30Days?.totalInteractions || 0"
                    tabular-nums
                  />
                  <NStatistic
                    label="弹幕数"
                    :value="summaryData?.last30Days?.totalDanmakuCount || 0"
                    tabular-nums
                  />
                  <NStatistic
                    label="直播时长"
                    tabular-nums
                  >
                    <template #default>
                      {{ ((summaryData?.last30Days?.totalLiveMinutes || 0) / 60).toFixed(1) }} 小时
                    </template>
                  </NStatistic>
                  <NStatistic
                    label="互动人数"
                    :value="summaryData?.last30Days?.interactionUsers || 0"
                    tabular-nums
                  >
                    <template #suffix>
                      <NTag
                        :type="getTrendType(summaryData?.last30Days?.interactionTrend || 0)"
                        size="small"
                        :bordered="false"
                      >
                        <NIcon v-if="(summaryData?.last30Days?.interactionTrend || 0) > 0" :component="TrendingUp" style="vertical-align: -0.15em; margin-right: 2px;" />
                        <NIcon v-else-if="(summaryData?.last30Days?.interactionTrend || 0) < 0" :component="TrendingDown" style="vertical-align: -0.15em; margin-right: 2px;" />
                        {{ formatTrend(summaryData?.last30Days?.interactionTrend || 0) }}
                      </NTag>
                    </template>
                  </NStatistic>
                  <NStatistic
                    label="付费人数"
                    :value="summaryData?.last30Days?.payingUsers || 0"
                    tabular-nums
                  >
                    <template #suffix>
                      <NTag
                        :type="getTrendType(summaryData?.last30Days?.incomeTrend || 0)"
                        size="small"
                        :bordered="false"
                      >
                        <NIcon v-if="(summaryData?.last30Days?.incomeTrend || 0) > 0" :component="TrendingUp" style="vertical-align: -0.15em; margin-right: 2px;" />
                        <NIcon v-else-if="(summaryData?.last30Days?.incomeTrend || 0) < 0" :component="TrendingDown" style="vertical-align: -0.15em; margin-right: 2px;" />
                        {{ formatTrend(summaryData?.last30Days?.incomeTrend || 0) }}
                      </NTag>
                    </template>
                  </NStatistic>
                  <NStatistic
                    label="日均收入"
                    tabular-nums
                  >
                    <template #default>
                      {{ formatCurrency(summaryData?.last30Days?.dailyAvgIncome || 0) }}
                    </template>
                  </NStatistic>
                  <NStatistic
                    label="日均弹幕"
                    :value="(summaryData?.last30Days?.dailyAvgDanmaku || 0).toFixed(0)"
                    tabular-nums
                  />
                  <NStatistic
                    label="活跃直播天数"
                    :value="summaryData?.last30Days?.activeLiveDays || 0"
                    tabular-nums
                  />
                </div>
              </NCard>
            </NGridItem>

            <NGridItem>
              <NCard
                title="关键指标"
                size="small"
                class="summary-card summary-card-highlight"
                hoverable
              >
                <template #header-extra>
                  <NTag :bordered="false" size="small" type="success">
                    核心数据
                  </NTag>
                </template>
                <div class="stat-grid">
                  <NStatistic
                    label="月收入增长"
                    tabular-nums
                  >
                    <template #default>
                      <span class="trend-value" :class="(summaryData?.last30Days?.incomeTrend || 0) >= 0 ? 'trend-up' : 'trend-down'">
                        {{ formatTrend(summaryData?.last30Days?.incomeTrend || 0) }}
                      </span>
                    </template>
                    <template #prefix>
                      <NIcon :color="(summaryData?.last30Days?.incomeTrend || 0) >= 0 ? '#18A058' : '#D03050'">
                        <TrendingUp v-if="(summaryData?.last30Days?.incomeTrend || 0) >= 0" />
                        <TrendingDown v-else />
                      </NIcon>
                    </template>
                  </NStatistic>
                  <NStatistic
                    label="月互动增长"
                    tabular-nums
                  >
                    <template #default>
                      <span class="trend-value" :class="(summaryData?.last30Days?.interactionTrend || 0) >= 0 ? 'trend-up' : 'trend-down'">
                        {{ formatTrend(summaryData?.last30Days?.interactionTrend || 0) }}
                      </span>
                    </template>
                    <template #prefix>
                      <NIcon
                        :component="(summaryData?.last30Days?.interactionTrend || 0) >= 0 ? TrendingUp : TrendingDown"
                        :color="(summaryData?.last30Days?.interactionTrend || 0) >= 0 ? '#18A058' : '#D03050'"
                      />
                    </template>
                  </NStatistic>
                  <NStatistic
                    label="单次直播平均时长"
                    tabular-nums
                  >
                    <template #default>
                      {{ ((summaryData?.last30Days?.totalLiveMinutes || 0) / (summaryData?.last30Days?.activeLiveDays || 1) / 60).toFixed(1) }} 小时
                    </template>
                  </NStatistic>
                  <NStatistic
                    label="互动转化率"
                    tabular-nums
                  >
                    <template #default>
                      {{ ((summaryData?.last30Days?.payingUsers || 0) / (summaryData?.last30Days?.interactionUsers || 1) * 100).toFixed(1) }}%
                    </template>
                  </NStatistic>
                  <NStatistic
                    label="每付费用户平均收入"
                    tabular-nums
                  >
                    <template #default>
                      {{ formatCurrency((summaryData?.last30Days?.totalIncome || 0) / (summaryData?.last30Days?.payingUsers || 1)) }}
                    </template>
                  </NStatistic>
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
      </template>
    </NSpin>
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
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.analyze-card {
  margin-bottom: 20px;
}

.summary-cards {
  margin-bottom: 20px;
}

.summary-card {
  height: 100%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
}

.summary-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transform: translateY(-4px);
}

.summary-card-highlight {
  background: linear-gradient(135deg, rgba(24, 160, 88, 0.03) 0%, rgba(24, 160, 88, 0.01) 100%);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.stat-value-primary {
  font-size: 1.2em;
  font-weight: 600;
  color: var(--n-text-color);
}

.trend-value {
  font-weight: 600;
  font-size: 1.1em;
  transition: all 0.3s;
}

.trend-up {
  color: #18A058;
}

.trend-down {
  color: #D03050;
}

.chart-selector {
  margin-top: 20px;
  border-radius: 8px;
  overflow: hidden;
}

.chart {
  height: 500px;
  width: 100%;
  margin-top: 10px;
  transition: height 0.3s ease;
}

/* 响应式设计 */
@media (max-width: 1400px) {
  .chart {
    height: 450px;
  }
}

@media (max-width: 1024px) {
  .chart {
    height: 400px;
  }
}

@media (max-width: 768px) {
  .analyze-container {
    padding: 0;
  }

  .stat-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .chart {
    height: 350px;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch !important;
  }

  .header-actions :deep(.n-space) {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 480px) {
  .chart {
    height: 300px;
  }

  .stat-value-primary {
    font-size: 1.1em;
  }

  .trend-value {
    font-size: 1em;
  }
}

/* 骨架屏动画 */
@keyframes skeleton-loading {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
}

/* 标签优化 */
:deep(.n-statistic-value__prefix) {
  margin-right: 8px;
  display: inline-flex;
  align-items: center;
}

:deep(.n-statistic-value__suffix) {
  margin-left: 8px;
}

/* 图表容器优化 */
:deep(.n-tabs-nav) {
  padding: 0 12px;
}

/* 卡片标题优化 */
:deep(.n-card-header__main) {
  font-weight: 600;
  font-size: 1.05em;
}

/* Hover效果 */
.summary-card :deep(.n-statistic) {
  transition: transform 0.2s;
}

.summary-card:hover :deep(.n-statistic) {
  transform: scale(1.02);
}
</style>
