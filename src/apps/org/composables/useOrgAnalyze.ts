import { computed, nextTick, ref } from 'vue'

import { getApiOrgOrgIdAnalyze } from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import { toast } from '@/shared/utils'

import type { AnalyzeData, SummaryRange } from '../types'
import type { OrgContext } from './useOrgContext'

export function useOrgAnalyze(ctx: OrgContext) {
  const data = ref<AnalyzeData | null>(null)
  const loading = ref(true)
  const range = ref<SummaryRange>('last7Days')

  const summary = computed(() => data.value?.summary?.[range.value] ?? null)
  const hasChartData = computed(() => !!data.value && Object.keys(data.value.chartData || {}).length > 0)

  async function load(onLoaded?: () => Promise<void> | void) {
    if (!ctx.orgId.value) return
    loading.value = true
    try {
      data.value = unwrapOk(
        (await getApiOrgOrgIdAnalyze(ctx.orgId.value)) as any,
        '加载分析数据失败',
      )
      await nextTick()
      await onLoaded?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载分析数据失败')
    } finally {
      loading.value = false
    }
  }

  return { data, loading, range, summary, hasChartData, load }
}
