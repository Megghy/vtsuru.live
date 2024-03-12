<script setup lang="ts">
import { EventDataTypes, PointFrom, ResponsePointGoodModel, ResponsePointHisrotyModel } from '@/api/api-models'
import {
  DataTableColumns,
  NButton,
  NDataTable,
  NDivider,
  NFlex,
  NInput,
  NModal,
  NTag,
  NText,
  NTime,
  NTooltip,
} from 'naive-ui'
import { h, ref } from 'vue'
import PointGoodsItem from './PointGoodsItem.vue'

const props = defineProps<{
  histories: ResponsePointHisrotyModel[]
}>()

const showGoodsModal = ref(false)
const currentGoods = ref<ResponsePointGoodModel>()

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
      return h(
        NText,
        { style: { color: row.point < 0 ? 'red' : 'green' } },
        () => (row.point < 0 ? '' : '+') + row.point,
      )
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
        label: '主播操作',
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
            return h(
              NTag,
              { type: 'success', bordered: false, size: 'small' },
              () => '主播' + (row.point > 0 ? '赠予' : '扣除'),
            )
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
                h(NTag, { type: 'error', size: 'small' }, () => '上舰'),
                row.extra?.msg,
              ])
            case EventDataTypes.Gift:
              return h(NFlex, { justify: 'center' }, () => [
                h(NTag, { type: 'info', size: 'small', style: { margin: '0' } }, () => '礼物'),
                row.extra?.msg,
              ])
            case EventDataTypes.SC:
              return h(NFlex, { justify: 'center' }, () => [
                h(NTag, { type: 'warning', size: 'small', style: { margin: '0' } }, () => 'SC'),
                row.extra?.price,
              ])
          }
        case PointFrom.Manual:
          return h(NFlex, { align: 'center' }, () => [
            h(NTag, { type: 'info', size: 'small', style: { margin: '0' } }, () => '来自'),
            h(
              NButton,
              {
                tag: 'a',
                href: '/@' + row.extra.user?.name,
                target: '_blank',
                text: true,
                type: 'info',
                secondary: true,
              },
              () => row.extra.user?.name,
            ),
            h(NTag, { type: 'info', size: 'small', style: { margin: '0' }, bordered: false }, () => '备注'),
            h(NText, {}, () => row.extra.reason ?? h(NText, { italic: true, depth: '3' }, () => '未提供')),
          ])
        case PointFrom.Use:
          return h(NFlex, { align: 'center' }, () => [
            h(NTag, { type: 'success', size: 'small', style: { margin: '0' }, strong: true }, () => '兑换'),
            h(
              NButton,
              {
                text: true,
                type: 'info',
                onClick: () => {
                  currentGoods.value = row.extra
                  showGoodsModal.value = true
                },
              },
              () => row.extra?.name,
            ),
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
  <NModal v-model:show="showGoodsModal" preset="card" title="礼物详情 (快照)" style="max-width: 400px; height: auto">
    <PointGoodsItem :goods="currentGoods" />
    <template v-if="currentGoods?.content">
      <NDivider> 礼物内容 </NDivider>
      <NInput :value="currentGoods?.content" type="textarea" readonly placeholder="无内容" />
    </template>
  </NModal>
</template>
