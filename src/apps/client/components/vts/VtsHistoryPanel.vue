<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { computed, h, resolveComponent } from 'vue'

import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type { VtsOpRecord } from '@/apps/client/store/useVtsStore'

import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const replayableKinds = new Set([
  'hotkeyTrigger',
  'moveModel',
  'injectParam',
  'macroRun',
  'itemOpacity',
  'dropItem',
  'panicCalibrate',
  'panicResetPhysics',
])

const columns = computed<TableColumn<VtsOpRecord>[]>(() => [
  {
    header: '时间',
    accessorKey: 'ts',
    cell: ({ row }) => new Date(row.original.ts).toLocaleTimeString(),
  },
  {
    header: '操作',
    accessorKey: 'kind',
  },
  {
    header: '状态',
    accessorKey: 'ok',
    cell: ({ row }) =>
      h(
        resolveComponent('UBadge'),
        { color: row.original.ok ? 'success' : 'error', size: 'sm' },
        { default: () => (row.original.ok ? 'OK' : '失败') },
      ),
  },
  {
    header: '耗时',
    accessorKey: 'durationMs',
    cell: ({ row }) => (row.original.durationMs != null ? `${row.original.durationMs}ms` : '-'),
  },
  {
    header: '详情',
    accessorKey: 'detail',
    cell: ({ row }) => row.original.detail ?? '',
  },
  {
    header: '错误',
    accessorKey: 'error',
    cell: ({ row }) => row.original.error ?? '',
  },
  {
    id: 'op',
    header: '',
    cell: ({ row }) => {
      const record = row.original
      if (!record.payload || !replayableKinds.has(record.kind)) return ''
      return h(
        resolveComponent('UButton'),
        {
          size: 'xs',
          disabled: !vts.canOperate,
          onClick: () => run(() => vts.replayHistoryRecord(record.id), '已回放'),
        },
        { default: () => '回放' },
      )
    },
  },
])
</script>

<template>
  <UCard
    size="small"
    bordered
    title="操作记录"
  >
    <div
      vertical
      :size="12"
    >
      <div justify="end">
        <UButton
          size="small"
          color="error"
          @click="run(() => vts.clearHistory(), '已清空')"
        >
          清空
        </UButton>
      </div>
      <UTable
        size="small"
        :columns="columns"
        :data="vts.history"
        :pagination="{ pageIndex: 1, pageSize: 10 }"
        :bordered="false"
      />
    </div>
  </UCard>
</template>
