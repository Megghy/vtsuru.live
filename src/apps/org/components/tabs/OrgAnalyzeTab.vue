<script setup lang="ts">
import { NButton, NCard, NEmpty, NGrid, NGridItem, NIcon, NProgress, NRadioButton, NRadioGroup, NSkeleton, NFlex, NStatistic, NTag, useThemeVars } from 'naive-ui'
import { DownloadOutline, TrendingDown, TrendingUp } from '@vicons/ionicons5'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useOrgContext } from '../../composables/useOrgContext'
import { useOrgAnalyze } from '../../composables/useOrgAnalyze'
import { injectOrgLives } from '../../composables/useOrgLives'
import { useOrgAnalyzeChart } from '../useOrgAnalyzeChart'
import type { OrgAnalyzeChartMetric } from '../useOrgAnalyzeChart'
import { exportCsv, formatDate } from '../../utils'
import OrgUserAvatar from '../OrgUserAvatar.vue'

const ctx = useOrgContext()
const { data, loading, range, summary, hasChartData, load } = useOrgAnalyze(ctx)
const { ranking, load: loadLives } = injectOrgLives()
const themeVars = useThemeVars()

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
  chartRef, analyzeData: data, formatDate, themeVars, selectedMetrics, chartMetrics,
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
  const list = [...ranking.value].sort((a, b) => b[rankMetric.value] - a[rankMetric.value]).slice(0, 10)
  const max = list[0]?.[rankMetric.value] || 1
  return list.map(s => ({ ...s, pct: Math.round((s[rankMetric.value] / max) * 100) }))
})

function trendType(v: number): 'success' | 'error' | 'default' {
  if (v > 0) return 'success'
  if (v < 0) return 'error'
  return 'default'
}

function toggleMetric(value: string) {
  selectedMetrics.value = selectedMetrics.value.includes(value)
    ? selectedMetrics.value.filter(x => x !== value)
    : [...selectedMetrics.value, value]
}

function exportRanking() {
  exportCsv(
    `主播排行_${Date.now()}.csv`,
    ['主播', 'ID', '收入', '弹幕', '互动', '场次'],
    [...ranking.value]
      .sort((a, b) => b[rankMetric.value] - a[rankMetric.value])
      .map(s => [s.name, s.id, s.income.toFixed(2), s.danmaku, s.interaction, s.liveCount]),
  )
}

watch(selectedMetrics, updateChartOption, { deep: true })

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
  <NFlex justify="end" style="margin-bottom: 12px;">
    <NRadioGroup v-model:value="range" size="small">
      <NRadioButton value="last7Days">
        近7日
      </NRadioButton>
      <NRadioButton value="last30Days">
        近30日
      </NRadioButton>
    </NRadioGroup>
  </NFlex>

  <NSkeleton v-if="loading" text :repeat="4" />
  <NEmpty v-else-if="!summary" description="暂无分析数据" />
  <template v-else>
    <NGrid :x-gap="12" :y-gap="12" :cols="4" item-responsive responsive="screen">
      <NGridItem v-for="card in summaryCards" :key="card.label" span="4 m:2 l:1">
        <NCard size="small" :bordered="false" class="stat-card">
          <NStatistic :label="card.label" :value="card.value" :precision="card.precision">
            <template v-if="card.money" #prefix>
              ¥
            </template>
            <template #suffix>
              <span v-if="card.suffix">{{ card.suffix }}</span>
              <NTag v-else-if="card.trend != null" :type="trendType(card.trend)" :bordered="false" size="tiny" style="vertical-align: middle; margin-left: 4px;">
                <template #icon>
                  <NIcon :component="card.trend >= 0 ? TrendingUp : TrendingDown" />
                </template>
                {{ Math.abs(card.trend) }}%
              </NTag>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
    </NGrid>

    <NCard title="趋势图表" size="small" :segmented="{ content: true }" style="margin-top: 16px;">
      <template #header-extra>
        <NFlex>
          <NTag
            v-for="m in chartMetrics"
            :key="m.value"
            clickable
            :type="selectedMetrics.includes(m.value) ? 'primary' : 'default'"
            @click="toggleMetric(m.value)"
          >
            {{ m.label }}
          </NTag>
        </NFlex>
      </template>
      <NEmpty v-if="!hasChartData" description="暂无图表数据" style="padding: 12px;" />
      <div v-else ref="chartRef" style="height: 420px; width: 100%;" />
    </NCard>

    <NCard size="small" :segmented="{ content: true }" style="margin-top: 16px;">
      <template #header>
        主播排行榜 Top 10
      </template>
      <template #header-extra>
        <NFlex align="center">
          <NRadioGroup v-model:value="rankMetric" size="small">
            <NRadioButton value="income">
              收入
            </NRadioButton>
            <NRadioButton value="danmaku">
              弹幕
            </NRadioButton>
            <NRadioButton value="interaction">
              互动
            </NRadioButton>
          </NRadioGroup>
          <NButton size="small" secondary :disabled="ranking.length === 0" @click="exportRanking">
            <template #icon>
              <NIcon :component="DownloadOutline" />
            </template>
            导出
          </NButton>
        </NFlex>
      </template>
      <NEmpty v-if="topStreamers.length === 0" description="暂无主播数据" />
      <NFlex v-else vertical :size="10">
        <NFlex v-for="(s, i) in topStreamers" :key="s.id" align="center" :wrap="false" style="gap: 10px;">
          <span class="rank-no" :class="{ top: i < 3 }">{{ i + 1 }}</span>
          <OrgUserAvatar :face-url="s.faceUrl" :size="28" />
          <div style="width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px;">
            {{ s.name }}
          </div>
          <NProgress type="line" :percentage="s.pct" :show-indicator="false" :height="8" style="flex: 1;" />
          <span style="width: 90px; text-align: right; font-size: 13px; font-weight: 600;">
            {{ rankMetric === 'income' ? rankUnit.income + s.income.toFixed(0) : s[rankMetric] }}
            <span v-if="rankMetric !== 'income'" style="opacity: .6; font-weight: 400;"> {{ rankUnit[rankMetric] }}</span>
          </span>
        </NFlex>
      </NFlex>
    </NCard>
  </template>
</template>

<style scoped>
.stat-card {
  border: 1px solid var(--n-border-color);
}
.rank-no {
  width: 22px;
  text-align: center;
  font-weight: 600;
  opacity: .5;
  flex: 0 0 auto;
}
.rank-no.top {
  opacity: 1;
  color: var(--n-primary-color);
}
</style>
