<script setup lang="ts">
import { NButton, NCard, NDataTable, NFlex, NTag, useMessage } from 'naive-ui'
import { computed, h } from 'vue'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import type { VtsOpRecord } from '@/apps/client/store/useVtsStore'

const vts = useVtsStore()
const message = useMessage()

function canReplay(row: VtsOpRecord) {
  if (!row.payload) return false
  return [
    'hotkeyTrigger',
    'moveModel',
    'injectParam',
    'macroRun',
    'itemOpacity',
    'dropItem',
    'panicCalibrate',
    'panicResetPhysics',
  ].includes(row.kind)
}

const columns = computed(() => {
  return [
    {
      title: '时间',
      key: 'ts',
      width: 120,
      render: (row: VtsOpRecord) => new Date(row.ts).toLocaleTimeString(),
    },
    {
      title: '类型',
      key: 'kind',
      width: 130,
      render: (row: VtsOpRecord) => row.kind,
    },
    {
      title: '状态',
      key: 'ok',
      width: 90,
      render: (row: VtsOpRecord) => {
        return row.ok
          ? h(NTag, { type: 'success' }, { default: () => 'OK' })
          : h(NTag, { type: 'error' }, { default: () => 'FAIL' })
      },
    },
    {
      title: '耗时',
      key: 'durationMs',
      width: 90,
      render: (row: VtsOpRecord) => (row.durationMs != null ? `${row.durationMs}ms` : '-'),
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
      title: '错误码',
      key: 'errorCode',
      width: 120,
      render: (row: VtsOpRecord) => row.errorCode ?? '',
    },
    {
      title: '操作',
      key: 'op',
      width: 90,
      render: (row: VtsOpRecord) => {
        if (!canReplay(row)) return ''
        return h(NButton, {
          size: 'tiny',
          disabled: !vts.canOperate,
          onClick: async () => {
            try {
              await vts.replayHistoryRecord(row.id)
              message.success('已回放')
            } catch (err) {
              message.error(err instanceof Error ? err.message : String(err))
            }
          },
        }, { default: () => '回放' })
      },
    },
  ]
})

async function clear() {
  await vts.clearHistory()
  message.success('已清空历史')
}
</script>

<template>
  <NCard size="small" title="操作历史">
    <NFlex vertical :size="10">
      <NFlex justify="space-between" align="center" :wrap="true" :size="8">
        <div />
        <NButton size="small" type="error" @click="clear">
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
