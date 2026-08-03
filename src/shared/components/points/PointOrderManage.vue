<script setup lang="ts">
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { computed, onMounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponsePointGoodModel, ResponsePointOrder2OwnerModel } from '@/api/api-models'
import { GoodsTypes, PointOrderStatus } from '@/api/api-models'
import { fetchOwnerOrders, updateOrdersStatus } from '@/api/point-orders'
import { QueryPostAPI } from '@/api/query'
import PointOrderCard from '@/shared/components/points/PointOrderCard.vue'
import { POINT_API_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { objectsToCSV } from '@/shared/utils'

interface OrderFilterSettings {
  type?: GoodsTypes
  status?: PointOrderStatus
  customer?: number
  streamerId?: number
  onlyRequireShippingInfo: boolean
}

const props = defineProps<{
  goods?: ResponsePointGoodModel[]
  orgId?: number
  streamerOptions?: { label: string; value: number }[]
}>()

const toast = useToast()
const accountInfo = useAccount()
const defaultSettings: OrderFilterSettings = { onlyRequireShippingInfo: false }
const filterKey = computed(() =>
  props.orgId ? `vtsuru:setting:point:order-filter:org-${props.orgId}` : 'vtsuru:setting:point:order-filter:owner',
)
const filterSettings = usePersistedStorage<OrderFilterSettings>(filterKey, defaultSettings)
const orders = ref<ResponsePointOrder2OwnerModel[]>([])
const isLoading = ref(false)
const selectedItem = ref<number[]>([])
const targetStatus = ref<PointOrderStatus>()
const showStatusModal = ref(false)
const showDeleteConfirm = ref(false)

const filteredOrders = computed(() =>
  orders.value.filter((order) => {
    if (filterSettings.value.type !== undefined && order.type !== filterSettings.value.type) return false
    if (filterSettings.value.status !== undefined && order.status !== filterSettings.value.status) return false
    if (filterSettings.value.onlyRequireShippingInfo && order.trackingNumber) return false
    if (filterSettings.value.customer && order.customer.userId !== filterSettings.value.customer) return false
    if (props.orgId && filterSettings.value.streamerId && order.vTsuruId !== filterSettings.value.streamerId)
      return false
    return true
  }),
)
const orderStats = computed(() => ({
  total: orders.value.length,
  pending: orders.value.filter((order) => order.status === PointOrderStatus.Pending).length,
  shipped: orders.value.filter((order) => order.status === PointOrderStatus.Shipped).length,
  completed: orders.value.filter((order) => order.status === PointOrderStatus.Completed).length,
  physical: orders.value.filter((order) => order.type === GoodsTypes.Physical).length,
  virtual: orders.value.filter((order) => order.type === GoodsTypes.Virtual).length,
  totalPoints: Number(orders.value.reduce((sum, order) => sum + order.point, 0).toFixed(1)),
}))
const customerOptions = computed(() =>
  [...new Map(orders.value.map((order) => [order.customer.userId, order.customer.name])).entries()].map(
    ([value, label]) => ({
      label,
      value,
    }),
  ),
)
const typeOptions = [
  { label: '实体订单', value: GoodsTypes.Physical },
  { label: '虚拟订单', value: GoodsTypes.Virtual },
]
const statusOptions = [
  { label: '已完成', value: PointOrderStatus.Completed },
  { label: '等待发货', value: PointOrderStatus.Pending },
  { label: '已发货', value: PointOrderStatus.Shipped },
]
const statusText = {
  [PointOrderStatus.Completed]: '已完成',
  [PointOrderStatus.Pending]: '等待发货',
  [PointOrderStatus.Shipped]: '已发货',
}

watch(
  () => [filterSettings.value.streamerId, filterSettings.value.customer],
  () => props.orgId && refresh(),
)

async function deleteOrder() {
  if (props.orgId) {
    toast.add({ title: '组织订单暂不支持删除', color: 'warning' })
    return
  }
  if (!selectedItem.value.length) {
    toast.add({ title: '请选择要删除的订单', color: 'warning' })
    return
  }
  isLoading.value = true
  try {
    const result = await QueryPostAPI(`${POINT_API_URL}delete-orders`, selectedItem.value)
    if (result.code !== 200) throw new Error(result.message)
    orders.value = orders.value.filter((order) => !selectedItem.value.includes(order.id))
    selectedItem.value = []
    showDeleteConfirm.value = false
    toast.add({ title: '删除成功', color: 'success' })
  } catch (error) {
    toast.add({ title: error instanceof Error ? `删除失败: ${error.message}` : `删除失败: ${error}`, color: 'error' })
  } finally {
    isLoading.value = false
  }
}

function openStatusUpdateModal() {
  if (!selectedItem.value.length) {
    toast.add({ title: '请选择要更新的订单', color: 'warning' })
    return
  }
  showStatusModal.value = true
}

async function batchUpdateOrderStatus() {
  if (!selectedItem.value.length || targetStatus.value === undefined) return
  isLoading.value = true
  try {
    await updateOrdersStatus(
      props.orgId ? { kind: 'org', orgId: props.orgId } : { kind: 'owner' },
      selectedItem.value,
      targetStatus.value,
    )
    const updated = new Set(selectedItem.value)
    orders.value.forEach((order) => {
      if (!updated.has(order.id)) return
      order.status = targetStatus.value!
      order.updateAt = Date.now()
    })
    targetStatus.value = undefined
    showStatusModal.value = false
    toast.add({ title: '更新成功', color: 'success' })
  } catch (error) {
    toast.add({ title: error instanceof Error ? error.message : `更新失败: ${error}`, color: 'error' })
  } finally {
    isLoading.value = false
  }
}

function exportData() {
  try {
    const text = objectsToCSV(
      filteredOrders.value.map((order) => ({
        订单号: order.id,
        订单类型: order.type === GoodsTypes.Physical ? '实体' : '虚拟',
        订单状态: statusText[order.status],
        用户名: order.customer.name ?? '未知',
        用户UID: order.customer.userId,
        联系人: order.address?.name,
        联系电话: order.address?.phone,
        地址: order.address
          ? `${order.address.province}省${order.address.city}市${order.address.district}区${order.address.street}街道${order.address.address}`
          : '无',
        礼物名: order.goods?.name ?? '已删除',
        款式: (order.selectedSubItems ?? []).map((item) => `${item.nameSnapshot} x ${item.quantity}`).join('; ') || '-',
        礼物数量: order.count,
        礼物单价: order.goods?.price ? Number(order.goods.price.toFixed(1)) : 0,
        礼物总价: Number(order.point.toFixed(1)),
        快递公司: order.expressCompany,
        快递单号: order.trackingNumber,
        备注: order.remark ?? '',
        创建时间: format(order.createAt, 'yyyy-MM-dd HH:mm:ss'),
        更新时间: order.updateAt ? format(order.updateAt, 'yyyy-MM-dd HH:mm:ss') : '未更新',
      })),
    )
    saveAs(
      new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), new TextEncoder().encode(text)], {
        type: 'text/csv;charset=utf-8;',
      }),
      `积分订单_${format(Date.now(), 'yyyy-MM-dd HH-mm-ss')}_${accountInfo.value?.name}.csv`,
    )
    toast.add({ title: '导出成功', color: 'success' })
  } catch (error) {
    toast.add({ title: `导出失败: ${error}`, color: 'error' })
  }
}

async function refresh() {
  isLoading.value = true
  try {
    orders.value = await fetchOwnerOrders(
      props.orgId
        ? {
            kind: 'org',
            orgId: props.orgId,
            streamerId: filterSettings.value.streamerId,
            customer: filterSettings.value.customer,
          }
        : { kind: 'owner' },
    )
  } catch (error) {
    toast.add({ title: error instanceof Error ? error.message : `加载订单失败: ${error}`, color: 'error' })
  } finally {
    isLoading.value = false
  }
}

onMounted(refresh)
</script>

<template>
  <div class="point-order-manage">
    <div
      v-if="isLoading && !orders.length"
      class="orders-loading"
    >
      <UIcon
        class="orders-loading__spinner"
        name="i-lucide-loader-circle"
      />
    </div>
    <div
      v-else-if="orders.length === 0"
      class="orders-loading"
    >
      <UIcon name="i-lucide-package-search" /><span>暂无订单</span>
    </div>
    <template v-else>
      <div class="stats-grid">
        <div class="stat-card">
          <span>总订单</span><strong>{{ orderStats.total }}</strong>
        </div>
        <div class="stat-card">
          <span>待发货</span><strong class="warning">{{ orderStats.pending }}</strong>
        </div>
        <div class="stat-card">
          <span>已发货</span><strong class="info">{{ orderStats.shipped }}</strong>
        </div>
        <div class="stat-card">
          <span>已完成</span><strong class="success">{{ orderStats.completed }}</strong>
        </div>
        <div class="stat-card">
          <span>实体 / 虚拟</span><strong>{{ orderStats.physical }} / {{ orderStats.virtual }}</strong>
        </div>
        <div class="stat-card">
          <span>总积分</span><strong class="primary">{{ orderStats.totalPoints }}</strong>
        </div>
      </div>

      <div class="toolbar-section">
        <div class="filters">
          <USelect
            v-if="orgId && streamerOptions?.length"
            v-model="filterSettings.streamerId"
            :items="streamerOptions"
            placeholder="主播"
            class="filter-control"
          />
          <USelect
            v-model="filterSettings.type"
            :items="typeOptions"
            placeholder="订单类型"
            class="filter-control"
          /><USelect
            v-model="filterSettings.status"
            :items="statusOptions"
            placeholder="订单状态"
            class="filter-control"
          /><USelect
            v-model="filterSettings.customer"
            :items="customerOptions"
            placeholder="按用户筛选"
            searchable
            class="filter-control"
          />
          <UCheckbox v-model="filterSettings.onlyRequireShippingInfo">仅未填单号</UCheckbox>
          <UButton
            color="warning"
            variant="soft"
            icon="i-lucide-filter-x"
            @click="filterSettings = { ...defaultSettings }"
            >重置筛选</UButton
          >
        </div>
        <USeparator />
        <div class="toolbar-actions">
          <div>
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-refresh-cw"
              :loading="isLoading"
              @click="refresh"
              >刷新</UButton
            ><UButton
              color="info"
              variant="soft"
              icon="i-lucide-download"
              @click="exportData"
              >导出数据</UButton
            >
          </div>
          <div>
            <UButton
              color="info"
              :disabled="!selectedItem.length"
              icon="i-lucide-pencil-line"
              @click="openStatusUpdateModal"
              >批量更新状态 ({{ selectedItem.length }})</UButton
            ><UButton
              v-if="!orgId"
              color="error"
              :disabled="!selectedItem.length"
              icon="i-lucide-trash-2"
              @click="showDeleteConfirm = true"
              >批量删除 ({{ selectedItem.length }})</UButton
            >
          </div>
        </div>
      </div>

      <PointOrderCard
        :order="filteredOrders"
        type="owner"
        :org-id="orgId"
        :loading="isLoading"
        @selected-item="selectedItem = $event"
      />
    </template>

    <UModal
      v-model:open="showStatusModal"
      title="选择目标状态"
      ><template #body
        ><div class="modal-stack">
          <span>请选择您想要将订单更新为的状态</span
          ><USelect
            v-model="targetStatus"
            :items="statusOptions"
            placeholder="选择状态"
          /></div></template
      ><template #footer
        ><div class="modal-actions">
          <UButton
            color="neutral"
            variant="ghost"
            @click="showStatusModal = false"
            >取消</UButton
          ><UButton
            color="primary"
            :disabled="targetStatus === undefined"
            :loading="isLoading"
            @click="batchUpdateOrderStatus"
            >确认更新</UButton
          >
        </div></template
      ></UModal
    >
    <UModal
      v-model:open="showDeleteConfirm"
      title="删除订单"
      ><template #body
        ><p>确定删除选中的 {{ selectedItem.length }} 个订单吗？此操作不可撤销。</p></template
      ><template #footer
        ><div class="modal-actions">
          <UButton
            color="neutral"
            variant="ghost"
            @click="showDeleteConfirm = false"
            >取消</UButton
          ><UButton
            color="error"
            :loading="isLoading"
            @click="deleteOrder"
            >确认删除</UButton
          >
        </div></template
      ></UModal
    >
  </div>
</template>

<style scoped>
.point-order-manage {
  display: grid;
  gap: 16px;
}
.orders-loading {
  display: grid;
  min-height: 240px;
  place-content: center;
  gap: 10px;
  color: var(--vtsuru-fg-muted);
  text-align: center;
}
.orders-loading__spinner {
  font-size: 26px;
  animation: spin 0.8s linear infinite;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}
.stat-card,
.toolbar-section {
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg);
}
.stat-card {
  display: grid;
  gap: 4px;
  padding: 16px;
}
.stat-card span {
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}
.stat-card strong {
  color: var(--vtsuru-fg);
  font-size: 24px;
  line-height: 1.2;
}
.primary {
  color: var(--vtsuru-brand) !important;
}
.success {
  color: var(--vtsuru-success) !important;
}
.info {
  color: var(--vtsuru-info) !important;
}
.warning {
  color: var(--vtsuru-warning) !important;
}
.toolbar-section,
.filters,
.toolbar-actions,
.toolbar-actions > div,
.modal-stack {
  display: grid;
  gap: 12px;
}
.toolbar-section {
  padding: 12px 16px;
}
.filters {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  align-items: center;
}
.filter-control {
  min-width: 0;
}
.toolbar-actions {
  grid-template-columns: repeat(2, auto);
  justify-content: space-between;
  align-items: center;
}
.toolbar-actions > div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 960px) {
  .stats-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .toolbar-actions {
    grid-template-columns: 1fr;
  }
  .toolbar-actions > div {
    justify-content: stretch;
  }
  .toolbar-actions :deep(button) {
    flex: 1;
  }
}
</style>
