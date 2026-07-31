<script setup lang="ts">
import { Open24Regular } from '@vicons/fluent'
import type { DataTableColumns } from 'naive-ui'
import {
  NButton,
  NDataTable,
  NDivider,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NModal,
  NPagination,
  NScrollbar,
  NTag,
  NText,
  NTime,
} from 'naive-ui'
import { computed, h, ref, watch } from 'vue'

import type { ResponsePointOrder2UserModel } from '@/api/api-models'
import { GoodsTypes, PointOrderStatus } from '@/api/api-models'
import AddressDisplay from '@/shared/components/points/AddressDisplay.vue'
import PointGoodsItem from '@/shared/components/points/PointGoodsItem.vue'

const props = defineProps<{
  orders: ResponsePointOrder2UserModel[]
}>()

const detail = ref<ResponsePointOrder2UserModel>()
const showDetail = ref(false)
const page = ref(1)
const pageSize = 10

const statusMeta = {
  [PointOrderStatus.Pending]: { label: '等待发货', type: 'warning' as const },
  [PointOrderStatus.Shipped]: { label: '已发货', type: 'info' as const },
  [PointOrderStatus.Completed]: { label: '已完成', type: 'success' as const },
}

const pagedOrders = computed(() => props.orders.slice((page.value - 1) * pageSize, page.value * pageSize))

watch(
  () => props.orders,
  () => (page.value = 1),
)

function openDetail(order: ResponsePointOrder2UserModel) {
  detail.value = order
  showDetail.value = true
}

const columns: DataTableColumns<ResponsePointOrder2UserModel> = [
  { title: '订单号', key: 'id', width: 84 },
  {
    title: '礼物',
    key: 'goods',
    minWidth: 220,
    render: (row) =>
      h('div', { class: 'order-goods-cell' }, [
        h('strong', row.goods.name),
        row.selectedSubItems?.length
          ? h('span', row.selectedSubItems.map((item) => `${item.nameSnapshot} x ${item.quantity}`).join(' / '))
          : null,
      ]),
  },
  {
    title: '时间',
    key: 'createAt',
    width: 130,
    sorter: (left, right) => left.createAt - right.createAt,
    render: (row) => h(NTime, { time: row.createAt, type: 'relative' }),
  },
  {
    title: '积分',
    key: 'point',
    width: 90,
    sorter: (left, right) => left.point - right.point,
    render: (row) => Number(row.point.toFixed(1)),
  },
  {
    title: '状态',
    key: 'status',
    width: 108,
    render: (row) => {
      const meta = statusMeta[row.status]
      return h(NTag, { type: meta.type, size: 'small', bordered: false }, () => meta.label)
    },
  },
  {
    title: '',
    key: 'action',
    width: 70,
    render: (row) => h(NButton, { size: 'small', secondary: true, onClick: () => openDetail(row) }, () => '详情'),
  },
]
</script>

<template>
  <NEmpty
    v-if="orders.length === 0"
    description="暂无符合条件的订单"
  />

  <template v-else>
    <NDataTable
      class="desktop-order-table"
      :columns="columns"
      :data="orders"
      :row-key="(row) => row.id"
      :pagination="{ defaultPageSize: 10, showSizePicker: true, pageSizes: [10, 25, 50] }"
      size="small"
    />

    <div class="mobile-order-list">
      <button
        v-for="order in pagedOrders"
        :key="order.id"
        class="mobile-order-card"
        type="button"
        @click="openDetail(order)"
      >
        <span class="mobile-order-card__topline">
          <span>#{{ order.id }}</span>
          <NTag
            :type="statusMeta[order.status].type"
            size="small"
            :bordered="false"
          >
            {{ statusMeta[order.status].label }}
          </NTag>
        </span>
        <strong>{{ order.goods.name }}</strong>
        <span
          v-if="order.selectedSubItems?.length"
          class="mobile-order-card__variants"
        >
          {{ order.selectedSubItems.map((item) => `${item.nameSnapshot} x ${item.quantity}`).join(' / ') }}
        </span>
        <span class="mobile-order-card__meta">
          <NTime
            :time="order.createAt"
            type="relative"
          />
          <b>{{ Number(order.point.toFixed(1)) }} 积分</b>
        </span>
      </button>

      <NPagination
        v-if="orders.length > pageSize"
        v-model:page="page"
        :page-size="pageSize"
        :item-count="orders.length"
        simple
      />
    </div>
  </template>

  <NModal
    v-if="detail"
    v-model:show="showDetail"
    preset="card"
    title="订单详情"
    class="order-detail-modal"
  >
    <NScrollbar class="order-detail-scrollbar">
      <div class="order-detail">
        <div class="order-summary">
          <div>
            <span>订单号</span>
            <strong>#{{ detail.id }}</strong>
          </div>
          <div>
            <span>兑换时间</span>
            <NTime :time="detail.createAt" />
          </div>
          <div>
            <span>使用积分</span>
            <strong>{{ Number(detail.point.toFixed(1)) }}</strong>
          </div>
          <div>
            <span>当前状态</span>
            <NTag
              :type="statusMeta[detail.status].type"
              size="small"
              :bordered="false"
            >
              {{ statusMeta[detail.status].label }}
            </NTag>
          </div>
        </div>

        <NDivider>礼物快照</NDivider>
        <PointGoodsItem
          class="detail-goods"
          :goods="detail.goods"
        />

        <template v-if="detail.selectedSubItems?.length">
          <NDivider>已选款式</NDivider>
          <div class="variant-grid">
            <div
              v-for="item in detail.selectedSubItems"
              :key="item.subItemId"
              class="variant-item"
            >
              <div>
                <strong>{{ item.nameSnapshot }}</strong>
                <span>x {{ item.quantity }}</span>
              </div>
              <NTag
                size="tiny"
                type="info"
                :bordered="false"
              >
                {{ item.priceSnapshot }} 积分
              </NTag>
              <NText
                v-if="item.assignedVirtualKeys.length"
                type="success"
                depth="3"
              >
                已分配 {{ item.assignedVirtualKeys.length }} 个密钥
              </NText>
            </div>
          </div>
        </template>

        <template v-if="detail.remark">
          <NDivider>订单备注</NDivider>
          <div class="detail-note">{{ detail.remark }}</div>
        </template>

        <template v-if="detail.type === GoodsTypes.Virtual">
          <NDivider>虚拟礼物内容</NDivider>
          <NInput
            :value="detail.goods.content"
            type="textarea"
            readonly
            placeholder="暂无内容"
            :autosize="{ minRows: 2, maxRows: 8 }"
          />
        </template>

        <template v-else>
          <NDivider>收货与物流</NDivider>
          <div class="delivery-panel">
            <AddressDisplay :address="detail.address" />
            <NFlex
              v-if="detail.trackingNumber"
              align="center"
              wrap
            >
              <NTag
                size="small"
                :bordered="false"
              >
                {{ detail.expressCompany || '物流单号' }}
              </NTag>
              <NText>{{ detail.trackingNumber }}</NText>
            </NFlex>
            <NText
              v-else
              depth="3"
            >
              暂无物流信息
            </NText>
          </div>

          <template v-if="detail.status === PointOrderStatus.Pending && detail.goods.collectUrl">
            <NDivider>填写收货信息</NDivider>
            <NButton
              tag="a"
              :href="detail.goods.collectUrl"
              target="_blank"
              type="primary"
            >
              <template #icon><NIcon :component="Open24Regular" /></template>
              打开地址填写页面
            </NButton>
            <iframe
              v-if="detail.goods.embedCollectUrl"
              class="collect-frame"
              :src="detail.goods.collectUrl"
              title="收货地址填写"
              sandbox="allow-same-origin allow-scripts allow-modals allow-downloads allow-forms allow-popups"
            />
          </template>
        </template>
      </div>
    </NScrollbar>
  </NModal>
</template>

<style scoped>
:deep(.order-goods-cell) {
  display: grid;
  gap: 2px;
}

:deep(.order-goods-cell span) {
  overflow: hidden;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-order-list {
  display: none;
}

:global(.order-detail-modal) {
  width: min(760px, calc(100vw - 24px));
  max-width: calc(100vw - 24px);
}

:global(.order-detail-scrollbar) {
  max-height: min(78vh, 760px);
}

.order-detail {
  padding-right: 10px;
}

.order-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.order-summary > div,
.variant-item,
.delivery-panel,
.detail-note {
  padding: 10px 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-elevated);
}

.order-summary > div {
  display: grid;
  gap: 3px;
}

.order-summary span,
.variant-item span {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.detail-goods {
  width: min(100%, 320px);
  margin: 0 auto;
}

.variant-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.variant-item {
  display: grid;
  gap: 8px;
}

.variant-item > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.delivery-panel {
  display: grid;
  gap: 10px;
}

.collect-frame {
  width: 100%;
  height: min(560px, 65vh);
  margin-top: 10px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
}

@media (max-width: 768px) {
  .desktop-order-table {
    display: none;
  }

  .mobile-order-list {
    display: grid;
    gap: 8px;
  }

  .mobile-order-card {
    display: grid;
    width: 100%;
    min-width: 0;
    gap: 8px;
    padding: 12px;
    color: var(--vtsuru-fg);
    text-align: left;
    border: 1px solid var(--vtsuru-border);
    border-radius: var(--vtsuru-radius);
    background: var(--vtsuru-bg-surface);
    cursor: pointer;
    transition:
      border-color 160ms var(--vtsuru-bezier),
      background-color 160ms var(--vtsuru-bezier);
  }

  .mobile-order-card:hover,
  .mobile-order-card:focus-visible {
    border-color: var(--vtsuru-border-hover);
    background: var(--vtsuru-bg-muted);
    outline: none;
  }

  .mobile-order-card__topline,
  .mobile-order-card__meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: var(--vtsuru-fg-muted);
    font-size: 12px;
  }

  .mobile-order-card__variants {
    overflow-wrap: anywhere;
    color: var(--vtsuru-fg-muted);
    font-size: 12px;
  }

  .mobile-order-card__meta b {
    color: var(--vtsuru-primary);
  }

  :global(.order-detail-modal) {
    width: calc(100vw - 16px);
    max-width: calc(100vw - 16px);
  }

  .order-detail {
    padding-right: 4px;
  }

  .order-summary,
  .variant-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .collect-frame {
    height: 420px;
  }
}
</style>
