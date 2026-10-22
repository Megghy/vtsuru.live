import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getApiAnalyzeAll } from '@/api/generated/analyze/analyze'
import type { BackendAnalyzeData } from '@/apps/manage/composables/analyzeRange'

export const useAnalyzeStore = defineStore('manage-analyze', () => {
  const analyzeData = ref<BackendAnalyzeData | null>(null)
  const loading = ref(false)
  const refreshing = ref(false)
  const lastUpdateTime = ref<number>(0)
  const error = ref<string | null>(null)

  const hasData = computed(() => {
    if (!analyzeData.value) return false
    const chartKeys = Object.keys(analyzeData.value.chartData || {})
    const hasSessions = (analyzeData.value.sessions?.length || 0) > 0
    const hasSummary =
      (analyzeData.value.summary?.last30Days?.totalLiveMinutes || 0) > 0 ||
      (analyzeData.value.summary?.last30Days?.totalDanmakuCount || 0) > 0 ||
      (analyzeData.value.summary?.last30Days?.totalIncome || 0) > 0
    return chartKeys.length > 0 || hasSessions || hasSummary
  })

  /**
   * SWR 加载策略：
   * - 若无缓存：开启 loading 骨架态阻断
   * - 若已有缓存：立即秒开渲染，仅置 refreshing 进行后台静默拉取
   */
  async function loadData(): Promise<void> {
    const hasExistingData = !!analyzeData.value

    if (!hasExistingData) {
      loading.value = true
    } else {
      refreshing.value = true
    }
    error.value = null

    try {
      const response = await getApiAnalyzeAll()
      if (response.code === 200 && response.data) {
        analyzeData.value = response.data as unknown as BackendAnalyzeData
        lastUpdateTime.value = Date.now()
      } else {
        throw new Error(response.message || '获取分析数据失败')
      }
    } catch (err: any) {
      error.value = err?.message || '获取分析数据失败'
      throw err
    } finally {
      loading.value = false
      refreshing.value = false
    }
  }

  return {
    analyzeData,
    loading,
    refreshing,
    lastUpdateTime,
    error,
    hasData,
    loadData,
  }
})
