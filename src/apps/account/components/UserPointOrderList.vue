<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'

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
const pageSize = ref(10)
const pageSizeOptions = [10, 25, 50]

const statusMeta = {
  [PointOrderStatus.Pending]: { label: '等待发货', color: 'warning' as const },
  [PointOrderStatus.Shipped]: { label: '已发货', color: 'info' as const },
  [PointOrderStatus.Completed]: { label: '已完成', color: 'success' as const },
}

const columns: TableColumn<ResponsePointOrder2UserModel>[] = [
  { header: '订单号', accessorKey: 'id', size: 84 },
  { header: '礼物', accessorKey: 'goods', size: 220 },
  { header: '时间', accessorKey: 'createAt', size: 150 },
  { header: '积分', accessorKey: 'point', size: 90 },
  { header: '状态', accessorKey: 'status', size: 108 },
  { id: 'action', header: '', size: 70 },
]

const pagedOrders = computed(() => props.orders.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))

watch([() => props.orders, pageSize], () => (page.value = 1))

function openDetail(order: ResponsePointOrder2UserModel) {
  detail.value = order
  showDetail.value = true
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(timestamp)
}
</script>

<template>
  <UEmpty
    v-if="orders.length === 0"
    icon="i-lucide-package-search"
    title="暂无符合条件的订单"
  />

  <template v-else>
    <UTable
      class="desktop-order-table"
      :columns="columns"
      :data="pagedOrders"
      :row-key="(row) => row.id"
    >
      <template #id-cell="{ row }"> #{{ row.original.id }} </template>
      <template #goods-cell="{ row }">
        <div class="order-goods-cell">
          <strong>{{ row.original.goods.name }}</strong>
          <span v-if="row.original.selectedSubItems?.length">
            {{ row.original.selectedSubItems.map((item) => `${item.nameSnapshot} x ${item.quantity}`).join(' / ') }}
          </span>
        </div>
      </template>
      <template #createAt-cell="{ row }">
        <time :datetime="new Date(row.original.createAt).toISOString()">
          {{ formatTime(row.original.createAt) }}
        </time>
      </template>
      <template #point-cell="{ row }">{{ Number(row.original.point.toFixed(1)) }}</template>
      <template #status-cell="{ row }">
        <UBadge
          size="sm"
          :color="statusMeta[row.original.status].color"
          :label="statusMeta[row.original.status].label"
        />
      </template>
      <template #action-cell="{ row }">
        <UButton
          color="neutral"
          variant="soft"
          size="xs"
          @click="openDetail(row.original)"
        >
          详情
        </UButton>
      </template>
    </UTable>
    <div class="desktop-order-pagination">
      <USelect
        v-model="pageSize"
        :items="pageSizeOptions"
        size="sm"
      />
      <UPagination
        v-if="orders.length > pageSize"
        v-model:page="page"
        :total="orders.length"
        :items-per-page="pageSize"
        :show-edges="false"
        size="sm"
      />
    </div>

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
          <UBadge
            size="sm"
            :color="statusMeta[order.status].color"
            :label="statusMeta[order.status].label"
          />
        </span>
        <strong>{{ order.goods.name }}</strong>
        <span
          v-if="order.selectedSubItems?.length"
          class="mobile-order-card__variants"
        >
          {{ order.selectedSubItems.map((item) => `${item.nameSnapshot} x ${item.quantity}`).join(' / ') }}
        </span>
        <span class="mobile-order-card__meta">
          <time :datetime="new Date(order.createAt).toISOString()">{{ formatTime(order.createAt) }}</time>
          <b>{{ Number(order.point.toFixed(1)) }} 积分</b>
        </span>
      </button>

      <UPagination
        v-if="orders.length > pageSize"
        v-model:page="page"
        :total="orders.length"
        :items-per-page="pageSize"
        :show-edges="false"
        size="sm"
      />
    </div>
  </template>

  <UModal
    v-if="detail"
    v-model:open="showDetail"
    title="订单详情"
  >
    <template #body>
      <div class="order-detail-scrollbar">
        <div class="order-detail">
          <div class="order-summary">
            <div>
              <span>订单号</span>
              <strong>#{{ detail.id }}</strong>
            </div>
            <div>
              <span>兑换时间</span>
              <time :datetime="new Date(detail.createAt).toISOString()">{{ formatTime(detail.createAt) }}</time>
            </div>
            <div>
              <span>使用积分</span>
              <strong>{{ Number(detail.point.toFixed(1)) }}</strong>
            </div>
            <div>
              <span>当前状态</span>
              <UBadge
                size="sm"
                :color="statusMeta[detail.status].color"
                :label="statusMeta[detail.status].label"
              />
            </div>
          </div>

          <USeparator label="礼物快照" />
          <PointGoodsItem
            class="detail-goods"
            :goods="detail.goods"
          />

          <template v-if="detail.selectedSubItems?.length">
            <USeparator label="已选款式" />
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
                <UBadge
                  size="xs"
                  color="info"
                  :label="`${item.priceSnapshot} 积分`"
                />
                <span
                  v-if="item.assignedVirtualKeys.length"
                  class="assigned-key-count"
                >
                  已分配 {{ item.assignedVirtualKeys.length }} 个密钥
                </span>
              </div>
            </div>
          </template>

          <template v-if="detail.remark">
            <USeparator label="订单备注" />
            <div class="detail-note">{{ detail.remark }}</div>
          </template>

          <template v-if="detail.type === GoodsTypes.Virtual">
            <USeparator label="虚拟礼物内容" />
            <UTextarea
              :model-value="detail.goods.content"
              readonly
              placeholder="暂无内容"
              :rows="2"
              :maxrows="8"
              autoresize
            />
          </template>

          <template v-else>
            <USeparator label="收货与物流" />
            <div class="delivery-panel">
              <AddressDisplay :address="detail.address" />
              <div
                v-if="detail.trackingNumber"
                class="tracking-info"
              >
                <UBadge
                  size="sm"
                  color="neutral"
                  :label="detail.expressCompany || '物流单号'"
                />
                <span>{{ detail.trackingNumber }}</span>
              </div>
              <span
                v-else
                class="muted-text"
              >
                暂无物流信息
              </span>
            </div>

            <template v-if="detail.status === PointOrderStatus.Pending && detail.goods.collectUrl">
              <USeparator label="填写收货信息" />
              <UButton
                :href="detail.goods.collectUrl"
                external
                target="_blank"
                color="primary"
                trailing-icon="i-lucide-external-link"
              >
                打开地址填写页面
              </UButton>
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
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.order-goods-cell {
  display: grid;
  gap: 2px;
}

.order-goods-cell span {
  overflow: hidden;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-order-list {
  display: none;
}

.desktop-order-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.order-detail-scrollbar {
  max-height: min(78vh, 760px);
  overflow: auto;
}

.order-detail {
  display: grid;
  gap: 16px;
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
.variant-item span,
.muted-text {
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

.variant-item > div,
.tracking-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.assigned-key-count {
  color: var(--vtsuru-success) !important;
}

.delivery-panel {
  display: grid;
  gap: 10px;
}

.collect-frame {
  width: 100%;
  height: min(560px, 65vh);
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
}

@media (max-width: 768px) {
  .desktop-order-table {
    display: none;
  }

  .desktop-order-pagination {
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
