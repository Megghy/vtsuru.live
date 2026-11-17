<script lang="ts" setup>
import ArrowClockwise24Regular from '@vicons/fluent/es/ArrowClockwise24Regular'
import { addDays, endOfDay, format, startOfDay } from 'date-fns'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'

import AnalyzeDailyTable from '@/apps/manage/components/analyze/AnalyzeDailyTable.vue'
import AnalyzeInsightsGrid from '@/apps/manage/components/analyze/AnalyzeInsightsGrid.vue'
import AnalyzeSummaryCards from '@/apps/manage/components/analyze/AnalyzeSummaryCards.vue'
import AnalyzeTrendChart from '@/apps/manage/components/analyze/AnalyzeTrendChart.vue'
import type { ChartDayPoint, UnifiedSummary } from '@/apps/manage/components/analyze/types'
import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
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
  type AnalyzeMilestones,
  type AnalyzeOfflineEventItem,
  type AnalyzeRangeSummary,
  type AnalyzeSessionItem,
} from '@/apps/manage/composables/analyzeRange'
import { formatDate } from '@/apps/manage/composables/formatters'
import { useAnalyzeStore } from '@/apps/manage/composables/useAnalyzeStore'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { DateRangePicker } from '@/shared/ui/date-picker'
import { Skeleton } from '@/shared/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { toast } from '@/shared/utils'

const analyzeStore = useAnalyzeStore()
const { analyzeData, loading, refreshing, hasData } = storeToRefs(analyzeStore)

type RangePreset = '7d' | '30d' | '60d' | 'all' | 'custom'
const PRESET_DAYS: Record<'7d' | '30d' | '60d', number> = {
  '7d': 6,
  '30d': 29,
  '60d': 59,
}

const activePreset = ref<RangePreset>('30d')
const dateRange = ref<[number, number] | null>([
  startOfDay(addDays(new Date(), -29)).getTime(),
  endOfDay(new Date()).getTime(),
])
const customStartDate = ref(format(addDays(new Date(), -29), 'yyyy-MM-dd'))
const customEndDate = ref(format(new Date(), 'yyyy-MM-dd'))

function setPreset(preset: RangePreset) {
  activePreset.value = preset
  if (preset === 'all') {
    dateRange.value = null
    return
  }
  if (preset === 'custom') return
  const now = new Date()
  const startDay = addDays(now, -PRESET_DAYS[preset])
  dateRange.value = [startOfDay(startDay).getTime(), endOfDay(now).getTime()]
  customStartDate.value = format(startDay, 'yyyy-MM-dd')
  customEndDate.value = format(now, 'yyyy-MM-dd')
}

function handleCustomDateApply() {
  if (!customStartDate.value || !customEndDate.value) return
  activePreset.value = 'custom'
  const start = startOfDay(new Date(customStartDate.value)).getTime()
  const end = endOfDay(new Date(customEndDate.value)).getTime()
  dateRange.value = start <= end ? [start, end] : [end, start]
}

const allChartPoints = computed<ChartDayPoint[]>(() => {
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
        offlineIncome: data.offlineIncome ?? 0,
        offlineGuardIncome: data.offlineGuardIncome ?? 0,
        offlineScIncome: data.offlineScIncome ?? 0,
        grandTotalIncome: data.grandTotalIncome ?? (data.income || 0) + (data.offlineIncome || 0),
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
})

const filteredChartData = computed<ChartDayPoint[]>(() => {
  const all = allChartPoints.value
  if (!dateRange.value) return all
  return filterChartDataByRange(all, dateRange.value[0], dateRange.value[1]).map((p) => ({
    ...p,
    date: formatDate(p.timestamp),
  }))
})

const filteredOfflineEvents = computed<AnalyzeOfflineEventItem[]>(() => {
  const all = analyzeData.value?.offlineEvents || []
  if (!dateRange.value) return all
  const start = Math.min(dateRange.value[0], dateRange.value[1])
  const end = Math.max(dateRange.value[0], dateRange.value[1])
  return all.filter((e) => {
    const ts = e.time < 10_000_000_000 && e.time > 100_000_000 ? e.time * 1_000 : e.time
    return ts >= start && ts <= end
  })
})

interface BackendSummaryOverrides extends Partial<AnalyzeRangeSummary> {
  offlineGuardCount?: number
  incomeTrend?: number
  interactionTrend?: number
  danmakuTrend?: number
}

function mergeBackendSummary(
  calculated: AnalyzeRangeSummary,
  backend: BackendSummaryOverrides,
  titlePrefix: string,
): UnifiedSummary {
  return {
    ...calculated,
    totalIncome: backend.totalIncome ?? calculated.totalIncome,
    giftIncome: backend.giftIncome ?? calculated.giftIncome,
    scIncome: backend.scIncome ?? calculated.scIncome,
    guardIncome: backend.guardIncome ?? calculated.guardIncome,
    offlineIncome: backend.offlineIncome ?? calculated.offlineIncome,
    offlineGuardIncome: backend.offlineGuardIncome ?? calculated.offlineGuardIncome,
    offlineScIncome: backend.offlineScIncome ?? calculated.offlineScIncome,
    grandTotalIncome: backend.grandTotalIncome ?? calculated.grandTotalIncome,
    offlineGuardCount: backend.offlineGuardCount ?? 0,
    totalIncomeWithGuard: backend.totalIncomeWithGuard ?? calculated.totalIncomeWithGuard,
    totalInteractions: backend.totalInteractions ?? calculated.totalInteractions,
    totalDanmakuCount: backend.totalDanmakuCount ?? calculated.totalDanmakuCount,
    totalLiveMinutes: backend.totalLiveMinutes ?? calculated.totalLiveMinutes,
    activeLiveDays: backend.activeLiveDays ?? calculated.activeLiveDays,
    interactionUsers: backend.interactionUsers ?? calculated.interactionUsers,
    payingUsers: backend.payingUsers ?? calculated.payingUsers,
    dailyAvgIncome: backend.dailyAvgIncome ?? calculated.dailyAvgIncome,
    dailyAvgDanmaku: backend.dailyAvgDanmaku ?? calculated.dailyAvgDanmaku,
    titlePrefix,
    incomeTrend: backend.incomeTrend,
    interactionTrend: backend.interactionTrend,
    danmakuTrend: backend.danmakuTrend,
  }
}

const currentSummary = computed<UnifiedSummary>(() => {
  const calculated = computeRangeSummary(filteredChartData.value)

  if (activePreset.value === '7d' && analyzeData.value?.summary?.last7Days) {
    return mergeBackendSummary(calculated, analyzeData.value.summary.last7Days, '近7天')
  }
  if (activePreset.value === '30d' && analyzeData.value?.summary?.last30Days) {
    return mergeBackendSummary(calculated, analyzeData.value.summary.last30Days, '近30天')
  }

  const titlePrefix =
    activePreset.value === '60d'
      ? '近60天'
      : activePreset.value === 'all'
        ? '历史全量'
        : dateRange.value
          ? `${formatDate(dateRange.value[0])} ~ ${formatDate(dateRange.value[1])}`
          : '所选区间'

  return {
    ...calculated,
    titlePrefix,
    offlineGuardCount: filteredOfflineEvents.value.filter((e) => e.type === 0).length,
  }
})

const currentMilestones = computed<AnalyzeMilestones>(() => computeMilestones(filteredChartData.value))

const currentFilteredSessions = computed<AnalyzeSessionItem[]>(() => {
  const allSessions = analyzeData.value?.sessions || []
  if (!dateRange.value) return allSessions
  return filterSessionsByRange(allSessions, dateRange.value[0], dateRange.value[1])
})

const currentAreaStats = computed<AnalyzeAreaStat[]>(() => {
  if (currentFilteredSessions.value.length > 0) {
    return computeAreaStatsFromSessions(currentFilteredSessions.value)
  }
  return analyzeData.value?.areaStats || []
})

const currentDayOfWeekStats = computed<AnalyzeDayOfWeekStat[]>(() => computeDayOfWeekStats(filteredChartData.value))

async function loadData() {
  try {
    await analyzeStore.loadData()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '获取分析数据失败')
  }
}

async function refreshData() {
  try {
    await analyzeStore.loadData()
    toast.success('数据已刷新')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '刷新数据失败')
  }
}

onMounted(() => {
  void loadData()
})
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="直播数据罗盘"
      subtitle="沉淀过去 60 天多维全景直播战报，透视收益构成、粉丝互动深度与开播偏好"
    >
      <template #action>
        <div class="flex items-center gap-2 flex-wrap">
          <ToggleGroup
            v-model="activePreset"
            type="single"
          >
            <ToggleGroupItem
              value="7d"
              @click="setPreset('7d')"
              >近7天</ToggleGroupItem
            >
            <ToggleGroupItem
              value="30d"
              @click="setPreset('30d')"
              >近30天</ToggleGroupItem
            >
            <ToggleGroupItem
              value="60d"
              @click="setPreset('60d')"
              >近60天</ToggleGroupItem
            >
            <ToggleGroupItem
              value="all"
              @click="setPreset('all')"
              >全部</ToggleGroupItem
            >
          </ToggleGroup>

          <DateRangePicker
            v-model:start="customStartDate"
            v-model:end="customEndDate"
            @update:start="handleCustomDateApply"
            @update:end="handleCustomDateApply"
          />

          <Button
            variant="outline"
            :loading="refreshing"
            @click="refreshData"
          >
            <component
              :is="ArrowClockwise24Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            刷新
          </Button>
        </div>
      </template>
    </ManagePageHeader>

    <EventFetcherStatusCard />

    <div
      v-if="loading"
      class="space-y-4"
    >
      <div class="flex items-center gap-2 text-xs text-muted-foreground">
        <div class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
        <span>正在盘点过去 60 天直播战报与全盘指标…</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Skeleton
          v-for="i in 4"
          :key="i"
          class="h-40 rounded-xl"
        />
      </div>

      <Skeleton class="h-96 rounded-xl" />
    </div>

    <Card
      v-else-if="!hasData"
      class="p-12 text-center"
    >
      <div class="text-muted-foreground text-sm">暂无直播分析数据</div>
      <div class="text-xs text-muted-foreground/70 mt-1">
        系统会自动采集并维护你的直播数据，开播后将在此生成全景图表与复盘洞察。
      </div>
    </Card>

    <div
      v-else
      class="space-y-4"
    >
      <AnalyzeSummaryCards
        :summary="currentSummary"
        :milestones="currentMilestones"
        :total-day-count="filteredChartData.length"
      />

      <AnalyzeTrendChart
        :chart-data="filteredChartData"
        :title-prefix="currentSummary.titlePrefix"
      />

      <AnalyzeInsightsGrid
        :summary="currentSummary"
        :day-of-week-stats="currentDayOfWeekStats"
        :area-stats="currentAreaStats"
        :sessions="currentFilteredSessions"
      />

      <AnalyzeDailyTable
        :chart-data="filteredChartData"
        :title-prefix="currentSummary.titlePrefix"
      />
    </div>
  </div>
</template>
