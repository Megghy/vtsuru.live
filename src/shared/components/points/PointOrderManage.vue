<script setup lang="ts">
import {
  ArrowDownload24Regular,
  ArrowSync24Regular,
  Delete24Regular,
  Edit24Regular,
  Filter24Regular,
} from '@vicons/fluent'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { List } from 'linqts'
import { computed, onMounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponsePointGoodModel, ResponsePointOrder2OwnerModel } from '@/api/api-models'
import { GoodsTypes, PointOrderStatus } from '@/api/api-models'
import { postApiPointDeleteOrders } from '@/api/generated/point/point'
import { fetchOwnerOrders, updateOrdersStatus } from '@/api/point-orders'
import PointOrderCard from '@/shared/components/points/PointOrderCard.vue'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
import { objectsToCSV, toast } from '@/shared/utils'

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

const defaultSettings: OrderFilterSettings = {
  onlyRequireShippingInfo: false,
}

const filterKey = computed(() =>
  props.orgId ? `vtsuru:setting:point:order-filter:org-${props.orgId}` : 'vtsuru:setting:point:order-filter:owner',
)
const filterSettings = usePersistedStorage<OrderFilterSettings>(filterKey, defaultSettings)

watch(
  () => filterSettings.value.streamerId,
  () => {
    if (props.orgId) refresh()
  },
)

watch(
  () => filterSettings.value.customer,
  () => {
    if (props.orgId) refresh()
  },
)

const accountInfo = useAccount()
const orders = ref<ResponsePointOrder2OwnerModel[]>([])
const filteredOrders = computed(() => {
  return orders.value.filter((o) => {
    if (filterSettings.value.type != undefined && o.type !== filterSettings.value.type) return false
    if (filterSettings.value.status != undefined && o.status !== filterSettings.value.status) return false
    if (filterSettings.value.onlyRequireShippingInfo && o.trackingNumber) return false
    if (filterSettings.value.customer && o.customer.userId !== filterSettings.value.customer) return false
    if (props.orgId && filterSettings.value.streamerId && o.vTsuruId !== filterSettings.value.streamerId) return false
    return true
  })
})

const isLoading = ref(false)
const selectedItem = ref<(string | number)[]>()
const targetStatus = ref<PointOrderStatus>()
const showStatusModal = ref(false)

const orderStats = computed(() => ({
  total: orders.value.length,
  pending: orders.value.filter((o) => o.status === PointOrderStatus.Pending).length,
  shipped: orders.value.filter((o) => o.status === PointOrderStatus.Shipped).length,
  inProgress: orders.value.filter((o) => o.status === PointOrderStatus.InProgress).length,
  completed: orders.value.filter((o) => o.status === PointOrderStatus.Completed).length,
  physical: orders.value.filter((o) => o.type === GoodsTypes.Physical).length,
  virtual: orders.value.filter((o) => o.type === GoodsTypes.Virtual).length,
  service: orders.value.filter((o) => o.type === GoodsTypes.Service).length,
  totalPoints: Number(orders.value.reduce((sum, o) => sum + o.point, 0).toFixed(1)),
  filteredCount: filteredOrders.value.length,
}))

async function deleteOrder() {
  if (props.orgId) {
    toast.warning('组织订单暂不支持删除')
    return
  }
  if (!selectedItem.value?.length) {
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
      selectedItem.value = undefined
    } else {
      toast.error(`删除失败: ${data.message}`)
    }
  } catch (err) {
    toast.error(`删除失败: ${err}`)
  }
}

function openStatusUpdateModal() {
  if (!selectedItem.value?.length) {
    toast.warning('请选择要更新的订单')
    return
  }
  showStatusModal.value = true
}

async function batchUpdateOrderStatus() {
  if (!selectedItem.value?.length) {
    toast.warning('请选择要更新的订单')
    return
  }
  if (targetStatus.value === undefined) {
    toast.warning('请选择目标状态')
    return
  }

  const ids = (selectedItem.value as number[]).filter(
    (id) => orders.value.find((order) => order.id === id)?.type !== GoodsTypes.Service,
  )
  if (!ids.length) {
    toast.warning('服务订单需要在订单详情中按履约流程处理')
    return
  }
  try {
    await updateOrdersStatus(
      props.orgId ? { kind: 'org', orgId: props.orgId } : { kind: 'owner' },
      ids,
      targetStatus.value,
    )
    toast.success('更新成功')
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
  <div class="space-y-4">
    <div v-if="isLoading && orders.length === 0" class="py-16 flex justify-center">
      <Spin />
    </div>

    <Empty
      v-else-if="orders.length === 0"
      description="暂无订单"
      class="py-12"
    />

    <template v-else>
      <!-- 统计指标网格 -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <div class="p-3 rounded-lg border border-border/80 bg-card">
          <span class="text-muted-foreground text-[11px] block">总订单</span>
          <strong class="text-base font-semibold text-foreground font-mono">{{ orderStats.total }}</strong>
        </div>
        <div class="p-3 rounded-lg border border-border/80 bg-card">
          <span class="text-muted-foreground text-[11px] block">待处理</span>
          <strong class="text-base font-semibold text-amber-500 font-mono">{{ orderStats.pending }}</strong>
        </div>
        <div class="p-3 rounded-lg border border-border/80 bg-card">
          <span class="text-muted-foreground text-[11px] block">已发货</span>
          <strong class="text-base font-semibold text-sky-500 font-mono">{{ orderStats.shipped }}</strong>
        </div>
        <div class="p-3 rounded-lg border border-border/80 bg-card">
          <span class="text-muted-foreground text-[11px] block">服务进行中</span>
          <strong class="text-base font-semibold text-sky-500 font-mono">{{ orderStats.inProgress }}</strong>
        </div>
        <div class="p-3 rounded-lg border border-border/80 bg-card">
          <span class="text-muted-foreground text-[11px] block">已完成</span>
          <strong class="text-base font-semibold text-emerald-500 font-mono">{{ orderStats.completed }}</strong>
        </div>
        <div class="p-3 rounded-lg border border-border/80 bg-card">
          <span class="text-muted-foreground text-[11px] block">实体/虚拟/服务</span>
          <span class="text-xs font-medium text-foreground font-mono">
            {{ orderStats.physical }} / {{ orderStats.virtual }} / {{ orderStats.service }}
          </span>
        </div>
        <div class="p-3 rounded-lg border border-border/80 bg-card">
          <span class="text-muted-foreground text-[11px] block">总积分</span>
          <strong class="text-base font-semibold text-primary font-mono">{{ orderStats.totalPoints }}</strong>
        </div>
      </div>

      <!-- 工具栏区域 -->
      <div class="p-3.5 rounded-lg border border-border/80 bg-card space-y-3 text-xs">
        <!-- 筛选行 -->
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          <div class="flex flex-wrap items-center gap-2">
            <Select
              v-if="orgId && streamerOptions?.length"
              :model-value="filterSettings.streamerId ? String(filterSettings.streamerId) : 'all'"
              @update:model-value="filterSettings.streamerId = $event === 'all' ? undefined : Number($event)"
            >
              <SelectTrigger class="w-36 h-8 text-xs">
                <SelectValue placeholder="主播" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" class="text-xs">全部主播</SelectItem>
                <SelectItem
                  v-for="s in streamerOptions"
                  :key="s.value"
                  :value="String(s.value)"
                  class="text-xs"
                >
                  {{ s.label }}
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              :model-value="filterSettings.type !== undefined ? String(filterSettings.type) : 'all'"
              @update:model-value="filterSettings.type = $event === 'all' ? undefined : Number($event)"
            >
              <SelectTrigger class="w-32 h-8 text-xs">
                <SelectValue placeholder="订单类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" class="text-xs">全部类型</SelectItem>
                <SelectItem :value="String(GoodsTypes.Physical)" class="text-xs">实体订单</SelectItem>
                <SelectItem :value="String(GoodsTypes.Virtual)" class="text-xs">虚拟订单</SelectItem>
                <SelectItem :value="String(GoodsTypes.Service)" class="text-xs">服务订单</SelectItem>
              </SelectContent>
            </Select>

            <Select
              :model-value="filterSettings.status !== undefined ? String(filterSettings.status) : 'all'"
              @update:model-value="filterSettings.status = $event === 'all' ? undefined : Number($event)"
            >
              <SelectTrigger class="w-32 h-8 text-xs">
                <SelectValue placeholder="订单状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" class="text-xs">全部状态</SelectItem>
                <SelectItem :value="String(PointOrderStatus.Completed)" class="text-xs">已完成</SelectItem>
                <SelectItem :value="String(PointOrderStatus.Pending)" class="text-xs">待处理</SelectItem>
                <SelectItem :value="String(PointOrderStatus.Shipped)" class="text-xs">已发货</SelectItem>
                <SelectItem :value="String(PointOrderStatus.InProgress)" class="text-xs">进行中</SelectItem>
                <SelectItem :value="String(PointOrderStatus.Rejected)" class="text-xs">已拒绝</SelectItem>
                <SelectItem :value="String(PointOrderStatus.Cancelled)" class="text-xs">已取消</SelectItem>
              </SelectContent>
            </Select>

            <Select
              :model-value="filterSettings.customer ? String(filterSettings.customer) : 'all'"
              @update:model-value="filterSettings.customer = $event === 'all' ? undefined : Number($event)"
            >
              <SelectTrigger class="w-36 h-8 text-xs">
                <SelectValue placeholder="按用户筛选" />
              </SelectTrigger>
              <SelectContent class="max-h-56">
                <SelectItem value="all" class="text-xs">全部用户</SelectItem>
                <SelectItem
                  v-for="c in new List(orders).DistinctBy((s) => s.customer.userId).ToArray()"
                  :key="c.customer.userId"
                  :value="String(c.customer.userId)"
                  class="text-xs"
                >
                  {{ c.customer.name }}
                </SelectItem>
              </SelectContent>
            </Select>

            <label class="flex items-center gap-1.5 cursor-pointer ml-1">
              <Checkbox v-model:checked="filterSettings.onlyRequireShippingInfo" />
              <span class="text-xs">仅未填单号</span>
            </label>
          </div>

          <Button
            variant="ghost"
            size="sm"
            class="h-8 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
            @click="filterSettings = JSON.parse(JSON.stringify(defaultSettings))"
          >
            <component :is="Filter24Regular" class="size-3.5" />
            重置筛选
          </Button>
        </div>

        <Separator />

        <!-- 操作行 -->
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              class="h-8 text-xs flex items-center gap-1"
              @click="refresh"
            >
              <component :is="ArrowSync24Regular" class="size-3.5" />
              刷新
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="h-8 text-xs flex items-center gap-1"
              @click="exportData"
            >
              <component :is="ArrowDownload24Regular" class="size-3.5" />
              导出数据
            </Button>
          </div>

          <div class="flex items-center gap-2">
            <Popconfirm
              title="确定要更新选中订单的状态吗?"
              positive-text="确定"
              negative-text="取消"
              :disabled="!selectedItem?.length"
              @positive-click="openStatusUpdateModal"
            >
              <template #trigger>
                <Button
                  variant="outline"
                  size="sm"
                  class="h-8 text-xs flex items-center gap-1"
                  :disabled="!selectedItem?.length"
                >
                  <component :is="Edit24Regular" class="size-3.5" />
                  批量更新状态 ({{ selectedItem?.length ?? 0 }})
                </Button>
              </template>
              确定要更新选中订单的状态吗?
            </Popconfirm>

            <Popconfirm
              v-if="!orgId"
              title="确定删除所选订单吗?"
              positive-text="删除"
              negative-text="取消"
              :disabled="!selectedItem?.length"
              @positive-click="deleteOrder"
            >
              <template #trigger>
                <Button
                  variant="destructive"
                  size="sm"
                  class="h-8 text-xs flex items-center gap-1"
                  :disabled="!selectedItem?.length"
                >
                  <component :is="Delete24Regular" class="size-3.5" />
                  批量删除 ({{ selectedItem?.length ?? 0 }})
                </Button>
              </template>
              确定删除所选订单吗?
            </Popconfirm>
          </div>
        </div>
      </div>

      <!-- 订单列表 -->
      <PointOrderCard
        :order="filteredOrders"
        type="owner"
        :org-id="orgId"
        @selected-item="(items) => (selectedItem = items)"
      />

      <!-- 状态选择弹窗 -->
      <Dialog v-model:open="showStatusModal">
        <DialogContent class="sm:max-w-sm p-4 space-y-3">
          <DialogHeader class="pb-2 border-b border-border/60">
            <DialogTitle class="text-sm font-semibold">选择目标状态</DialogTitle>
          </DialogHeader>

          <div class="space-y-2 text-xs">
            <p class="text-muted-foreground">请选择您想要将选中的订单更新为的状态：</p>
            <Select
              :model-value="targetStatus !== undefined ? String(targetStatus) : ''"
              @update:model-value="targetStatus = Number($event) as PointOrderStatus"
            >
              <SelectTrigger class="w-full h-8 text-xs">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="String(PointOrderStatus.Completed)" class="text-xs">已完成</SelectItem>
                <SelectItem :value="String(PointOrderStatus.Pending)" class="text-xs">等待发货</SelectItem>
                <SelectItem :value="String(PointOrderStatus.Shipped)" class="text-xs">已发货</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter class="pt-2 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              class="text-xs"
              @click="showStatusModal = false"
            >
              取消
            </Button>
            <Button
              size="sm"
              class="text-xs"
              :disabled="targetStatus === undefined"
              @click="batchUpdateOrderStatus"
            >
              确认更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
