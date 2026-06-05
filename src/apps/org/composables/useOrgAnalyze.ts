import { computed, nextTick, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { QueryGetAPI, unwrapOk } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'
import type { OrgContext } from './useOrgContext'
import type { AnalyzeData, SummaryRange } from '../types'

export function useOrgAnalyze(ctx: OrgContext) {
  const message = useMessage()
  const data = ref<AnalyzeData | null>(null)
  const loading = ref(true)
  const range = ref<SummaryRange>('last7Days')

  const summary = computed(() => data.value?.summary?.[range.value] ?? null)
  const hasChartData = computed(() =>
    !!data.value && Object.keys(data.value.chartData || {}).length > 0,
  )

  async function load(onLoaded?: () => Promise<void> | void) {
    if (!ctx.orgId.value) return
    loading.value = true
    try {
      data.value = unwrapOk(
        await QueryGetAPI<AnalyzeData>(`${ORG_API_URL}${ctx.orgId.value}/analyze`),
        '加载分析数据失败',
      )
      await nextTick()
      await onLoaded?.()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载分析数据失败')
    } finally {
      loading.value = false
    }
  }

  return { data, loading, range, summary, hasChartData, load }
}
