<script setup lang="ts">
import { ArrowDownload24Regular, ArrowSync24Regular, CalendarLtr24Regular } from '@vicons/fluent'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { computed, onMounted, ref } from 'vue'

import type { ResponsePointHisrotyModel } from '@/api/api-models'
import { PointFrom } from '@/api/api-models'
import { getApiPointUserGetHistories } from '@/api/generated/point/point'
import AccountDataPanel from '@/apps/account/components/AccountDataPanel.vue'
import AccountPageHeader from '@/apps/account/components/AccountPageHeader.vue'
import PointHistoryCard from '@/shared/components/points/PointHistoryCard.vue'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { objectsToCSV, toast } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

const emit = defineEmits<{ dataLoaded: [] }>()
const auth = useBiliAuth()
const histories = ref<ResponsePointHisrotyModel[]>([])
const loading = ref(false)
const loaded = ref(false)
let generation = 0
let request: { generation: number; promise: Promise<void> } | undefined

const streamer = ref<string | null>(null)
const direction = ref<'all' | 'increase' | 'decrease'>('all')
const startDateStr = ref('')
const endDateStr = ref('')

const dateRange = computed<[number, number] | null>(() => {
  if (!startDateStr.value && !endDateStr.value) return null
  const start = startDateStr.value ? new Date(`${startDateStr.value}T00:00:00`).getTime() : 0
  const end = endDateStr.value ? new Date(`${endDateStr.value}T23:59:59.999`).getTime() : Infinity
  return [start, end]
})

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
    const result = (await getApiPointUserGetHistories({
      headers: Object.fromEntries(await auth.getBiliAuthHeaders()),
    })) as unknown as {
      code: number
      message?: string
      data: ResponsePointHisrotyModel[]
    }
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
      toast.error(error instanceof Error ? error.message : `获取积分记录失败: ${error}`)
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
  toast.success(`已导出 ${filteredHistories.value.length} 条记录`)
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
  startDateStr.value = ''
  endDateStr.value = ''
}

defineExpose({ getHistories: loadHistories, reset })

onMounted(() => void loadHistories())
</script>

<template>
  <div class="point-history-page flex flex-col gap-4">
    <AccountPageHeader
      title="积分记录"
      subtitle="追溯在所有主播频道的积分获取、消耗明细与时间流水。"
    >
      <template #actions>
        <Button
          variant="outline"
          :disabled="filteredHistories.length === 0"
          class="flex items-center gap-1.5"
          @click="exportHistories"
        >
          <component :is="ArrowDownload24Regular" class="size-4" />
          导出
        </Button>
        <Button
          variant="outline"
          :disabled="loading"
          class="flex items-center gap-1.5"
          @click="refresh"
        >
          <component :is="ArrowSync24Regular" class="size-4" :class="{ 'animate-spin': loading }" />
          刷新
        </Button>
      </template>
    </AccountPageHeader>

    <div v-if="loading" class="py-16 flex justify-center">
      <Spin />
    </div>

    <template v-else>
      <AccountDataPanel :stats="stats">
        <template #toolbar>
          <div class="history-toolbar flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/20 border-b border-border/60 text-xs">
            <div class="history-filters flex flex-wrap items-center gap-2">
              <Select
                :model-value="streamer || 'all'"
                @update:model-value="streamer = $event === 'all' ? null : String($event)"
              >
                <SelectTrigger class="w-40 h-8 text-xs">
                  <SelectValue placeholder="全部主播" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" class="text-xs">全部主播</SelectItem>
                  <SelectItem
                    v-for="opt in streamerOptions"
                    :key="opt.value"
                    :value="opt.value"
                    class="text-xs"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <div class="filter-direction flex items-center bg-muted/60 p-0.5 rounded-md border border-border/50">
                <button
                  type="button"
                  class="px-2.5 py-1 text-xs rounded transition cursor-pointer"
                  :class="direction === 'all' ? 'bg-background shadow-xs text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'"
                  @click="direction = 'all'"
                >
                  全部
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1 text-xs rounded transition cursor-pointer"
                  :class="direction === 'increase' ? 'bg-background shadow-xs text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'"
                  @click="direction = 'increase'"
                >
                  增加
                </button>
                <button
                  type="button"
                  class="px-2.5 py-1 text-xs rounded transition cursor-pointer"
                  :class="direction === 'decrease' ? 'bg-background shadow-xs text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'"
                  @click="direction = 'decrease'"
                >
                  减少
                </button>
              </div>

              <div class="filter-datepicker flex items-center gap-1.5 bg-background border border-border/80 px-2 py-0.5 rounded-md">
                <component :is="CalendarLtr24Regular" class="size-3.5 text-muted-foreground shrink-0" />
                <Input
                  v-model="startDateStr"
                  type="date"
                  class="h-7 w-32 px-1 text-xs border-0 shadow-none focus-visible:ring-0"
                />
                <span class="text-muted-foreground text-xs">至</span>
                <Input
                  v-model="endDateStr"
                  type="date"
                  class="h-7 w-32 px-1 text-xs border-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            <div class="history-toolbar__meta">
              <span class="filter-result text-xs text-muted-foreground font-mono">
                显示 {{ filteredHistories.length }} / {{ histories.length }} 条
              </span>
            </div>
          </div>
        </template>
      </AccountDataPanel>

      <PointHistoryCard :histories="filteredHistories" />
    </template>
  </div>
</template>

<style scoped>
.point-history-page {
  width: 100%;
}
</style>
