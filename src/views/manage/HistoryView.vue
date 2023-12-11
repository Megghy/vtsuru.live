<script setup lang="ts">
import { useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import { HISTORY_API_URL } from '@/data/constants'
import { NAlert, NCard, NSpace, NSpin, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent, DataZoomComponent, ToolboxComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { addHours, format, getUnixTime, isSameDay, isSameHour, startOfHour } from 'date-fns'

use([CanvasRenderer, LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, DataZoomComponent, LineChart, ToolboxComponent, BarChart])

const accountInfo = useAccount()
const message = useMessage()

const fansHistory = ref<{ time: number; count: number }[]>()
const guardHistory = ref<{ time: number; count: number }[]>()
const upstatHistory = ref<{ time: number; stats: { views: number; likes: number } }[]>()
const fansOption = ref()
const guardsOption = ref()
const upstatViewOption = ref()
const upstatLikeOption = ref()

const isLoading = ref(true)

async function getFansHistory() {
  await QueryGetAPI<
    {
      time: number
      count: number
    }[]
  >(HISTORY_API_URL + 'fans')
    .then((data) => {
      if (data.code == 200) {
        fansHistory.value = data.data
      } else {
        message.error('加载失败: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('加载失败')
    })
}
async function getGuardsHistory() {
  await QueryGetAPI<
    {
      time: number
      count: number
    }[]
  >(HISTORY_API_URL + 'guards')
    .then((data) => {
      if (data.code == 200) {
        guardHistory.value = data.data
      } else {
        message.error('加载失败: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('加载失败')
    })
}
async function getUpstatHistory() {
  await QueryGetAPI<
    {
      time: number
      stats: {
        views: number
        likes: number
      }
    }[]
  >(HISTORY_API_URL + 'upstat')
    .then((data) => {
      if (data.code == 200) {
        upstatHistory.value = data.data
      } else {
        message.error('加载失败: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('加载失败')
    })
}
function isSameDaySimple(time1: number, time2: number) {
  const time1Date = new Date(time1)
  const time2Date = new Date(time2)
  return time1Date.getFullYear() === time2Date.getFullYear() && time1Date.getMonth() === time2Date.getMonth() && time1Date.getDate() === time2Date.getDate()
}
function getOptions() {
  let fansIncreacement = [] as { time: Date; count: number; timeString: string }[]
  let completeTimeSeries: {
    time: Date
    count: number
  }[] = []
  let guards = [] as { time: number; count: number; timeString: string }[]

  if (fansHistory.value) {
    const startTime = new Date(fansHistory.value[0].time)
    const endTime = new Date(fansHistory.value[fansHistory.value.length - 1].time)

    let currentTime = startTime
    // 生成完整的小时序列
    while (currentTime <= endTime) {
      let found = fansHistory.value.find((f) => isSameHour(currentTime, f.time))
      let count = found ? found.count : completeTimeSeries[completeTimeSeries.length - 1]?.count || 0

      completeTimeSeries.push({
        time: currentTime,
        count: count,
      })

      currentTime = addHours(currentTime, 1)
    }
    // 计算日增量数据
    let previousDayCount = completeTimeSeries[0].count

    completeTimeSeries.forEach((entry, index, array) => {
      if (index === 0 || !isSameDay(entry.time, array[index - 1].time)) {
        if (index > 0) {
          let dailyIncrement = entry.count - previousDayCount
          fansIncreacement.push({
            time: startOfHour(array[index - 1].time),
            count: dailyIncrement,
            timeString: format(array[index - 1].time, 'yyyy-MM-dd'),
          })
        }
        previousDayCount = entry.count
      } else if (index === array.length - 1) {
        let dailyIncrement = entry.count - previousDayCount
        fansIncreacement.push({
          time: startOfHour(entry.time),
          count: dailyIncrement,
          timeString: format(array[index - 1].time, 'yyyy-MM-dd'),
        })
      }
    })
  }

  let lastDayGuards = 0
  let lastDay = 0
  guardHistory.value?.forEach((g) => {
    if (!isSameDaySimple(g.time, lastDayGuards)) {
      guards.push({
        time: lastDayGuards,
        count: lastDay == 0 ? 0 : g.count - lastDayGuards,
        //将timeString转换为yyyy-MM-dd HH
        timeString: format(g.time, 'yyyy-MM-dd'),
      })
      lastDay = g.time
      lastDayGuards = g.count
    }
  })
  let upstatViewIncreace: { time: number; value: number }[] = []
  let upstatLikeIncreace: { time: number; value: number }[] = []
  if (upstatHistory.value && upstatHistory.value.length > 0) {
    let lastUpstatView = upstatHistory.value[0].stats.views
    let lastUpstatLike = upstatHistory.value[0].stats.likes

    upstatHistory.value?.forEach((u) => {
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
    xAxisData: completeTimeSeries.map((entry) => format(entry.time, 'yyyy-MM-dd HH:mm')),
    hourlyCounts: completeTimeSeries.map((entry) => entry.count),
    dailyIncrements: fansIncreacement.map((entry) => {
      return {
        date: format(entry.time, 'yyyy-MM-dd'),
        count: entry.count,
      }
    }),
  }
  fansOption.value = {
    title: {
      text: '粉丝数',
      left: 'left',
    },
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
    yAxis: [
      {
        type: 'value',
        name: '每小时粉丝数',
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
        boundaryGap: false, // 设置为false使得柱状图紧贴左右两侧
        axisLine: {
          onZero: false,
          lineStyle: {
            color: '#EE6666',
          },
        },
        // prettier-ignore
        data: fansIncreacement.map((f) => f.timeString),
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
    title: {
      text: '舰长数',
      left: 'left',
    },
    tooltip: {
      trigger: 'axis',
    },
    legend: {},
    yAxis: [
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
        data: guards.map((f) => f.timeString ),
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
    title: {
      text: '投稿播放数',
      left: 'left',
    },
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
    title: {
      text: '投稿点赞数',
      left: 'left',
    },
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
    await getFansHistory()
    await getGuardsHistory()
    await getUpstatHistory()
    getOptions()
    isLoading.value = false
  }
})
</script>

<template>
  <NAlert v-if="accountInfo?.isBiliVerified != true" type="info"> 尚未进行Bilibili认证 </NAlert>
  <NSpin v-else-if="isLoading" show />
  <NCard v-else size="small">
    <NSpace vertical>
      <VChart :option="fansOption" style="height: 200px" />
      <VChart :option="guardsOption" style="height: 200px" />
      <VChart :option="upstatViewOption" style="height: 200px" />
      <VChart :option="upstatLikeOption" style="height: 200px" />
    </NSpace>
  </NCard>
</template>
