<script setup lang="ts">
import { DataTableColumns, NDataTable, NDivider, NFlex, NTag, NText, NTime, NTooltip } from 'naive-ui'
import { h } from 'vue'
import { EventDataTypes, PointFrom, ResponsePointHisrotyModel } from '@/api/api-models'

const props = defineProps<{
  histories: ResponsePointHisrotyModel[]
}>()

const historyColumn: DataTableColumns<ResponsePointHisrotyModel> = [
  {
    title: '时间',
    key: 'createAt',
    sorter: 'default',
    render: (row: ResponsePointHisrotyModel) => {
      return h(NTooltip, null, {
        trigger: () => h(NTime, { time: row.createAt, type: 'relative' }),
        default: () => h(NTime, { time: row.createAt }),
      })
    },
  },
  {
    title: '积分变动',
    key: 'point',
    render: (row: ResponsePointHisrotyModel) => {
      return h(NText, { style: { color: row.from === PointFrom.Use ? 'red' : 'green' } }, () => (row.from === PointFrom.Use ? '' : '+') + row.point)
    },
  },
  {
    title: '来自',
    key: 'from',
    filter(value, row) {
      return ~row.from == value
    },
    filterOptions: [
      {
        label: '直播间',
        value: PointFrom.Danmaku,
      },
      {
        label: '手动',
        value: PointFrom.Manual,
      },
      {
        label: '使用',
        value: PointFrom.Use,
      },
    ],
    render: (row: ResponsePointHisrotyModel) => {
      const get = () => {
        switch (row.from) {
          case PointFrom.Danmaku:
            return h(NTag, { type: 'info', bordered: false, size: 'small' }, () => '直播间')
          case PointFrom.Manual:
            return h(NTag, { type: 'success', bordered: false, size: 'small' }, () => '手动')
          case PointFrom.Use:
            return h(NTag, { type: 'warning', bordered: false, size: 'small' }, () => '使用')
        }
      }
      return h(NFlex, {}, () => get())
    },
  },
  {
    title: '详情',
    key: 'action',

    render: (row: ResponsePointHisrotyModel) => {
      switch (row.from) {
        case PointFrom.Danmaku:
          switch (row.type) {
            case EventDataTypes.Guard:
              return h(NFlex, { justify: 'center', align: 'center' }, () => [
                h(NTag, { type: 'info', size: 'small' }, () => '上舰'),
                h(NDivider, { vertical: true, style: { margin: '0' } }),
                row.extra?.msg,
              ])
            case EventDataTypes.Gift:
              return h(NFlex, { justify: 'center' }, () => [
                h(NTag, { type: 'info', size: 'small', style: { margin: '0' } }, () => '礼物'),
                h(NDivider, { vertical: true }),
                row.extra?.msg,
              ])
            case EventDataTypes.SC:
              return h(NFlex, { justify: 'center' }, () => [
                h(NTag, { type: 'info', size: 'small', style: { margin: '0' } }, () => 'SC'),
                h(NDivider, { vertical: true }),
                row.extra?.price,
              ])
          }
        case PointFrom.Manual:
          return h(NFlex, { align: 'center' }, () => [
            h(NTag, { type: 'info', size: 'small', style: { margin: '0' } }, () => '备注'),
            h(NDivider, { vertical: true }),
            h(NText, { depth: 3 }, () => row.extra ?? h(NText, { italic: true, depth: '3' }, () => '未提供')),
          ])
        case PointFrom.Use:
          return h(NFlex, { align: 'center' }, () => [
            h(NTag, { type: 'success', size: 'small', style: { margin: '0' }, strong: true }, () => '购买'),
            h(NDivider, { vertical: true }),
            row.extra,
          ])
      }
    },
  },
]
</script>

<template>
  <NDataTable
    :columns="historyColumn"
    :data="histories"
    :pagination="{ showSizePicker: true, pageSizes: [10, 25, 50, 100], defaultPageSize: 10, size: 'small' }"
  >
  </NDataTable>
</template>
