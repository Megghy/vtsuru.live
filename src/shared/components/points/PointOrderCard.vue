<script setup lang="ts">
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, ref, watch } from 'vue'

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

const emit = defineEmits<{ selectedItem: [items: number[]] }>()
const toast = useToast()
const actionLoading = ref(false)
const selectedItems = ref<number[]>([])
const detail = ref<ResponsePointOrder2OwnerModel>()
const showDetail = ref(false)
const pendingStatus = ref<{ order: ResponsePointOrder2OwnerModel; status: PointOrderStatus }>()
const page = ref(1)
const pageSize = 10

const statusMeta: Record<PointOrderStatus, { label: string; color: 'warning' | 'info' | 'success'; hint: string }> = {
  [PointOrderStatus.Pending]: { label: '等待发货', color: 'warning', hint: '订单已创建，等待处理' },
  [PointOrderStatus.Shipped]: { label: '已发货', color: 'info', hint: '订单已发货，可填写或更新物流信息' },
  [PointOrderStatus.Completed]: { label: '已完成', color: 'success', hint: '订单流程已完成' },
}

const loading = computed(() => Boolean(props.loading || actionLoading.value))
const pagedOrders = computed(() => props.order.slice((page.value - 1) * pageSize, page.value * pageSize))
const pageCount = computed(() => Math.ceil(props.order.length / pageSize))
const expressCompanies = computed(() => [...new Set(props.order.map((item) => item.expressCompany).filter(Boolean))])

watch(
  () => props.order,
  () => {
    page.value = 1
    selectedItems.value = selectedItems.value.filter((id) => props.order.some((order) => order.id === id))
  },
)

function formatOrderTime(time: number | string | Date) {
  return formatDistanceToNow(new Date(time), { addSuffix: true, locale: zhCN })
}

function statusPresentation(order: ResponsePointOrder2OwnerModel) {
  if (order.status === PointOrderStatus.Shipped && !order.trackingNumber) {
    return { label: '已发货 · 待填单号', color: 'warning' as const }
  }
  return statusMeta[order.status]
}

function openDetail(order: ResponsePointOrder2OwnerModel) {
  detail.value = order
  showDetail.value = true
}

function nextStatus(order: ResponsePointOrder2OwnerModel) {
  if (order.type === GoodsTypes.Virtual && order.status === PointOrderStatus.Pending) return PointOrderStatus.Completed
  if (order.status === PointOrderStatus.Pending) return PointOrderStatus.Shipped
  if (order.status === PointOrderStatus.Shipped) return PointOrderStatus.Completed
  return undefined
}

function previousStatus(order: ResponsePointOrder2OwnerModel) {
  return order.type === GoodsTypes.Physical && order.status === PointOrderStatus.Shipped
    ? PointOrderStatus.Pending
    : undefined
}

async function updateStatus(ids: number[], status: PointOrderStatus) {
  actionLoading.value = true
  try {
    await updateOrdersStatus(props.orgId ? { kind: 'org', orgId: props.orgId } : { kind: 'owner' }, ids, status)
    props.order.forEach((order) => {
      if (!ids.includes(order.id)) return
      order.status = status
      order.updateAt = Date.now()
    })
    toast.add({ title: '订单状态已更新', color: 'success' })
    pendingStatus.value = undefined
  } catch (error) {
    toast.add({ title: error instanceof Error ? error.message : `更新订单失败: ${error}`, color: 'error' })
  } finally {
    actionLoading.value = false
  }
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
    toast.add({ title: '物流信息已更新', color: 'success' })
  } catch (error) {
    toast.add({ title: error instanceof Error ? error.message : `更新物流信息失败: ${error}`, color: 'error' })
  } finally {
    actionLoading.value = false
  }
}

function updateSelection(items: number[]) {
  selectedItems.value = items
  emit('selectedItem', items)
}

function toggleSelection(id: number, checked: boolean) {
  updateSelection(
    checked ? [...new Set([...selectedItems.value, id])] : selectedItems.value.filter((item) => item !== id),
  )
}

function togglePageSelection(checked: boolean) {
  const pageIds = pagedOrders.value.map((order) => order.id)
  updateSelection(
    checked
      ? [...new Set([...selectedItems.value, ...pageIds])]
      : selectedItems.value.filter((id) => !pageIds.includes(id)),
  )
}
</script>

<template>
  <div class="point-order-card">
    <div
      v-if="order.length === 0"
      class="order-empty"
    >
      <UIcon name="i-lucide-package-search" /><span>暂无订单</span>
    </div>
    <template v-else>
      <div class="owner-order-table-wrap">
        <table class="owner-order-table">
          <thead>
            <tr>
              <th>
                <UCheckbox
                  :model-value="pagedOrders.length > 0 && pagedOrders.every((item) => selectedItems.includes(item.id))"
                  aria-label="选择本页订单"
                  @update:model-value="togglePageSelection($event === true)"
                />
              </th>
              <th>订单号</th>
              <th>用户</th>
              <th>礼物</th>
              <th>数量</th>
              <th>时间</th>
              <th>积分</th>
              <th>状态</th>
              <th>类型</th>
              <th>物流</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in pagedOrders"
              :key="item.id"
            >
              <td>
                <UCheckbox
                  :model-value="selectedItems.includes(item.id)"
                  :aria-label="`选择订单 #${item.id}`"
                  @update:model-value="toggleSelection(item.id, $event === true)"
                />
              </td>
              <td>#{{ item.id }}</td>
              <td>
                <a
                  :href="`https://space.bilibili.com/${item.customer?.userId || ''}`"
                  target="_blank"
                  >{{ item.customer?.name || '未知用户' }}</a
                >
              </td>
              <td>
                <div class="owner-order-goods">
                  <strong>{{ item.goods.name }}</strong
                  ><span v-if="item.selectedSubItems?.length">{{
                    item.selectedSubItems.map((subItem) => `${subItem.nameSnapshot} x ${subItem.quantity}`).join(' / ')
                  }}</span>
                </div>
              </td>
              <td>{{ item.count }}</td>
              <td>{{ formatOrderTime(item.createAt) }}</td>
              <td>{{ Number(item.point.toFixed(1)) }}</td>
              <td>
                <UBadge
                  size="sm"
                  :color="statusPresentation(item).color"
                  :label="statusPresentation(item).label"
                />
              </td>
              <td>
                <UBadge
                  size="sm"
                  color="neutral"
                  :label="item.type === GoodsTypes.Physical ? '实体' : '虚拟'"
                />
              </td>
              <td>{{ item.trackingNumber || (item.type === GoodsTypes.Virtual ? '无需发货' : '暂无物流') }}</td>
              <td>
                <UButton
                  color="neutral"
                  variant="soft"
                  size="xs"
                  @click="openDetail(item)"
                  >详情</UButton
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mobile-owner-orders">
        <article
          v-for="item in pagedOrders"
          :key="item.id"
          class="mobile-owner-order"
        >
          <div class="mobile-owner-order__topline">
            <UCheckbox
              :model-value="selectedItems.includes(item.id)"
              @update:model-value="toggleSelection(item.id, $event === true)"
              >#{{ item.id }}</UCheckbox
            ><UBadge
              size="sm"
              :color="statusPresentation(item).color"
              :label="statusPresentation(item).label"
            />
          </div>
          <strong>{{ item.goods.name }}</strong
          ><span
            >{{ item.customer?.name || '未知用户' }} · {{ item.count }} 件 ·
            {{ Number(item.point.toFixed(1)) }} 积分</span
          >
          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            @click="openDetail(item)"
            >查看与处理</UButton
          >
        </article>
      </div>

      <div
        v-if="pageCount > 1"
        class="order-pagination"
      >
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          :disabled="page === 1"
          @click="page--"
          >上一页</UButton
        ><span>{{ page }} / {{ pageCount }}</span
        ><UButton
          color="neutral"
          variant="outline"
          size="sm"
          :disabled="page === pageCount"
          @click="page++"
          >下一页</UButton
        >
      </div>
    </template>

    <UModal
      v-if="detail"
      v-model:open="showDetail"
      title="订单详情"
    >
      <template #body>
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
              <span>当前状态</span
              ><UBadge
                size="sm"
                :color="statusPresentation(detail).color"
                :label="statusPresentation(detail).label"
              />
            </div>
          </div>
          <USeparator label="礼物快照" /><PointGoodsItem
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
                <strong>{{ item.nameSnapshot }}</strong
                ><span>x {{ item.quantity }}</span
                ><UBadge
                  size="xs"
                  color="info"
                  :label="`${item.priceSnapshot} 积分`"
                />
              </div>
            </div>
          </template>
          <div
            v-if="detail.remark"
            class="order-note"
          >
            <strong>订单备注</strong><span>{{ detail.remark }}</span>
          </div>
          <USeparator label="状态处理" />
          <div class="status-hint">{{ statusMeta[detail.status].hint }}</div>
          <template v-if="detail.type === GoodsTypes.Physical">
            <USeparator label="收货地址" />
            <div class="detail-panel">
              <a
                v-if="detail.goods.collectUrl"
                :href="detail.goods.collectUrl"
                target="_blank"
                >通过站外链接收集</a
              ><AddressDisplay
                v-else
                :address="detail.address"
              />
            </div>
          </template>
          <template v-if="detail.type === GoodsTypes.Physical && detail.status === PointOrderStatus.Shipped">
            <USeparator label="物流信息" />
            <div class="detail-panel express-form">
              <UInput
                v-model="detail.expressCompany"
                list="express-companies"
                placeholder="快递公司"
              /><datalist id="express-companies">
                <option
                  v-for="company in expressCompanies"
                  :key="company"
                  :value="company"
                /></datalist
              ><UInput
                v-model="detail.trackingNumber"
                placeholder="填写快递单号"
              /><UButton
                color="primary"
                :loading="actionLoading"
                @click="saveExpress"
                >更新物流信息</UButton
              >
            </div>
          </template>
          <div class="status-actions">
            <UButton
              v-if="previousStatus(detail) !== undefined"
              color="warning"
              variant="soft"
              @click="pendingStatus = { order: detail, status: previousStatus(detail)! }"
              >回退到等待发货</UButton
            ><UButton
              v-if="nextStatus(detail) !== undefined"
              color="primary"
              @click="pendingStatus = { order: detail, status: nextStatus(detail)! }"
              >{{
                detail.type === GoodsTypes.Virtual || detail.status === PointOrderStatus.Shipped
                  ? '完成订单'
                  : '确认发货'
              }}</UButton
            >
          </div>
        </div>
      </template>
    </UModal>

    <UModal
      v-if="pendingStatus"
      :open="Boolean(pendingStatus)"
      title="修改订单状态"
      @update:open="!$event && (pendingStatus = undefined)"
    >
      <template #body
        ><p>
          确认将订单 #{{ pendingStatus.order.id }} 从「{{ statusMeta[pendingStatus.order.status].label }}」改为「{{
            statusMeta[pendingStatus.status].label
          }}」吗？
        </p></template
      >
      <template #footer
        ><div class="status-actions">
          <UButton
            color="neutral"
            variant="ghost"
            @click="pendingStatus = undefined"
            >取消</UButton
          ><UButton
            color="primary"
            :loading="actionLoading"
            @click="updateStatus([pendingStatus!.order.id], pendingStatus!.status)"
            >确认修改</UButton
          >
        </div></template
      >
    </UModal>
  </div>
</template>

<style scoped>
.point-order-card {
  width: 100%;
  min-width: 0;
}
.order-empty {
  display: grid;
  min-height: 180px;
  place-content: center;
  gap: 10px;
  color: var(--vtsuru-fg-muted);
  text-align: center;
}
.order-empty :first-child {
  font-size: 28px;
}
.owner-order-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
}
.owner-order-table {
  width: 100%;
  min-width: 1100px;
  border-collapse: collapse;
  color: var(--vtsuru-fg);
  font-size: 13px;
}
.owner-order-table th,
.owner-order-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--vtsuru-border);
  text-align: left;
  vertical-align: middle;
}
.owner-order-table th {
  color: var(--vtsuru-fg-muted);
  background: var(--vtsuru-bg-muted);
  font-size: 12px;
  font-weight: 600;
}
.owner-order-table tbody tr:last-child td {
  border-bottom: 0;
}
.owner-order-table a,
.detail-panel a {
  color: var(--vtsuru-brand);
  text-decoration: none;
}
.owner-order-goods {
  display: grid;
  gap: 2px;
}
.owner-order-goods span,
.mobile-owner-order span,
.order-summary span,
.variant-item span {
  overflow: hidden;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mobile-owner-orders {
  display: none;
}
.order-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 12px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.owner-order-detail {
  display: grid;
  max-height: min(74vh, 720px);
  gap: 12px;
  overflow-y: auto;
}
.order-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.order-summary > div,
.variant-item,
.detail-panel,
.order-note,
.status-hint {
  padding: 10px 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-elevated);
}
.order-summary > div {
  display: grid;
  gap: 3px;
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
.variant-item :last-child {
  grid-column: 1 / -1;
  justify-self: start;
}
.order-note {
  display: grid;
  gap: 5px;
}
.express-form {
  display: grid;
  grid-template-columns: 180px minmax(220px, 1fr) auto;
  gap: 8px;
}
.status-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 768px) {
  .owner-order-table-wrap {
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
    background: var(--vtsuru-bg);
  }
  .mobile-owner-order__topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
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
