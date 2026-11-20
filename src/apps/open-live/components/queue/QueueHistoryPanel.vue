<script setup lang="ts">
import ArrowCounterclockwise24Regular from '@vicons/fluent/es/ArrowCounterclockwise24Regular'
import Delete24Filled from '@vicons/fluent/es/Delete24Filled'
import { format } from 'date-fns'
import { computed, onMounted, ref } from 'vue'

import { QueueFrom, QueueStatus } from '@/api/generated/model'
import { getQueueSourceText, STATUS_MAP, useQueue } from '@/composables/useQueue'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { normalizeTimestampMs } from '@/shared/utils/queue'

const store = useQueue()

const currentPage = ref(1)
const pageSize = ref(10)
const statusFilter = ref<string>('all')
const fromFilter = ref<string>('all')
const selectedRowIds = ref<number[]>([])
const showStats = ref(true)

onMounted(() => {
  void store.fetchStats()
})

const statusOptions = [
  { label: '全部状态', value: 'all' },
  { label: '已完成', value: String(QueueStatus.Finish) },
  { label: '已取消', value: String(QueueStatus.Cancel) },
]

const fromOptions = [
  { label: '全部来源', value: 'all' },
  { label: '弹幕排队', value: String(QueueFrom.Danmaku) },
  { label: '礼物排队', value: String(QueueFrom.Gift) },
  { label: '网页排队', value: String(QueueFrom.Web) },
  { label: '主播手动', value: String(QueueFrom.Manual) },
]

const filteredHistory = computed(() => {
  let list = store.historySongs

  if (statusFilter.value !== 'all') {
    const target = Number(statusFilter.value)
    list = list.filter((q) => q.status === target)
  }

  if (fromFilter.value !== 'all') {
    const target = Number(fromFilter.value)
    list = list.filter((q) => q.from === target)
  }

  if (store.filterName.trim()) {
    const term = store.filterName.trim().toLowerCase()
    list = list.filter((q) => {
      const name = (q.user?.name || '').toLowerCase()
      return store.filterNameContains ? name.includes(term) : name === term
    })
  }

  return list
})

const paginatedHistory = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredHistory.value.slice(start, start + pageSize.value)
})

const isPageAllSelected = computed(() => {
  if (paginatedHistory.value.length === 0) return false
  return paginatedHistory.value.every((r) => selectedRowIds.value.includes(r.id))
})

function togglePageAll(checked: boolean) {
  const pageIds = paginatedHistory.value.map((r) => r.id)
  if (checked) {
    selectedRowIds.value = Array.from(new Set([...selectedRowIds.value, ...pageIds]))
  } else {
    const pageSet = new Set(pageIds)
    selectedRowIds.value = selectedRowIds.value.filter((id) => !pageSet.has(id))
  }
}

function toggleRow(id: number, checked: boolean) {
  if (checked) {
    if (!selectedRowIds.value.includes(id)) selectedRowIds.value = [...selectedRowIds.value, id]
  } else {
    selectedRowIds.value = selectedRowIds.value.filter((item) => item !== id)
  }
}

async function handleBatchDelete() {
  const idSet = new Set(selectedRowIds.value)
  const items = store.historySongs.filter((q) => idSet.has(q.id))
  if (items.length === 0) return
  await store.deleteQueue(items)
  selectedRowIds.value = []
}

function formatTime(timestamp?: number | null) {
  if (!timestamp) return '-'
  try {
    return format(new Date(normalizeTimestampMs(timestamp)), 'yyyy-MM-dd HH:mm:ss')
  } catch {
    return '-'
  }
}

function getFromBadgeVariant(from: QueueFrom) {
  switch (from) {
    case QueueFrom.Danmaku:
      return 'outline' as const
    case QueueFrom.Gift:
      return 'destructive' as const
    case QueueFrom.Web:
      return 'success' as const
    default:
      return 'secondary' as const
  }
}
</script>

<template>
  <div class="space-y-3">
    <!-- 统计概览 -->
    <Card v-if="store.stats && showStats">
      <CardHeader class="p-3.5 pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle class="text-sm font-semibold">排队统计概览</CardTitle>
        <Button
          size="xs"
          variant="ghost"
          @click="showStats = false"
        >
          收起
        </Button>
      </CardHeader>
      <CardContent class="p-3.5 pt-1 space-y-3">
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs">
          <div class="rounded-md border border-border/70 bg-muted/20 p-2.5">
            <div class="text-muted-foreground">累计排队人次</div>
            <div class="text-lg font-semibold tabular-nums mt-0.5">{{ store.stats.totalCount }}</div>
          </div>
          <div class="rounded-md border border-border/70 bg-muted/20 p-2.5">
            <div class="text-muted-foreground">今日新增</div>
            <div class="text-lg font-semibold tabular-nums mt-0.5">{{ store.stats.todayJoinCount }}</div>
          </div>
          <div class="rounded-md border border-border/70 bg-muted/20 p-2.5">
            <div class="text-muted-foreground">今日已完成</div>
            <div class="text-lg font-semibold tabular-nums text-emerald-600 mt-0.5">
              {{ store.stats.todayFinishedCount }}
            </div>
          </div>
          <div class="rounded-md border border-border/70 bg-muted/20 p-2.5">
            <div class="text-muted-foreground">累计礼物收益</div>
            <div class="text-lg font-semibold tabular-nums text-rose-600 mt-0.5">
              ¥{{ Number(store.stats.totalGiftPrice ?? 0).toFixed(1) }}
            </div>
          </div>
          <div class="rounded-md border border-border/70 bg-muted/20 p-2.5">
            <div class="text-muted-foreground">净消耗积分</div>
            <div class="text-lg font-semibold tabular-nums mt-0.5">{{ store.stats.totalPointCost }}</div>
          </div>
        </div>

        <div
          v-if="store.stats.topUsers.length > 0"
          class="flex items-center gap-1.5 flex-wrap text-xs pt-1"
        >
          <span class="text-muted-foreground shrink-0">常驻排队观众:</span>
          <Badge
            v-for="item in store.stats.topUsers.slice(0, 6)"
            :key="item.name"
            variant="secondary"
            size="xs"
          >
            {{ item.name }} ×{{ item.count }}
          </Badge>
        </div>
      </CardContent>
    </Card>

    <!-- 筛选栏 -->
    <div class="flex items-center gap-2.5 flex-wrap">
      <div class="flex items-center gap-1.5 w-[230px]">
        <Input
          :model-value="store.filterName"
          placeholder="搜索历史用户..."
          class="flex-1"
          @update:model-value="
            (val) => {
              store.filterName = String(val ?? '')
              currentPage = 1
            }
          "
        />
        <label class="flex items-center gap-1 cursor-pointer text-xs shrink-0 select-none">
          <Checkbox v-model:checked="store.filterNameContains" />
          <span>模糊</span>
        </label>
      </div>

      <div class="w-[125px]">
        <Select
          v-model="statusFilter"
          @update:model-value="currentPage = 1"
        >
          <SelectTrigger class="w-full">
            <SelectValue placeholder="状态筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in statusOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="w-[125px]">
        <Select
          v-model="fromFilter"
          @update:model-value="currentPage = 1"
        >
          <SelectTrigger class="w-full">
            <SelectValue placeholder="来源筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in fromOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="flex items-center gap-2 ml-auto">
        <Button
          v-if="store.stats && !showStats"
          variant="outline"
          @click="showStats = true"
        >
          显示统计
        </Button>

        <Popconfirm
          v-if="selectedRowIds.length > 0"
          :title="`确认删除选中的 ${selectedRowIds.length} 条记录？`"
          @positive-click="handleBatchDelete"
        >
          <template #trigger>
            <Button
              variant="outline"
              class="border-destructive/40 text-destructive hover:bg-destructive/10"
              :disabled="store.isLoading"
            >
              <Delete24Filled class="size-3.5 mr-1" />
              删除选中 ({{ selectedRowIds.length }})
            </Button>
          </template>
          此操作不可恢复。
        </Popconfirm>
      </div>
    </div>

    <!-- 历史表格 -->
    <div class="border rounded-md overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-10">
              <Checkbox
                :checked="isPageAllSelected"
                aria-label="全选当前页"
                @update:checked="(val) => togglePageAll(Boolean(val))"
              />
            </TableHead>
            <TableHead>观众</TableHead>
            <TableHead>来源与消费</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>加入时间</TableHead>
            <TableHead class="text-right w-[100px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="paginatedHistory.length > 0">
            <TableRow
              v-for="item in paginatedHistory"
              :key="item.id"
              class="text-xs"
            >
              <TableCell>
                <Checkbox
                  :checked="selectedRowIds.includes(item.id)"
                  aria-label="选择历史记录"
                  @update:checked="(val) => toggleRow(item.id, Boolean(val))"
                />
              </TableCell>
              <TableCell class="font-medium">
                {{ item.user?.name || '未知用户' }}
              </TableCell>
              <TableCell>
                <div class="flex items-center gap-1 flex-wrap">
                  <Badge
                    :variant="getFromBadgeVariant(item.from)"
                    size="xs"
                  >
                    {{ getQueueSourceText(item) }}
                  </Badge>
                  <Badge
                    v-if="item.pointCost && item.pointCost > 0"
                    variant="secondary"
                    size="xs"
                  >
                    {{ item.pointCost }} 积分
                  </Badge>
                  <Badge
                    v-if="item.pointRefunded"
                    variant="outline"
                    size="xs"
                    class="border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                  >
                    已退积分
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  :variant="item.status === QueueStatus.Finish ? 'success' : 'destructive'"
                  size="xs"
                >
                  {{ STATUS_MAP[item.status] || '未知' }}
                </Badge>
              </TableCell>
              <TableCell class="font-mono text-muted-foreground whitespace-nowrap">
                {{ formatTime(item.createAt) }}
              </TableCell>
              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          class="text-sky-600 hover:bg-sky-500/10"
                          :disabled="store.isLoading"
                          aria-label="放回等待队列"
                          @click="store.updateStatus(item, QueueStatus.Waiting)"
                        >
                          <ArrowCounterclockwise24Regular class="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>重新放回等待队列</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger as-child>
                        <div>
                          <Popconfirm
                            title="确认删除"
                            @positive-click="store.deleteQueue([item])"
                          >
                            <template #trigger>
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                class="text-destructive hover:bg-destructive/10"
                                :disabled="store.isLoading"
                                aria-label="删除历史记录"
                              >
                                <Delete24Filled class="size-3.5" />
                              </Button>
                            </template>
                            确定删除此条历史排队记录？
                          </Popconfirm>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>删除记录</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell
              colspan="6"
              class="text-center py-8"
            >
              <Empty description="暂无符合条件的历史排队记录" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <div
      v-if="filteredHistory.length > pageSize"
      class="flex justify-end pt-2"
    >
      <Pagination
        v-model:page="currentPage"
        v-model:page-size="pageSize"
        :total="filteredHistory.length"
        size="small"
      />
    </div>
  </div>
</template>
