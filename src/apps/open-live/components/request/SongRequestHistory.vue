<script setup lang="ts">
import { ArrowCounterclockwise24Regular, Delete24Filled } from '@vicons/fluent'
import { format } from 'date-fns'
import { computed, ref } from 'vue'

import type { SongRequestInfo } from '@/api/client-types'
import { SongRequestFrom, SongRequestStatus } from '@/api/generated/model'
import { useLiveRequest } from '@/composables/useLiveRequest'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
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

const statusFilterOptions = [
  { label: '全部状态', value: 'all' },
  { label: '等待中', value: String(SongRequestStatus.Waiting) },
  { label: '正在演唱', value: String(SongRequestStatus.Singing) },
  { label: '已完成', value: String(SongRequestStatus.Finish) },
  { label: '已取消', value: String(SongRequestStatus.Cancel) },
]

const filteredSongs = computed(() => {
  let list = songRequest.songs || []

  // 状态筛选
  if (selectedStatusFilter.value !== 'all') {
    const targetStatus = Number(selectedStatusFilter.value)
    list = list.filter((s) => s.status === targetStatus)
  }

  // 曲名筛选
  if (songRequest.filterSongName) {
    const term = songRequest.filterSongName.toLowerCase()
    list = list.filter((s) =>
      songRequest.filterSongNameContains ? s.songName.toLowerCase().includes(term) : s.songName.toLowerCase() === term,
    )
  }

  // 用户筛选
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
        text: `SuperChat${row.price ? ` | ${row.price}` : ''}`,
        class: 'border-rose-500/40 text-rose-600 bg-rose-500/10',
      }
    case SongRequestFrom.Gift:
      return {
        text: `礼物${row.price ? ` | ${row.price}` : ''}`,
        class: 'border-amber-500/40 text-amber-600 bg-amber-500/10',
      }
    case SongRequestFrom.Manual:
      return { text: '手动添加', class: 'border-border text-muted-foreground bg-muted/40' }
    case SongRequestFrom.Web:
      return { text: '网页添加', class: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' }
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
    <!-- 筛选工具栏 -->
    <div class="flex items-center gap-2.5 flex-wrap">
      <div class="flex items-center gap-1.5 w-[250px]">
        <Input
          :value="songRequest.filterSongName"
          placeholder="搜索歌曲..."
          class="flex-1"
          @input="
            songRequest.filterSongName = ($event.target as HTMLInputElement).value
            currentPage = 1
          "
        />
        <label class="flex items-center gap-1 cursor-pointer text-xs shrink-0 select-none">
          <Checkbox
            :checked="songRequest.filterSongNameContains"
            @update:checked="songRequest.filterSongNameContains = $event"
          />
          <span>包含</span>
        </label>
      </div>

      <div class="flex items-center gap-1.5 w-[250px]">
        <Input
          :value="songRequest.filterName"
          placeholder="搜索用户..."
          class="flex-1"
          @input="
            songRequest.filterName = ($event.target as HTMLInputElement).value
            currentPage = 1
          "
        />
        <label class="flex items-center gap-1 cursor-pointer text-xs shrink-0 select-none">
          <Checkbox
            :checked="songRequest.filterNameContains"
            @update:checked="songRequest.filterNameContains = $event"
          />
          <span>包含</span>
        </label>
      </div>

      <div class="w-[120px]">
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
              class="text-xs"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="border rounded-md overflow-hidden bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="text-xs">曲名</TableHead>
            <TableHead class="text-xs">用户名</TableHead>
            <TableHead class="text-xs">来自</TableHead>
            <TableHead class="text-xs">状态</TableHead>
            <TableHead class="text-xs">时间</TableHead>
            <TableHead class="text-xs text-right w-[100px]">操作</TableHead>
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
              <TableCell class="text-xs font-medium">
                {{ row.songName }}
              </TableCell>

              <TableCell class="text-xs">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Badge
                        variant="outline"
                        class="text-[10px] h-4.5 px-1.5 cursor-help"
                      >
                        {{ row.from === 3 ? '手动添加' : row.user?.name || '未知用户' }}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ row.from === 3 ? '就是主播自己' : row.user?.uid || '未知ID' }}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>

              <TableCell class="text-xs">
                <Badge
                  variant="outline"
                  class="text-[10px] h-4.5 px-1.5"
                  :class="getFromBadge(row).class"
                >
                  {{ getFromBadge(row).text }}
                </Badge>
              </TableCell>

              <TableCell class="text-xs">
                <Badge
                  variant="outline"
                  class="text-[10px] h-4.5 px-1.5"
                  :class="getStatusBadge(row.status).class"
                >
                  {{ getStatusBadge(row.status).text }}
                </Badge>
              </TableCell>

              <TableCell class="text-xs text-muted-foreground whitespace-nowrap">
                {{ formatTime(row.createAt) }}
              </TableCell>

              <TableCell class="text-xs text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <TooltipProvider>
                    <Tooltip v-if="row.status === SongRequestStatus.Finish || row.status === SongRequestStatus.Cancel">
                      <TooltipTrigger as-child>
                        <Button
                          size="xs"
                          variant="ghost"
                          class="h-6 w-6 p-0 text-sky-600 hover:text-sky-700 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                          :disabled="songRequest.isLoading"
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
                                size="xs"
                                variant="ghost"
                                class="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                :disabled="songRequest.isLoading"
                              >
                                <Delete24Filled class="size-3.5" />
                              </Button>
                            </template>
                            确定删除此点歌记录？
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
                colspan="6"
                class="text-center py-8"
              >
                <Empty description="暂无符合条件的点歌记录" />
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
