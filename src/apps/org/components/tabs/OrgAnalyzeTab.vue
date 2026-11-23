<script setup lang="ts">
import { Download, Minus, TrendingDown, TrendingUp } from 'lucide-vue-next'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Progress } from '@/shared/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { isDarkMode } from '@/shared/utils'

import { useOrgAnalyze } from '../../composables/useOrgAnalyze'
import { useOrgContext } from '../../composables/useOrgContext'
import { injectOrgLives } from '../../composables/useOrgLives'
import { exportCsv, formatDate, formatMinutes } from '../../utils'
import OrgUserAvatar from '../OrgUserAvatar.vue'
import { useOrgAnalyzeChart } from '../useOrgAnalyzeChart'
import type { OrgAnalyzeChartMetric } from '../useOrgAnalyzeChart'

const ctx = useOrgContext()
const { data, loading, error, range, chartDays, summary, hasChartData, load } = useOrgAnalyze(ctx)
const { computeRanking, load: loadLives } = injectOrgLives()

const chartRef = ref<HTMLElement | null>(null)

const allChartMetrics: OrgAnalyzeChartMetric[] = [
  { label: '收入', value: 'income', color: '#f59e0b', type: 'line', yAxisIndex: 1 },
  { label: '互动数', value: 'interactionCount', color: '#3b82f6', type: 'line', yAxisIndex: 0 },
  { label: '弹幕数', value: 'danmakuCount', color: '#10b981', type: 'line', yAxisIndex: 0 },
  { label: '直播时长', value: 'liveMinutes', color: '#06b6d4', type: 'line', yAxisIndex: 0 },
  { label: '互动人数', value: 'interactionUsers', color: '#8b5cf6', type: 'bar', yAxisIndex: 0 },
  { label: '付费人数', value: 'payingUsers', color: '#ec4899', type: 'bar', yAxisIndex: 0 },
]

const chartMetrics = computed(() =>
  ctx.canViewRevenue.value
    ? allChartMetrics
    : allChartMetrics.filter((m) => m.value !== 'income' && m.value !== 'payingUsers'),
)

const selectedMetrics = ref<string[]>(
  ctx.canViewRevenue.value ? ['income', 'interactionCount'] : ['interactionCount', 'danmakuCount'],
)

const { renderChart, updateChartOption, disposeChart } = useOrgAnalyzeChart({
  chartRef,
  analyzeData: data,
  formatDate,
  selectedMetrics,
  chartMetrics: allChartMetrics,
})

function normalizeTrend(value: number, trend?: number | null): number | null {
  if (trend == null || Number.isNaN(trend)) return null
  // 兼容旧后端在 0 对 0 时误返回 100 的情况
  if (value === 0 && trend === 100) return 0
  return Number(trend.toFixed(1))
}

const summaryCards = computed(() => {
  const s = summary.value
  if (!s) return []
  const prefix = range.value === 'last7Days' ? '近7日' : '近30日'
  const cards: {
    label: string
    display: string
    money?: boolean
    trend?: number | null
  }[] = []

  if (ctx.canViewRevenue.value) {
    cards.push({
      label: `${prefix}总收入`,
      display: (s.totalIncome ?? 0).toFixed(2),
      money: true,
      trend: normalizeTrend(s.totalIncome ?? 0, s.incomeTrend),
    })
  }
  cards.push(
    {
      label: `${prefix}互动数`,
      display: String(s.totalInteractions ?? 0),
      trend: normalizeTrend(s.totalInteractions ?? 0, s.interactionTrend),
    },
    {
      label: `${prefix}弹幕数`,
      display: String(s.totalDanmakuCount ?? 0),
      trend: normalizeTrend(s.totalDanmakuCount ?? 0, s.danmakuTrend),
    },
    {
      label: `${prefix}直播时长`,
      display: formatMinutes(s.totalLiveMinutes),
    },
  )
  return cards
})

type RankMetric = 'income' | 'danmaku' | 'interaction'
const rankMetric = ref<RankMetric>(ctx.canViewRevenue.value ? 'income' : 'interaction')
const rankUnit: Record<RankMetric, string> = { income: '¥', danmaku: '弹幕', interaction: '互动' }

const rangeDaysNum = computed(() => (range.value === 'last7Days' ? 7 : 30))

const rankedList = computed(() => {
  const raw = computeRanking(rangeDaysNum.value)
  return [...raw].toSorted((a, b) => b[rankMetric.value] - a[rankMetric.value])
})

const topStreamers = computed(() => {
  const list = rankedList.value.slice(0, 10)
  const max = list[0]?.[rankMetric.value] || 1
  return list.map((s) => ({
    ...s,
    pct: max > 0 ? Math.min(100, Math.round((s[rankMetric.value] / max) * 100)) : 0,
  }))
})

function exportRanking() {
  const headers = ctx.canViewRevenue.value
    ? ['主播', 'ID', '收入', '弹幕', '互动', '场次']
    : ['主播', 'ID', '弹幕', '互动', '场次']
  exportCsv(
    `主播排行_近${rangeDaysNum.value}日_${Date.now()}.csv`,
    headers,
    rankedList.value.map((s) =>
      ctx.canViewRevenue.value
        ? [s.name, s.id, s.income.toFixed(2), s.danmaku, s.interaction, s.liveCount]
        : [s.name, s.id, s.danmaku, s.interaction, s.liveCount],
    ),
  )
}

watch(
  [chartRef, data, loading, hasChartData],
  async () => {
    if (loading.value || !hasChartData.value) return
    await nextTick()
    renderChart()
  },
  { flush: 'post' },
)

watch(selectedMetrics, updateChartOption, { deep: true })
watch(isDarkMode, () => {
  nextTick(updateChartOption)
})
watch(chartDays, (days) => {
  void load(days)
})
watch(
  () => ctx.refreshTick.value,
  () => {
    void Promise.all([load(chartDays.value), loadLives(true)])
  },
)

onMounted(async () => {
  await Promise.all([load(chartDays.value), loadLives()])
})

onUnmounted(disposeChart)
</script>

<template>
  <div class="space-y-4 text-xs">
    <div class="flex-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="text-muted-foreground">统计周期</span>
        <Tabs
          :model-value="range"
          class="w-auto"
          @update:model-value="range = $event as any"
        >
          <TabsList size="xs">
            <TabsTrigger value="last7Days">近 7 日</TabsTrigger>
            <TabsTrigger value="last30Days">近 30 日</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-muted-foreground">趋势跨度</span>
        <Select
          :model-value="String(chartDays)"
          @update:model-value="chartDays = Number($event)"
        >
          <SelectTrigger class="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="14">近 14 天</SelectItem>
            <SelectItem value="30">近 30 天</SelectItem>
            <SelectItem value="60">近 60 天</SelectItem>
            <SelectItem value="90">近 90 天</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <Alert
      v-if="error"
      variant="destructive"
    >
      <AlertDescription class="flex-between gap-2">
        <span>{{ error }}</span>
        <Button
          variant="outline"
          size="xs"
          @click="load(chartDays)"
        >
          重试
        </Button>
      </AlertDescription>
    </Alert>

    <div
      v-else-if="loading && !data"
      class="py-12 flex-center"
    >
      <Spin />
    </div>

    <div
      v-else-if="!summary"
      class="py-10"
    >
      <Empty description="暂无分析数据" />
    </div>

    <template v-else>
      <!-- 指标概览卡片 -->
      <div
        class="grid grid-cols-2 gap-2.5"
        :class="summaryCards.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'"
      >
        <Card
          v-for="card in summaryCards"
          :key="card.label"
        >
          <CardContent class="p-3.5 space-y-1">
            <span class="text-[11px] text-muted-foreground block">{{ card.label }}</span>
            <div class="flex items-baseline gap-1.5 flex-wrap">
              <span
                v-if="card.money"
                class="text-xs font-semibold text-primary"
                >¥</span
              >
              <span class="text-base font-semibold font-mono tabular-nums text-foreground">
                {{ card.display }}
              </span>
              <Badge
                v-if="card.trend != null"
                variant="outline"
                size="xs"
                class="ml-auto gap-0.5 tabular-nums"
                :class="
                  card.trend > 0
                    ? 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10'
                    : card.trend < 0
                      ? 'text-destructive border-destructive/30 bg-destructive/10'
                      : 'text-muted-foreground border-border/60 bg-muted/40'
                "
              >
                <TrendingUp
                  v-if="card.trend > 0"
                  class="size-3"
                />
                <TrendingDown
                  v-else-if="card.trend < 0"
                  class="size-3"
                />
                <Minus
                  v-else
                  class="size-3"
                />
                {{ Math.abs(card.trend) }}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- 趋势图表 -->
      <Card>
        <CardHeader class="p-3 border-b border-border/60 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle class="text-xs font-semibold">趋势图表（近 {{ chartDays }} 天）</CardTitle>
          <ToggleGroup
            type="multiple"
            size="xs"
            :model-value="selectedMetrics"
            @update:model-value="
              (val) => {
                selectedMetrics = val as string[]
              }
            "
          >
            <ToggleGroupItem
              v-for="m in chartMetrics"
              :key="m.value"
              :value="m.value"
            >
              {{ m.label }}
            </ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>

        <CardContent class="p-3">
          <div
            v-if="loading"
            class="h-[360px] flex-center"
          >
            <Spin />
          </div>
          <div
            v-else-if="!hasChartData"
            class="py-10"
          >
            <Empty description="暂无图表数据" />
          </div>
          <div
            v-else
            ref="chartRef"
            class="w-full h-[360px]"
          />
        </CardContent>
      </Card>

      <!-- 主播排行榜 Top 10 -->
      <Card>
        <CardHeader class="p-3 border-b border-border/60 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle class="text-xs font-semibold">主播排行榜 Top 10（近 {{ rangeDaysNum }} 日）</CardTitle>
          <div class="flex items-center gap-2 flex-wrap">
            <Tabs
              :model-value="rankMetric"
              class="w-auto"
              @update:model-value="rankMetric = $event as any"
            >
              <TabsList size="xs">
                <TabsTrigger
                  v-if="ctx.canViewRevenue.value"
                  value="income"
                >
                  收入
                </TabsTrigger>
                <TabsTrigger value="danmaku">弹幕</TabsTrigger>
                <TabsTrigger value="interaction">互动</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button
              variant="outline"
              class="gap-1.5"
              :disabled="rankedList.length === 0"
              @click="exportRanking"
            >
              <Download class="size-3.5" />
              导出
            </Button>
          </div>
        </CardHeader>

        <CardContent class="p-3">
          <div
            v-if="topStreamers.length === 0"
            class="py-8"
          >
            <Empty description="该周期暂无主播开播数据" />
          </div>
          <div
            v-else
            class="space-y-2.5"
          >
            <div
              v-for="(s, i) in topStreamers"
              :key="s.id"
              class="flex items-center gap-2.5 text-xs"
            >
              <span
                class="w-5 text-center font-mono font-semibold tabular-nums shrink-0"
                :class="i < 3 ? 'text-primary' : 'text-muted-foreground/60'"
              >
                {{ i + 1 }}
              </span>

              <OrgUserAvatar
                :face-url="s.faceUrl"
                :size="26"
              />

              <span class="w-28 truncate font-medium text-foreground shrink-0">
                {{ s.name }}
              </span>

              <div class="flex-1 min-w-0">
                <Progress :model-value="s.pct" />
              </div>

              <span class="w-24 text-right font-mono font-semibold tabular-nums text-foreground shrink-0">
                {{ rankMetric === 'income' ? `${rankUnit.income}${s.income.toFixed(0)}` : s[rankMetric] }}
                <span
                  v-if="rankMetric !== 'income'"
                  class="text-[11px] font-normal text-muted-foreground ml-0.5"
                >
                  {{ rankUnit[rankMetric] }}
                </span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </template>
  </div>
</template>
