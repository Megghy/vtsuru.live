<script setup lang="ts">
import ArrowSync24Regular from '@vicons/fluent/es/ArrowSync24Regular'
import CheckmarkCircle24Regular from '@vicons/fluent/es/CheckmarkCircle24Regular'
import ChevronLeft24Regular from '@vicons/fluent/es/ChevronLeft24Regular'
import ChevronRight24Regular from '@vicons/fluent/es/ChevronRight24Regular'
import DismissCircle24Regular from '@vicons/fluent/es/DismissCircle24Regular'
import Prohibited24Regular from '@vicons/fluent/es/Prohibited24Regular'
import Timer24Regular from '@vicons/fluent/es/Timer24Regular'
import VehicleTruck24Regular from '@vicons/fluent/es/VehicleTruck24Regular'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { Component } from 'vue'
import { computed, ref, watch } from 'vue'

import type { ResponsePointOrder2OwnerModel } from '@/api/generated/model'
import { GoodsTypes, PointOrderStatus } from '@/api/generated/model'
import { updateOrderExpress, updateOrdersStatus } from '@/api/point-orders'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { toast } from '@/shared/utils'

import AddressDisplay from './AddressDisplay.vue'
import PointGoodsItem from './PointGoodsItem.vue'
import ServiceOrderPanel from './ServiceOrderPanel.vue'

const props = defineProps<{
  order: ResponsePointOrder2OwnerModel[]
  type: 'owner'
  orgId?: number
  loading?: boolean
}>()

const emit = defineEmits<{ selectedItem: [items: number[]] }>()

const actionLoading = ref(false)
const selectedItems = ref<number[]>([])
const detail = ref<ResponsePointOrder2OwnerModel>()
const showDetail = ref(false)
const serviceDetail = ref<ResponsePointOrder2OwnerModel>()
const showServiceDetail = ref(false)
const page = ref(1)
const pageSize = 15

const statusMeta: Record<
  PointOrderStatus,
  { label: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline'; hint: string; icon: Component }
> = {
  [PointOrderStatus.Pending]: {
    label: '等待发货',
    badgeVariant: 'outline',
    hint: '订单已创建，等待处理',
    icon: Timer24Regular,
  },
  [PointOrderStatus.Shipped]: {
    label: '已发货',
    badgeVariant: 'secondary',
    hint: '订单已发货，可填写或更新物流信息',
    icon: VehicleTruck24Regular,
  },
  [PointOrderStatus.Completed]: {
    label: '已完成',
    badgeVariant: 'default',
    hint: '订单流程已完成',
    icon: CheckmarkCircle24Regular,
  },
  [PointOrderStatus.InProgress]: {
    label: '进行中',
    badgeVariant: 'secondary',
    hint: '服务已接单，正在履约',
    icon: ArrowSync24Regular,
  },
  [PointOrderStatus.Rejected]: {
    label: '已拒绝',
    badgeVariant: 'destructive',
    hint: '服务订单已拒绝，积分已退回',
    icon: Prohibited24Regular,
  },
  [PointOrderStatus.Cancelled]: {
    label: '已取消',
    badgeVariant: 'outline',
    hint: '订单已取消，积分已退回',
    icon: DismissCircle24Regular,
  },
}

const loading = computed(() => Boolean(props.loading) || actionLoading.value)
const pagedOrders = computed(() => props.order.slice((page.value - 1) * pageSize, page.value * pageSize))

watch(
  () => props.order,
  (list) => {
    const maxPage = Math.max(1, Math.ceil(list.length / pageSize))
    if (page.value > maxPage) page.value = 1
    const existingIds = new Set(list.map((o) => o.id))
    const pruned = selectedItems.value.filter((id) => existingIds.has(id))
    if (pruned.length !== selectedItems.value.length) {
      selectedItems.value = pruned
      emit('selectedItem', pruned)
    }
  },
)

const detailOrderIndex = computed(() => {
  if (!detail.value) return -1
  return props.order.findIndex((o) => o.id === detail.value!.id)
})

const canPrevDetail = computed(() => detailOrderIndex.value > 0)
const canNextDetail = computed(() => detailOrderIndex.value >= 0 && detailOrderIndex.value < props.order.length - 1)

function stepDetailOrder(delta: -1 | 1) {
  const nextIndex = detailOrderIndex.value + delta
  const target = props.order[nextIndex]
  if (!target) return
  if (target.type === GoodsTypes.Service) {
    showDetail.value = false
    openDetail(target)
    return
  }
  detail.value = target
}

function getStatusLabel(row: ResponsePointOrder2OwnerModel) {
  if (row.type === GoodsTypes.Service && row.status === PointOrderStatus.Pending) return '待接单'
  if (row.status === PointOrderStatus.Shipped && !row.trackingNumber) return '已发货 · 待填单号'
  return statusMeta[row.status].label
}

function getStatusVariant(row: ResponsePointOrder2OwnerModel): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (row.status === PointOrderStatus.Shipped && !row.trackingNumber) return 'outline'
  return statusMeta[row.status].badgeVariant
}

function openDetail(row: ResponsePointOrder2OwnerModel) {
  if (row.type === GoodsTypes.Service) {
    if (props.orgId) {
      toast.info('组织订单暂不支持查看服务需求，请在主播账号下处理')
      return
    }
    serviceDetail.value = row
    showServiceDetail.value = true
    return
  }
  detail.value = row
  showDetail.value = true
}

function nextStatus(order: ResponsePointOrder2OwnerModel) {
  if (order.type === GoodsTypes.Service) return null
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
    toast.success('订单状态已更新')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : `更新订单失败: ${error}`)
  } finally {
    actionLoading.value = false
  }
}

async function saveExpress(andMarkShipped = false) {
  if (!detail.value) return
  actionLoading.value = true
  try {
    await updateOrderExpress(
      props.orgId ? { kind: 'org', orgId: props.orgId } : { kind: 'owner' },
      detail.value.id,
      detail.value.trackingNumber ?? '',
      detail.value.expressCompany,
    )
    if (andMarkShipped && detail.value.status === PointOrderStatus.Pending) {
      await updateOrdersStatus(
        props.orgId ? { kind: 'org', orgId: props.orgId } : { kind: 'owner' },
        [detail.value.id],
        PointOrderStatus.Shipped,
      )
      detail.value.status = PointOrderStatus.Shipped
    }
    detail.value.updateAt = Date.now()
    toast.success(andMarkShipped ? '已保存物流单号并标记发货' : '物流信息已更新')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : `更新物流信息失败: ${error}`)
  } finally {
    actionLoading.value = false
  }
}

function updateSelection(items: number[]) {
  const eligible = items.filter((id) => props.order.find((order) => order.id === id)?.type !== GoodsTypes.Service)
  selectedItems.value = eligible
  emit('selectedItem', eligible)
}

function toggleSelection(id: number, checked: boolean) {
  const next = checked ? [...selectedItems.value, id] : selectedItems.value.filter((item) => item !== id)
  updateSelection([...new Set(next)])
}

const selectableOrders = computed(() => props.order.filter((o) => o.type !== GoodsTypes.Service))
const isAllSelected = computed(
  () => selectableOrders.value.length > 0 && selectableOrders.value.every((o) => selectedItems.value.includes(o.id)),
)

function toggleAll(checked: boolean) {
  updateSelection(checked ? selectableOrders.value.map((o) => o.id) : [])
}

function formatRelativeTime(time: number) {
  try {
    return formatDistanceToNow(new Date(time), { addSuffix: true, locale: zhCN })
  } catch {
    return String(time)
  }
}
</script>

<template>
  <div class="point-order-card w-full min-w-0">
    <Empty
      v-if="order.length === 0"
      description="暂无匹配订单"
      class="py-12"
    />

    <template v-else>
      <!-- 桌面端表格 -->
      <div class="hidden md:block rounded-lg border border-border/80 overflow-hidden bg-card text-xs">
        <Table>
          <TableHeader>
            <TableRow class="hover:bg-transparent border-b border-border/80">
              <TableHead class="w-10 py-2.5 px-3">
                <Checkbox
                  :checked="isAllSelected"
                  @update:checked="toggleAll"
                />
              </TableHead>
              <TableHead class="w-20 py-2.5">订单号</TableHead>
              <TableHead class="w-32 py-2.5">用户</TableHead>
              <TableHead class="min-w-44 py-2.5">礼物</TableHead>
              <TableHead class="w-16 py-2.5">数量</TableHead>
              <TableHead class="w-28 py-2.5">时间</TableHead>
              <TableHead class="w-20 py-2.5">积分</TableHead>
              <TableHead class="w-36 py-2.5">状态</TableHead>
              <TableHead class="w-20 py-2.5">类型</TableHead>
              <TableHead class="w-28 py-2.5">备注</TableHead>
              <TableHead class="min-w-36 py-2.5">物流</TableHead>
              <TableHead class="w-20 py-2.5 text-right pr-3">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in pagedOrders"
              :key="row.id"
              class="hover:bg-muted/30 cursor-pointer"
              @click="openDetail(row)"
            >
              <TableCell
                class="py-2.5 px-3"
                @click.stop
              >
                <Checkbox
                  :checked="selectedItems.includes(row.id)"
                  :disabled="row.type === GoodsTypes.Service"
                  @update:checked="(checked) => toggleSelection(row.id, checked)"
                />
              </TableCell>
              <TableCell class="py-2.5 font-mono text-muted-foreground">#{{ row.id }}</TableCell>
              <TableCell
                class="py-2.5"
                @click.stop
              >
                <a
                  :href="`https://space.bilibili.com/${row.customer?.userId || ''}`"
                  target="_blank"
                  class="text-primary hover:underline truncate block max-w-28"
                >
                  {{ row.customer?.name || '未知用户' }}
                </a>
              </TableCell>
              <TableCell class="py-2.5">
                <div class="flex flex-col gap-0.5">
                  <strong class="font-medium text-foreground">{{ row.goods.name }}</strong>
                  <span
                    v-if="row.selectedSubItems?.length"
                    class="text-[11px] text-muted-foreground truncate"
                  >
                    {{ row.selectedSubItems.map((item) => `${item.nameSnapshot} x ${item.quantity}`).join(' / ') }}
                  </span>
                </div>
              </TableCell>
              <TableCell class="py-2.5 font-mono">{{ row.count }}</TableCell>
              <TableCell class="py-2.5 text-muted-foreground whitespace-nowrap">
                {{ formatRelativeTime(row.createAt) }}
              </TableCell>
              <TableCell class="py-2.5 font-mono font-medium">
                {{ Number(row.point.toFixed(1)) }}
              </TableCell>
              <TableCell class="py-2.5">
                <Badge
                  :variant="getStatusVariant(row)"
                  size="xs"
                  class="flex items-center gap-1 w-fit"
                >
                  <component
                    :is="statusMeta[row.status].icon"
                    class="size-3"
                  />
                  <span>{{ getStatusLabel(row) }}</span>
                </Badge>
              </TableCell>
              <TableCell class="py-2.5">
                <Badge
                  variant="outline"
                  size="xs"
                  class="text-muted-foreground"
                >
                  {{ row.type === GoodsTypes.Physical ? '实体' : row.type === GoodsTypes.Service ? '服务' : '虚拟' }}
                </Badge>
              </TableCell>
              <TableCell
                class="py-2.5 text-muted-foreground truncate max-w-28"
                :title="row.remark"
              >
                {{ row.remark || '—' }}
              </TableCell>
              <TableCell class="py-2.5 font-mono text-[11px] text-muted-foreground truncate max-w-36">
                {{ row.trackingNumber || (row.type === GoodsTypes.Virtual ? '无需发货' : '暂无物流') }}
              </TableCell>
              <TableCell
                class="py-2.5 text-right pr-3"
                @click.stop
              >
                <Button
                  variant="outline"
                  size="xs"
                  @click="openDetail(row)"
                >
                  {{ row.status === PointOrderStatus.Pending ? '处理' : '详情' }}
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- 移动端列表 -->
      <div class="md:hidden space-y-2.5">
        <article
          v-for="item in pagedOrders"
          :key="item.id"
          class="p-3 rounded-lg border border-border/80 bg-card space-y-2 text-xs"
        >
          <div class="flex-between">
            <label class="flex items-center gap-1.5 cursor-pointer font-mono text-muted-foreground">
              <Checkbox
                :checked="selectedItems.includes(item.id)"
                :disabled="item.type === GoodsTypes.Service"
                @update:checked="(checked) => toggleSelection(item.id, checked)"
              />
              <span>#{{ item.id }}</span>
            </label>
            <Badge
              :variant="getStatusVariant(item)"
              size="xs"
              class="flex items-center gap-1"
            >
              <component
                :is="statusMeta[item.status].icon"
                class="size-3"
              />
              <span>{{ getStatusLabel(item) }}</span>
            </Badge>
          </div>

          <strong class="block text-foreground text-sm font-semibold">{{ item.goods.name }}</strong>
          <p class="text-xs text-muted-foreground m-0">
            {{ item.customer?.name || '未知用户' }} · {{ item.count }} 件 · {{ Number(item.point.toFixed(1)) }} 积分
          </p>

          <Button
            variant="outline"
            class="w-full mt-1"
            @click="openDetail(item)"
          >
            查看与处理
          </Button>
        </article>
      </div>

      <!-- 分页栏 -->
      <div
        v-if="order.length > pageSize"
        class="flex justify-center pt-2"
      >
        <Pagination
          :total="order.length"
          :items-per-page="pageSize"
          :page="page"
          @update:page="page = $event"
        />
      </div>
    </template>

    <!-- 订单履约抽屉 -->
    <Sheet
      v-if="detail"
      v-model:open="showDetail"
    >
      <SheetContent
        side="right"
        class="w-full sm:max-w-lg flex flex-col p-0 gap-0"
      >
        <SheetHeader
          class="px-5 py-3.5 pr-12 border-b border-border/70 flex-row items-center justify-between space-y-0"
        >
          <div class="flex items-center gap-2 min-w-0">
            <SheetTitle class="text-sm font-semibold font-mono truncate"> 订单 #{{ detail.id }} </SheetTitle>
            <Badge
              :variant="getStatusVariant(detail)"
              size="xs"
              class="flex items-center gap-1 shrink-0"
            >
              <component
                :is="statusMeta[detail.status].icon"
                class="size-3"
              />
              <span>{{ getStatusLabel(detail) }}</span>
            </Badge>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <Button
              variant="outline"
              size="icon-xs"
              title="上一单"
              :disabled="!canPrevDetail"
              @click="stepDetailOrder(-1)"
            >
              <ChevronLeft24Regular class="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon-xs"
              title="下一单"
              :disabled="!canNextDetail"
              @click="stepDetailOrder(1)"
            >
              <ChevronRight24Regular class="size-3.5" />
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea class="flex-1 min-h-0 px-5 py-4">
          <div class="space-y-4 text-xs">
            <div class="grid grid-cols-2 gap-2.5 p-3 rounded-lg bg-muted/30 border border-border/60">
              <div>
                <span class="text-muted-foreground block text-[11px]">下单用户</span>
                <a
                  :href="`https://space.bilibili.com/${detail.customer?.userId || ''}`"
                  target="_blank"
                  class="font-semibold text-primary hover:underline"
                >
                  {{ detail.customer?.name || '未知用户' }}
                </a>
              </div>
              <div>
                <span class="text-muted-foreground block text-[11px]">消耗积分</span>
                <strong class="font-mono text-foreground">{{ Number(detail.point.toFixed(1)) }}</strong>
              </div>
              <div>
                <span class="text-muted-foreground block text-[11px]">兑换数量</span>
                <strong class="font-mono text-foreground">{{ detail.count }} 件</strong>
              </div>
              <div>
                <span class="text-muted-foreground block text-[11px]">下单时间</span>
                <span class="text-foreground">{{ formatRelativeTime(detail.createAt) }}</span>
              </div>
            </div>

            <div class="space-y-1.5">
              <span class="text-[11px] font-medium text-muted-foreground block">礼物快照</span>
              <PointGoodsItem
                class="detail-goods"
                :goods="detail.goods"
              />
            </div>

            <template v-if="detail.selectedSubItems?.length">
              <div class="space-y-1.5">
                <span class="text-[11px] font-medium text-muted-foreground block">已选款式</span>
                <div class="space-y-1">
                  <div
                    v-for="item in detail.selectedSubItems"
                    :key="item.subItemId"
                    class="flex-between p-2 rounded bg-muted/40 text-xs"
                  >
                    <strong class="font-medium text-foreground">{{ item.nameSnapshot }}</strong>
                    <div class="flex items-center gap-2">
                      <span class="text-muted-foreground">x {{ item.quantity }}</span>
                      <Badge
                        variant="secondary"
                        size="xs"
                        class="font-mono"
                      >
                        {{ item.priceSnapshot }} 积分
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <Alert
              v-if="detail.remark"
              size="sm"
            >
              <AlertTitle>订单备注</AlertTitle>
              <AlertDescription class="text-muted-foreground">{{ detail.remark }}</AlertDescription>
            </Alert>

            <Alert
              size="sm"
              class="bg-muted/40 border-border/80"
            >
              <AlertTitle>状态说明</AlertTitle>
              <AlertDescription class="text-muted-foreground">{{ statusMeta[detail.status].hint }}</AlertDescription>
            </Alert>

            <template v-if="detail.type === GoodsTypes.Physical">
              <Separator />
              <div class="space-y-1.5">
                <span class="text-[11px] font-medium text-muted-foreground block">收货地址</span>
                <div class="p-2.5 rounded-lg border border-border/60 bg-muted/20">
                  <a
                    v-if="detail.goods.collectUrl"
                    :href="detail.goods.collectUrl"
                    target="_blank"
                    class="text-primary hover:underline text-xs"
                  >
                    通过站外链接收集
                  </a>
                  <AddressDisplay
                    v-else
                    :address="detail.address"
                  />
                </div>
              </div>

              <template v-if="detail.status === PointOrderStatus.Pending || detail.status === PointOrderStatus.Shipped">
                <Separator />
                <div class="space-y-2">
                  <span class="text-[11px] font-medium text-muted-foreground block">物流发货信息</span>
                  <div class="flex flex-col gap-2 p-3 rounded-lg border border-border/60 bg-muted/20">
                    <Input
                      v-model="detail.expressCompany"
                      placeholder="快递公司 (如: 顺丰速运)"
                    />
                    <Input
                      v-model="detail.trackingNumber"
                      placeholder="填写快递单号"
                      class="font-mono"
                    />
                    <div class="flex items-center justify-end gap-2 pt-1">
                      <Button
                        variant="outline"
                        :loading="loading"
                        @click="saveExpress(false)"
                      >
                        仅保存单号
                      </Button>
                      <Button
                        v-if="detail.status === PointOrderStatus.Pending"
                        :loading="loading"
                        @click="saveExpress(true)"
                      >
                        保存单号并发货
                      </Button>
                    </div>
                  </div>
                </div>
              </template>
            </template>
          </div>
        </ScrollArea>

        <SheetFooter class="px-5 py-3 border-t border-border/70 bg-muted/20">
          <Popconfirm
            v-if="previousStatus(detail) !== null"
            :title="`确认将订单 #${detail.id} 从「${statusMeta[detail.status].label}」改为「${statusMeta[previousStatus(detail)!].label}」？`"
            positive-text="确认回退"
            negative-text="取消"
            @positive-click="updateStatus([detail.id], previousStatus(detail)!)"
          >
            <template #trigger>
              <Button
                variant="outline"
                class="text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
              >
                回退到等待发货
              </Button>
            </template>
            确认将订单从「{{ statusMeta[detail.status].label }}」回退到等待发货？
          </Popconfirm>

          <Popconfirm
            v-if="nextStatus(detail) !== null"
            :title="`确认将订单 #${detail.id} 状态更新为「${statusMeta[nextStatus(detail)!].label}」？`"
            positive-text="确认"
            negative-text="取消"
            @positive-click="updateStatus([detail.id], nextStatus(detail)!)"
          >
            <template #trigger>
              <Button :loading="loading">
                {{
                  detail.type === GoodsTypes.Virtual
                    ? '完成订单'
                    : detail.status === PointOrderStatus.Pending
                      ? '确认发货'
                      : '完成订单'
                }}
              </Button>
            </template>
            确认更新订单状态为「{{ statusMeta[nextStatus(detail)!].label }}」？
          </Popconfirm>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <ServiceOrderPanel
      v-if="serviceDetail"
      v-model:show="showServiceDetail"
      :order="serviceDetail"
      role="owner"
      @updated="(updated) => Object.assign(serviceDetail!, updated)"
    />
  </div>
</template>
