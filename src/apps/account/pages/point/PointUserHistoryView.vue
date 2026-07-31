<script setup lang="ts">
import { ArrowDownload24Regular, ArrowSync24Regular } from '@vicons/fluent'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { NButton, NDatePicker, NFlex, NIcon, NRadioButton, NRadioGroup, NSelect, NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'

import type { ResponsePointHisrotyModel } from '@/api/api-models'
import { PointFrom } from '@/api/api-models'
import AccountDataPanel from '@/apps/account/components/AccountDataPanel.vue'
import PointHistoryCard from '@/shared/components/points/PointHistoryCard.vue'
import { POINT_API_URL } from '@/shared/config'
import { objectsToCSV } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

const emit = defineEmits<{ dataLoaded: [] }>()
const auth = useBiliAuth()
const message = useMessage()
const histories = ref<ResponsePointHisrotyModel[]>([])
const loading = ref(false)
const loaded = ref(false)
let generation = 0
let request: { generation: number; promise: Promise<void> } | undefined

const streamer = ref<string | null>(null)
const direction = ref<'all' | 'increase' | 'decrease'>('all')
const dateRange = ref<[number, number] | null>(null)

const filteredHistories = computed(() =>
  histories.value.filter((item) => {
    const matchesStreamer = !streamer.value || item.extra?.user?.name === streamer.value
    const matchesDirection =
      direction.value === 'all' || (direction.value === 'increase' ? item.point > 0 : item.point < 0)
    const matchesDate = !dateRange.value || (item.createAt >= dateRange.value[0] && item.createAt <= dateRange.value[1])
    return matchesStreamer && matchesDirection && matchesDate
  }),
)

const streamerOptions = computed(() =>
  [...new Set(histories.value.map((item) => item.extra?.user?.name).filter((name): name is string => !!name))]
    .toSorted((left, right) => left.localeCompare(right, 'zh-CN'))
    .map((name) => ({ label: name, value: name })),
)

const stats = computed(() => {
  const increase = filteredHistories.value.reduce((sum, item) => sum + Math.max(item.point, 0), 0)
  const decrease = Math.abs(filteredHistories.value.reduce((sum, item) => sum + Math.min(item.point, 0), 0))
  return [
    { label: '筛选记录', value: filteredHistories.value.length },
    { label: '获得积分', value: `+${Number(increase.toFixed(1))}`, tone: 'success' as const },
    { label: '消耗积分', value: `-${Number(decrease.toFixed(1))}`, tone: 'error' as const },
    { label: '净变化', value: Number((increase - decrease).toFixed(1)), tone: 'primary' as const },
  ]
})

const sourceText: Record<PointFrom, string> = {
  [PointFrom.Danmaku]: '直播互动',
  [PointFrom.Manual]: '主播调整',
  [PointFrom.Use]: '礼物兑换',
  [PointFrom.CheckIn]: '签到',
  [PointFrom.DailyFirstInteraction]: '每日首次互动',
}

async function loadHistories(force = false) {
  if (request?.generation === generation) return request.promise
  if (loaded.value && !force) return

  loading.value = true
  const currentGeneration = generation
  const promise = (async () => {
    const result = await auth.QueryBiliAuthGetAPI<ResponsePointHisrotyModel[]>(`${POINT_API_URL}user/get-histories`)
    if (result.code !== 200) throw new Error(result.message || '获取积分记录失败')
    if (currentGeneration !== generation) return
    histories.value = result.data
    loaded.value = true
    emit('dataLoaded')
  })()
  request = { generation: currentGeneration, promise }

  try {
    await promise
  } catch (error) {
    if (currentGeneration === generation) {
      message.error(error instanceof Error ? error.message : `获取积分记录失败: ${error}`)
    }
  } finally {
    if (request?.promise === promise) {
      request = undefined
      loading.value = false
    }
  }
}

function exportHistories() {
  const csv = objectsToCSV(
    filteredHistories.value.map((item) => ({
      时间: format(item.createAt, 'yyyy-MM-dd HH:mm:ss'),
      积分变化: Number(item.point.toFixed(1)),
      来源: sourceText[item.from],
      主播: item.extra?.user?.name || '-',
      礼物: item.extra?.goods?.name || '-',
      款式: item.extra?.selectedSubItems?.map((part) => `${part.nameSnapshot} x ${part.quantity}`).join('; ') || '-',
      数量: item.count || '-',
      备注: item.extra?.reason || item.extra?.remark || '-',
    })),
  )
  const bom = new Uint8Array([0xef, 0xbb, 0xbf])
  saveAs(
    new Blob([bom, new TextEncoder().encode(csv)], { type: 'text/csv;charset=utf-8;' }),
    `积分记录_${format(Date.now(), 'yyyy-MM-dd_HH-mm-ss')}.csv`,
  )
  message.success(`已导出 ${filteredHistories.value.length} 条记录`)
}

function refresh() {
  void loadHistories(true)
}

function reset() {
  generation += 1
  histories.value = []
  loaded.value = false
  loading.value = false
  streamer.value = null
  direction.value = 'all'
  dateRange.value = null
}

defineExpose({ getHistories: loadHistories, reset })

onMounted(() => void loadHistories())
</script>

<template>
  <NSpin :show="loading">
    <AccountDataPanel :stats="stats">
      <template #toolbar>
        <NFlex
          class="history-toolbar"
          align="center"
          justify="space-between"
          wrap
          :gap="8"
        >
          <NFlex
            class="history-filters"
            align="center"
            wrap
            :gap="8"
          >
            <NSelect
              v-model:value="streamer"
              :options="streamerOptions"
              clearable
              filterable
              placeholder="全部主播"
              style="width: 160px"
            />
            <NRadioGroup v-model:value="direction">
              <NRadioButton value="all">全部</NRadioButton>
              <NRadioButton value="increase">增加</NRadioButton>
              <NRadioButton value="decrease">减少</NRadioButton>
            </NRadioGroup>
            <NDatePicker
              v-model:value="dateRange"
              type="datetimerange"
              clearable
              placeholder="选择时间范围"
              style="width: 330px"
            />
            <span class="filter-result">显示 {{ filteredHistories.length }} / {{ histories.length }} 条</span>
          </NFlex>

          <NFlex :gap="8">
            <NButton
              secondary
              :disabled="filteredHistories.length === 0"
              @click="exportHistories"
            >
              <template #icon><NIcon :component="ArrowDownload24Regular" /></template>
              导出
            </NButton>
            <NButton
              secondary
              @click="refresh"
            >
              <template #icon><NIcon :component="ArrowSync24Regular" /></template>
              刷新
            </NButton>
          </NFlex>
        </NFlex>
      </template>
    </AccountDataPanel>

    <PointHistoryCard :histories="filteredHistories" />
  </NSpin>
</template>

<style scoped>
.filter-result {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

@media (max-width: 768px) {
  .history-toolbar,
  .history-filters {
    width: 100%;
  }

  .history-filters :deep(.n-select),
  .history-filters :deep(.n-date-picker) {
    width: 100% !important;
  }
}
</style>
