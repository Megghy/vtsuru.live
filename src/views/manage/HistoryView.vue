<script setup lang="ts">
import { useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import { HISTORY_API_URL } from '@/data/constants'
import { Info24Filled } from '@vicons/fluent'
import { addDays, endOfDay, format, isSameDay, startOfDay } from 'date-fns'
import { BarChart, LineChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { NAlert, NButton, NCard, NDivider, NIcon, NSpace, NSpin, NText, NTime, NTooltip, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import VChart from 'vue-echarts'


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
type HistoryModel = {
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

type HistoryRecordModel = {
  time: number
  count: number
}

type HistoryUpstatRecordModel = {
  time: number
  stats: {
    views: number
    likes: number
  }
}

const accountInfo = useAccount()
const message = useMessage()

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
    const response = await QueryGetAPI<HistoryModel>(HISTORY_API_URL + 'get-all')
    if (response.code == 200) {
      fansHistory.value = response.data.fan.records
      guardHistory.value = response.data.guard.records
      upstatHistory.value = response.data.upstat.records
      fansUpdateAt.value = response.data.fan.updateAt
      guardUpdateAt.value = response.data.guard.updateAt
      upstatUpdateAt.value = response.data.upstat.updateAt
    } else {
      message.error('加载失败: ' + response.message)
    }
  } catch (err) {
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
          color: '#999',
        },
      },
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
 * 处理粉丝历史数据并生成图表选项
 */
function processFansChartOptions() {
  if (!fansHistory.value || fansHistory.value.length === 0) return

  // 确定开始时间
  let startTime = new Date(accountInfo.value?.createAt ?? Date.now())
  startTime = startTime < statisticStartDate ? statisticStartDate : startTime
  startTime = startOfDay(startTime)
  const endTime = new Date()

  // 用于存储完整的时间序列数据
  const completeTimeSeries: { time: Date; count: number; change: boolean, exist: boolean }[] = []
  // 用于存储粉丝增量数据
  const fansIncreacement: { time: Date; count: number }[] = []

  // 查找统计开始时间之后的第一个数据点
  let lastFansTimeIndex = fansHistory.value.length > 0
    ? fansHistory.value[0].time >= statisticStartDateTime
      ? 0
      : fansHistory.value.findIndex((entry) => entry.time >= statisticStartDateTime)
    : -1
  let lastDayCount = lastFansTimeIndex >= 0 ? fansHistory.value[lastFansTimeIndex].count : 0

  // 生成完整的天序列数据
  let currentTime = startTime
  while (currentTime <= endTime) {
    const dayEndTime = endOfDay(currentTime).getTime()
    while (true) {
      const data = fansHistory.value[lastFansTimeIndex]
      if (!data) {
        completeTimeSeries.push({
          time: currentTime,
          count: lastDayCount,
          change: false,
          exist: false,
        })
        break
      }
      // 如果下一个数据的时间大于当前天的结束时间
      if ((fansHistory.value[lastFansTimeIndex + 1]?.time ?? Number.MAX_VALUE) > dayEndTime) {
        const changed = data.count !== lastDayCount
        lastDayCount = data.count

        completeTimeSeries.push({
          time: currentTime,
          count: lastDayCount,
          change: changed,
          exist: true,
        })
        break
      }

      lastFansTimeIndex++
    }

    currentTime = addDays(currentTime, 1) // 移动到下一天
  }

  // 计算粉丝增量数据
  let previousDayCount = completeTimeSeries[0].count
  completeTimeSeries.forEach((entry, index, array) => {
    if (index === 0 || !isSameDay(entry.time, array[index - 1].time)) {
      if (index > 0) {
        const dailyIncrement = entry.count - previousDayCount
        fansIncreacement.push({
          time: startOfDay(array[index - 1].time),
          count: dailyIncrement,
        })
      }
      previousDayCount = entry.count
    } else if (index === array.length - 1) {
      const dailyIncrement = entry.count - previousDayCount
      fansIncreacement.push({
        time: startOfDay(entry.time),
        count: dailyIncrement,
      })
    }
  })

  // 准备图表数据
  const chartData = {
    xAxisData: completeTimeSeries.map((entry) => format(entry.time, 'yyyy-MM-dd')),
    hourlyCounts: completeTimeSeries.map((entry) => entry.count),
    dailyIncrements: fansIncreacement.map((entry) => ({
      date: format(entry.time, 'yyyy-MM-dd'),
      count: entry.count,
    })),
  }

  // 生成图表配置
  const baseOptions = getBaseChartOptions()
  fansOption.value = {
    ...baseOptions,
    tooltip: {
      ...baseOptions.tooltip,
      formatter: (param: any) => {
        const name = param[0].name + '<br>'
        let str = ''
        for (var i = 0; i < param.length; i++) {
          const status =
            param[i].seriesName == '粉丝数' ? (completeTimeSeries[param[i].dataIndex].exist ? '' : '(未获取)') : ''
          const statusHtml = status == '' ? '' : '&nbsp;<span style="color:gray">' + status + '</span>'
          str += param[i].marker + param[i].seriesName + '：' + param[i].data + statusHtml + '<br>'
        }
        return name + str
      },
    },
    yAxis: [
      {
        type: 'value',
        name: '粉丝数',
      },
      {
        type: 'value',
        name: '每日增量',
      },
    ],
    xAxis: [
      {
        type: 'category',
        axisTick: {
          alignWithLabel: true,
        },
        axisLine: {
          onZero: false,
          lineStyle: {
            color: '#5470C6',
          },
        },
        data: chartData.xAxisData,
      },
      {
        type: 'category',
        axisTick: {
          alignWithLabel: true,
        },
        axisLine: {
          onZero: false,
          lineStyle: {
            color: '#EE6666',
          },
        },
        data: fansIncreacement.map((f) => format(f.time, 'yyyy-MM-dd')),
      },
    ],
    series: [
      {
        name: '粉丝数',
        type: 'line',
        emphasis: {
          focus: 'series',
        },
        data: chartData.hourlyCounts,
        itemStyle: {
          color: function (data: any) {
            return completeTimeSeries[data.dataIndex].change ? '#18a058' : '#5470C6'
          },
        },
      },
      {
        name: '增量 /日',
        type: 'bar',
        yAxisIndex: 1,
        xAxisIndex: 1,
        emphasis: {
          focus: 'series',
        },
        data: chartData.dailyIncrements.map((f) => f.count),
        itemStyle: {
          color: function (params: any) {
            return params.value < 0 ? '#FF4D4F' : '#3398DB' // 负数时红色，正数时默认颜色
          },
        },
      },
    ],
  }
}

/**
 * 处理舰长历史数据并生成图表选项
 */
function processGuardsChartOptions() {
  if (!guardHistory.value || guardHistory.value.length === 0) return

  // 确定开始时间
  let startTime = new Date(accountInfo.value?.createAt ?? Date.now())
  startTime = startTime < statisticStartDate ? statisticStartDate : startTime
  startTime = startOfDay(startTime)
  const endTime = new Date()

  // 生成完整的舰长天序列
  const completeGuardTimeSeries: { time: Date; count: number }[] = []
  let currentGuardTime = startTime
  let lastGuardTimeIndex = 0
  let lastDayGuardCount = 0

  while (currentGuardTime <= endTime) {
    const dayEndTime = endOfDay(currentGuardTime).getTime()
    while (true) {
      const data = guardHistory.value[lastGuardTimeIndex]
      if (!data) {
        completeGuardTimeSeries.push({
          time: currentGuardTime,
          count: lastDayGuardCount,
        })
        break
      }

      if ((guardHistory.value[lastGuardTimeIndex + 1]?.time ?? Number.MAX_VALUE) > dayEndTime) {
        lastDayGuardCount = data.count
        completeGuardTimeSeries.push({
          time: currentGuardTime,
          count: lastDayGuardCount,
        })
        break
      }

      lastGuardTimeIndex++
    }

    currentGuardTime = addDays(currentGuardTime, 1) // 移动到下一天
  }

  // 计算守护增量数据
  const guardsIncreacement: { time: number; count: number; timeString: string }[] = []
  const guards: { time: number; count: number; timeString: string }[] = []

  let lastDayGuards = 0
  let lastDay = 0

  completeGuardTimeSeries.forEach((g) => {
    if (!isSameDay(g.time, new Date(lastDay * 1000))) {
      guardsIncreacement.push({
        time: lastDayGuards,
        count: lastDay === 0 ? 0 : g.count - lastDayGuards,
        timeString: format(g.time, 'yyyy-MM-dd'),
      })
      guards.push({
        time: g.time.getTime() / 1000,
        count: g.count,
        timeString: format(g.time, 'yyyy-MM-dd'),
      })
      lastDay = g.time.getTime() / 1000
      lastDayGuards = g.count
    }
  })

  // 生成图表配置
  const baseOptions = getBaseChartOptions()
  guardsOption.value = {
    ...baseOptions,
    yAxis: [
      {
        type: 'value',
      },
      {
        type: 'value',
      },
    ],
    xAxis: [
      {
        type: 'category',
        axisTick: {
          alignWithLabel: true,
        },
        axisLine: {
          onZero: false,
          lineStyle: {
            color: '#EE6666',
          },
        },
        data: guardsIncreacement.map((f) => f.timeString),
      },
    ],
    series: [
      {
        name: '舰长数',
        type: 'line',
        step: 'middle',
        emphasis: {
          focus: 'series',
        },
        data: guards.map((f) => f.count),
      },
      {
        name: '日增',
        type: 'bar',
        yAxisIndex: 1,
        emphasis: {
          focus: 'series',
        },
        data: guardsIncreacement.map((f) => f.count),
        itemStyle: {
          color: function (params: any) {
            return params.value < 0 ? '#FF4D4F' : '#3398DB'
          },
        },
      },
    ],
  }
}

/**
 * 处理播放量历史数据并生成图表选项
 */
function processUpstatViewChartOptions() {
  if (!upstatHistory.value || upstatHistory.value.length === 0) return

  // 计算播放量增量数据
  const upstatViewIncreace: { time: number; value: number }[] = []
  let lastUpstatView = upstatHistory.value[0].stats.views

  upstatHistory.value.forEach((u) => {
    upstatViewIncreace.push({
      time: u.time,
      value: u.stats.views - lastUpstatView,
    })
    lastUpstatView = u.stats.views
  })

  // 生成图表配置
  const baseOptions = getBaseChartOptions()
  upstatViewOption.value = {
    ...baseOptions,
    yAxis: [
      {
        type: 'value',
      },
      {
        type: 'value',
      },
    ],
    xAxis: [
      {
        type: 'category',
        axisTick: {
          alignWithLabel: true,
        },
        axisLine: {
          onZero: false,
          lineStyle: {
            color: '#EE6666',
          },
        },
        data: upstatHistory.value.map((f) => format(f.time, 'yyyy-MM-dd')),
      },
    ],
    series: [
      {
        name: '播放数',
        type: 'line',
        emphasis: {
          focus: 'series',
        },
        data: upstatHistory.value.map((f) => f.stats.views),
      },
      {
        name: '日增',
        type: 'bar',
        yAxisIndex: 1,
        emphasis: {
          focus: 'series',
        },
        data: upstatViewIncreace.map((f) => f.value),
      },
    ],
  }
}

/**
 * 处理点赞量历史数据并生成图表选项
 */
function processUpstatLikeChartOptions() {
  if (!upstatHistory.value || upstatHistory.value.length === 0) return

  // 计算点赞量增量数据
  const upstatLikeIncreace: { time: number; value: number }[] = []
  let lastUpstatLike = upstatHistory.value[0].stats.likes

  upstatHistory.value.forEach((u) => {
    upstatLikeIncreace.push({
      time: u.time,
      value: u.stats.likes - lastUpstatLike,
    })
    lastUpstatLike = u.stats.likes
  })

  // 生成图表配置
  const baseOptions = getBaseChartOptions()
  upstatLikeOption.value = {
    ...baseOptions,
    yAxis: [
      {
        type: 'value',
      },
      {
        type: 'value',
      },
    ],
    xAxis: [
      {
        type: 'category',
        axisTick: {
          alignWithLabel: true,
        },
        axisLine: {
          onZero: false,
          lineStyle: {
            color: '#EE6666',
          },
        },
        data: upstatHistory.value.map((f) => format(f.time, 'yyyy-MM-dd')),
      },
    ],
    series: [
      {
        name: '点赞数',
        type: 'line',
        emphasis: {
          focus: 'series',
        },
        data: upstatHistory.value.map((f) => f.stats.likes),
      },
      {
        name: '日增',
        type: 'bar',
        yAxisIndex: 1,
        emphasis: {
          focus: 'series',
        },
        data: upstatLikeIncreace.map((f) => f.value),
      },
    ],
  }
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
  if (accountInfo.value?.isBiliVerified == true) {
    await getHistory()
    processAllChartOptions()
    isLoading.value = false
  }
})
</script>

<template>
  <NAlert
    v-if="accountInfo?.isBiliVerified != true"
    type="info"
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
    class="history-card"
  >
    <NAlert type="warning">
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
      <NSpace vertical>
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
      </NSpace>
    </NTooltip>
    <br>
    <br>
    <NSpace
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

      <NDivider>
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
      />
    </NSpace>
  </NCard>
</template>

<style scoped>
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
