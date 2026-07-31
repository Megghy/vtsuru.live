<script setup lang="ts">
import type { DataTableColumns, DataTableRowKey } from 'naive-ui'
import {
  NAlert,
  NAutoComplete,
  NButton,
  NCheckbox,
  NDataTable,
  NDivider,
  NEllipsis,
  NEmpty,
  NFlex,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NModal,
  NPagination,
  NScrollbar,
  NTag,
  NText,
  NTime,
  useDialog,
  useMessage,
} from 'naive-ui'
import { computed, h, ref, watch } from 'vue'

import type { ResponsePointOrder2OwnerModel } from '@/api/api-models'
import { GoodsTypes, PointOrderStatus } from '@/api/api-models'
import { updateOrderExpress, updateOrdersStatus } from '@/api/point-orders'

import AddressDisplay from './AddressDisplay.vue'
import PointGoodsItem from './PointGoodsItem.vue'

const props = defineProps<{
  order: ResponsePointOrder2OwnerModel[]
  type: 'owner'
  orgId?: number
  loading?: boolean
}>()

const emit = defineEmits<{ selectedItem: [items: DataTableRowKey[]] }>()
const message = useMessage()
const dialog = useDialog()
const actionLoading = ref(false)
const selectedItems = ref<DataTableRowKey[]>([])
const detail = ref<ResponsePointOrder2OwnerModel>()
const showDetail = ref(false)
const page = ref(1)
const pageSize = 10

const statusMeta: Record<PointOrderStatus, { label: string; type: 'warning' | 'info' | 'success'; hint: string }> = {
  [PointOrderStatus.Pending]: { label: '等待发货', type: 'warning', hint: '订单已创建，等待处理' },
  [PointOrderStatus.Shipped]: { label: '已发货', type: 'info', hint: '订单已发货，可填写或更新物流信息' },
  [PointOrderStatus.Completed]: { label: '已完成', type: 'success', hint: '订单流程已完成' },
}

const loading = computed(() => !!props.loading || actionLoading.value)
const pagedOrders = computed(() => props.order.slice((page.value - 1) * pageSize, page.value * pageSize))
const expressOptions = computed(() =>
  [...new Set(props.order.map((item) => item.expressCompany).filter((name): name is string => !!name))].map((name) => ({
    label: name,
    value: name,
  })),
)

watch(
  () => props.order,
  () => (page.value = 1),
)

function statusTag(row: ResponsePointOrder2OwnerModel) {
  const meta = statusMeta[row.status]
  const label = row.status === PointOrderStatus.Shipped && !row.trackingNumber ? '已发货 · 待填单号' : meta.label
  const type = row.status === PointOrderStatus.Shipped && !row.trackingNumber ? 'warning' : meta.type
  return h(NTag, { type, size: 'small', bordered: false }, () => label)
}

function openDetail(row: ResponsePointOrder2OwnerModel) {
  detail.value = row
  showDetail.value = true
}

function nextStatus(order: ResponsePointOrder2OwnerModel) {
  if (order.type === GoodsTypes.Virtual && order.status === PointOrderStatus.Pending) return PointOrderStatus.Completed
  if (order.status === PointOrderStatus.Pending) return PointOrderStatus.Shipped
  if (order.status === PointOrderStatus.Shipped) return PointOrderStatus.Completed
  return null
}

function previousStatus(order: ResponsePointOrder2OwnerModel) {
  if (order.type === GoodsTypes.Physical && order.status === PointOrderStatus.Shipped) return PointOrderStatus.Pending
  return null
}

async function updateStatus(ids: number[], status: PointOrderStatus) {
  actionLoading.value = true
  try {
    await updateOrdersStatus(props.orgId ? { kind: 'org', orgId: props.orgId } : { kind: 'owner' }, ids, status)
    props.order.forEach((order) => {
      if (ids.includes(order.id)) {
        order.status = status
        order.updateAt = Date.now()
      }
    })
    message.success('订单状态已更新')
  } catch (error) {
    message.error(error instanceof Error ? error.message : `更新订单失败: ${error}`)
  } finally {
    actionLoading.value = false
  }
}

function confirmStatus(order: ResponsePointOrder2OwnerModel, status: PointOrderStatus) {
  dialog.info({
    title: '修改订单状态',
    content: `确认将订单 #${order.id} 从「${statusMeta[order.status].label}」改为「${statusMeta[status].label}」吗？`,
    positiveText: '确认修改',
    negativeText: '取消',
    onPositiveClick: () => updateStatus([order.id], status),
  })
}

async function saveExpress() {
  if (!detail.value) return
  actionLoading.value = true
  try {
    await updateOrderExpress(
      props.orgId ? { kind: 'org', orgId: props.orgId } : { kind: 'owner' },
      detail.value.id,
      detail.value.trackingNumber ?? '',
      detail.value.expressCompany,
    )
    detail.value.updateAt = Date.now()
    message.success('物流信息已更新')
  } catch (error) {
    message.error(error instanceof Error ? error.message : `更新物流信息失败: ${error}`)
  } finally {
    actionLoading.value = false
  }
}

function updateSelection(items: DataTableRowKey[]) {
  selectedItems.value = items
  emit('selectedItem', items)
}

function toggleSelection(id: number, checked: boolean) {
  const next = checked ? [...selectedItems.value, id] : selectedItems.value.filter((item) => item !== id)
  updateSelection([...new Set(next)])
}

const columns: DataTableColumns<ResponsePointOrder2OwnerModel> = [
  {
    type: 'selection',
    options: [
      'all',
      'none',
      {
        label: '选中待发货订单',
        key: 'pending',
        onSelect: (rows) =>
          updateSelection(rows.filter((row) => row.status === PointOrderStatus.Pending).map((row) => row.id)),
      },
    ],
  },
  { title: '订单号', key: 'id', width: 84 },
  {
    title: '用户',
    key: 'customer',
    width: 130,
    render: (row) =>
      h(
        NButton,
        {
          text: true,
          type: 'primary',
          tag: 'a',
          href: `https://space.bilibili.com/${row.customer?.userId || ''}`,
          target: '_blank',
        },
        () => row.customer?.name || '未知用户',
      ),
  },
  {
    title: '礼物',
    key: 'goods',
    minWidth: 180,
    render: (row) =>
      h('div', { class: 'owner-order-goods' }, [
        h('strong', row.goods.name),
        row.selectedSubItems?.length
          ? h('span', row.selectedSubItems.map((item) => `${item.nameSnapshot} x ${item.quantity}`).join(' / '))
          : null,
      ]),
  },
  { title: '数量', key: 'count', width: 70 },
  {
    title: '时间',
    key: 'createAt',
    width: 120,
    sorter: (left, right) => left.createAt - right.createAt,
    render: (row) => h(NTime, { time: row.createAt, type: 'relative' }),
  },
  {
    title: '积分',
    key: 'point',
    width: 82,
    sorter: (left, right) => left.point - right.point,
    render: (row) => Number(row.point.toFixed(1)),
  },
  { title: '状态', key: 'status', width: 130, render: statusTag },
  {
    title: '类型',
    key: 'type',
    width: 90,
    render: (row) =>
      h(NTag, { size: 'small', bordered: false }, () => (row.type === GoodsTypes.Physical ? '实体' : '虚拟')),
  },
  {
    title: '备注',
    key: 'remark',
    width: 120,
    render: (row) => (row.remark ? h(NEllipsis, null, () => row.remark) : h(NText, { depth: 3 }, () => '无')),
  },
  {
    title: '物流',
    key: 'express',
    minWidth: 150,
    render: (row) => row.trackingNumber || (row.type === GoodsTypes.Virtual ? '无需发货' : '暂无物流'),
  },
  {
    title: '',
    key: 'action',
    fixed: 'right',
    width: 70,
    render: (row) => h(NButton, { size: 'small', secondary: true, onClick: () => openDetail(row) }, () => '详情'),
  },
]
</script>

<template>
  <div class="point-order-card">
    <NEmpty
      v-if="order.length === 0"
      description="暂无订单"
    />

    <template v-else>
      <NDataTable
        class="desktop-owner-orders"
        :checked-row-keys="selectedItems"
        :row-key="(row) => row.id"
        :loading="loading"
        :columns="columns"
        :data="order"
        :pagination="{ defaultPageSize: 10, showSizePicker: true, pageSizes: [10, 25, 50, 100] }"
        size="small"
        @update:checked-row-keys="updateSelection"
      />

      <div class="mobile-owner-orders">
        <article
          v-for="item in pagedOrders"
          :key="item.id"
          class="mobile-owner-order"
        >
          <div class="mobile-owner-order__topline">
            <NCheckbox
              :checked="selectedItems.includes(item.id)"
              @update:checked="(checked) => toggleSelection(item.id, checked)"
            >
              #{{ item.id }}
            </NCheckbox>
            <NTag
              :type="
                item.status === PointOrderStatus.Shipped && !item.trackingNumber
                  ? 'warning'
                  : statusMeta[item.status].type
              "
              size="small"
              :bordered="false"
            >
              {{
                item.status === PointOrderStatus.Shipped && !item.trackingNumber
                  ? '已发货 · 待填单号'
                  : statusMeta[item.status].label
              }}
            </NTag>
          </div>
          <strong>{{ item.goods.name }}</strong>
          <span
            >{{ item.customer?.name || '未知用户' }} · {{ item.count }} 件 ·
            {{ Number(item.point.toFixed(1)) }} 积分</span
          >
          <NButton
            size="small"
            secondary
            @click="openDetail(item)"
          >
            查看与处理
          </NButton>
        </article>
        <NPagination
          v-if="order.length > pageSize"
          v-model:page="page"
          :page-size="pageSize"
          :item-count="order.length"
          simple
        />
      </div>
    </template>

    <NModal
      v-if="detail"
      v-model:show="showDetail"
      preset="card"
      title="订单详情"
      class="owner-order-modal"
    >
      <NScrollbar class="owner-order-scrollbar">
        <div class="owner-order-detail">
          <div class="order-summary">
            <div>
              <span>订单号</span><strong>#{{ detail.id }}</strong>
            </div>
            <div>
              <span>用户</span><strong>{{ detail.customer?.name || '未知用户' }}</strong>
            </div>
            <div>
              <span>使用积分</span><strong>{{ Number(detail.point.toFixed(1)) }}</strong>
            </div>
            <div>
              <span>当前状态</span>
              <NTag
                :type="
                  detail.status === PointOrderStatus.Shipped && !detail.trackingNumber
                    ? 'warning'
                    : statusMeta[detail.status].type
                "
                size="small"
                :bordered="false"
              >
                {{
                  detail.status === PointOrderStatus.Shipped && !detail.trackingNumber
                    ? '已发货 · 待填单号'
                    : statusMeta[detail.status].label
                }}
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

          <NAlert
            v-if="detail.remark"
            type="info"
            title="订单备注"
          >
            {{ detail.remark }}
          </NAlert>

          <NDivider>状态处理</NDivider>
          <NAlert :type="statusMeta[detail.status].type">
            {{ statusMeta[detail.status].hint }}
          </NAlert>

          <template v-if="detail.type === GoodsTypes.Physical">
            <NDivider>收货地址</NDivider>
            <div class="detail-panel">
              <NButton
                v-if="detail.goods.collectUrl"
                tag="a"
                :href="detail.goods.collectUrl"
                target="_blank"
                text
                type="primary"
              >
                通过站外链接收集
              </NButton>
              <AddressDisplay
                v-else
                :address="detail.address"
              />
            </div>
          </template>

          <template v-if="detail.type === GoodsTypes.Physical && detail.status === PointOrderStatus.Shipped">
            <NDivider>物流信息</NDivider>
            <div class="detail-panel express-form">
              <NAutoComplete
                v-model:value="detail.expressCompany"
                :options="expressOptions"
                placeholder="快递公司"
              />
              <NInputGroup>
                <NInputGroupLabel>单号</NInputGroupLabel>
                <NInput
                  v-model:value="detail.trackingNumber"
                  placeholder="填写快递单号"
                />
              </NInputGroup>
              <NButton
                type="primary"
                :loading="actionLoading"
                @click="saveExpress"
              >
                更新物流信息
              </NButton>
            </div>
          </template>

          <NFlex
            class="status-actions"
            justify="end"
            wrap
          >
            <NButton
              v-if="previousStatus(detail) !== null"
              type="warning"
              secondary
              @click="confirmStatus(detail, previousStatus(detail)!)"
            >
              回退到等待发货
            </NButton>
            <NButton
              v-if="nextStatus(detail) !== null"
              type="primary"
              @click="confirmStatus(detail, nextStatus(detail)!)"
            >
              {{
                detail.type === GoodsTypes.Virtual
                  ? '完成订单'
                  : detail.status === PointOrderStatus.Pending
                    ? '确认发货'
                    : '完成订单'
              }}
            </NButton>
          </NFlex>
        </div>
      </NScrollbar>
    </NModal>
  </div>
</template>

<style scoped>
.point-order-card {
  width: 100%;
  min-width: 0;
}

:deep(.owner-order-goods) {
  display: grid;
  gap: 2px;
}

:deep(.owner-order-goods span) {
  overflow: hidden;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-owner-orders {
  display: none;
}

.owner-order-modal {
  width: min(780px, calc(100vw - 24px));
  max-width: calc(100vw - 24px);
}

.owner-order-scrollbar {
  max-height: min(78vh, 760px);
}

.owner-order-detail {
  display: grid;
  gap: 12px;
  padding-right: 10px;
}

.owner-order-detail :deep(.n-divider) {
  margin: 4px 0;
}

.order-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.order-summary > div,
.variant-item,
.detail-panel {
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
.mobile-owner-order span {
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
  grid-template-columns: 1fr auto;
  gap: 6px 8px;
}

.variant-item .n-tag {
  grid-column: 1 / -1;
  justify-self: start;
}

.express-form {
  display: grid;
  grid-template-columns: 180px minmax(220px, 1fr) auto;
  gap: 8px;
}

.status-actions {
  margin-top: 4px;
}

@media (max-width: 768px) {
  .desktop-owner-orders {
    display: none;
  }

  .mobile-owner-orders {
    display: grid;
    gap: 8px;
  }

  .mobile-owner-order {
    display: grid;
    min-width: 0;
    gap: 8px;
    padding: 12px;
    border: 1px solid var(--vtsuru-border);
    border-radius: var(--vtsuru-radius);
    background: var(--vtsuru-bg-surface);
  }

  .mobile-owner-order__topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .owner-order-modal {
    width: calc(100vw - 16px);
    max-width: calc(100vw - 16px);
  }

  .owner-order-detail {
    padding-right: 4px;
  }

  .order-summary,
  .variant-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .express-form {
    grid-template-columns: 1fr;
  }
}
</style>
