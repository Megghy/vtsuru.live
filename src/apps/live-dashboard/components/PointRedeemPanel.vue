<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { Check, ExternalLink, PackageCheck, RefreshCw, RotateCcw, ShoppingBag, Truck } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { GoodsTypes, PointOrderStatus, type ResponsePointOrder2OwnerModel } from '@/api/generated/model'
import { fetchOwnerOrders, updateOrdersStatus } from '@/api/point-orders'
import { updateOwnerServiceOrder } from '@/api/point-service'
import { CURRENT_HOST, isTauri } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { avatarUrl } from '../core/format'
import { useDashboardUi } from '../store/ui'
import IconAction from './IconAction.vue'
import PanelShell from './PanelShell.vue'

defineProps<{ blurred?: boolean }>()

const ui = useDashboardUi()
const orders = ref<ResponsePointOrder2OwnerModel[]>([])
const loading = ref(false)
const busyId = ref<number | null>(null)
const filterMode = ref<'pending' | 'all'>('pending')

const STATUS_LABELS: Record<number, string> = {
  [PointOrderStatus.Pending]: '待处理',
  [PointOrderStatus.Shipped]: '已发货',
  [PointOrderStatus.Completed]: '已完成',
  [PointOrderStatus.InProgress]: '进行中',
  [PointOrderStatus.Rejected]: '已拒绝',
  [PointOrderStatus.Cancelled]: '已取消',
}

const TYPE_LABELS: Record<number, string> = {
  [GoodsTypes.Physical]: '实物',
  [GoodsTypes.Virtual]: '虚拟',
  [GoodsTypes.Service]: '服务',
}

const pendingOrders = computed(() =>
  orders.value.filter(
    (o) => o.status === PointOrderStatus.Pending || o.status === PointOrderStatus.InProgress,
  ),
)

const displayOrders = computed(() => (filterMode.value === 'pending' ? pendingOrders.value : orders.value))

async function refresh(silent = false) {
  if (loading.value) return
  loading.value = true
  try {
    const list = await fetchOwnerOrders({ kind: 'owner' })
    orders.value = [...list].sort((a, b) => b.createAt - a.createAt)
    ui.pendingRedeemCount = pendingOrders.value.length
  } catch (err) {
    if (!silent) {
      toast.error(err instanceof Error ? err.message : '拉取积分订单失败')
    }
  } finally {
    loading.value = false
  }
}

async function handleAction(order: ResponsePointOrder2OwnerModel, status: PointOrderStatus, reason?: string) {
  if (busyId.value !== null) return
  busyId.value = order.id
  try {
    if (order.type === GoodsTypes.Service) {
      await updateOwnerServiceOrder({
        orderId: order.id,
        status,
        reason,
      })
    } else {
      await updateOrdersStatus({ kind: 'owner' }, [order.id], status)
    }
    toast.success(`订单已更新为「${STATUS_LABELS[status] ?? '已处理'}」`)
    await refresh(true)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '操作失败')
  } finally {
    busyId.value = null
  }
}

function formatTime(ts: number) {
  const d = new Date(ts < 1e12 ? ts * 1000 : ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

async function openManage() {
  const url = `${CURRENT_HOST}manage/point`
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank')
  }
}

useIntervalFn(() => void refresh(true), 45_000)

onMounted(() => {
  void refresh(true)
})
</script>

<template>
  <PanelShell
    title="积分核销"
    panel-id="point_redeem"
    :count="displayOrders.length"
    :unread="pendingOrders.length"
    :blurred="blurred"
  >
    <template #actions>
      <IconAction
        :icon="RefreshCw"
        tip="刷新积分订单"
        :class="loading ? 'animate-spin' : ''"
        @click="refresh()"
      />
      <IconAction
        :icon="ExternalLink"
        tip="打开积分商城管理"
        @click="openManage"
      />
    </template>

    <div class="flex flex-col h-full min-h-0 p-2 gap-2 text-xs">
      <ToggleGroup
        v-model="filterMode"
        type="single"
        size="xs"
        class="w-full grid grid-cols-2 shrink-0"
      >
        <ToggleGroupItem value="pending">待处理 ({{ pendingOrders.length }})</ToggleGroupItem>
        <ToggleGroupItem value="all">全部 ({{ orders.length }})</ToggleGroupItem>
      </ToggleGroup>

      <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-1.5">
        <div
          v-for="order in displayOrders"
          :key="order.id"
          class="rounded-md border border-border bg-card/70 p-2 space-y-1.5"
        >
          <div class="flex items-start gap-2">
            <img
              v-if="order.customer?.avatar"
              :src="avatarUrl(order.customer.avatar, 48)"
              referrerpolicy="no-referrer"
              class="size-6 rounded-full shrink-0 mt-0.5"
            />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1 flex-wrap">
                <span class="font-semibold text-foreground truncate">{{ order.goods?.name || '未知商品' }}</span>
                <span class="text-[11px] text-muted-foreground tabular-nums">×{{ order.count }}</span>
                <Badge
                  variant="secondary"
                  size="xs"
                  class="text-[10px]"
                >
                  {{ TYPE_LABELS[order.type] ?? '商品' }}
                </Badge>
                <Badge
                  :variant="
                    order.status === PointOrderStatus.Pending
                      ? 'warning'
                      : order.status === PointOrderStatus.Completed
                        ? 'success'
                        : 'outline'
                  "
                  size="xs"
                  class="ml-auto text-[10px]"
                >
                  {{ STATUS_LABELS[order.status] ?? order.status }}
                </Badge>
              </div>
              <div class="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate">
                <span class="truncate">{{ order.customer?.name || `UID ${order.customer?.userId || '-'}` }}</span>
                <span>·</span>
                <span class="tabular-nums">{{ order.point }} 积分</span>
                <span>·</span>
                <span class="tabular-nums">{{ formatTime(order.createAt) }}</span>
              </div>
              <div
                v-if="order.remark"
                class="mt-1 rounded bg-muted/60 px-1.5 py-1 text-[11px] text-foreground/90 break-words"
              >
                备注：{{ order.remark }}
              </div>
            </div>
          </div>

          <div
            v-if="order.status === PointOrderStatus.Pending || order.status === PointOrderStatus.InProgress || order.status === PointOrderStatus.Shipped"
            class="flex items-center justify-end gap-1 pt-1 border-t border-border/60"
          >
            <!-- 服务订单操作 -->
            <template v-if="order.type === GoodsTypes.Service">
              <Button
                v-if="order.status === PointOrderStatus.Pending"
                size="xs"
                variant="outline"
                :disabled="busyId === order.id"
                @click="handleAction(order, PointOrderStatus.InProgress)"
              >
                接单
              </Button>
              <Button
                size="xs"
                variant="default"
                class="gap-1"
                :disabled="busyId === order.id"
                @click="handleAction(order, PointOrderStatus.Completed)"
              >
                <Check class="size-3" />
                完成核销
              </Button>
              <Popconfirm
                @positive-click="
                  handleAction(
                    order,
                    order.status === PointOrderStatus.Pending ? PointOrderStatus.Rejected : PointOrderStatus.Cancelled,
                    '中控台退回积分',
                  )
                "
              >
                <template #trigger>
                  <Button
                    size="xs"
                    variant="ghost"
                    class="text-muted-foreground hover:text-destructive gap-1"
                    :disabled="busyId === order.id"
                  >
                    <RotateCcw class="size-3" />
                    退分
                  </Button>
                </template>
                确定取消该订单并退还积分给观众？
              </Popconfirm>
            </template>

            <!-- 虚拟 / 实物订单操作 -->
            <template v-else>
              <Button
                v-if="order.type === GoodsTypes.Physical && order.status === PointOrderStatus.Pending"
                size="xs"
                variant="outline"
                class="gap-1"
                :disabled="busyId === order.id"
                @click="handleAction(order, PointOrderStatus.Shipped)"
              >
                <Truck class="size-3" />
                标记发货
              </Button>
              <Button
                size="xs"
                variant="default"
                class="gap-1"
                :disabled="busyId === order.id"
                @click="handleAction(order, PointOrderStatus.Completed)"
              >
                <PackageCheck class="size-3" />
                核销完成
              </Button>
              <Popconfirm
                v-if="order.status === PointOrderStatus.Pending"
                @positive-click="handleAction(order, PointOrderStatus.Cancelled)"
              >
                <template #trigger>
                  <Button
                    size="xs"
                    variant="ghost"
                    class="text-muted-foreground hover:text-destructive gap-1"
                    :disabled="busyId === order.id"
                  >
                    <RotateCcw class="size-3" />
                    退分
                  </Button>
                </template>
                确定取消该订单并退还积分给观众？
              </Popconfirm>
            </template>
          </div>
        </div>

        <div
          v-if="!displayOrders.length && !loading"
          class="flex-col-center py-8 text-muted-foreground gap-1.5"
        >
          <ShoppingBag class="size-5 opacity-40" />
          <span>{{ filterMode === 'pending' ? '当前没有待核销的兑换订单' : '暂无兑换记录' }}</span>
        </div>
      </div>
    </div>
  </PanelShell>
</template>
