<script setup lang="ts">
import {
  ArrowSync24Regular,
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
  Prohibited24Regular,
  Timer24Regular,
  VehicleTruck24Regular,
} from '@vicons/fluent'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import type { Component } from 'vue'
import { computed, ref, watch } from 'vue'

import type { ResponsePointOrder2OwnerModel } from '@/api/api-models'
import { GoodsTypes, PointOrderStatus } from '@/api/api-models'
import { updateOrderExpress, updateOrdersStatus } from '@/api/point-orders'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'
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
const pageSize = 10

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

const loading = computed(() => !!props.loading || actionLoading.value)
const pagedOrders = computed(() => props.order.slice((page.value - 1) * pageSize, page.value * pageSize))

watch(
  () => props.order,
  () => (page.value = 1),
)

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
    toast.success('物流信息已更新')
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

const isAllSelected = computed(
  () =>
    props.order.length > 0 &&
    props.order.filter((o) => o.type !== GoodsTypes.Service).every((o) => selectedItems.value.includes(o.id)),
)

function toggleAll(checked: boolean) {
  if (checked) {
    updateSelection(props.order.filter((o) => o.type !== GoodsTypes.Service).map((o) => o.id))
  } else {
    updateSelection([])
  }
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
      description="暂无订单"
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
              <TableHead class="w-32 py-2.5">状态</TableHead>
              <TableHead class="w-20 py-2.5">类型</TableHead>
              <TableHead class="w-28 py-2.5">备注</TableHead>
              <TableHead class="min-w-36 py-2.5">物流</TableHead>
              <TableHead class="w-16 py-2.5 text-right pr-3">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in pagedOrders"
              :key="row.id"
              class="hover:bg-muted/30"
            >
              <TableCell class="py-2.5 px-3">
                <Checkbox
                  :checked="selectedItems.includes(row.id)"
                  :disabled="row.type === GoodsTypes.Service"
                  @update:checked="(checked) => toggleSelection(row.id, checked)"
                />
              </TableCell>
              <TableCell class="py-2.5 font-mono text-muted-foreground">#{{ row.id }}</TableCell>
              <TableCell class="py-2.5">
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
                  class="text-[10px] h-4.5 px-1.5 font-normal flex items-center gap-1 w-fit"
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
                  class="text-[10px] h-4.5 px-1 font-normal text-muted-foreground"
                >
                  {{ row.type === GoodsTypes.Physical ? '实体' : row.type === GoodsTypes.Service ? '服务' : '虚拟' }}
                </Badge>
              </TableCell>
              <TableCell
                class="py-2.5 text-muted-foreground truncate max-w-28"
                :title="row.remark"
              >
                {{ row.remark || '无' }}
              </TableCell>
              <TableCell class="py-2.5 font-mono text-[11px] text-muted-foreground truncate max-w-36">
                {{ row.trackingNumber || (row.type === GoodsTypes.Virtual ? '无需发货' : '暂无物流') }}
              </TableCell>
              <TableCell class="py-2.5 text-right pr-3">
                <Button
                  variant="outline"
                  class="px-2"
                  @click="openDetail(row)"
                >
                  详情
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
          <div class="flex items-center justify-between">
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
              class="text-[10px] h-4.5 px-1.5 font-normal flex items-center gap-1"
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

    <!-- 订单详情弹窗 -->
    <Dialog
      v-if="detail"
      v-model:open="showDetail"
    >
      <DialogContent class="sm:max-w-lg max-h-[85vh] flex flex-col p-4 gap-3">
        <DialogHeader class="pb-2 border-b border-border/60">
          <DialogTitle class="text-sm font-semibold">订单详情</DialogTitle>
        </DialogHeader>

        <ScrollArea class="flex-1 min-h-0 pr-2">
          <div class="space-y-3.5 text-xs">
            <div class="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/60">
              <div>
                <span class="text-muted-foreground block text-[11px]">订单号</span>
                <strong class="font-mono text-foreground">#{{ detail.id }}</strong>
              </div>
              <div>
                <span class="text-muted-foreground block text-[11px]">用户</span>
                <strong class="text-foreground">{{ detail.customer?.name || '未知用户' }}</strong>
              </div>
              <div>
                <span class="text-muted-foreground block text-[11px]">使用积分</span>
                <strong class="font-mono text-foreground">{{ Number(detail.point.toFixed(1)) }}</strong>
              </div>
              <div>
                <span class="text-muted-foreground block text-[11px]">当前状态</span>
                <Badge
                  :variant="getStatusVariant(detail)"
                  class="text-[10px] h-4.5 px-1.5 font-normal flex items-center gap-1 w-fit mt-0.5"
                >
                  <component
                    :is="statusMeta[detail.status].icon"
                    class="size-3"
                  />
                  <span>{{ getStatusLabel(detail) }}</span>
                </Badge>
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
                    class="flex items-center justify-between p-1.5 rounded bg-muted/40 text-xs"
                  >
                    <strong class="font-medium text-foreground">{{ item.nameSnapshot }}</strong>
                    <div class="flex items-center gap-2">
                      <span class="text-muted-foreground">x {{ item.quantity }}</span>
                      <Badge
                        variant="secondary"
                        class="text-[10px] h-4.5 px-1 font-mono"
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
              class="text-xs"
            >
              <AlertTitle class="text-xs font-semibold">订单备注</AlertTitle>
              <AlertDescription class="text-xs text-muted-foreground">{{ detail.remark }}</AlertDescription>
            </Alert>

            <Alert class="text-xs bg-muted/40 border-border/80">
              <AlertTitle class="text-xs font-semibold">状态说明</AlertTitle>
              <AlertDescription class="text-xs text-muted-foreground">{{
                statusMeta[detail.status].hint
              }}</AlertDescription>
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
            </template>

            <template v-if="detail.type === GoodsTypes.Physical && detail.status === PointOrderStatus.Shipped">
              <Separator />
              <div class="space-y-2">
                <span class="text-[11px] font-medium text-muted-foreground block">物流信息</span>
                <div class="flex flex-col gap-2 p-2.5 rounded-lg border border-border/60 bg-muted/20">
                  <Input
                    v-model="detail.expressCompany"
                    placeholder="快递公司 (如: 顺丰速运)"
                  />
                  <Input
                    v-model="detail.trackingNumber"
                    placeholder="填写快递单号"
                    class="font-mono"
                  />
                  <Button
                    class="self-end"
                    :disabled="actionLoading"
                    @click="saveExpress"
                  >
                    更新物流信息
                  </Button>
                </div>
              </div>
            </template>
          </div>
        </ScrollArea>

        <DialogFooter class="pt-2 border-t border-border/60 flex items-center justify-end gap-2">
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
              <Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ServiceOrderPanel
      v-if="serviceDetail"
      v-model:show="showServiceDetail"
      :order="serviceDetail"
      role="owner"
      @updated="(updated) => Object.assign(serviceDetail!, updated)"
    />
  </div>
</template>
