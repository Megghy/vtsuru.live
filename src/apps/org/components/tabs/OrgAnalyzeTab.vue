<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

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
const rankMetric = ref<'income' | 'danmaku' | 'interaction'>('income')
const chartTheme = computed(() => ({ textColor2: '#94a3b8', borderColor: '#334155', dividerColor: '#334155' }))
const rangeOptions = [
  { label: '近7日', value: 'last7Days' },
  { label: '近30日', value: 'last30Days' },
]
const rankOptions = [
  { label: '收入', value: 'income' },
  { label: '弹幕', value: 'danmaku' },
  { label: '互动', value: 'interaction' },
]
const chartMetrics: OrgAnalyzeChartMetric[] = [
  { label: '收入', value: 'income', color: '#f59e0b', type: 'line', yAxisIndex: 1 },
  { label: '互动数', value: 'interactionCount', color: '#3b82f6', type: 'line' },
  { label: '弹幕数', value: 'danmakuCount', color: '#22c55e', type: 'line' },
  { label: '点赞数', value: 'likeCount', color: '#f43f5e', type: 'line' },
  { label: '互动人数', value: 'interactionUsers', color: '#8b5cf6', type: 'bar' },
  { label: '付费人数', value: 'payingUsers', color: '#ec4899', type: 'bar' },
]
const { initChart, updateChartOption, disposeChart } = useOrgAnalyzeChart({
  chartRef,
  analyzeData: data,
  formatDate,
  themeVars: chartTheme,
  selectedMetrics,
  chartMetrics,
})
const summaryCards = computed(() => {
  if (!summary.value) return []
  const prefix = range.value === 'last7Days' ? '近7日' : '近30日'
  return [
    {
      label: `${prefix}总收入`,
      value: summary.value.totalIncome,
      money: true,
      precision: 2,
      trend: summary.value.incomeTrend,
    },
    { label: `${prefix}互动数`, value: summary.value.totalInteractions, trend: summary.value.interactionTrend },
    { label: `${prefix}弹幕数`, value: summary.value.totalDanmakuCount, trend: summary.value.danmakuTrend },
    { label: `${prefix}直播时长`, value: summary.value.totalLiveMinutes, suffix: 'min' },
  ]
})
const topStreamers = computed(() => {
  const list = [...ranking.value]
    .toSorted((left, right) => right[rankMetric.value] - left[rankMetric.value])
    .slice(0, 10)
  const maximum = list[0]?.[rankMetric.value] || 1
  return list.map((streamer) => ({ ...streamer, pct: Math.round((streamer[rankMetric.value] / maximum) * 100) }))
})

function toggleMetric(value: string) {
  selectedMetrics.value = selectedMetrics.value.includes(value)
    ? selectedMetrics.value.filter((metric) => metric !== value)
    : [...selectedMetrics.value, value]
}

function exportRanking() {
  exportCsv(
    `主播排行_${Date.now()}.csv`,
    ['主播', 'ID', '收入', '弹幕', '互动', '场次'],
    [...ranking.value]
      .toSorted((left, right) => right[rankMetric.value] - left[rankMetric.value])
      .map((streamer) => [
        streamer.name,
        streamer.id,
        streamer.income.toFixed(2),
        streamer.danmaku,
        streamer.interaction,
        streamer.liveCount,
      ]),
  )
}

watch(selectedMetrics, updateChartOption, { deep: true })
watch(range, () => load(() => updateChartOption()))
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
  <div class="analyze-tab">
    <div class="flex justify-end">
      <URadioGroup
        v-model="range"
        :items="rangeOptions"
        value-key="value"
      />
    </div>
    <div
      v-if="loading"
      class="loading-state"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-5 animate-spin"
      />
    </div>
    <UEmpty
      v-else-if="!summary"
      icon="i-lucide-chart-no-axes-column"
      description="暂无分析数据"
    />
    <template v-else>
      <div class="summary-grid">
        <UCard
          v-for="card in summaryCards"
          :key="card.label"
        >
          <div class="summary-card">
            <span>{{ card.label }}</span>
            <strong
              >{{ card.money ? `¥${card.value.toFixed(card.precision ?? 0)}` : card.value.toLocaleString()
              }}<small v-if="card.suffix">{{ card.suffix }}</small></strong
            >
            <UBadge
              v-if="card.trend != null"
              :color="card.trend > 0 ? 'success' : card.trend < 0 ? 'error' : 'neutral'"
              variant="soft"
              size="xs"
            >
              <UIcon :name="card.trend >= 0 ? 'i-lucide-trending-up' : 'i-lucide-trending-down'" />
              {{ Math.abs(card.trend) }}%
            </UBadge>
          </div>
        </UCard>
      </div>

      <UCard>
        <template #header>
          <div class="card-header">
            <h2>趋势图表</h2>
            <div class="metric-list">
              <UButton
                v-for="metric in chartMetrics"
                :key="metric.value"
                size="xs"
                :color="selectedMetrics.includes(metric.value) ? 'primary' : 'neutral'"
                :variant="selectedMetrics.includes(metric.value) ? 'soft' : 'ghost'"
                @click="toggleMetric(metric.value)"
                >{{ metric.label }}</UButton
              >
            </div>
          </div>
        </template>
        <UEmpty
          v-if="!hasChartData"
          icon="i-lucide-chart-spline"
          description="暂无图表数据"
        />
        <div
          v-else
          ref="chartRef"
          class="chart"
        />
      </UCard>

      <UCard>
        <template #header
          ><div class="card-header">
            <h2>主播排行榜 Top 10</h2>
            <div class="flex flex-wrap items-center gap-2">
              <URadioGroup
                v-model="rankMetric"
                :items="rankOptions"
                value-key="value"
                size="sm"
              /><UButton
                size="sm"
                color="neutral"
                variant="soft"
                icon="i-lucide-download"
                :disabled="!ranking.length"
                @click="exportRanking"
                >导出</UButton
              >
            </div>
          </div></template
        >
        <UEmpty
          v-if="!topStreamers.length"
          icon="i-lucide-users-round"
          description="暂无主播数据"
        />
        <div
          v-else
          class="ranking-list"
        >
          <div
            v-for="(streamer, index) in topStreamers"
            :key="streamer.id"
            class="ranking-row"
          >
            <span
              class="rank-no"
              :class="{ top: index < 3 }"
              >{{ index + 1 }}</span
            ><OrgUserAvatar
              :face-url="streamer.faceUrl"
              :size="28"
            /><span class="streamer-name">{{ streamer.name }}</span>
            <div class="progress"><span :style="{ width: `${streamer.pct}%` }" /></div>
            <strong>{{ rankMetric === 'income' ? `¥${streamer.income.toFixed(0)}` : streamer[rankMetric] }}</strong>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>

<style scoped>
.analyze-tab {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.loading-state {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.summary-card {
  display: grid;
  gap: 6px;
}
.summary-card > span {
  color: var(--vtsuru-fg-muted);
  font-size: 0.8125rem;
}
.summary-card strong {
  font-size: 1.5rem;
}
.summary-card small {
  margin-left: 4px;
  color: var(--vtsuru-fg-muted);
  font-size: 0.75rem;
  font-weight: 400;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.card-header h2 {
  margin: 0;
  font-size: 1rem;
}
.metric-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chart {
  height: 420px;
  width: 100%;
}
.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ranking-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}
.rank-no {
  width: 22px;
  text-align: center;
  color: var(--vtsuru-fg-muted);
  font-weight: 600;
}
.rank-no.top {
  color: var(--vtsuru-primary);
}
.streamer-name {
  width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8125rem;
}
.progress {
  height: 8px;
  flex: 1;
  overflow: hidden;
  border-radius: 999px;
  background: var(--vtsuru-bg-muted);
}
.progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--vtsuru-primary);
}
.ranking-row strong {
  width: 90px;
  text-align: right;
  font-size: 0.8125rem;
}
@media (max-width: 800px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .card-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .streamer-name {
    width: 80px;
  }
}
</style>
