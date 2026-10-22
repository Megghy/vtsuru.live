<script setup lang="ts">
import { computed, ref } from 'vue'

import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { REPLAYABLE_KINDS } from '@/apps/client/store/vts/operations'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
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
      <CardTitle class="text-sm font-semibold">操作记录</CardTitle>
      <Button variant="destructive" @click="run(() => vts.clearHistory(), '已清空')"
      >
        清空
      </Button>
    </CardHeader>
    <CardContent class="px-4 pb-4 pt-0 flex flex-col gap-3">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="border-b border-[var(--border)] text-[var(--muted-foreground)]">
              <th class="py-2 px-2 font-medium w-24">时间</th>
              <th class="py-2 px-2 font-medium w-28">操作</th>
              <th class="py-2 px-2 font-medium w-20">状态</th>
              <th class="py-2 px-2 font-medium w-20">耗时</th>
              <th class="py-2 px-2 font-medium">详情</th>
              <th class="py-2 px-2 font-medium">错误</th>
              <th class="py-2 px-2 font-medium w-16 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="pagedHistory.length === 0"
              class="border-b border-[var(--border)]"
            >
              <td
                colspan="7"
                class="py-6 text-center text-[var(--muted-foreground)]"
              >
                暂无记录
              </td>
            </tr>
            <tr
              v-for="row in pagedHistory"
              :key="row.id"
              class="border-b border-[var(--border)] hover:bg-[var(--popover)]"
            >
              <td class="py-2 px-2 whitespace-nowrap">{{ new Date(row.ts).toLocaleTimeString() }}</td>
              <td class="py-2 px-2 font-medium whitespace-nowrap">{{ row.kind }}</td>
              <td class="py-2 px-2 whitespace-nowrap">
                <Tag
                  :variant="row.ok ? 'default' : 'destructive'"
                  class="text-[10px] py-0 px-1.5"
                >
                  {{ row.ok ? 'OK' : '失败' }}
                </Tag>
              </td>
              <td class="py-2 px-2 whitespace-nowrap">{{ row.durationMs != null ? `${row.durationMs}ms` : '-' }}</td>
              <td
                class="py-2 px-2 truncate max-w-xs"
                :title="row.detail"
              >
                {{ row.detail ?? '' }}
              </td>
              <td
                class="py-2 px-2 truncate max-w-xs text-red-400"
                :title="row.error"
              >
                {{ row.error ?? '' }}
              </td>
              <td class="py-2 px-2 text-right whitespace-nowrap">
                <Button v-if="row.payload && REPLAYABLE_KINDS.has(row.kind)" variant="outline" class="h-6 text-[11px] px-1.5" :disabled="!vts.connected" @click="run(() => vts.replayHistoryRecord(row.id), '已回放')"
                >
                  回放
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="totalPages > 1"
        class="flex items-center justify-end gap-2 pt-2 text-xs"
      >
        <Button variant="outline" :disabled="currentPage <= 1" @click="currentPage--">
          上一页
        </Button>
        <span class="text-[var(--muted-foreground)]">{{ currentPage }} / {{ totalPages }}</span>
        <Button variant="outline" :disabled="currentPage>= totalPages"
          @click="currentPage++"
        >
          下一页
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
