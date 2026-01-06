<script setup lang="ts">
import type {
  DataTableColumns,
} from 'naive-ui'
import type { ResponsePointGoodModel, ResponsePointHisrotyModel } from '@/api/api-models'
import {
  NButton,
  NDataTable,
  NDivider,
  NEmpty,
  NFlex,
  NInput,
  NModal,
  NTag,
  NText,
  NTime,
  NTooltip,
} from 'naive-ui'
import { h, ref } from 'vue'
import { EventDataTypes, PointFrom } from '@/api/api-models'
import PointGoodsItem from './PointGoodsItem.vue'

defineProps<{
  histories: ResponsePointHisrotyModel[]
}>()

// 礼物详情模态框
const showGoodsModal = ref(false)
const currentGoods = ref<ResponsePointGoodModel>()

// 数据表格列定义
const historyColumn: DataTableColumns<ResponsePointHisrotyModel> = [
  {
    title: '时间',
    key: 'createAt',
    sorter: (row1: ResponsePointHisrotyModel, row2: ResponsePointHisrotyModel) => row1.createAt - row2.createAt,
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
    sorter: (row1: ResponsePointHisrotyModel, row2: ResponsePointHisrotyModel) => row1.point - row2.point,
    render: (row: ResponsePointHisrotyModel) => {
      const point = Number(row.point.toFixed(1))
      return h(
        NText,
        { style: { color: point < 0 ? 'red' : 'green' } },
        () => (point < 0 ? '' : '+') + point,
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
      {
        label: '签到',
        value: PointFrom.CheckIn,
      },
      {
        label: '每日首次互动',
        value: PointFrom.DailyFirstInteraction,
      },
    ],
    render: (row: ResponsePointHisrotyModel) => {
      const get = () => {
        switch (row.from) {
          case PointFrom.Danmaku:
            return h(NFlex, { align: 'center' }, () => [
              h(NTag, { type: 'info', bordered: false, size: 'small' }, () => '直播间'),
              row.extra?.user
                ? h(
                    NButton,
                    {
                      tag: 'a',
                      href: `/@${row.extra.user?.name}`,
                      target: '_blank',
                      text: true,
                      type: 'success',
                    },
                    () => row.extra.user?.name,
                  )
                : null,
            ])
          case PointFrom.Manual:
            return h(NFlex, { align: 'center' }, () => [
              h(
                NTag,
                { type: row.point > 0 ? 'success' : 'error', bordered: false, size: 'small' },
                () => `主播${row.point > 0 ? '赠予' : '扣除'}`,
              ),
              row.extra?.user
                ? h(
                    NButton,
                    {
                      tag: 'a',
                      href: `/@${row.extra.user?.name}`,
                      target: '_blank',
                      text: true,
                      type: 'info',
                    },
                    () => row.extra.user?.name,
                  )
                : null,
            ])
          case PointFrom.Use:
            return h(NFlex, { align: 'center' }, () => [
              h(NTag, { type: 'warning', bordered: false, size: 'small' }, () => '使用'),
              row.extra?.user
                ? h(
                    NButton,
                    {
                      tag: 'a',
                      href: `/@${row.extra.user?.name}`,
                      target: '_blank',
                      text: true,
                      type: 'success',
                    },
                    () => row.extra.user?.name,
                  )
                : null,
            ])
          case PointFrom.CheckIn:
            return h(NFlex, { align: 'center' }, () => [
              h(NTag, { type: 'success', bordered: false, size: 'small' }, () => '签到'),
              row.extra?.user
                ? h(
                    NButton,
                    {
                      tag: 'a',
                      href: `/@${row.extra.user?.name}`,
                      target: '_blank',
                      text: true,
                      type: 'success',
                    },
                    () => row.extra.user?.name,
                  )
                : null,
            ])
          case PointFrom.DailyFirstInteraction:
            return h(NFlex, { align: 'center' }, () => [
              h(NTag, { type: 'primary', bordered: false, size: 'small' }, () => '首次互动'),
              row.extra?.user
                ? h(
                    NButton,
                    {
                      tag: 'a',
                      href: `/@${row.extra.user?.name}`,
                      target: '_blank',
                      text: true,
                      type: 'info',
                    },
                    () => row.extra.user?.name,
                  )
                : null,
            ])
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
              return h(NFlex, { align: 'center' }, () => [
                h(NTag, { type: 'error', size: 'small' }, () => '上舰'),
                row.extra?.danmaku.msg,
              ])
            case EventDataTypes.Gift:
              return h(NFlex, { align: 'center' }, () => [
                h(NTag, { type: 'info', size: 'small', style: { margin: '0' } }, () => '礼物'),
                row.extra?.danmaku.msg,
                h(
                  NTag,
                  { type: 'warning', size: 'tiny', style: { margin: '0' }, bordered: false },
                  () => `${row.count ?? 1}个`,
                ),
              ])
            case EventDataTypes.SC:
              return h(NFlex, { align: 'center' }, () => [
                h(NTag, { type: 'warning', size: 'small', style: { margin: '0' } }, () => 'SC'),
                row.extra?.danmaku.price,
              ])
          }
          break
        case PointFrom.Manual:
          return h(NFlex, { align: 'center' }, () => [
            h(NTag, { type: 'info', size: 'small', style: { margin: '0' } }, () => '来自'),
            h(
              NButton,
              {
                tag: 'a',
                href: `/@${row.extra.user?.name}`,
                target: '_blank',
                text: true,
                type: 'info',
              },
              () => row.extra.user?.name,
            ),
            h(NTag, { type: 'info', size: 'small', style: { margin: '0' }, bordered: false }, () => '备注'),
            h(NText, {}, () => row.extra.reason ?? h(NText, { italic: true, depth: '3' }, () => '未提供')),
          ])
        case PointFrom.DailyFirstInteraction: {
          // 每日首次互动奖励
          const interactionType = row.extra?.interactionType
          return h(NFlex, { align: 'center' }, () => [
            h(NTag, {
              type: interactionType === 'danmaku' ? 'info' : 'warning',
              size: 'small',
              bordered: false,
            }, () => interactionType === 'danmaku' ? '弹幕' : '礼物'),
            h('span', {}, interactionType === 'danmaku' ? row.extra?.danmaku?.msg : `${row.extra?.danmaku?.msg} x ${row.extra?.danmaku?.num}`),
          ])
        }
        case PointFrom.Use:
          return h(NFlex, { align: 'center' }, () => [
            h(NTag, { type: 'success', size: 'small', style: { margin: '0' }, strong: true }, () => '兑换'),
            row.extra?.goods
              ? h(
                  NButton,
                  {
                    text: true,
                    type: 'info',
                    onClick: () => {
                      currentGoods.value = row.extra?.goods
                      showGoodsModal.value = true
                    },
                  },
                  () => row.extra?.goods?.name,
                )
              : h(NText, { depth: 3, italic: true }, () => '(商品已删除)'),
            row.extra?.isDiscontinued
              ? h(NTag, { type: 'error', size: 'tiny', bordered: false }, () => '已下架')
              : null,
            row.extra?.remark
              ? h(NTooltip, null, {
                  trigger: () => h(NTag, { type: 'info', size: 'tiny', bordered: false }, () => '留言'),
                  default: () => row.extra.remark,
                })
              : null,
          ])
      }
      return null
    },
  },
]
</script>

<template>
  <!-- 无数据时显示提示 -->
  <NEmpty
    v-if="!histories || histories.length === 0"
    description="暂无积分历史记录"
  />

  <!-- 有数据时显示表格 -->
  <NDataTable
    v-else
    :columns="historyColumn"
    :data="histories"
    :pagination="{
      showSizePicker: true,
      pageSizes: [10, 25, 50, 100],
      defaultPageSize: 10,
      size: 'small',
    }"
  />

  <!-- 商品详情模态框 -->
  <NModal
    v-model:show="showGoodsModal"
    preset="card"
    title="礼物详情 (快照)"
    style="max-width: 400px; height: auto"
  >
    <PointGoodsItem :goods="currentGoods" />
    <template v-if="currentGoods?.content">
      <NDivider>礼物内容</NDivider>
      <NInput
        :value="currentGoods?.content"
        type="textarea"
        readonly
        placeholder="无内容"
      />
    </template>
  </NModal>
</template>
