<script setup lang="ts">
import { DownloadOutline, TrendingDown, TrendingUp } from '@vicons/ionicons5'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Progress } from '@/shared/ui/progress'
import { Spin } from '@/shared/ui/spin'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'

import { useOrgAnalyze } from '../../composables/useOrgAnalyze'
import { useOrgContext } from '../../composables/useOrgContext'
import { injectOrgLives } from '../../composables/useOrgLives'
import { exportCsv, formatDate } from '../../utils'
import OrgUserAvatar from '../OrgUserAvatar.vue'
import { useOrgAnalyzeChart } from '../useOrgAnalyzeChart'
import type { OrgAnalyzeChartMetric } from '../useOrgAnalyzeChart'

const ctx = useOrgContext()
const { data, loading, range, summary, hasChartData, load } = useOrgAnalyze(ctx)
const { ranking, load: loadLives } = injectOrgLives()

const chartRef = ref<HTMLElement | null>(null)
const selectedMetrics = ref<string[]>(['income', 'interactionCount'])
const chartMetrics: OrgAnalyzeChartMetric[] = [
  { label: '收入', value: 'income', color: '#f5a623', type: 'line', yAxisIndex: 1 },
  { label: '互动数', value: 'interactionCount', color: '#2080f0', type: 'line', yAxisIndex: 0 },
  { label: '弹幕数', value: 'danmakuCount', color: '#18a058', type: 'line', yAxisIndex: 0 },
  { label: '点赞数', value: 'likeCount', color: '#d03050', type: 'line', yAxisIndex: 0 },
  { label: '互动人数', value: 'interactionUsers', color: '#8a2be2', type: 'bar', yAxisIndex: 0 },
  { label: '付费人数', value: 'payingUsers', color: '#ff69b4', type: 'bar', yAxisIndex: 0 },
]

const { initChart, updateChartOption, disposeChart } = useOrgAnalyzeChart({
  chartRef,
  analyzeData: data,
  formatDate,
  selectedMetrics,
  chartMetrics,
})

const summaryCards = computed(() => {
  const s = summary.value
  if (!s) return []
  const prefix = range.value === 'last7Days' ? '近7日' : '近30日'
  return [
    { label: `${prefix}总收入`, value: s.totalIncome, precision: 2, money: true, trend: s.incomeTrend },
    { label: `${prefix}互动数`, value: s.totalInteractions, trend: s.interactionTrend },
    { label: `${prefix}弹幕数`, value: s.totalDanmakuCount, trend: s.danmakuTrend },
    { label: `${prefix}直播时长`, value: s.totalLiveMinutes, suffix: 'min' },
  ]
})

type RankMetric = 'income' | 'danmaku' | 'interaction'
const rankMetric = ref<RankMetric>('income')
const rankUnit: Record<RankMetric, string> = { income: '¥', danmaku: '弹幕', interaction: '互动' }
const topStreamers = computed(() => {
  const list = [...ranking.value].toSorted((a, b) => b[rankMetric.value] - a[rankMetric.value]).slice(0, 10)
  const max = list[0]?.[rankMetric.value] || 1
  return list.map((s) => ({ ...s, pct: Math.round((s[rankMetric.value] / max) * 100) }))
})

function toggleMetric(value: string) {
  selectedMetrics.value = selectedMetrics.value.includes(value)
    ? selectedMetrics.value.filter((x) => x !== value)
    : [...selectedMetrics.value, value]
}

function exportRanking() {
  exportCsv(
    `主播排行_${Date.now()}.csv`,
    ['主播', 'ID', '收入', '弹幕', '互动', '场次'],
    [...ranking.value]
      .toSorted((a, b) => b[rankMetric.value] - a[rankMetric.value])
      .map((s) => [s.name, s.id, s.income.toFixed(2), s.danmaku, s.interaction, s.liveCount]),
  )
}

watch(selectedMetrics, updateChartOption, { deep: true })
watch(range, () => {
  load(() => {
    disposeChart()
    initChart()
  })
})

onMounted(async () => {
  await Promise.all([
    load(() => {
      disposeChart()
      initChart()
    }),
    loadLives(),
  ])
})

onUnmounted(disposeChart)
</script>

<template>
  <div class="space-y-4 text-xs">
    <div class="flex justify-end">
      <Tabs
        :model-value="range"
        class="w-auto"
        @update:model-value="range = $event as any"
      >
        <TabsList size="xs">
          <TabsTrigger value="last7Days">近7日</TabsTrigger>
          <TabsTrigger value="last30Days">近30日</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>

    <div v-if="loading" class="py-12 flex justify-center">
      <Spin />
    </div>
    <div v-else-if="!summary" class="py-10">
      <Empty description="暂无分析数据" />
    </div>
    <template v-else>
      <!-- 指标概览卡片 -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Card
          v-for="card in summaryCards"
          :key="card.label"
          class="border border-border/80"
        >
          <CardContent class="p-3 space-y-1">
            <span class="text-[11px] text-muted-foreground block">{{ card.label }}</span>
            <div class="flex items-baseline gap-1.5 flex-wrap">
              <span v-if="card.money" class="text-xs font-semibold text-primary">¥</span>
              <span class="text-base font-semibold font-mono text-foreground">
                {{ typeof card.value === 'number' && card.precision ? card.value.toFixed(card.precision) : card.value }}
              </span>
              <span v-if="card.suffix" class="text-[11px] text-muted-foreground">{{ card.suffix }}</span>
              <Badge
                v-if="card.trend != null"
                variant="outline"
                class="text-[10px] h-4 px-1 ml-auto"
                :class="
                  card.trend >= 0
                    ? 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10'
                    : 'text-destructive border-destructive/30 bg-destructive/10'
                "
              >
                <component :is="card.trend >= 0 ? TrendingUp : TrendingDown" class="size-3 mr-0.5 inline" />
                {{ Math.abs(card.trend) }}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- 趋势图表 -->
      <Card class="border border-border/80">
        <CardHeader class="p-3 pb-2 border-b border-border/60 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle class="text-xs font-semibold">趋势图表</CardTitle>
          <div class="flex items-center gap-1.5 flex-wrap">
            <button
              v-for="m in chartMetrics"
              :key="m.value"
              type="button"
              class="px-2 py-0.5 rounded text-[11px] transition-colors border"
              :class="
                selectedMetrics.includes(m.value)
                  ? 'bg-primary/10 border-primary/40 text-primary font-medium'
                  : 'bg-muted/40 border-border/60 text-muted-foreground hover:bg-muted/70'
              "
              @click="toggleMetric(m.value)"
            >
              {{ m.label }}
            </button>
          </div>
        </CardHeader>

        <CardContent class="p-3">
          <div v-if="!hasChartData" class="py-8">
            <Empty description="暂无图表数据" />
          </div>
          <div
            v-else
            ref="chartRef"
            class="w-full h-[400px]"
          />
        </CardContent>
      </Card>

      <!-- 主播排行榜 Top 10 -->
      <Card class="border border-border/80">
        <CardHeader class="p-3 pb-2 border-b border-border/60 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle class="text-xs font-semibold">主播排行榜 Top 10</CardTitle>
          <div class="flex items-center gap-2">
            <Tabs
              :model-value="rankMetric"
              class="w-auto"
              @update:model-value="rankMetric = $event as any"
            >
              <TabsList size="xs">
                <TabsTrigger value="income">收入</TabsTrigger>
                <TabsTrigger value="danmaku">弹幕</TabsTrigger>
                <TabsTrigger value="interaction">互动</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button variant="outline" class="gap-1" :disabled="ranking.length === 0" @click="exportRanking">
              <component :is="DownloadOutline" class="size-3.5" />
              导出
            </Button>
          </div>
        </CardHeader>

        <CardContent class="p-3">
          <div v-if="topStreamers.length === 0" class="py-8">
            <Empty description="暂无主播数据" />
          </div>
          <div v-else class="space-y-2.5">
            <div
              v-for="(s, i) in topStreamers"
              :key="s.id"
              class="flex items-center gap-2.5 text-xs"
            >
              <span
                class="w-5 text-center font-mono font-semibold text-xs shrink-0"
                :class="i < 3 ? 'text-primary' : 'text-muted-foreground/60'"
              >
                {{ i + 1 }}
              </span>

              <OrgUserAvatar
                :face-url="s.faceUrl"
                :size="26"
              />

              <span class="w-28 truncate font-medium text-foreground text-xs shrink-0">
                {{ s.name }}
              </span>

              <div class="flex-1">
                <Progress :value="s.pct" class="h-2" />
              </div>

              <span class="w-24 text-right font-mono font-semibold text-xs text-foreground shrink-0">
                {{ rankMetric === 'income' ? rankUnit.income + s.income.toFixed(0) : s[rankMetric] }}
                <span v-if="rankMetric !== 'income'" class="text-[11px] font-normal text-muted-foreground ml-0.5">
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
