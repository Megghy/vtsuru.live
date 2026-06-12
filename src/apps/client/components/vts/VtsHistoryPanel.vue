<script setup lang="ts">
import { NButton, NCard, NDataTable, NFlex, NTag } from 'naive-ui'
import { computed, h } from 'vue'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type { VtsOpRecord } from '@/apps/client/store/useVtsStore'
import { useVtsAction } from './useVtsAction'

const vts = useVtsStore()
const { run } = useVtsAction()

const replayableKinds = new Set([
  'hotkeyTrigger', 'moveModel', 'injectParam', 'macroRun',
  'itemOpacity', 'dropItem', 'panicCalibrate', 'panicResetPhysics',
])

const columns = computed(() => [
  {
    title: '时间',
    key: 'ts',
    width: 100,
    render: (row: VtsOpRecord) => new Date(row.ts).toLocaleTimeString(),
  },
  {
    title: '操作',
    key: 'kind',
    width: 120,
  },
  {
    title: '状态',
    key: 'ok',
    width: 80,
    render: (row: VtsOpRecord) =>
      h(NTag, { type: row.ok ? 'success' : 'error', size: 'small' }, { default: () => row.ok ? 'OK' : '失败' }),
  },
  {
    title: '耗时',
    key: 'durationMs',
    width: 80,
    render: (row: VtsOpRecord) => row.durationMs != null ? `${row.durationMs}ms` : '-',
  },
  {
    title: '详情',
    key: 'detail',
    ellipsis: { tooltip: true as const },
    render: (row: VtsOpRecord) => row.detail ?? '',
  },
  {
    title: '错误',
    key: 'error',
    ellipsis: { tooltip: true as const },
    render: (row: VtsOpRecord) => row.error ?? '',
  },
  {
    title: '',
    key: 'op',
    width: 80,
    render: (row: VtsOpRecord) => {
      if (!row.payload || !replayableKinds.has(row.kind)) return ''
      return h(NButton, {
        size: 'tiny',
        disabled: !vts.canOperate,
        onClick: () => run(() => vts.replayHistoryRecord(row.id), '已回放'),
      }, { default: () => '回放' })
    },
  },
])
</script>

<template>
  <NCard size="small" bordered title="操作记录">
    <NFlex vertical :size="12">
      <NFlex justify="end">
        <NButton size="small" type="error" @click="run(() => vts.clearHistory(), '已清空')">
          清空
        </NButton>
      </NFlex>
      <NDataTable
        size="small"
        :columns="columns"
        :data="vts.history"
        :pagination="{ pageSize: 10 }"
        :bordered="false"
      />
    </NFlex>
  </NCard>
</template>
