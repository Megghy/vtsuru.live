<script setup lang="ts">
import { Info24Filled } from '@vicons/fluent'
import { addDays, endOfDay, format, startOfDay } from 'date-fns'
import { BarChart, LineChart } from 'echarts/charts'
import {
  DataZoomComponent, GridComponent, LegendComponent, TitleComponent, ToolboxComponent, TooltipComponent, } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { NAlert, NButton, NCard, NDatePicker, NDivider, NIcon, NFlex, NSpin, NText, NTime, NTooltip, useMessage, useThemeVars } from 'naive-ui';
import { computed, onMounted, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import { HISTORY_API_URL } from '@/shared/config'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'

// 初始化ECharts组件
use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  LineChart,
  ToolboxComponent,
  BarChart,
])

// 定义数据模型类型
interface HistoryModel {
  fan: {
    records: HistoryRecordModel[]
    updateAt: number
  }
  guard: {
    records: HistoryRecordModel[]
    updateAt: number
  }
  upstat: {
    records: HistoryUpstatRecordModel[]
    updateAt: number
  }
}

interface HistoryRecordModel {
  time: number
  count: number
}

interface HistoryUpstatRecordModel {
  time: number
  stats: {
    views: number
    likes: number
  }
}

const accountInfo = useAccount()
const message = useMessage()
const themeVars = useThemeVars()

// 历史数据引用
const fansHistory = ref<HistoryRecordModel[]>()
const guardHistory = ref<HistoryRecordModel[]>()
const upstatHistory = ref<HistoryUpstatRecordModel[]>()

// 更新时间引用
const fansUpdateAt = ref(0)
const guardUpdateAt = ref(0)
const upstatUpdateAt = ref(0)

// 图表配置引用
const fansOption = ref()
const guardsOption = ref()
const upstatViewOption = ref()
const upstatLikeOption = ref()

const isLoading = ref(true)

// 统计开始日期
const statisticStartDate = new Date(2023, 10, 4)
const statisticStartDateTime = statisticStartDate.getTime()

// 日期范围选择（毫秒时间戳区间）
const dateRange = ref<[number, number] | null>(null)
const dateShortcuts: Record<string, [number, number] | (() => [number, number])> = {
  最近7天: () => {
    const end = endOfDay(new Date()).getTime()
    const start = startOfDay(addDays(new Date(), -6)).getTime()
    return [start, end] as [number, number]
  },
  最近30天: () => {
    const end = endOfDay(new Date()).getTime()
    const start = startOfDay(addDays(new Date(), -29)).getTime()
    return [start, end] as [number, number]
  },
  最近90天: () => {
    const end = endOfDay(new Date()).getTime()
    const start = startOfDay(addDays(new Date(), -89)).getTime()
    return [start, end] as [number, number]
  },
}

// 响应式图表高度
const chartHeight = computed(() => {
  // 可以根据窗口大小动态调整图表高度
  return window.innerWidth < 768 ? '250px' : '300px'
})

/**
 * 获取所有历史数据
 */
async function getHistory() {
  try {
    const response = await QueryGetAPI<HistoryModel>(`${HISTORY_API_URL}get-all`)
    if (response.code === 200) {
      fansHistory.value = response.data.fan.records
      guardHistory.value = response.data.guard.records
      upstatHistory.value = response.data.upstat.records
      fansUpdateAt.value = response.data.fan.updateAt
      guardUpdateAt.value = response.data.guard.updateAt
      upstatUpdateAt.value = response.data.upstat.updateAt
    } else {
      message.error(`加载失败: ${response.message}`)
    }
  } catch {
    message.error('加载失败')
  }
}

/**
 * 获取基础图表配置
 */
function getBaseChartOptions() {
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: themeVars.value.textColor3,
        },
      },
    },
    textStyle: {
      color: themeVars.value.textColor2,
    },
    toolbox: {
      feature: {
        dataView: { show: true, readOnly: false },
        magicType: { show: true, type: ['line', 'bar'] },
        restore: { show: true },
        saveAsImage: { show: true },
      },
    },
    legend: {},
    dataZoom: [
      {
        show: true,
        realtime: true,
        start: 0,
        end: 100,
        xAxisIndex: [0, 1],
      },
    ],
  }
}

/**
 * 生成每日时间序列数据的通用函数
 * @param historyData 原始历史记录
 * @param startTime 开始时间
 * @param endTime 结束时间
 * @param initialTimeIndex 起始索引
 * @param initialCount 初始计数值
 */
function generateTimeSeries(
  historyData: HistoryRecordModel[],
  startTime: Date,
  endTime: Date,
  initialTimeIndex: number,
  initialCount: number,
) {
  const timeSeries: { time: Date, count: number, change: boolean, exist: boolean }[] = []
  let lastDayCount = initialCount
  let lastTimeIndex = initialTimeIndex
  let currentTime = startTime

  while (currentTime <= endTime) {
    const dayEndTime = endOfDay(currentTime).getTime()
    let dayExist = false

    while (true) {
      const data = historyData[lastTimeIndex]
      if (!data) {
        break
      }

      if ((historyData[lastTimeIndex + 1]?.time ?? Number.MAX_VALUE) > dayEndTime) {
        const _changed = data.count !== lastDayCount
        lastDayCount = data.count
        dayExist = true
        break
      }
      lastTimeIndex++
    }

    timeSeries.push({
      time: currentTime,
      count: lastDayCount,
      change: lastDayCount !== (timeSeries[timeSeries.length - 1]?.count ?? initialCount),
      exist: dayExist,
    })

    currentTime = addDays(currentTime, 1)
  }

  return timeSeries
}

/**
 * 处理粉丝历史数据并生成图表选项
 */
function processFansChartOptions() {
  if (!fansHistory.value || fansHistory.value.length === 0) return

  let startTimeBase = new Date(accountInfo.value?.createAt ?? Date.now())
  startTimeBase = startTimeBase < statisticStartDate ? statisticStartDate : startTimeBase
  const startTime = startOfDay(dateRange.value ? new Date(dateRange.value[0]) : startTimeBase)
  const endTime = dateRange.value ? new Date(dateRange.value[1]) : new Date()

  if (startTime > endTime) {
    fansOption.value = { ...getBaseChartOptions(), series: [] } // Simplified empty state
    return
  }

  const initialIndex = fansHistory.value.findIndex(entry => entry.time >= statisticStartDateTime)
  const initialCount = initialIndex >= 0 ? fansHistory.value[initialIndex].count : 0

  const completeTimeSeries = generateTimeSeries(fansHistory.value, startTime, endTime, initialIndex, initialCount)

  const fansIncreacement: { time: Date, count: number }[] = []
  let previousDayCount = completeTimeSeries[0]?.count ?? 0
  completeTimeSeries.forEach((entry, index) => {
    if (index > 0) {
      const dailyIncrement = entry.count - previousDayCount
      fansIncreacement.push({ time: startOfDay(entry.time), count: dailyIncrement })
    }
    previousDayCount = entry.count
  })

  const chartData = {
    xAxisData: completeTimeSeries.map(entry => format(entry.time, 'yyyy-MM-dd')),
    seriesData: completeTimeSeries.map(entry => entry.count),
    incrementData: fansIncreacement.map(entry => entry.count),
  }

  fansOption.value = {
    ...getBaseChartOptions(),
    tooltip: {
      ...getBaseChartOptions().tooltip,
      formatter: (param: any) => {
        const name = `${param[0].name}<br>`
        let str = ''
        for (let i = 0; i < param.length; i++) {
          const status
            = param[i].seriesName === '粉丝数' ? (completeTimeSeries[param[i].dataIndex].exist ? '' : '(未获取)') : ''
          const statusHtml = status === '' ? '' : `&nbsp;<span style="color:${themeVars.value.textColor3}">${status}</span>`
          str += `${param[i].marker + param[i].seriesName}：${param[i].data}${statusHtml}<br>`
        }
        return name + str
      },
    },
    yAxis: [
      { type: 'value', name: '粉丝数', min: 'dataMin' },
      { type: 'value', name: '每日增量' },
    ],
    xAxis: [
      { type: 'category', data: chartData.xAxisData },
      { type: 'category', data: chartData.xAxisData.slice(1) }, // Align increments
    ],
    series: [
      {
        name: '粉丝数',
        type: 'line',
        data: chartData.seriesData,
        itemStyle: {
          color: (data: any) => {
            const item = completeTimeSeries[data.dataIndex]
            return !item.exist ? themeVars.value.textColor3 : item.change ? themeVars.value.successColor : themeVars.value.primaryColor
          },
        },
      },
      {
        name: '增量 /日',
        type: 'bar',
        yAxisIndex: 1,
        xAxisIndex: 1,
        data: chartData.incrementData,
        itemStyle: { color: (params: any) => (params.value < 0 ? themeVars.value.errorColor : themeVars.value.infoColor) },
      },
    ],
  }
}

/**
 * 处理舰长历史数据并生成图表选项
 */
function processGuardsChartOptions() {
  if (!guardHistory.value || guardHistory.value.length === 0) return

  let startTimeBase = new Date(accountInfo.value?.createAt ?? Date.now())
  startTimeBase = startTimeBase < statisticStartDate ? statisticStartDate : startTimeBase
  const startTime = startOfDay(dateRange.value ? new Date(dateRange.value[0]) : startTimeBase)
  const endTime = dateRange.value ? new Date(dateRange.value[1]) : new Date()

  if (startTime > endTime) {
    guardsOption.value = { ...getBaseChartOptions(), series: [] } // Simplified empty state
    return
  }

  const initialIndex = guardHistory.value.findIndex(entry => entry.time >= startTime.getTime())
  const initialCount = initialIndex >= 0 ? guardHistory.value[initialIndex].count : 0

  const completeTimeSeries = generateTimeSeries(guardHistory.value, startTime, endTime, initialIndex, initialCount)

  const guardIncrements: number[] = []
  let previousDayCount = completeTimeSeries[0]?.count ?? 0
  completeTimeSeries.forEach((entry, index) => {
    if (index > 0) {
      guardIncrements.push(entry.count - previousDayCount)
    }
    previousDayCount = entry.count
  })

  const xAxisData = completeTimeSeries.map(entry => format(entry.time, 'yyyy-MM-dd'))

  guardsOption.value = {
    ...getBaseChartOptions(),
    yAxis: [
      { type: 'value', name: '舰长数', min: 'dataMin' },
      { type: 'value', name: '日增' },
    ],
    xAxis: [
      { type: 'category', data: xAxisData },
      { type: 'category', data: xAxisData.slice(1) },
    ],
    series: [
      {
        name: '舰长数',
        type: 'line',
        step: 'middle',
        data: completeTimeSeries.map(item => item.count),
        itemStyle: {
          color: (data: any) => completeTimeSeries[data.dataIndex].exist ? themeVars.value.primaryColor : themeVars.value.textColor3,
        },
      },
      {
        name: '日增',
        type: 'bar',
        yAxisIndex: 1,
        xAxisIndex: 1,
        data: guardIncrements,
        itemStyle: { color: (params: any) => (params.value < 0 ? themeVars.value.errorColor : themeVars.value.infoColor) },
      },
    ],
  }
}

/**
 * 处理投稿数据并生成图表选项的通用函数
 * @param {('views' | 'likes')} dataType - 要处理的数据类型 ('views' 或 'likes')
 * @param {string} title - 图表主标题
 */
function processUpstatChartOptions(dataType: 'views' | 'likes', title: string) {
  if (!upstatHistory.value || upstatHistory.value.length === 0) {
    return {
      ...getBaseChartOptions(),
      xAxis: [{ type: 'category', data: [] }],
      yAxis: [{ type: 'value' }, { type: 'value' }],
      series: [
        { name: title, type: 'line', data: [] },
        { name: '日增', type: 'bar', data: [], yAxisIndex: 1 },
      ],
    }
  }

  const rangeStart = dateRange.value ? dateRange.value[0] : -Infinity
  const rangeEnd = dateRange.value ? dateRange.value[1] : Infinity
  const filtered = upstatHistory.value.filter(u => u.time >= rangeStart && u.time <= rangeEnd)

  if (filtered.length === 0) {
    return {
      ...getBaseChartOptions(),
      xAxis: [{ type: 'category', data: [] }],
      yAxis: [{ type: 'value' }, { type: 'value' }],
      series: [
        { name: title, type: 'line', data: [] },
        { name: '日增', type: 'bar', data: [], yAxisIndex: 1 },
      ],
    }
  }

  const increments: { time: number, value: number }[] = []
  let lastValue = filtered[0].stats[dataType]

  filtered.forEach((u) => {
    const currentValue = u.stats[dataType]
    increments.push({
      time: u.time,
      value: currentValue - lastValue,
    })
    lastValue = currentValue
  })

  return {
    ...getBaseChartOptions(),
    yAxis: [
      { type: 'value', min: 'dataMin' },
      { type: 'value' },
    ],
    xAxis: [
      {
        type: 'category',
        axisTick: { alignWithLabel: true },
        axisLine: { onZero: false, lineStyle: { color: themeVars.value.errorColor } },
        data: filtered.map(f => format(f.time, 'yyyy-MM-dd')),
      },
    ],
    series: [
      {
        name: title,
        type: 'line',
        emphasis: { focus: 'series' },
        data: filtered.map(f => f.stats[dataType]),
        itemStyle: {
          color(data: any) {
            return increments[data.dataIndex].value !== 0 ? themeVars.value.primaryColor : themeVars.value.textColor3
          },
        },
      },
      {
        name: '日增',
        type: 'bar',
        yAxisIndex: 1,
        emphasis: { focus: 'series' },
        data: increments.map(f => f.value),
      },
    ],
  }
}

/**
 * 处理播放量历史数据并生成图表选项
 */
function processUpstatViewChartOptions() {
  upstatViewOption.value = processUpstatChartOptions('views', '播放数')
}

/**
 * 处理点赞量历史数据并生成图表选项
 */
function processUpstatLikeChartOptions() {
  upstatLikeOption.value = processUpstatChartOptions('likes', '点赞数')
}

/**
 * 处理所有图表选项
 */
function processAllChartOptions() {
  processFansChartOptions()
  processGuardsChartOptions()
  processUpstatViewChartOptions()
  processUpstatLikeChartOptions()
}

onMounted(async () => {
  if (accountInfo.value?.isBiliVerified === true) {
    await getHistory()
    processAllChartOptions()
    isLoading.value = false
  }
})

// 选择日期范围后，自动刷新图表
watch(
  () => dateRange.value,
  () => {
    if (!isLoading.value) processAllChartOptions()
  },
)
</script>

<template>
  <div class="history-view">
    <ManagePageHeader title="数据跟踪" subtitle="粉丝/舰长趋势（需 EventFetcher 提供数据）" />
    <NAlert
      v-if="accountInfo?.isBiliVerified !== true"
      type="info"
      :bordered="false"
    >
      尚未进行Bilibili认证
    </NAlert>
    <NSpin
      v-else-if="isLoading"
      show
    />
    <NCard
      v-else
      size="small"
      :bordered="true"
      class="history-card"
    >
      <NAlert type="warning" :bordered="false">
        由于B站继续收紧风控策略, 本站已无法再爬取相关数据, 请需要使用此功能的用户下载并安装1.0.6.4及以上版本的
        <NButton
          text
          type="info"
          tag="a"
          href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
          target="_blank"
        >
          VTsuruEventFetcher
        </NButton>
        来帮助本站获取你的数据记录
      </NAlert>
      <br>
      <NTooltip
        trigger="click"
        placement="bottom"
      >
        <template #trigger>
          <NButton type="info">
            <template #icon>
              <NIcon :component="Info24Filled" />
            </template>
            关于数据更新
          </NButton>
        </template>
        <NFlex vertical>
          <NText strong>
            所有数据改为每天更新一次
          </NText>
          <NDivider style="margin: 0" />
          <NText
            delete
            :depth="3"
          >
            粉丝数: 200粉以下: 每3天一次, 200-1000粉: 每24小时一次, 1000-10000粉: 每6小时一次, 10000粉以上: 每小时一次
          </NText>
          <NText
            delete
            :depth="3"
          >
            舰长数: 10舰以下: 每24小时一次, 10-50舰: 每12小时一次, 50舰以上: 每6小时一次
          </NText>
          <NText
            delete
            :depth="3"
          >
            投稿数据: 500粉以上: 每天一次
          </NText>
        </NFlex>
      </NTooltip>
      <br>
      <br>
      <NFlex align="center">
        <NText depth="3">
          日期范围：
        </NText>
        <NDatePicker
          v-model:value="dateRange"
          type="daterange"
          clearable
          separator="至"
          :shortcuts="dateShortcuts"
        />
      </NFlex>
      <br>
      <NFlex
        vertical
        class="charts-container"
      >
        <NDivider>
          粉丝
          <NDivider vertical />
          <NTooltip>
            <template #trigger>
              <span>
                <NTime
                  :time="fansUpdateAt"
                  type="relative"
                />
                更新
              </span>
            </template>
            <NTime :time="fansUpdateAt" />
          </NTooltip>
        </NDivider>
        <VChart
          :option="fansOption"
          :style="{ height: chartHeight }"
          class="chart"
        />
        <NDivider>
          舰长
          <NDivider vertical />
          <NTooltip>
            <template #trigger>
              <span>
                <NTime
                  :time="guardUpdateAt"
                  type="relative"
                />
                更新
              </span>
            </template>
            <NTime :time="guardUpdateAt" />
          </NTooltip>
        </NDivider>
        <VChart
          :option="guardsOption"
          :style="{ height: chartHeight }"
          class="chart"
        />

        <NDivider />
      <!-- <NDivider>
        投稿播放量
        <NDivider vertical />
        <NTooltip>
          <template #trigger>
            <span>
              <NTime
                :time="upstatUpdateAt"
                type="relative"
              />
              更新
            </span>
          </template>
          <NTime :time="upstatUpdateAt" />
        </NTooltip>
      </NDivider>
      <VChart
        :option="upstatViewOption"
        :style="{ height: chartHeight }"
        class="chart"
      />

      <NDivider>
        投稿点赞量
        <NDivider vertical />
        <NTooltip>
          <template #trigger>
            <span>
              <NTime
                :time="upstatUpdateAt"
                type="relative"
              />
              更新
            </span>
          </template>
          <NTime :time="upstatUpdateAt" />
        </NTooltip>
      </NDivider>
      <VChart
        :option="upstatLikeOption"
        :style="{ height: chartHeight }"
        class="chart"
      /> -->
      </NFlex>
    </NCard>
  </div>
</template>

<style scoped>
.history-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-card {
  width: 100%;
}

.charts-container {
  width: 100%;
}

.chart {
  width: 100%;
  min-height: 200px;
  transition: height 0.3s ease;
}

@media (max-width: 768px) {
  .chart {
    min-height: 250px;
  }
}
</style>
