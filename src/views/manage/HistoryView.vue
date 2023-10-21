<script setup lang="ts">
import { useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import { HISTORY_API_URL } from '@/data/constants'
import { NAlert, NCard, NSpace, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent, DataZoomComponent } from 'echarts/components'
import VChart, { THEME_KEY } from 'vue-echarts'
import { format } from 'date-fns'

use([CanvasRenderer, LineChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, DataZoomComponent, LineChart])

const accountInfo = useAccount()
const message = useMessage()

const fansHistory = ref<{ time: number; count: number }[]>()
const guardHistory = ref<{ time: number; count: number }[]>()
const upstatHistory = ref<{ time: number; stats: { views: number; likes: number } }[]>()
const fansOption = ref()
const guardsOption = ref()
const upstatViewOption = ref()
const upstatLikeOption = ref()

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
function isSameDay(time1: number, time2: number) {
  const time1Date = new Date(time1)
  const time2Date = new Date(time2)
  return time1Date.getFullYear() === time2Date.getFullYear() && time1Date.getMonth() === time2Date.getMonth() && time1Date.getDate() === time2Date.getDate()
}
function getOptions() {
  let fansIncreacement = [] as { time: number; count: number; timeString: string }[]
  let guards = [] as { time: number; count: number; timeString: string }[]

  let fansIncreacementLastHour = 0
  let lastHourFans = 0
  fansHistory.value?.forEach((f) => {
    if (!isSameDay(f.time, fansIncreacementLastHour)) {
      fansIncreacement.push({
        time: fansIncreacementLastHour,
        count: fansIncreacementLastHour == 0 ? 0 : f.count - lastHourFans,
        //将timeString转换为yyyy-MM-dd HH
        timeString: format(f.time, 'yyyy-MM-dd'),
      })
      fansIncreacementLastHour = f.time
      lastHourFans = f.count
    }
  })
  let lastDayGuards = 0
  let lastDay = 0
  guardHistory.value?.forEach((g) => {
    if (!isSameDay(g.time, lastDayGuards)) {
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

  fansOption.value = {
    title: {
      text: '粉丝数',
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
        data: fansIncreacement.map((f) => f.timeString),
      },
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
        data: fansHistory.value?.map(f => format(f.time, 'yyyy-MM-dd HH:mm')),
      },
    ],
    series: [
      {
        name: '粉丝数',
        type: 'line',
        emphasis: {
          focus: 'series',
        },
        data: fansHistory.value?.map((f) => f.count),
      },
      {
        name: '增量 /日',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        emphasis: {
          focus: 'series',
        },
        data: fansIncreacement.map((f) => f.count),
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
        step: 'start',
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
        type: 'line',
        step: 'start',
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
        type: 'line',
        yAxisIndex: 1,
        step: 'start',

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
  }
})
</script>

<template>
  <NAlert v-if="accountInfo?.isBiliVerified != true" type="info"> 尚未进行Bilibili认证 </NAlert>
  <NCard size="small">
    <NSpace vertical>
      <VChart :option="fansOption" style="height: 200px" />
      <VChart :option="guardsOption" style="height: 200px" />
      <VChart :option="upstatViewOption" style="height: 200px" />
      <VChart :option="upstatLikeOption" style="height: 200px" />
    </NSpace>
  </NCard>
</template>
