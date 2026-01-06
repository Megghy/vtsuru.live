<script setup lang="ts">
import {
  NCard,
  NEmpty,
  NGrid,
  NGridItem,
  NIcon,
  NRadioButton,
  NRadioGroup,
  NSkeleton,
  NSpace,
  NStatistic,
  NTag,
} from 'naive-ui'
import { TrendingDown, TrendingUp } from '@vicons/ionicons5'

export type SummaryRange = 'last7Days' | 'last30Days'

interface SummaryData {
  totalIncome: number
  totalInteractions: number
  totalDanmakuCount: number
  totalLiveMinutes: number
  incomeTrend: number
  interactionTrend: number
  danmakuTrend: number
}

interface ChartMetric {
  label: string
  value: string
}

const props = defineProps<{
  loading: boolean
  summaryRange: SummaryRange
  summaryData: SummaryData | null
  chartMetrics: ChartMetric[]
  selectedMetrics: string[]
  hasChartData: boolean
  setChartRef: (el: HTMLElement | null) => void
}>()

const emit = defineEmits<{
  (e: 'update:summaryRange', value: SummaryRange): void
  (e: 'update:selectedMetrics', value: string[]): void
}>()

function getTrendType(value: number): 'success' | 'error' | 'default' {
  if (value > 0) return 'success'
  if (value < 0) return 'error'
  return 'default'
}

function toggleMetric(metricValue: string) {
  const exists = props.selectedMetrics.includes(metricValue)
  emit(
    'update:selectedMetrics',
    exists
      ? props.selectedMetrics.filter(x => x !== metricValue)
      : [...props.selectedMetrics, metricValue],
  )
}
</script>

<template>
  <div style="margin-bottom: 12px; display: flex; justify-content: flex-end;">
    <NRadioGroup
      :value="props.summaryRange"
      size="small"
      @update:value="v => emit('update:summaryRange', v as SummaryRange)"
    >
      <NRadioButton value="last7Days">
        近7日
      </NRadioButton>
      <NRadioButton value="last30Days">
        近30日
      </NRadioButton>
    </NRadioGroup>
  </div>

  <template v-if="props.loading">
    <NSkeleton text :repeat="4" />
  </template>

  <template v-else-if="!props.summaryData">
    <NEmpty description="暂无分析数据" />
  </template>

  <template v-else>
    <NGrid :x-gap="12" :y-gap="12" :cols="4" item-responsive responsive="screen">
      <NGridItem span="4 m:2 l:1">
        <NCard size="small" :bordered="false" class="stat-card">
          <NStatistic :label="props.summaryRange === 'last7Days' ? '近7日总收入' : '近30日总收入'" :value="props.summaryData.totalIncome" :precision="2">
            <template #prefix>
              ¥
            </template>
            <template #suffix>
              <NTag :type="getTrendType(props.summaryData.incomeTrend)" :bordered="false" size="tiny" style="vertical-align: middle; margin-left: 4px;">
                <template #icon>
                  <NIcon :component="props.summaryData.incomeTrend >= 0 ? TrendingUp : TrendingDown" />
                </template>
                {{ Math.abs(props.summaryData.incomeTrend) }}%
              </NTag>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      <NGridItem span="4 m:2 l:1">
        <NCard size="small" :bordered="false" class="stat-card">
          <NStatistic :label="props.summaryRange === 'last7Days' ? '近7日互动数' : '近30日互动数'" :value="props.summaryData.totalInteractions">
            <template #suffix>
              <NTag :type="getTrendType(props.summaryData.interactionTrend)" :bordered="false" size="tiny" style="vertical-align: middle; margin-left: 4px;">
                <template #icon>
                  <NIcon :component="props.summaryData.interactionTrend >= 0 ? TrendingUp : TrendingDown" />
                </template>
                {{ Math.abs(props.summaryData.interactionTrend) }}%
              </NTag>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      <NGridItem span="4 m:2 l:1">
        <NCard size="small" :bordered="false" class="stat-card">
          <NStatistic :label="props.summaryRange === 'last7Days' ? '近7日弹幕数' : '近30日弹幕数'" :value="props.summaryData.totalDanmakuCount">
            <template #suffix>
              <NTag :type="getTrendType(props.summaryData.danmakuTrend)" :bordered="false" size="tiny" style="vertical-align: middle; margin-left: 4px;">
                <template #icon>
                  <NIcon :component="props.summaryData.danmakuTrend >= 0 ? TrendingUp : TrendingDown" />
                </template>
                {{ Math.abs(props.summaryData.danmakuTrend) }}%
              </NTag>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      <NGridItem span="4 m:2 l:1">
        <NCard size="small" :bordered="false" class="stat-card">
          <NStatistic :label="props.summaryRange === 'last7Days' ? '近7日直播时长' : '近30日直播时长'" :value="props.summaryData.totalLiveMinutes">
            <template #suffix>
              min
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
    </NGrid>

    <NCard title="趋势图表" size="small" :segmented="{ content: true }" style="margin-top: 16px;">
      <template #header-extra>
        <NSpace>
          <NTag
            v-for="m in props.chartMetrics"
            :key="m.value"
            clickable
            :type="props.selectedMetrics.includes(m.value) ? 'primary' : 'default'"
            @click="toggleMetric(m.value)"
          >
            {{ m.label }}
          </NTag>
        </NSpace>
      </template>
      <div v-if="!props.hasChartData" style="padding: 12px;">
        <NEmpty description="暂无图表数据" />
      </div>
      <div v-else :ref="props.setChartRef" style="height: 420px; width: 100%;" />
    </NCard>
  </template>
</template>
