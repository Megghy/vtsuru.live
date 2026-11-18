<script setup lang="ts">
import { computed, ref } from 'vue'

import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { REPLAYABLE_KINDS } from '@/apps/client/store/vts/operations'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Pagination } from '@/shared/ui/pagination'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tag } from '@/shared/ui/tag'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const currentPage = ref(1)
const pageSize = 10

const totalPages = computed(() => Math.max(1, Math.ceil(vts.history.length / pageSize)))
const pagedHistory = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return vts.history.slice(start, start + pageSize)
})
</script>

<template>
  <Card>
    <CardHeader class="py-3 px-4 flex flex-row items-center justify-between">
      <CardTitle>操作记录</CardTitle>
      <Popconfirm
        title="确认清空操作记录"
        description="确定要清空全部 VTS 操作历史记录吗？"
        positive-text="确认清空"
        @positive-click="run(() => vts.clearHistory(), '已清空')"
      >
        <template #trigger>
          <Button
            variant="destructive"
            :disabled="vts.history.length === 0"
          >
            清空
          </Button>
        </template>
      </Popconfirm>
    </CardHeader>
    <CardContent class="px-4 pb-4 flex flex-col gap-3">
      <div class="overflow-x-auto">
        <Table class="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead class="w-24">时间</TableHead>
              <TableHead class="w-28">操作</TableHead>
              <TableHead class="w-20">状态</TableHead>
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
              暂无记录
            </TableEmpty>
            <TableRow
              v-for="row in pagedHistory"
              :key="row.id"
            >
              <TableCell class="whitespace-nowrap">{{ new Date(row.ts).toLocaleTimeString() }}</TableCell>
              <TableCell class="font-medium whitespace-nowrap">{{ row.kind }}</TableCell>
              <TableCell class="whitespace-nowrap">
                <Tag
                  :variant="row.ok ? 'default' : 'destructive'"
                  class="text-[10px] py-0 px-1.5"
                >
                  {{ row.ok ? 'OK' : '失败' }}
                </Tag>
              </TableCell>
              <TableCell class="whitespace-nowrap">{{
                row.durationMs != null ? `${row.durationMs}ms` : '-'
              }}</TableCell>
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
                  class="px-1.5"
                  :disabled="!vts.connected"
                  @click="run(() => vts.replayHistoryRecord(row.id), '已回放')"
                >
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
        :total="vts.history.length"
      />
    </CardContent>
  </Card>
</template>
