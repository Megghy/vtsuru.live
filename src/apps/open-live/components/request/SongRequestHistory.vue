<script setup lang="ts">
import ArrowCounterclockwise24Regular from '@vicons/fluent/es/ArrowCounterclockwise24Regular'
import Delete24Filled from '@vicons/fluent/es/Delete24Filled'
import Timeline24Regular from '@vicons/fluent/es/Timeline24Regular'
import { format } from 'date-fns'
import { computed, onMounted, ref } from 'vue'

import type { SongRequestInfo } from '@/api/client-types'
import { SongRequestFrom, SongRequestStatus } from '@/api/generated/model'
import SongTimelineExportDialog from '@/components/song/SongTimelineExportDialog.vue'
import { useLiveRequest } from '@/composables/useLiveRequest'
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

const songRequest = useLiveRequest()

const currentPage = ref(1)
const pageSize = ref(10)
const selectedStatusFilter = ref<string>('all')
const selectedFromFilter = ref<string>('all')
const selectedRowIds = ref<number[]>([])
const showTimelineExport = ref(false)
const showStats = ref(true)

onMounted(() => {
  void songRequest.fetchStats()
})

const timelineEntries = computed(() =>
  (songRequest.songs || [])
    .filter((s) => s.status === SongRequestStatus.Finish || s.status === SongRequestStatus.Singing)
    .map((s) => ({
      title: s.songName,
      artist: s.song?.author?.join('/'),
      requester: s.from === SongRequestFrom.Manual ? undefined : s.user?.name,
      timeMs: s.startSingAt || s.finishAt || s.createAt,
    })),
)

const statusFilterOptions = [
  { label: '全部状态', value: 'all' },
  { label: '等待中', value: String(SongRequestStatus.Waiting) },
  { label: '正在演唱', value: String(SongRequestStatus.Singing) },
  { label: '已完成', value: String(SongRequestStatus.Finish) },
  { label: '已取消', value: String(SongRequestStatus.Cancel) },
]

const fromFilterOptions = [
  { label: '全部来源', value: 'all' },
  { label: '弹幕点播', value: String(SongRequestFrom.Danmaku) },
  { label: 'SuperChat', value: String(SongRequestFrom.SC) },
  { label: '礼物', value: String(SongRequestFrom.Gift) },
  { label: '网页歌单', value: String(SongRequestFrom.Web) },
  { label: '主播手动', value: String(SongRequestFrom.Manual) },
]

const filteredSongs = computed(() => {
  let list = songRequest.songs || []

  if (selectedStatusFilter.value !== 'all') {
    const targetStatus = Number(selectedStatusFilter.value)
    list = list.filter((s) => s.status === targetStatus)
  }

  if (selectedFromFilter.value !== 'all') {
    const targetFrom = Number(selectedFromFilter.value)
    list = list.filter((s) => s.from === targetFrom)
  }

  if (songRequest.filterSongName) {
    const term = songRequest.filterSongName.toLowerCase()
    list = list.filter((s) =>
      songRequest.filterSongNameContains ? s.songName.toLowerCase().includes(term) : s.songName.toLowerCase() === term,
    )
  }

  if (songRequest.filterName) {
    const term = songRequest.filterName.toLowerCase()
    list = list.filter((s) => {
      const uName = (s.user?.name || '').toLowerCase()
      return songRequest.filterNameContains ? uName.includes(term) : uName === term
    })
  }

  return list
})

const paginatedSongs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredSongs.value.slice(start, start + pageSize.value)
})

const isAllCurrentPageSelected = computed(() => {
  if (paginatedSongs.value.length === 0) return false
  return paginatedSongs.value.every((row) => selectedRowIds.value.includes(row.id))
})

function togglePageAll(checked: boolean) {
  const pageIds = paginatedSongs.value.map((r) => r.id)
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
  const items = songRequest.songs.filter((s) => idSet.has(s.id))
  if (items.length === 0) return
  await songRequest.deleteSongs(items)
  selectedRowIds.value = []
}

function formatTime(time: number | string | Date) {
  try {
    return format(new Date(time), 'yyyy-MM-dd HH:mm:ss')
  } catch {
    return ''
  }
}

function getFromBadge(row: SongRequestInfo) {
  switch (row.from) {
    case SongRequestFrom.Danmaku:
      return { text: '弹幕', class: 'border-sky-500/40 text-sky-600 bg-sky-500/10' }
    case SongRequestFrom.SC:
      return {
        text: `SC${row.price ? ` ¥${row.price}` : ''}`,
        class: 'border-rose-500/40 text-rose-600 bg-rose-500/10',
      }
    case SongRequestFrom.Gift:
      return {
        text: `礼物${row.price ? ` ¥${row.price}` : ''}`,
        class: 'border-amber-500/40 text-amber-600 bg-amber-500/10',
      }
    case SongRequestFrom.Manual:
      return { text: '手动添加', class: 'border-border text-muted-foreground bg-muted/40' }
    case SongRequestFrom.Web:
      return { text: '网页点歌', class: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' }
    default:
      return { text: '未知', class: 'border-border text-muted-foreground' }
  }
}

function getStatusBadge(status: SongRequestStatus) {
  switch (status) {
    case SongRequestStatus.Singing:
      return { text: '正在演唱', class: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' }
    case SongRequestStatus.Waiting:
      return { text: '等待中', class: 'border-amber-500/40 text-amber-600 bg-amber-500/10' }
    case SongRequestStatus.Finish:
      return { text: '已完成', class: 'border-sky-500/40 text-sky-600 bg-sky-500/10' }
    case SongRequestStatus.Cancel:
      return { text: '已取消', class: 'border-destructive/40 text-destructive bg-destructive/10' }
    default:
      return { text: songRequest.STATUS_MAP[status] || '未知', class: 'border-border' }
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <!-- 场次与历史统计 -->
    <Card v-if="songRequest.stats && showStats">
      <CardHeader class="p-3.5 pb-2 flex-row items-center justify-between space-y-0">
        <CardTitle class="text-sm font-semibold">点播统计概览</CardTitle>
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
            <div class="text-muted-foreground">累计点播</div>
            <div class="text-lg font-semibold tabular-nums mt-0.5">{{ songRequest.stats.totalCount }}</div>
          </div>
          <div class="rounded-md border border-border/70 bg-muted/20 p-2.5">
            <div class="text-muted-foreground">今日新增</div>
            <div class="text-lg font-semibold tabular-nums mt-0.5">{{ songRequest.stats.todayRequestCount }}</div>
          </div>
          <div class="rounded-md border border-border/70 bg-muted/20 p-2.5">
            <div class="text-muted-foreground">今日已唱</div>
            <div class="text-lg font-semibold tabular-nums text-emerald-600 mt-0.5">
              {{ songRequest.stats.todayFinishedCount }}
            </div>
          </div>
          <div class="rounded-md border border-border/70 bg-muted/20 p-2.5">
            <div class="text-muted-foreground">累计 SC 金额</div>
            <div class="text-lg font-semibold tabular-nums text-rose-600 mt-0.5">
              ¥{{ Number(songRequest.stats.totalScPrice ?? 0).toFixed(0) }}
            </div>
          </div>
          <div class="rounded-md border border-border/70 bg-muted/20 p-2.5">
            <div class="text-muted-foreground">净消耗积分</div>
            <div class="text-lg font-semibold tabular-nums mt-0.5">{{ songRequest.stats.totalPointCost }}</div>
          </div>
        </div>

        <div
          v-if="songRequest.stats.topSongs.length > 0 || songRequest.stats.topRequesters.length > 0"
          class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1"
        >
          <div
            v-if="songRequest.stats.topSongs.length > 0"
            class="flex items-center gap-1.5 flex-wrap"
          >
            <span class="text-muted-foreground shrink-0">热门点播:</span>
            <Badge
              v-for="item in songRequest.stats.topSongs.slice(0, 5)"
              :key="item.name"
              variant="secondary"
              size="xs"
            >
              {{ item.name }} ×{{ item.count }}
            </Badge>
          </div>
          <div
            v-if="songRequest.stats.topRequesters.length > 0"
            class="flex items-center gap-1.5 flex-wrap"
          >
            <span class="text-muted-foreground shrink-0">活跃观众:</span>
            <Badge
              v-for="item in songRequest.stats.topRequesters.slice(0, 5)"
              :key="item.name"
              variant="outline"
              size="xs"
            >
              {{ item.name }} ×{{ item.count }}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 筛选工具栏 -->
    <div class="flex items-center gap-2.5 flex-wrap">
      <div class="flex items-center gap-1.5 w-[230px]">
        <Input
          :model-value="songRequest.filterSongName"
          placeholder="搜索历史歌曲..."
          class="flex-1"
          @update:model-value="
            (val) => {
              songRequest.filterSongName = String(val ?? '')
              currentPage = 1
            }
          "
        />
        <label class="flex items-center gap-1 cursor-pointer text-xs shrink-0 select-none">
          <Checkbox v-model:checked="songRequest.filterSongNameContains" />
          <span>模糊</span>
        </label>
      </div>

      <div class="flex items-center gap-1.5 w-[230px]">
        <Input
          :model-value="songRequest.filterName"
          placeholder="搜索历史用户..."
          class="flex-1"
          @update:model-value="
            (val) => {
              songRequest.filterName = String(val ?? '')
              currentPage = 1
            }
          "
        />
        <label class="flex items-center gap-1 cursor-pointer text-xs shrink-0 select-none">
          <Checkbox v-model:checked="songRequest.filterNameContains" />
          <span>模糊</span>
        </label>
      </div>

      <div class="w-[125px]">
        <Select
          v-model="selectedStatusFilter"
          @update:model-value="currentPage = 1"
        >
          <SelectTrigger class="w-full">
            <SelectValue placeholder="状态筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in statusFilterOptions"
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
          v-model="selectedFromFilter"
          @update:model-value="currentPage = 1"
        >
          <SelectTrigger class="w-full">
            <SelectValue placeholder="来源筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in fromFilterOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="flex items-center gap-2 ml-auto flex-wrap">
        <Button
          v-if="songRequest.stats && !showStats"
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
              :disabled="songRequest.isLoading"
            >
              <Delete24Filled class="size-3.5 mr-1" />
              删除选中 ({{ selectedRowIds.length }})
            </Button>
          </template>
          此操作不可恢复。
        </Popconfirm>

        <Button
          variant="outline"
          class="gap-1.5"
          :disabled="timelineEntries.length === 0"
          @click="showTimelineExport = true"
        >
          <Timeline24Regular class="size-4" />
          导出时间轴
        </Button>
      </div>
    </div>

    <SongTimelineExportDialog
      v-model:open="showTimelineExport"
      :entries="timelineEntries"
      title="导出弹幕点播歌回时间轴"
    />

    <!-- 数据表格 -->
    <div class="border rounded-md overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-10">
              <Checkbox
                :checked="isAllCurrentPageSelected"
                aria-label="全选当前页"
                @update:checked="(val) => togglePageAll(Boolean(val))"
              />
            </TableHead>
            <TableHead>曲名</TableHead>
            <TableHead>点播人</TableHead>
            <TableHead>来源与费用</TableHead>
            <TableHead>状态</TableHead>
            <TableHead>时间</TableHead>
            <TableHead class="text-right w-[100px]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="paginatedSongs.length > 0">
            <TableRow
              v-for="row in paginatedSongs"
              :key="row.id"
              :class="
                row.status === SongRequestStatus.Singing || row.status === SongRequestStatus.Waiting
                  ? 'bg-primary/5 hover:bg-primary/10'
                  : ''
              "
            >
              <TableCell>
                <Checkbox
                  :checked="selectedRowIds.includes(row.id)"
                  aria-label="选择行"
                  @update:checked="(val) => toggleRow(row.id, Boolean(val))"
                />
              </TableCell>

              <TableCell class="font-medium">
                {{ row.songName }}
              </TableCell>

              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Badge
                        variant="outline"
                        size="xs"
                        class="cursor-help"
                      >
                        {{ row.from === SongRequestFrom.Manual ? '手动添加' : row.user?.name || '未知用户' }}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ row.from === SongRequestFrom.Manual ? '主播自己' : row.user?.uid || '未知ID' }}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>

              <TableCell>
                <div class="flex items-center gap-1 flex-wrap">
                  <Badge
                    variant="outline"
                    size="xs"
                    :class="getFromBadge(row).class"
                  >
                    {{ getFromBadge(row).text }}
                  </Badge>
                  <Badge
                    v-if="row.pointCost && row.pointCost > 0"
                    variant="secondary"
                    size="xs"
                  >
                    {{ row.pointCost }} 积分
                  </Badge>
                  <Badge
                    v-if="row.pointRefunded"
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
                  variant="outline"
                  size="xs"
                  :class="getStatusBadge(row.status).class"
                >
                  {{ getStatusBadge(row.status).text }}
                </Badge>
              </TableCell>

              <TableCell class="text-muted-foreground whitespace-nowrap">
                {{ formatTime(row.createAt) }}
              </TableCell>

              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <TooltipProvider>
                    <Tooltip v-if="row.status === SongRequestStatus.Finish || row.status === SongRequestStatus.Cancel">
                      <TooltipTrigger as-child>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          class="text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                          :disabled="songRequest.isLoading"
                          aria-label="放回待唱列表"
                          @click="songRequest.updateSongStatus(row, SongRequestStatus.Waiting)"
                        >
                          <ArrowCounterclockwise24Regular class="size-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>重新放回等待列表</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger as-child>
                        <div>
                          <Popconfirm
                            title="确认删除"
                            @positive-click="songRequest.deleteSongs([row])"
                          >
                            <template #trigger>
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                class="text-destructive hover:text-destructive hover:bg-destructive/10"
                                :disabled="songRequest.isLoading"
                                aria-label="删除记录"
                              >
                                <Delete24Filled class="size-3.5" />
                              </Button>
                            </template>
                            确定删除此点播记录？
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
          <template v-else>
            <TableRow>
              <TableCell
                colspan="7"
                class="text-center py-8"
              >
                <Empty description="暂无符合条件的点播记录" />
              </TableCell>
            </TableRow>
          </template>
        </TableBody>
      </Table>
    </div>

    <!-- 分页 -->
    <div
      v-if="filteredSongs.length > pageSize"
      class="flex justify-end pt-2"
    >
      <Pagination
        v-model:page="currentPage"
        v-model:page-size="pageSize"
        :total="filteredSongs.length"
        size="small"
      />
    </div>
  </div>
</template>
