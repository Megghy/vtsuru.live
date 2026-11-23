<script setup lang="ts">
import { RotateCcw, Search, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import { useVtsStore, VTS_OP_KIND_LABELS, type VtsOpKind } from '@/apps/client/store/useVtsStore'
import { REPLAYABLE_KINDS } from '@/apps/client/store/vts/operations'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/shared/ui/table'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const currentPage = ref(1)
const pageSize = 10
const kindFilter = ref<'__all__' | VtsOpKind>('__all__')
const statusFilter = ref<'__all__' | 'ok' | 'fail'>('__all__')
const keyword = ref('')

const kindOptions = Object.entries(VTS_OP_KIND_LABELS).map(([value, label]) => ({
  value: value as VtsOpKind,
  label,
}))

const filteredHistory = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return vts.history.filter((row) => {
    if (kindFilter.value !== '__all__' && row.kind !== kindFilter.value) return false
    if (statusFilter.value === 'ok' && !row.ok) return false
    if (statusFilter.value === 'fail' && row.ok) return false
    if (q) {
      const label = VTS_OP_KIND_LABELS[row.kind] ?? row.kind
      return [label, row.kind, row.detail, row.error].some((s) => s?.toLowerCase().includes(q))
    }
    return true
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredHistory.value.length / pageSize)))

watch([kindFilter, statusFilter, keyword], () => {
  currentPage.value = 1
})

watch(totalPages, (maxPage) => {
  if (currentPage.value > maxPage) currentPage.value = maxPage
})

const pagedHistory = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredHistory.value.slice(start, start + pageSize)
})

function handleClear() {
  run(async () => {
    await vts.clearHistory()
    currentPage.value = 1
  }, '已清空')
}
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2">
        <CardTitle>操作记录</CardTitle>
        <Badge
          variant="secondary"
          size="xs"
          class="tabular-nums"
        >
          {{ filteredHistory.length }} / {{ vts.history.length }}
        </Badge>
      </div>
      <Popconfirm
        title="确认清空全部 VTS 操作历史记录？"
        @confirm="handleClear"
      >
        <Button
          size="xs"
          variant="outline"
          class="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
          :disabled="vts.history.length === 0"
        >
          <Trash2 class="size-3" />
          清空
        </Button>
      </Popconfirm>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="relative min-w-[180px] flex-1">
          <Search
            class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <Input
            v-model="keyword"
            placeholder="搜索详情或错误信息"
            class="pl-8"
          />
        </div>
        <div class="w-32">
          <Select v-model="kindFilter">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="操作类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部类型</SelectItem>
              <SelectItem
                v-for="opt in kindOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="w-24">
          <Select v-model="statusFilter">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部</SelectItem>
              <SelectItem value="ok">成功</SelectItem>
              <SelectItem value="fail">失败</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div class="overflow-x-auto">
        <Table class="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead class="w-24">时间</TableHead>
              <TableHead class="w-28">操作</TableHead>
              <TableHead class="w-16">状态</TableHead>
              <TableHead class="w-20">耗时</TableHead>
              <TableHead>详情</TableHead>
              <TableHead>错误</TableHead>
              <TableHead class="w-16 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableEmpty
              v-if="pagedHistory.length === 0"
              :colspan="7"
            >
              暂无匹配的操作记录
            </TableEmpty>
            <TableRow
              v-for="row in pagedHistory"
              :key="row.id"
            >
              <TableCell class="whitespace-nowrap tabular-nums text-muted-foreground">
                {{ new Date(row.ts).toLocaleTimeString() }}
              </TableCell>
              <TableCell class="font-medium whitespace-nowrap">
                {{ VTS_OP_KIND_LABELS[row.kind] ?? row.kind }}
              </TableCell>
              <TableCell class="whitespace-nowrap">
                <Badge
                  :variant="row.ok ? 'success' : 'destructive'"
                  size="xs"
                >
                  {{ row.ok ? '成功' : '失败' }}
                </Badge>
              </TableCell>
              <TableCell class="whitespace-nowrap tabular-nums text-muted-foreground">
                {{ row.durationMs != null ? `${row.durationMs}ms` : '-' }}
              </TableCell>
              <TableCell
                class="truncate max-w-xs"
                :title="row.detail"
              >
                {{ row.detail ?? '' }}
              </TableCell>
              <TableCell
                class="truncate max-w-xs text-destructive"
                :title="row.error"
              >
                {{ row.error ?? '' }}
              </TableCell>
              <TableCell class="text-right whitespace-nowrap">
                <Button
                  v-if="row.payload && REPLAYABLE_KINDS.has(row.kind)"
                  size="xs"
                  variant="outline"
                  class="gap-1"
                  :disabled="!vts.connected"
                  @click="run(() => vts.replayHistoryRecord(row.id), '已回放')"
                >
                  <RotateCcw class="size-3" />
                  回放
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <Pagination
        v-if="totalPages > 1"
        v-model:page="currentPage"
        :page-size="pageSize"
        :total="filteredHistory.length"
      />
    </CardContent>
  </Card>
</template>
