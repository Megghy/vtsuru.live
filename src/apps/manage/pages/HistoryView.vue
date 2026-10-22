<script setup lang="ts">
import { ArrowClockwise24Regular, Info24Filled } from '@vicons/fluent'
import { addDays, endOfDay, format, formatDistanceToNow, startOfDay } from 'date-fns'
import { zhCN } from 'date-fns/locale'
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
import { useMessage } from '@/shared/utils'
import { computed, onMounted, ref, watch } from 'vue'
import VChart from 'vue-echarts'

import { useAccount } from '@/api/account'
import { getApiHistoryGetAll } from '@/api/generated/history/history'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { isDarkMode } from '@/shared/utils'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { DateRangePicker } from '@/shared/ui/date-picker'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Separator } from '@/shared/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

// 初始化 ECharts 组件
use([
  CanvasRenderer,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
  ToolboxComponent,
  BarChart,
])

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

// 日期范围与预设
type DatePreset = '7d' | '30d' | '90d' | 'all' | 'custom'
const activePreset = ref<DatePreset>('all')
const dateRange = ref<[number, number] | null>(null)
const customStartDate = ref('')
const customEndDate = ref('')

function setPreset(preset: DatePreset) {
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
  } else if (preset === '90d') {
    dateRange.value = [startOfDay(addDays(now, -89)).getTime(), endOfDay(now).getTime()]
    customStartDate.value = format(addDays(now, -89), 'yyyy-MM-dd')
    customEndDate.value = format(now, 'yyyy-MM-dd')
  } else if (preset === 'all') {
    dateRange.value = null
    customStartDate.value = ''
    customEndDate.value = ''
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

const chartHeight = computed(() => {
  return window.innerWidth < 768 ? '260px' : '320px'
})

function formatRelativeTime(ts: number) {
  if (!ts) return ''
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: zhCN })
  } catch {
    return ''
  }
}

/**
 * 获取所有历史数据
 */
async function getHistory() {
  try {
    const response = (await getApiHistoryGetAll()) as unknown as {
      code: number
      data: HistoryModel
      message?: string
    }
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

async function refreshHistory() {
  isLoading.value = true
  try {
    await getHistory()
    processAllChartOptions()
  } finally {
    isLoading.value = false
  }
}

const hasFansData = computed(() => (fansHistory.value?.length ?? 0) > 0)
const hasGuardData = computed(() => (guardHistory.value?.length ?? 0) > 0)

function getBaseChartOptions() {
  const textColor = isDarkMode.value ? '#a1a1aa' : '#52525b'
  const borderColor = isDarkMode.value ? 'rgba(255, 255, 255, 0.1)' : '#e4e4e7'

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        crossStyle: {
          color: textColor,
        },
      },
    },
    textStyle: {
      color: textColor,
    },
    toolbox: {
      feature: {
        dataView: { show: true, readOnly: false },
        magicType: { show: true, type: ['line', 'bar'] },
        restore: { show: true },
        saveAsImage: { show: true },
      },
    },
    legend: {
      textStyle: {
        color: textColor,
      },
    },
    dataZoom: [
      {
        show: true,
        realtime: true,
        start: 0,
        end: 100,
        xAxisIndex: [0, 1],
        borderColor,
      },
    ],
  }
}

function generateTimeSeries(
  historyData: HistoryRecordModel[],
  startTime: Date,
  endTime: Date,
  initialTimeIndex: number,
  initialCount: number,
) {
  const timeSeries: { time: Date; count: number; change: boolean; exist: boolean }[] = []
  let lastDayCount = initialCount
  let lastTimeIndex = initialTimeIndex
  let currentTime = startTime

  while (currentTime <= endTime) {
    const dayEndTime = endOfDay(currentTime).getTime()
    let dayExist = false

    while (true) {
      const data = historyData[lastTimeIndex]
      if (!data) break

      if ((historyData[lastTimeIndex + 1]?.time ?? Number.MAX_VALUE) > dayEndTime) {
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

function processFansChartOptions() {
  if (!fansHistory.value || fansHistory.value.length === 0) return

  let startTimeBase = new Date(accountInfo.value?.createAt ?? Date.now())
  startTimeBase = startTimeBase < statisticStartDate ? statisticStartDate : startTimeBase
  const startTime = startOfDay(dateRange.value ? new Date(dateRange.value[0]) : startTimeBase)
  const endTime = dateRange.value ? new Date(dateRange.value[1]) : new Date()

  if (startTime > endTime) {
    fansOption.value = { ...getBaseChartOptions(), series: [] }
    return
  }

  const initialIndex = fansHistory.value.findIndex((entry) => entry.time >= statisticStartDateTime)
  const initialCount = initialIndex >= 0 ? fansHistory.value[initialIndex].count : 0

  const completeTimeSeries = generateTimeSeries(fansHistory.value, startTime, endTime, initialIndex, initialCount)

  const fansIncreacement: { time: Date; count: number }[] = []
  let previousDayCount = completeTimeSeries[0]?.count ?? 0
  completeTimeSeries.forEach((entry, index) => {
    if (index > 0) {
      const dailyIncrement = entry.count - previousDayCount
      fansIncreacement.push({ time: startOfDay(entry.time), count: dailyIncrement })
    }
    previousDayCount = entry.count
  })

  const chartData = {
    xAxisData: completeTimeSeries.map((entry) => format(entry.time, 'yyyy-MM-dd')),
    seriesData: completeTimeSeries.map((entry) => entry.count),
    incrementData: fansIncreacement.map((entry) => entry.count),
  }

  const textColorMuted = isDarkMode.value ? '#71717a' : '#a1a1aa'

  fansOption.value = {
    ...getBaseChartOptions(),
    tooltip: {
      ...getBaseChartOptions().tooltip,
      formatter: (param: any) => {
        const name = `${param[0].name}<br>`
        let str = ''
        for (let i = 0; i < param.length; i++) {
          const status =
            param[i].seriesName === '粉丝数' ? (completeTimeSeries[param[i].dataIndex].exist ? '' : '(未获取)') : ''
          const statusHtml =
            status === '' ? '' : `&nbsp;<span style="color:${textColorMuted}">${status}</span>`
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
      { type: 'category', data: chartData.xAxisData.slice(1) },
    ],
    series: [
      {
        name: '粉丝数',
        type: 'line',
        data: chartData.seriesData,
        itemStyle: {
          color: (data: any) => {
            const item = completeTimeSeries[data.dataIndex]
            return !item.exist
              ? textColorMuted
              : item.change
                ? '#10b981'
                : '#3b82f6'
          },
        },
      },
      {
        name: '增量 /日',
        type: 'bar',
        yAxisIndex: 1,
        xAxisIndex: 1,
        data: chartData.incrementData,
        itemStyle: {
          color: (params: any) => (params.value < 0 ? '#ef4444' : '#06b6d4'),
        },
      },
    ],
  }
}

function processGuardsChartOptions() {
  if (!guardHistory.value || guardHistory.value.length === 0) return

  let startTimeBase = new Date(accountInfo.value?.createAt ?? Date.now())
  startTimeBase = startTimeBase < statisticStartDate ? statisticStartDate : startTimeBase
  const startTime = startOfDay(dateRange.value ? new Date(dateRange.value[0]) : startTimeBase)
  const endTime = dateRange.value ? new Date(dateRange.value[1]) : new Date()

  if (startTime > endTime) {
    guardsOption.value = { ...getBaseChartOptions(), series: [] }
    return
  }

  const initialIndex = guardHistory.value.findIndex((entry) => entry.time >= startTime.getTime())
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

  const xAxisData = completeTimeSeries.map((entry) => format(entry.time, 'yyyy-MM-dd'))
  const textColorMuted = isDarkMode.value ? '#71717a' : '#a1a1aa'

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
        data: completeTimeSeries.map((item) => item.count),
        itemStyle: {
          color: (data: any) =>
            completeTimeSeries[data.dataIndex].exist ? '#3b82f6' : textColorMuted,
        },
      },
      {
        name: '日增',
        type: 'bar',
        yAxisIndex: 1,
        xAxisIndex: 1,
        data: guardIncrements,
        itemStyle: {
          color: (params: any) => (params.value < 0 ? '#ef4444' : '#06b6d4'),
        },
      },
    ],
  }
}

function processAllChartOptions() {
  processFansChartOptions()
  processGuardsChartOptions()
}

onMounted(async () => {
  if (accountInfo.value?.isBiliVerified === true) {
    await refreshHistory()
  } else {
    isLoading.value = false
  }
})

watch(
  () => dateRange.value,
  () => {
    if (!isLoading.value) processAllChartOptions()
  },
)
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="历史趋势"
      subtitle="粉丝与舰长成长轨迹，需 VTsuruEventFetcher 持续采集"
    >
      <template #action>
        <Button v-if="accountInfo?.isBiliVerified === true" size="xs" variant="outline" :loading="isLoading" @click="refreshHistory">
          <component
            :is="ArrowClockwise24Regular"
            class="h-3.5 w-3.5 mr-1"
          />
          刷新数据
        </Button>
      </template>
    </ManagePageHeader>

    <Alert
      v-if="accountInfo?.isBiliVerified !== true"
      variant="default"
    >
      <AlertTitle>尚未进行 Bilibili 认证</AlertTitle>
      <AlertDescription class="text-xs">
        尚未绑定认证 Bilibili 账号，无法加载历史数据。请前往面板完成认证。
      </AlertDescription>
    </Alert>

    <div
      v-else
      class="space-y-4"
    >
      <Alert variant="default">
        <AlertDescription class="text-xs flex items-center justify-between flex-wrap gap-2">
          <span>
            由于 B 站收紧风控策略，平台已无法直接抓取公开数据。请主播安装 1.0.6.4 及以上版本的 EventFetcher 本地采集端同步。
          </span>
          <a
            href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
            target="_blank"
            class="text-brand hover:underline font-semibold shrink-0"
          >
            下载采集端教程 →
          </a>
        </AlertDescription>
      </Alert>

      <!-- 主控制与图表大卡片 -->
      <Card class="p-4 space-y-4">
        <!-- 顶部工具条 -->
        <div class="flex items-center justify-between flex-wrap gap-2.5">
          <!-- 预设选择器 -->
          <div class="flex items-center gap-2 flex-wrap">
            <ToggleGroup v-model="activePreset" type="single">
              <ToggleGroupItem
                value="7d"
                @click="setPreset('7d')"
              >
                近7天
              </ToggleGroupItem>
              <ToggleGroupItem
                value="30d"
                @click="setPreset('30d')"
              >
                近30天
              </ToggleGroupItem>
              <ToggleGroupItem
                value="90d"
                @click="setPreset('90d')"
              >
                近90天
              </ToggleGroupItem>
              <ToggleGroupItem
                value="all"
                @click="setPreset('all')"
              >
                全部
              </ToggleGroupItem>
            </ToggleGroup>

            <!-- 自定义日期区间 -->
            <DateRangePicker
              v-model:start="customStartDate"
              v-model:end="customEndDate"
              size="sm"
              @update:start="handleCustomDateApply"
              @update:end="handleCustomDateApply"
            />
          </div>

          <!-- 关于数据更新弹窗说明 -->
          <Popover>
            <PopoverTrigger as-child>
              <Button variant="outline">
                <component
                  :is="Info24Filled"
                  class="size-3.5 mr-1 text-muted-foreground"
                />
                关于更新频次
              </Button>
            </PopoverTrigger>
            <PopoverContent class="w-80 p-3 text-xs space-y-2">
              <div class="font-semibold text-foreground">
                数据采集更新规则
              </div>
              <Separator />
              <div class="space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                <div>• 当前所有数据均调整为由本地 EventFetcher 每日汇总更新一次。</div>
                <div class="line-through opacity-60">
                  • 历史规则：粉丝数按梯度 1~72 小时轮询，舰长数 6~24 小时更新。
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <!-- 粉丝历史图表 -->
        <div class="space-y-2 pt-2 border-t border-border">
          <div class="flex items-center justify-between">
            <div class="text-xs font-semibold flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-blue-500" />
              <span>粉丝总量与每日增量</span>
            </div>
            <span
              v-if="fansUpdateAt"
              class="text-[11px] text-muted-foreground"
            >
              更新于 {{ formatRelativeTime(fansUpdateAt) }}
            </span>
          </div>

          <VChart
            v-if="hasFansData && fansOption"
            :option="fansOption"
            :style="{ height: chartHeight }"
            class="w-full"
          />
          <div
            v-else
            class="py-12 text-center text-xs text-muted-foreground"
          >
            暂无粉丝历史数据
          </div>
        </div>

        <!-- 舰长历史图表 -->
        <div class="space-y-2 pt-4 border-t border-border">
          <div class="flex items-center justify-between">
            <div class="text-xs font-semibold flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-cyan-500" />
              <span>舰长在籍总量与增减</span>
            </div>
            <span
              v-if="guardUpdateAt"
              class="text-[11px] text-muted-foreground"
            >
              更新于 {{ formatRelativeTime(guardUpdateAt) }}
            </span>
          </div>

          <VChart
            v-if="hasGuardData && guardsOption"
            :option="guardsOption"
            :style="{ height: chartHeight }"
            class="w-full"
          />
          <div
            v-else
            class="py-12 text-center text-xs text-muted-foreground"
          >
            暂无舰长历史数据
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
