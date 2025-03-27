<script setup lang="ts">
import { useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import { HISTORY_API_URL } from '@/data/constants'
import { Info24Filled } from '@vicons/fluent'
import { addDays, addHours, endOfDay, format, isSameDay, isSameHour, startOfDay, startOfHour } from 'date-fns'
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
import { onMounted, ref } from 'vue'
import VChart from 'vue-echarts'

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
type HistoryUpstatRecordModel = { time: number; stats: { views: number; likes: number } }

const accountInfo = useAccount()
const message = useMessage()

const fansHistory = ref<{ time: number; count: number }[]>()
const guardHistory = ref<{ time: number; count: number }[]>()
const upstatHistory = ref<{ time: number; stats: { views: number; likes: number } }[]>()
const fansUpdateAt = ref(0)
const guardUpdateAt = ref(0)
const upstatUpdateAt = ref(0)
const fansOption = ref()
const guardsOption = ref()
const upstatViewOption = ref()
const upstatLikeOption = ref()

const isLoading = ref(true)

async function getHistory() {
  await QueryGetAPI<HistoryModel>(HISTORY_API_URL + 'get-all')
    .then((data) => {
      if (data.code == 200) {
        fansHistory.value = data.data.fan.records
        guardHistory.value = data.data.guard.records
        upstatHistory.value = data.data.upstat.records
        fansUpdateAt.value = data.data.fan.updateAt
        guardUpdateAt.value = data.data.guard.updateAt
        upstatUpdateAt.value = data.data.upstat.updateAt
      } else {
        message.error('加载失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('加载失败')
    })
}
function isSameDaySimple(time1: number, time2: number) {
  const time1Date = new Date(time1)
  const time2Date = new Date(time2)
  return (
    time1Date.getFullYear() === time2Date.getFullYear() &&
    time1Date.getMonth() === time2Date.getMonth() &&
    time1Date.getDate() === time2Date.getDate()
  )
}
const statisticStartDate = new Date(2023, 10, 4)
const statisticStartDateTime = statisticStartDate.getTime()
function getOptions() {
  // 用于存储粉丝增量数据
  const fansIncreacement: { time: Date; count: number }[] = []
  // 用于存储完整的时间序列数据，包括时间、粉丝数、是否变化
  const completeTimeSeries: { time: Date; count: number; change: boolean, exist: boolean }[] = []

  let startTime = new Date(accountInfo.value?.createAt ?? Date.now())
  startTime = startTime < statisticStartDate ? statisticStartDate : startTime // 确保开始时间不早于统计开始时间
  startTime = startOfDay(startTime) // 将开始时间调整到整点
  const endTime = new Date()

  if (fansHistory.value) {
    let currentTime = startTime
    let lastFansTimeIndex = fansHistory.value.length > 0
      ? fansHistory.value[0].time >= statisticStartDateTime
        ? 0
        : fansHistory.value.findIndex((entry) => entry.time >= statisticStartDateTime)
      : -1
    let lastDayCount = lastFansTimeIndex >= 0 ? fansHistory.value[lastFansTimeIndex].count : 0

    // 生成完整的天序列数据
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
  }

  let lastDayGuards = 0
  let lastDay = 0
  const guardsIncreacement: { time: number; count: number; timeString: string }[] = []
  const guards: { time: number; count: number; timeString: string }[] = []

  // 处理舰长历史数据
  if (guardHistory.value && guardHistory.value.length > 0) {
    let currentGuardTime = startTime
    let lastDayGuardCount = 0
    const completeGuardTimeSeries: { time: Date; count: number }[] = []
    let lastGuardTimeIndex = 0

    // 生成完整的舰长天序列
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
  }

  const upstatViewIncreace: { time: number; value: number }[] = []
  const upstatLikeIncreace: { time: number; value: number }[] = []

  // 处理upstat历史数据
  if (upstatHistory.value && upstatHistory.value.length > 0) {
    let lastUpstatView = upstatHistory.value[0].stats.views
    let lastUpstatLike = upstatHistory.value[0].stats.likes

    upstatHistory.value.forEach((u) => {
      upstatViewIncreace.push({
        time: u.time,
        value: u.stats.views - lastUpstatView,
      })
      lastUpstatView = u.stats.views
      upstatLikeIncreace.push({
        time: u.time,
        value: u.stats.likes - lastUpstatLike,
      })
      lastUpstatLike = u.stats.likes
    })
  }
  const chartData = {
    xAxisData: completeTimeSeries.map((entry) => format(entry.time, 'yyyy-MM-dd')),
    hourlyCounts: completeTimeSeries.map((entry) => entry.count),
    dailyIncrements: fansIncreacement.map((entry) => {
      return {
        date: format(entry.time, 'yyyy-MM-dd'),
        count: entry.count,
      }
    }),
  }
  fansOption.value = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: '#999',
        },
      },
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
    toolbox: {
      feature: {
        dataView: { show: true, readOnly: false },
        magicType: { show: true, type: ['line', 'bar'] },
        restore: { show: true },
        saveAsImage: { show: true },
      },
    },
    legend: {},
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
        // prettier-ignore
        data: chartData.xAxisData,
      },

      {
        type: 'category',
        axisTick: {
          alignWithLabel: true,
        },
        //boundaryGap: chartData.dailyIncrements.length < 15, // 设置为false使得柱状图紧贴左右两侧
        axisLine: {
          onZero: false,
          lineStyle: {
            color: '#EE6666',
          },
        },
        // prettier-ignore
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
            if (completeTimeSeries[data.dataIndex].change) {
              return '#18a058'
            } else {
              return '#5470C6'
            }
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
            // params.value 是当前数据项的值
            return params.value < 0 ? '#FF4D4F' : '#3398DB' // 负数时红色，正数时默认颜色
          },
        },
      },
    ],
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
  guardsOption.value = {
    /*title: {
      text: '舰长数',
      left: 'left',
    },*/
    tooltip: {
      trigger: 'axis',
    },
    legend: {},
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
        // prettier-ignore
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
            // params.value 是当前数据项的值
            return params.value < 0 ? '#FF4D4F' : '#3398DB' // 负数时红色，正数时默认颜色
          },
        },
      },
    ],
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
  upstatViewOption.value = {
    /*title: {
      text: '投稿播放数',
      left: 'left',
    },*/
    tooltip: {
      trigger: 'axis',
    },
    legend: {},
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
        // prettier-ignore
        data: upstatHistory.value?.map((f) => format(f.time, 'yyyy-MM-dd')),
      },
    ],
    series: [
      {
        name: '播放数',
        type: 'line',
        emphasis: {
          focus: 'series',
        },
        data: upstatHistory.value?.map((f) => f.stats.views),
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
  upstatLikeOption.value = {
    /*title: {
      text: '投稿点赞数',
      left: 'left',
    },*/
    tooltip: {
      trigger: 'axis',
    },
    legend: {},
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
        // prettier-ignore
        data: upstatHistory.value?.map((f) => format(f.time, 'yyyy-MM-dd')),
      },
    ],
    series: [
      {
        name: '点赞数',
        type: 'line',
        emphasis: {
          focus: 'series',
        },
        data: upstatHistory.value?.map((f) => f.stats.likes),
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

onMounted(async () => {
  if (accountInfo.value?.isBiliVerified == true) {
    await getHistory()
    getOptions()
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
    <NSpace vertical>
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
        style="height: 200px"
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
        style="height: 200px"
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
        style="height: 200px"
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
        style="height: 200px"
      />
    </NSpace>
  </NCard>
</template>
