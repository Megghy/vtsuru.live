<script setup lang="ts">
import ArrowDownload24Regular from '@vicons/fluent/es/ArrowDownload24Regular'
import ArrowSync24Regular from '@vicons/fluent/es/ArrowSync24Regular'
import Delete24Regular from '@vicons/fluent/es/Delete24Regular'
import Edit24Regular from '@vicons/fluent/es/Edit24Regular'
import Filter24Regular from '@vicons/fluent/es/Filter24Regular'
import Search24Regular from '@vicons/fluent/es/Search24Regular'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { computed, onMounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponsePointOrder2OwnerModel } from '@/api/generated/model'
import { GoodsTypes, PointOrderStatus } from '@/api/generated/model'
import { postApiPointDeleteOrders } from '@/api/generated/point/point'
import { fetchOwnerOrders, updateOrdersStatus } from '@/api/point-orders'
import PointBatchExpressDialog from '@/shared/components/points/PointBatchExpressDialog.vue'
import PointOrderCard from '@/shared/components/points/PointOrderCard.vue'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
import { objectsToCSV, toast } from '@/shared/utils'

type OrderQuickView = 'all' | 'pending' | 'inProgress' | 'shipped' | 'needTracking' | 'completed' | 'closed'

interface OrderFilterSettings {
  type?: GoodsTypes
  status?: PointOrderStatus
  customer?: number
  streamerId?: number
  onlyRequireShippingInfo: boolean
}

const props = defineProps<{
  orgId?: number
  streamerOptions?: { label: string; value: number }[]
}>()

const emit = defineEmits<{
  statsChange: [stats: { total: number; pending: number; inProgress: number; needTracking: number }]
}>()

const defaultSettings: OrderFilterSettings = {
  onlyRequireShippingInfo: false,
}

const filterKey = computed(() =>
  props.orgId ? `vtsuru:setting:point:order-filter:org-${props.orgId}` : 'vtsuru:setting:point:order-filter:owner',
)
const filterSettings = usePersistedStorage<OrderFilterSettings>(filterKey, defaultSettings)
const searchKeyword = ref('')

watch(
  () => filterSettings.value.streamerId,
  () => {
    if (props.orgId) void refresh()
  },
)

watch(
  () => filterSettings.value.customer,
  () => {
    if (props.orgId) void refresh()
  },
)

const accountInfo = useAccount()
const orders = ref<ResponsePointOrder2OwnerModel[]>([])
const isLoading = ref(false)
const selectedItem = ref<number[]>([])
const targetStatus = ref<PointOrderStatus>()
const showStatusModal = ref(false)
const showBatchExpressModal = ref(false)
const isBatchSubmitting = ref(false)

const activeQuickView = computed<OrderQuickView>(() => {
  if (filterSettings.value.onlyRequireShippingInfo && filterSettings.value.status === PointOrderStatus.Shipped) {
    return 'needTracking'
  }
  if (filterSettings.value.status === PointOrderStatus.Pending) return 'pending'
  if (filterSettings.value.status === PointOrderStatus.InProgress) return 'inProgress'
  if (filterSettings.value.status === PointOrderStatus.Shipped) return 'shipped'
  if (filterSettings.value.status === PointOrderStatus.Completed) return 'completed'
  if (
    filterSettings.value.status === PointOrderStatus.Cancelled ||
    filterSettings.value.status === PointOrderStatus.Rejected
  ) {
    return 'closed'
  }
  return 'all'
})

function applyQuickView(view: OrderQuickView) {
  filterSettings.value.onlyRequireShippingInfo = false
  switch (view) {
    case 'all':
      filterSettings.value.status = undefined
      break
    case 'pending':
      filterSettings.value.status = PointOrderStatus.Pending
      break
    case 'inProgress':
      filterSettings.value.status = PointOrderStatus.InProgress
      break
    case 'shipped':
      filterSettings.value.status = PointOrderStatus.Shipped
      break
    case 'needTracking':
      filterSettings.value.status = PointOrderStatus.Shipped
      filterSettings.value.onlyRequireShippingInfo = true
      break
    case 'completed':
      filterSettings.value.status = PointOrderStatus.Completed
      break
    case 'closed':
      filterSettings.value.status = PointOrderStatus.Cancelled
      break
  }
}

const filteredOrders = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  return orders.value.filter((o) => {
    if (filterSettings.value.type != undefined && o.type !== filterSettings.value.type) return false
    if (filterSettings.value.status != undefined) {
      if (activeQuickView.value === 'closed') {
        if (o.status !== PointOrderStatus.Cancelled && o.status !== PointOrderStatus.Rejected) return false
      } else if (o.status !== filterSettings.value.status) {
        return false
      }
    }
    if (filterSettings.value.onlyRequireShippingInfo && (o.trackingNumber || o.type !== GoodsTypes.Physical)) {
      return false
    }
    if (filterSettings.value.customer && o.customer.userId !== filterSettings.value.customer) return false
    if (props.orgId && filterSettings.value.streamerId && o.vTsuruId !== filterSettings.value.streamerId) return false
    if (kw) {
      const matchId = `#${o.id}`.includes(kw) || String(o.id).includes(kw)
      const matchUser = o.customer.name?.toLowerCase().includes(kw) || String(o.customer.userId || '').includes(kw)
      const matchGoods = o.goods?.name?.toLowerCase().includes(kw)
      const matchSub = (o.selectedSubItems ?? []).some((sub) => sub.nameSnapshot?.toLowerCase().includes(kw))
      const matchTracking = o.trackingNumber?.toLowerCase().includes(kw)
      const matchRemark = o.remark?.toLowerCase().includes(kw)
      if (!matchId && !matchUser && !matchGoods && !matchSub && !matchTracking && !matchRemark) return false
    }
    return true
  })
})

const orderStats = computed(() => {
  const list = orders.value
  return {
    total: list.length,
    pending: list.filter((o) => o.status === PointOrderStatus.Pending).length,
    inProgress: list.filter((o) => o.status === PointOrderStatus.InProgress).length,
    shipped: list.filter((o) => o.status === PointOrderStatus.Shipped).length,
    needTracking: list.filter(
      (o) => o.type === GoodsTypes.Physical && o.status === PointOrderStatus.Shipped && !o.trackingNumber,
    ).length,
    completed: list.filter((o) => o.status === PointOrderStatus.Completed).length,
    closed: list.filter((o) => o.status === PointOrderStatus.Cancelled || o.status === PointOrderStatus.Rejected)
      .length,
    filteredPoints: Number(filteredOrders.value.reduce((sum, o) => sum + o.point, 0).toFixed(1)),
  }
})

watch(
  orderStats,
  (s) => {
    emit('statsChange', {
      total: s.total,
      pending: s.pending,
      inProgress: s.inProgress,
      needTracking: s.needTracking,
    })
  },
  { immediate: true },
)

const quickTabs = computed<{ key: OrderQuickView; label: string; count: number; highlight?: boolean }[]>(() => [
  { key: 'all', label: '全部', count: orderStats.value.total },
  { key: 'pending', label: '待处理', count: orderStats.value.pending, highlight: orderStats.value.pending > 0 },
  { key: 'inProgress', label: '服务进行中', count: orderStats.value.inProgress },
  {
    key: 'needTracking',
    label: '待填单号',
    count: orderStats.value.needTracking,
    highlight: orderStats.value.needTracking > 0,
  },
  { key: 'shipped', label: '已发货', count: orderStats.value.shipped },
  { key: 'completed', label: '已完成', count: orderStats.value.completed },
  { key: 'closed', label: '已取消/拒绝', count: orderStats.value.closed },
])

const hasActiveFilter = computed(
  () =>
    Boolean(searchKeyword.value.trim()) ||
    filterSettings.value.type !== undefined ||
    filterSettings.value.status !== undefined ||
    filterSettings.value.customer !== undefined ||
    filterSettings.value.streamerId !== undefined ||
    filterSettings.value.onlyRequireShippingInfo,
)

function resetFilters() {
  searchKeyword.value = ''
  filterSettings.value = { ...defaultSettings }
}

async function deleteOrder() {
  if (props.orgId) {
    toast.warning('组织订单暂不支持删除')
    return
  }
  if (!selectedItem.value.length) {
    toast.warning('请选择要删除的订单')
    return
  }

  const ids = selectedItem.value.filter(
    (id) => orders.value.find((order) => order.id === id)?.type !== GoodsTypes.Service,
  )
  if (!ids.length) {
    toast.warning('服务订单需要在订单详情中按履约流程取消')
    return
  }
  try {
    const data = await postApiPointDeleteOrders(ids.map(Number))
    if (data.code === 200) {
      toast.success('删除成功')
      orders.value = orders.value.filter((o) => !ids.includes(o.id))
      selectedItem.value = []
    } else {
      toast.error(`删除失败: ${data.message}`)
    }
  } catch (err) {
    toast.error(`删除失败: ${err}`)
  }
}

function openStatusUpdateModal() {
  if (!selectedItem.value.length) {
    toast.warning('请选择要更新的订单')
    return
  }
  targetStatus.value = undefined
  showStatusModal.value = true
}

function handleBatchExpressUpdated(
  updatedIds: number[],
  updates: Record<number, { expressCompany: string; trackingNumber: string }>,
  markShipped: boolean,
) {
  const set = new Set(updatedIds)
  orders.value.forEach((order) => {
    if (!set.has(Number(order.id))) return
    const u = updates[Number(order.id)]
    if (u) {
      order.expressCompany = u.expressCompany
      order.trackingNumber = u.trackingNumber
    }
    if (markShipped && order.status === PointOrderStatus.Pending) {
      order.status = PointOrderStatus.Shipped
    }
    order.updateAt = Date.now()
  })
}

async function batchUpdateOrderStatus() {
  if (!selectedItem.value.length) return
  if (targetStatus.value === undefined) {
    toast.warning('请选择目标状态')
    return
  }

  const ids = selectedItem.value.filter(
    (id) => orders.value.find((order) => order.id === id)?.type !== GoodsTypes.Service,
  )
  if (!ids.length) {
    toast.warning('服务订单需要在订单详情中按履约流程处理')
    return
  }

  isBatchSubmitting.value = true
  try {
    await updateOrdersStatus(
      props.orgId ? { kind: 'org', orgId: props.orgId } : { kind: 'owner' },
      ids,
      targetStatus.value,
    )
    toast.success(`已更新 ${ids.length} 笔订单状态`)
    const updated = new Set<number>(ids)
    orders.value.forEach((order) => {
      if (updated.has(Number(order.id))) {
        order.status = targetStatus.value as PointOrderStatus
        order.updateAt = Date.now()
      }
    })
    targetStatus.value = undefined
    showStatusModal.value = false
  } catch (err) {
    toast.error(err instanceof Error ? err.message : `更新失败: ${err}`)
  } finally {
    isBatchSubmitting.value = false
  }
}

const statusText: Record<PointOrderStatus, string> = {
  [PointOrderStatus.Completed]: '已完成',
  [PointOrderStatus.Pending]: '待处理',
  [PointOrderStatus.Shipped]: '已发货',
  [PointOrderStatus.InProgress]: '进行中',
  [PointOrderStatus.Rejected]: '已拒绝',
  [PointOrderStatus.Cancelled]: '已取消',
}

function exportData() {
  try {
    const text = objectsToCSV(
      filteredOrders.value.map((s) => {
        const gift = s.goods
        return {
          订单号: s.id,
          订单类型: s.type === GoodsTypes.Physical ? '实体' : s.type === GoodsTypes.Service ? '服务' : '虚拟',
          订单状态: statusText[s.status],
          用户名: s.customer.name ?? '未知',
          用户UID: s.customer.userId,
          联系人: s.address?.name,
          联系电话: s.address?.phone,
          地址: s.address
            ? `${s.address?.province}省${s.address?.city}市${s.address?.district}区${s.address?.street}街道${s.address?.address}`
            : '无',
          礼物名: gift?.name ?? '已删除',
          款式: (s.selectedSubItems ?? []).map((sub) => `${sub.nameSnapshot} x ${sub.quantity}`).join('; ') || '-',
          礼物数量: s.count,
          礼物单价: gift?.price ? Number(gift.price.toFixed(1)) : 0,
          礼物总价: Number(s.point.toFixed(1)),
          快递公司: s.expressCompany,
          快递单号: s.trackingNumber,
          备注: s.remark ?? '',
          创建时间: format(s.createAt, 'yyyy-MM-dd HH:mm:ss'),
          更新时间: s.updateAt ? format(s.updateAt, 'yyyy-MM-dd HH:mm:ss') : '未更新',
        }
      }),
    )

    const BOM = new Uint8Array([0xef, 0xbb, 0xbf])
    const utf8encoder = new TextEncoder()
    const utf8array = utf8encoder.encode(text)

    saveAs(
      new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }),
      `积分订单_${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.name ?? ''}_.csv`,
    )

    toast.success('导出成功')
  } catch (error) {
    toast.error(`导出失败: ${error}`)
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
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await refresh()
})
</script>

<template>
  <div class="space-y-3.5">
    <div
      v-if="isLoading && orders.length === 0"
      class="py-16 flex justify-center"
    >
      <Spin />
    </div>

    <Empty
      v-else-if="orders.length === 0"
      description="暂无订单"
      class="py-12"
    />

    <template v-else>
      <!-- 快捷状态队列 Pills -->
      <div class="flex-between gap-2 flex-wrap">
        <div class="flex items-center gap-1.5 flex-wrap">
          <Button
            v-for="tab in quickTabs"
            :key="tab.key"
            :variant="activeQuickView === tab.key ? 'default' : 'outline'"
            size="xs"
            class="gap-1.5"
            @click="applyQuickView(tab.key)"
          >
            <span>{{ tab.label }}</span>
            <Badge
              :variant="tab.highlight && activeQuickView !== tab.key ? 'warning' : 'secondary'"
              size="xs"
              class="font-mono"
            >
              {{ tab.count }}
            </Badge>
          </Button>
        </div>

        <span class="text-xs text-muted-foreground font-mono">
          当前 {{ filteredOrders.length }} 笔 · {{ orderStats.filteredPoints }} 积分
        </span>
      </div>

      <!-- 工具栏区域 -->
      <div class="p-3 rounded-lg border border-border/80 bg-card flex-between flex-wrap gap-2.5 text-xs">
        <div class="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div class="relative w-56 max-w-full">
            <Search24Regular class="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
            <Input
              v-model="searchKeyword"
              placeholder="搜订单号 / 用户 / 礼物 / 单号"
              class="pl-8"
            />
          </div>

          <Select
            v-if="orgId && streamerOptions?.length"
            :model-value="filterSettings.streamerId ? String(filterSettings.streamerId) : 'all'"
            @update:model-value="filterSettings.streamerId = $event === 'all' ? undefined : Number($event)"
          >
            <SelectTrigger class="w-36">
              <SelectValue placeholder="主播" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部主播</SelectItem>
              <SelectItem
                v-for="s in streamerOptions"
                :key="s.value"
                :value="String(s.value)"
              >
                {{ s.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            :model-value="filterSettings.type !== undefined ? String(filterSettings.type) : 'all'"
            @update:model-value="filterSettings.type = $event === 'all' ? undefined : Number($event)"
          >
            <SelectTrigger class="w-28">
              <SelectValue placeholder="订单类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem :value="String(GoodsTypes.Physical)">实体订单</SelectItem>
              <SelectItem :value="String(GoodsTypes.Virtual)">虚拟订单</SelectItem>
              <SelectItem :value="String(GoodsTypes.Service)">服务订单</SelectItem>
            </SelectContent>
          </Select>

          <Button
            v-if="hasActiveFilter"
            variant="ghost"
            size="xs"
            class="gap-1 text-muted-foreground"
            @click="resetFilters"
          >
            <Filter24Regular class="size-3.5" />
            重置筛选
          </Button>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            :loading="isLoading"
            @click="refresh"
          >
            <ArrowSync24Regular class="size-3.5 mr-1" />
            刷新
          </Button>
          <Button
            v-if="!orgId"
            variant="outline"
            @click="showBatchExpressModal = true"
          >
            批量导入单号
          </Button>
          <Button
            variant="outline"
            @click="exportData"
          >
            <ArrowDownload24Regular class="size-3.5 mr-1" />
            导出 CSV
          </Button>

          <Separator
            v-if="selectedItem.length > 0"
            orientation="vertical"
            class="h-5"
          />

          <Button
            v-if="selectedItem.length > 0"
            variant="outline"
            @click="openStatusUpdateModal"
          >
            <Edit24Regular class="size-3.5 mr-1" />
            批量改状态 ({{ selectedItem.length }})
          </Button>

          <Popconfirm
            v-if="!orgId && selectedItem.length > 0"
            title="确定删除所选订单吗?"
            positive-text="删除"
            negative-text="取消"
            @positive-click="deleteOrder"
          >
            <template #trigger>
              <Button variant="destructive">
                <Delete24Regular class="size-3.5 mr-1" />
                删除 ({{ selectedItem.length }})
              </Button>
            </template>
            确定删除选中的 {{ selectedItem.length }} 笔订单吗？
          </Popconfirm>
        </div>
      </div>

      <!-- 订单列表 -->
      <PointOrderCard
        :order="filteredOrders"
        type="owner"
        :org-id="orgId"
        :loading="isLoading"
        @selected-item="(items) => (selectedItem = items)"
      />

      <!-- 批量更新状态弹窗 -->
      <Dialog v-model:open="showStatusModal">
        <DialogContent class="sm:max-w-sm p-4 space-y-3">
          <DialogHeader class="pb-2 border-b border-border/60">
            <DialogTitle class="text-sm">批量更新状态 ({{ selectedItem.length }} 笔)</DialogTitle>
          </DialogHeader>

          <div class="space-y-2.5 text-xs">
            <p class="text-muted-foreground m-0">将已勾选的 {{ selectedItem.length }} 笔订单（不含服务订单）更新为：</p>
            <Select
              :model-value="targetStatus !== undefined ? String(targetStatus) : ''"
              @update:model-value="targetStatus = Number($event) as PointOrderStatus"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择目标状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="String(PointOrderStatus.Pending)">等待发货</SelectItem>
                <SelectItem :value="String(PointOrderStatus.Shipped)">已发货</SelectItem>
                <SelectItem :value="String(PointOrderStatus.Completed)">已完成</SelectItem>
                <SelectItem :value="String(PointOrderStatus.Cancelled)">已取消</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter class="pt-2 border-t border-border/60">
            <Button
              variant="outline"
              @click="showStatusModal = false"
            >
              取消
            </Button>
            <Button
              :loading="isBatchSubmitting"
              :disabled="targetStatus === undefined"
              @click="batchUpdateOrderStatus"
            >
              确认更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PointBatchExpressDialog
        v-if="!orgId"
        v-model:open="showBatchExpressModal"
        :orders="orders"
        @updated="handleBatchExpressUpdated"
      />
    </template>
  </div>
</template>
