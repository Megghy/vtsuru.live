<script setup lang="ts">
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
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
const toast = useToast()
const histories = ref<ResponsePointHisrotyModel[]>([])
const loading = ref(false)
const loaded = ref(false)
let generation = 0
let request: { generation: number; promise: Promise<void> } | undefined

const streamer = ref<string | null>(null)
const direction = ref<'all' | 'increase' | 'decrease'>('all')
const dateStart = ref('')
const dateEnd = ref('')
const directionItems = [
  { label: '全部', value: 'all' },
  { label: '增加', value: 'increase' },
  { label: '减少', value: 'decrease' },
]

const filteredHistories = computed(() => {
  const startAt = dateStart.value ? new Date(dateStart.value).getTime() : -Infinity
  const endAt = dateEnd.value ? new Date(dateEnd.value).getTime() : Infinity
  return histories.value.filter((item) => {
    const matchesStreamer = !streamer.value || item.extra?.user?.name === streamer.value
    const matchesDirection =
      direction.value === 'all' || (direction.value === 'increase' ? item.point > 0 : item.point < 0)
    const matchesDate = item.createAt >= startAt && item.createAt <= endAt
    return matchesStreamer && matchesDirection && matchesDate
  })
})

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
      toast.add({ title: error instanceof Error ? error.message : `获取积分记录失败: ${error}`, color: 'error' })
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
  toast.add({ title: `已导出 ${filteredHistories.value.length} 条记录`, color: 'success' })
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
  dateStart.value = ''
  dateEnd.value = ''
}

defineExpose({ getHistories: loadHistories, reset })

onMounted(() => void loadHistories())
</script>

<template>
  <div :aria-busy="loading">
    <AccountDataPanel :stats="stats">
      <template #toolbar>
        <div class="history-toolbar">
          <div class="history-filters">
            <USelectMenu
              v-model="streamer"
              class="history-filter-control history-filter-control--streamer"
              :items="streamerOptions"
              value-key="value"
              clear
              placeholder="全部主播"
            />
            <URadioGroup
              v-model="direction"
              :items="directionItems"
              value-key="value"
              variant="table"
              orientation="horizontal"
            />
            <div class="history-date-range">
              <UInput
                v-model="dateStart"
                type="datetime-local"
                aria-label="开始时间"
              />
              <span>至</span>
              <UInput
                v-model="dateEnd"
                type="datetime-local"
                aria-label="结束时间"
              />
            </div>
            <span class="filter-result">显示 {{ filteredHistories.length }} / {{ histories.length }} 条</span>
          </div>

          <div class="history-actions">
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-download"
              :disabled="filteredHistories.length === 0"
              @click="exportHistories"
            >
              导出
            </UButton>
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-refresh-cw"
              :loading="loading"
              @click="refresh"
            >
              刷新
            </UButton>
          </div>
        </div>
      </template>
    </AccountDataPanel>

    <UEmpty
      v-if="loading"
      loading
      title="正在加载积分记录"
    />
    <PointHistoryCard
      v-else
      :histories="filteredHistories"
    />
  </div>
</template>

<style scoped>
.history-toolbar,
.history-filters,
.history-actions,
.history-date-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-toolbar,
.history-filters {
  flex-wrap: wrap;
}

.history-toolbar {
  justify-content: space-between;
}

.history-filter-control--streamer {
  width: 160px;
}

.history-date-range span,
.filter-result {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

@media (max-width: 768px) {
  .history-toolbar,
  .history-filters,
  .history-actions,
  .history-date-range,
  .history-date-range :deep(input) {
    width: 100%;
  }

  .history-date-range {
    flex-wrap: wrap;
  }

  .history-date-range span {
    display: none;
  }

  .history-filter-control--streamer {
    width: 100%;
  }
}
</style>
