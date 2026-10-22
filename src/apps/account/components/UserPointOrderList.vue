<script setup lang="ts">
import {
  ArrowSync24Regular,
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
  Open24Regular,
  Prohibited24Regular,
  Timer24Regular,
  VehicleTruck24Regular,
} from '@vicons/fluent'
import type { Component } from 'vue'
import { computed, ref, watch } from 'vue'

import type { ResponsePointOrder2UserModel } from '@/api/api-models'
import { GoodsTypes, PointOrderStatus } from '@/api/api-models'
import AddressDisplay from '@/shared/components/points/AddressDisplay.vue'
import PointGoodsItem from '@/shared/components/points/PointGoodsItem.vue'
import ServiceOrderPanel from '@/shared/components/points/ServiceOrderPanel.vue'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Pagination } from '@/shared/ui/pagination'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import { Tag } from '@/shared/ui/tag'
import { Textarea } from '@/shared/ui/textarea'

const props = defineProps<{
  orders: ResponsePointOrder2UserModel[]
}>()

const detail = ref<ResponsePointOrder2UserModel>()
const showDetail = ref(false)
const serviceDetail = ref<ResponsePointOrder2UserModel>()
const showServiceDetail = ref(false)
const page = ref(1)
const pageSize = ref(10)

const statusMeta: Record<
  PointOrderStatus,
  { label: string; type: 'default' | 'warning' | 'info' | 'success' | 'error'; icon: Component }
> = {
  [PointOrderStatus.Pending]: { label: '等待发货', type: 'warning', icon: Timer24Regular },
  [PointOrderStatus.Shipped]: { label: '已发货', type: 'info', icon: VehicleTruck24Regular },
  [PointOrderStatus.Completed]: { label: '已完成', type: 'success', icon: CheckmarkCircle24Regular },
  [PointOrderStatus.InProgress]: { label: '进行中', type: 'info', icon: ArrowSync24Regular },
  [PointOrderStatus.Rejected]: { label: '已拒绝', type: 'error', icon: Prohibited24Regular },
  [PointOrderStatus.Cancelled]: { label: '已取消', type: 'default', icon: DismissCircle24Regular },
}

const pagedOrders = computed(() =>
  props.orders.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
)

watch(
  () => props.orders,
  () => (page.value = 1),
)

function openDetail(order: ResponsePointOrder2UserModel) {
  if (order.type === GoodsTypes.Service) {
    serviceDetail.value = order
    showServiceDetail.value = true
    return
  }
  detail.value = order
  showDetail.value = true
}

function statusLabel(order: ResponsePointOrder2UserModel) {
  return order.type === GoodsTypes.Service && order.status === PointOrderStatus.Pending
    ? '待接单'
    : statusMeta[order.status].label
}

function formatRelativeTime(ts: number) {
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${Math.floor(diff / 86400000)} 天前`
}

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}
</script>

<template>
  <div
    v-if="orders.length === 0"
    class="orders-empty-state"
  >
    <Empty
      description="暂无符合条件的订单记录"
      size="medium"
    >
      <template #extra>
        <span class="empty-tip">在主播频道使用积分兑换礼物或互动服务后，相关进度将在此展示。</span>
      </template>
    </Empty>
  </div>

  <template v-else>
    <div class="desktop-order-table overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[84px]">订单号</TableHead>
            <TableHead class="min-w-[220px]">礼物</TableHead>
            <TableHead class="w-[130px]">时间</TableHead>
            <TableHead class="w-[90px]">积分</TableHead>
            <TableHead class="w-[116px]">状态</TableHead>
            <TableHead class="w-[70px] text-right">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="row in pagedOrders"
            :key="row.id"
          >
            <TableCell class="font-mono text-xs text-muted-foreground">#{{ row.id }}</TableCell>
            <TableCell>
              <div class="flex flex-col gap-0.5">
                <strong class="text-xs">{{ row.type === GoodsTypes.Service ? '服务 · ' : '' }}{{ row.goods.name }}</strong>
                <span
                  v-if="row.selectedSubItems?.length"
                  class="text-[11px] text-muted-foreground truncate"
                >
                  {{ row.selectedSubItems.map((item) => `${item.nameSnapshot} x ${item.quantity}`).join(' / ') }}
                </span>
              </div>
            </TableCell>
            <TableCell class="text-xs text-muted-foreground">
              {{ formatRelativeTime(row.createAt) }}
            </TableCell>
            <TableCell class="text-xs font-medium">
              {{ Number(row.point.toFixed(1)) }}
            </TableCell>
            <TableCell>
              <Tag
                :type="statusMeta[row.status].type"
                size="small"
                :bordered="false"
                class="inline-flex items-center gap-1"
              >
                <component
                  :is="statusMeta[row.status].icon"
                  class="size-3.5"
                />
                {{ statusLabel(row) }}
              </Tag>
            </TableCell>
            <TableCell class="text-right">
              <Button size="xs" variant="outline" @click="openDetail(row)">
                详情
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <div
        v-if="orders.length > pageSize"
        class="p-2 border-t border-border flex justify-end"
      >
        <Pagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :total="orders.length"
          :item-count="orders.length"
          :page-sizes="[10, 25, 50]"
          show-size-picker
        />
      </div>
    </div>

    <div class="mobile-order-list flex flex-col gap-2.5">
      <button
        v-for="order in pagedOrders"
        :key="order.id"
        class="mobile-order-card text-left p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
        type="button"
        @click="openDetail(order)"
      >
        <span class="flex items-center justify-between mb-1.5 text-xs">
          <span class="font-mono text-muted-foreground">#{{ order.id }}</span>
          <Tag
            :type="statusMeta[order.status].type"
            size="small"
            :bordered="false"
            class="inline-flex items-center gap-1"
          >
            <component
              :is="statusMeta[order.status].icon"
              class="size-3"
            />
            {{ statusLabel(order) }}
          </Tag>
        </span>
        <strong class="text-sm block">{{ order.goods.name }}</strong>
        <span
          v-if="order.selectedSubItems?.length"
          class="text-xs text-muted-foreground block mt-0.5 truncate"
        >
          {{ order.selectedSubItems.map((item) => `${item.nameSnapshot} x ${item.quantity}`).join(' / ') }}
        </span>
        <span class="flex items-center justify-between mt-2 pt-1.5 border-t border-border/50 text-xs text-muted-foreground">
          <span>{{ formatRelativeTime(order.createAt) }}</span>
          <b class="text-foreground font-semibold">{{ Number(order.point.toFixed(1)) }} 积分</b>
        </span>
      </button>

      <Pagination
        v-if="orders.length > pageSize"
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="orders.length"
        :item-count="orders.length"
      />
    </div>
  </template>

  <Dialog
    v-if="detail"
    v-model:open="showDetail"
  >
    <DialogContent class="max-w-2xl max-h-[85vh] flex flex-col p-6">
      <DialogHeader>
        <DialogTitle>订单详情</DialogTitle>
      </DialogHeader>
      <ScrollArea class="flex-1 max-h-[70vh] pr-4">
        <div class="order-detail space-y-4">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/40 text-xs">
            <div>
              <span class="text-muted-foreground block mb-0.5">订单号</span>
              <strong class="font-mono text-foreground text-sm">#{{ detail.id }}</strong>
            </div>
            <div>
              <span class="text-muted-foreground block mb-0.5">兑换时间</span>
              <span class="text-foreground">{{ formatDateTime(detail.createAt) }}</span>
            </div>
            <div>
              <span class="text-muted-foreground block mb-0.5">使用积分</span>
              <strong class="text-foreground text-sm">{{ Number(detail.point.toFixed(1)) }}</strong>
            </div>
            <div>
              <span class="text-muted-foreground block mb-0.5">当前状态</span>
              <Tag
                :type="statusMeta[detail.status].type"
                size="small"
                :bordered="false"
              >
                {{ statusLabel(detail) }}
              </Tag>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-muted-foreground">礼物快照</span>
              <Separator class="flex-1" />
            </div>
            <PointGoodsItem
              class="detail-goods"
              :goods="detail.goods"
            />
          </div>

          <template v-if="detail.selectedSubItems?.length">
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-muted-foreground">已选款式</span>
                <Separator class="flex-1" />
              </div>
              <div class="grid gap-2">
                <div
                  v-for="item in detail.selectedSubItems"
                  :key="item.subItemId"
                  class="flex items-center justify-between p-2.5 rounded border border-border bg-card text-xs"
                >
                  <div class="flex items-center gap-2">
                    <strong class="text-foreground">{{ item.nameSnapshot }}</strong>
                    <span class="text-muted-foreground">x {{ item.quantity }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <Tag
                      size="tiny"
                      type="info"
                      :bordered="false"
                    >
                      {{ item.priceSnapshot }} 积分
                    </Tag>
                    <span
                      v-if="item.assignedVirtualKeys.length"
                      class="text-emerald-600 dark:text-emerald-400 text-[11px]"
                    >
                      已分配 {{ item.assignedVirtualKeys.length }} 个密钥
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-if="detail.remark">
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-muted-foreground">订单备注</span>
                <Separator class="flex-1" />
              </div>
              <div class="p-3 rounded bg-muted/40 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                {{ detail.remark }}
              </div>
            </div>
          </template>

          <template v-if="detail.type === GoodsTypes.Virtual">
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-muted-foreground">虚拟礼物内容</span>
                <Separator class="flex-1" />
              </div>
              <Textarea
                :model-value="detail.goods.content"
                readonly
                placeholder="暂无内容"
                rows="4"
              />
            </div>
          </template>

          <template v-else>
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-muted-foreground">收货与物流</span>
                <Separator class="flex-1" />
              </div>
              <div class="delivery-panel space-y-2 text-xs">
                <AddressDisplay :address="detail.address" />
                <div
                  v-if="detail.trackingNumber"
                  class="flex items-center gap-2 pt-2"
                >
                  <Tag
                    size="small"
                    :bordered="false"
                  >
                    {{ detail.expressCompany || '物流单号' }}
                  </Tag>
                  <span class="font-mono text-foreground">{{ detail.trackingNumber }}</span>
                </div>
                <span
                  v-else
                  class="text-muted-foreground block pt-1"
                >
                  暂无物流信息
                </span>
              </div>
            </div>

            <template v-if="detail.status === PointOrderStatus.Pending && detail.goods.collectUrl">
              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-muted-foreground">填写收货信息</span>
                  <Separator class="flex-1" />
                </div>
                <a
                  :href="detail.goods.collectUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
                >
                  <component
                    :is="Open24Regular"
                    class="size-4"
                  />
                  打开地址填写页面
                </a>
                <iframe
                  v-if="detail.goods.embedCollectUrl"
                  class="w-full h-80 rounded-lg border border-border mt-2"
                  :src="detail.goods.collectUrl"
                  title="收货地址填写"
                  sandbox="allow-same-origin allow-scripts allow-modals allow-downloads allow-forms allow-popups"
                />
              </div>
            </template>
          </template>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>

  <ServiceOrderPanel
    v-if="serviceDetail"
    v-model:show="showServiceDetail"
    :order="serviceDetail"
    role="buyer"
    @updated="(updated) => Object.assign(serviceDetail!, updated)"
  />
</template>

<style scoped>
.orders-empty-state {
  padding: 48px 16px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: var(--card);
}

.empty-tip {
  color: var(--muted-foreground);
  font-size: 12px;
}

@media (max-width: 640px) {
  .desktop-order-table {
    display: none;
  }
  .mobile-order-list {
    display: flex;
  }
}
@media (min-width: 641px) {
  .mobile-order-list {
    display: none;
  }
}
</style>
