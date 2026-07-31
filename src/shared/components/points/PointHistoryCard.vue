<script setup lang="ts">
import type { DataTableColumns, TagProps } from 'naive-ui'
import {
  NButton,
  NDataTable,
  NDivider,
  NEmpty,
  NFlex,
  NInput,
  NModal,
  NPagination,
  NTag,
  NText,
  NTime,
  NTooltip,
} from 'naive-ui'
import { computed, h, ref, watch } from 'vue'

import type { ResponsePointHisrotyModel } from '@/api/api-models'
import { EventDataTypes, PointFrom } from '@/api/api-models'
import { formatDanmakuPrice, getDanmakuGiftDisplayMeta } from '@/shared/utils/danmakuGiftDisplay'

import PointGoodsItem from './PointGoodsItem.vue'

const props = defineProps<{
  histories: ResponsePointHisrotyModel[]
}>()

type TagType = NonNullable<TagProps['type']>

const page = ref(1)
const pageSize = 10
const showGoodsModal = ref(false)
const currentHistory = ref<ResponsePointHisrotyModel>()
const currentGoods = computed(() => currentHistory.value?.extra?.goods)
const selectedSubItems = computed(() => currentHistory.value?.extra?.selectedSubItems ?? [])
const pagedHistories = computed(() => props.histories.slice((page.value - 1) * pageSize, page.value * pageSize))

watch(
  () => props.histories,
  () => (page.value = 1),
)

const sourceOptions = [
  { label: '直播互动', value: PointFrom.Danmaku },
  { label: '主播调整', value: PointFrom.Manual },
  { label: '礼物兑换', value: PointFrom.Use },
  { label: '签到', value: PointFrom.CheckIn },
  { label: '首次互动', value: PointFrom.DailyFirstInteraction },
]

function sourceMeta(row: ResponsePointHisrotyModel): { label: string; type: TagType } {
  switch (row.from) {
    case PointFrom.Danmaku:
      return { label: '直播互动', type: 'info' }
    case PointFrom.Manual:
      return { label: row.point >= 0 ? '主播赠予' : '主播扣除', type: row.point >= 0 ? 'success' : 'error' }
    case PointFrom.Use:
      return { label: '礼物兑换', type: 'warning' }
    case PointFrom.CheckIn:
      return { label: '签到', type: 'success' }
    case PointFrom.DailyFirstInteraction:
      return { label: '首次互动', type: 'info' }
  }
}

function giftDetail(row: ResponsePointHisrotyModel) {
  const danmaku = row.extra?.danmaku
  if (!danmaku) return '礼物详情缺失'
  const gift = getDanmakuGiftDisplayMeta({ ...danmaku, num: row.count ?? danmaku.num })
  return [
    gift.giftSummaryText,
    gift.mysteryBoxPriceText ? `盲盒 ￥${gift.mysteryBoxPriceText}` : '',
    gift.giftPriceText ? `价值 ￥${gift.giftPriceText}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function detailText(row: ResponsePointHisrotyModel) {
  switch (row.from) {
    case PointFrom.Danmaku:
      if (row.type === EventDataTypes.Guard) return `上舰 · ${row.extra?.danmaku?.msg || '舰长支持'}`
      if (row.type === EventDataTypes.Gift) return giftDetail(row)
      if (row.type === EventDataTypes.SC) {
        return `SC ￥${formatDanmakuPrice(row.extra?.danmaku?.price) ?? row.extra?.danmaku?.price ?? 0}`
      }
      return row.extra?.danmaku?.msg || '直播互动'
    case PointFrom.Manual:
      return row.extra?.reason || '未填写调整备注'
    case PointFrom.Use: {
      const variants = row.extra?.selectedSubItems?.map((item) => `${item.nameSnapshot} x ${item.quantity}`).join(' / ')
      return [row.extra?.goods?.name || '已删除的礼物', variants, row.extra?.remark].filter(Boolean).join(' · ')
    }
    case PointFrom.CheckIn:
      return '每日签到奖励'
    case PointFrom.DailyFirstInteraction:
      return row.extra?.interactionType === 'gift' ? giftDetail(row) : row.extra?.danmaku?.msg || '每日首次互动奖励'
  }
}

function openGoods(row: ResponsePointHisrotyModel) {
  currentHistory.value = row
  showGoodsModal.value = true
}

function renderSource(row: ResponsePointHisrotyModel) {
  const source = sourceMeta(row)
  return h(NFlex, { align: 'center', gap: 6, wrap: false }, () => [
    h(NTag, { type: source.type, bordered: false, size: 'small' }, () => source.label),
    row.extra?.user?.name
      ? h(
          NButton,
          { text: true, type: 'primary', tag: 'a', href: `/@${row.extra.user.name}`, target: '_blank' },
          () => row.extra?.user?.name,
        )
      : null,
  ])
}

function renderDetail(row: ResponsePointHisrotyModel) {
  const content = detailText(row)
  if (row.from === PointFrom.Use && row.extra?.goods) {
    return h(NFlex, { vertical: true, gap: 2, align: 'start' }, () => [
      h(NButton, { text: true, type: 'primary', onClick: () => openGoods(row) }, () => row.extra?.goods?.name),
      content !== row.extra.goods.name ? h(NText, { depth: 3, style: { fontSize: '12px' } }, () => content) : null,
    ])
  }
  return h(NTooltip, null, {
    trigger: () => h('span', { class: 'history-detail-cell' }, content),
    default: () => content,
  })
}

const columns: DataTableColumns<ResponsePointHisrotyModel> = [
  {
    title: '时间',
    key: 'createAt',
    width: 130,
    sorter: (left, right) => left.createAt - right.createAt,
    render: (row) => h(NTime, { time: row.createAt, type: 'relative' }),
  },
  {
    title: '积分变动',
    key: 'point',
    width: 104,
    sorter: (left, right) => left.point - right.point,
    render: (row) => {
      const point = Number(row.point.toFixed(1))
      return h(
        'strong',
        { class: point < 0 ? 'point-value point-value--out' : 'point-value point-value--in' },
        `${point > 0 ? '+' : ''}${point}`,
      )
    },
  },
  {
    title: '来源',
    key: 'from',
    width: 190,
    filter: (value, row) => row.from === value,
    filterOptions: sourceOptions,
    render: renderSource,
  },
  { title: '详情', key: 'detail', minWidth: 220, render: renderDetail },
]
</script>

<template>
  <NEmpty
    v-if="histories.length === 0"
    description="暂无积分记录"
  />

  <template v-else>
    <NDataTable
      class="desktop-history-table"
      :columns="columns"
      :data="histories"
      :pagination="{ defaultPageSize: 10, showSizePicker: true, pageSizes: [10, 25, 50, 100] }"
      size="small"
    />

    <div class="mobile-history-list">
      <article
        v-for="item in pagedHistories"
        :key="`${item.ouId}-${item.createAt}-${item.from}`"
        class="mobile-history-card"
      >
        <div class="mobile-history-card__topline">
          <NTag
            :type="sourceMeta(item).type"
            size="small"
            :bordered="false"
          >
            {{ sourceMeta(item).label }}
          </NTag>
          <strong :class="item.point < 0 ? 'point-value--out' : 'point-value--in'">
            {{ item.point > 0 ? '+' : '' }}{{ Number(item.point.toFixed(1)) }}
          </strong>
        </div>
        <div class="mobile-history-card__detail">{{ detailText(item) }}</div>
        <div class="mobile-history-card__meta">
          <NButton
            v-if="item.extra?.user?.name"
            text
            type="primary"
            tag="a"
            :href="`/@${item.extra.user.name}`"
            target="_blank"
          >
            {{ item.extra.user.name }}
          </NButton>
          <span v-else />
          <NTime
            :time="item.createAt"
            type="relative"
          />
        </div>
        <NButton
          v-if="item.from === PointFrom.Use && item.extra?.goods"
          size="small"
          secondary
          @click="openGoods(item)"
        >
          查看礼物快照
        </NButton>
      </article>

      <NPagination
        v-if="histories.length > pageSize"
        v-model:page="page"
        :page-size="pageSize"
        :item-count="histories.length"
        simple
      />
    </div>
  </template>

  <NModal
    v-if="currentHistory"
    v-model:show="showGoodsModal"
    preset="card"
    title="礼物快照"
    class="history-goods-modal"
  >
    <NFlex
      vertical
      :gap="12"
    >
      <PointGoodsItem
        v-if="currentGoods"
        :goods="currentGoods"
        :show-footer="false"
      />

      <template v-if="selectedSubItems.length">
        <NDivider>已选款式</NDivider>
        <div class="history-variant-grid">
          <div
            v-for="item in selectedSubItems"
            :key="item.subItemId"
            class="history-variant"
          >
            <strong>{{ item.nameSnapshot }}</strong>
            <span>x {{ item.quantity }}</span>
            <NTag
              size="tiny"
              type="info"
              :bordered="false"
            >
              {{ item.priceSnapshot }} 积分
            </NTag>
          </div>
        </div>
      </template>

      <template v-if="currentGoods?.content">
        <NDivider>礼物内容</NDivider>
        <NInput
          :value="currentGoods.content"
          type="textarea"
          readonly
          :autosize="{ minRows: 2, maxRows: 8 }"
        />
      </template>

      <template v-if="currentHistory.extra?.remark">
        <NDivider>兑换留言</NDivider>
        <NText>{{ currentHistory.extra.remark }}</NText>
      </template>
    </NFlex>
  </NModal>
</template>

<style scoped>
:deep(.point-value),
.mobile-history-card strong {
  font-variant-numeric: tabular-nums;
}

:deep(.point-value--in),
.point-value--in {
  color: var(--vtsuru-success);
}

:deep(.point-value--out),
.point-value--out {
  color: var(--vtsuru-error);
}

:deep(.history-detail-cell) {
  display: block;
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-history-list {
  display: none;
}

:global(.history-goods-modal) {
  width: min(520px, calc(100vw - 24px));
  max-width: calc(100vw - 24px);
}

.history-variant-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.history-variant {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 5px 8px;
  padding: 10px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-elevated);
}

.history-variant .n-tag {
  grid-column: 1 / -1;
  justify-self: start;
}

@media (max-width: 768px) {
  .desktop-history-table {
    display: none;
  }

  .mobile-history-list {
    display: grid;
    gap: 8px;
  }

  .mobile-history-card {
    display: grid;
    min-width: 0;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--vtsuru-border);
    border-radius: var(--vtsuru-radius);
    background: var(--vtsuru-bg-surface);
  }

  .mobile-history-card__topline,
  .mobile-history-card__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .mobile-history-card__detail {
    overflow-wrap: anywhere;
    color: var(--vtsuru-fg);
    line-height: 1.55;
  }

  .mobile-history-card__meta {
    color: var(--vtsuru-fg-muted);
    font-size: 12px;
  }

  :global(.history-goods-modal) {
    width: calc(100vw - 16px);
    max-width: calc(100vw - 16px);
  }

  .history-variant-grid {
    grid-template-columns: 1fr;
  }
}
</style>
