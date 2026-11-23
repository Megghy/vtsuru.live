import { computed, ref } from 'vue'

import { getApiOrgOrgIdAnalyze } from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import { toast } from '@/shared/utils'

import type { AnalyzeData, SummaryRange } from '../types'
import type { OrgContext } from './useOrgContext'

export function useOrgAnalyze(ctx: OrgContext) {
  const data = ref<AnalyzeData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const range = ref<SummaryRange>('last7Days')
  const chartDays = ref<number>(30)

  const summary = computed(() => data.value?.summary?.[range.value] ?? null)
  const hasChartData = computed(() => !!data.value && Object.keys(data.value.chartData || {}).length > 0)

  async function load(days = chartDays.value) {
    if (!ctx.orgId.value) return
    loading.value = true
    error.value = null
    try {
      data.value = unwrapOk((await getApiOrgOrgIdAnalyze(ctx.orgId.value, { days })) as any, '加载分析数据失败')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载分析数据失败'
      error.value = msg
      toast.error(msg)
    } finally {
      loading.value = false
    }
  }

  return { data, loading, error, range, chartDays, summary, hasChartData, load }
}
