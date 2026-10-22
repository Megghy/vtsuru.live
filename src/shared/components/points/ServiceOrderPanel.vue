<script setup lang="ts">
import {
  ArrowClockwise24Regular,
  ArrowSync24Regular,
  CalendarLtr24Regular,
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
  Link24Regular,
  Prohibited24Regular,
  Send24Regular,
  Timer24Regular,
  VehicleTruck24Regular,
} from '@vicons/fluent'
import type { Component } from 'vue'
import { computed, ref, watch } from 'vue'

import type { ResponsePointOrder2OwnerModel, ResponsePointOrder2UserModel } from '@/api/api-models'
import { GoodsTypes, PointOrderStatus, ServiceTimelineActor, ServiceTimelineType } from '@/api/api-models'
import {
  fetchOwnerServiceOrder,
  fetchUserServiceOrder,
  updateOwnerServiceOrder,
  updateUserServiceOrder,
} from '@/api/point-service'
import type { ServiceField, ServiceOrderData } from '@/api/point-service'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
import { Textarea } from '@/shared/ui/textarea'
import { toast } from '@/shared/utils'

type ServiceOrder = ResponsePointOrder2OwnerModel | ResponsePointOrder2UserModel
type Role = 'owner' | 'buyer'

const props = defineProps<{
  show: boolean
  order?: ServiceOrder
  role: Role
}>()

const emit = defineEmits<{
  'update:show': [show: boolean]
  updated: [order: ServiceOrder]
}>()

const current = ref<ServiceOrder>()
const loading = ref(false)
const actionLoading = ref(false)
const loadError = ref<string>()
const note = ref('')
const reason = ref('')
const deliveryUrl = ref('')
const appointmentAt = ref<string>('')

const orderData = computed<ServiceOrderData | undefined>(() => current.value?.serviceData)
const config = computed(() => current.value?.goods.serviceConfig)
const fields = computed<ServiceField[]>(() => config.value?.fields ?? [])
const answers = computed(() => new Map((orderData.value?.answers ?? []).map((answer) => [answer.fieldId, answer])))

function displayAnswer(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.length ? value.join('、') : '未填写'
  if (!value) return '未填写'
  return value
}

const statusMeta: Record<
  PointOrderStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; hint: string; icon: Component }
> = {
  [PointOrderStatus.Pending]: {
    label: '待接单',
    variant: 'secondary',
    hint: '需求已提交，等待创作者确认。',
    icon: Timer24Regular,
  },
  [PointOrderStatus.Shipped]: {
    label: '已发货',
    variant: 'default',
    hint: '订单已发货。',
    icon: VehicleTruck24Regular,
  },
  [PointOrderStatus.Completed]: {
    label: '已完成',
    variant: 'default',
    hint: '服务已完成。',
    icon: CheckmarkCircle24Regular,
  },
  [PointOrderStatus.InProgress]: {
    label: '进行中',
    variant: 'secondary',
    hint: '创作者已接单，正在安排或制作。',
    icon: ArrowSync24Regular,
  },
  [PointOrderStatus.Rejected]: {
    label: '已拒绝',
    variant: 'destructive',
    hint: '创作者无法承接，积分已退回。',
    icon: Prohibited24Regular,
  },
  [PointOrderStatus.Cancelled]: {
    label: '已取消',
    variant: 'outline',
    hint: '订单已取消，符合条件的积分已退回。',
    icon: DismissCircle24Regular,
  },
}

const isService = computed(() => current.value?.type === GoodsTypes.Service)
const canMessage = computed(
  () => current.value?.status === PointOrderStatus.Pending || current.value?.status === PointOrderStatus.InProgress,
)
const ownerActions = computed(() => {
  if (!current.value || props.role !== 'owner') return []
  if (current.value.status === PointOrderStatus.Pending) {
    return [
      {
        label: '接单',
        status: PointOrderStatus.InProgress,
        variant: 'default' as const,
        icon: CheckmarkCircle24Regular,
      },
      {
        label: '拒绝并退回积分',
        status: PointOrderStatus.Rejected,
        variant: 'destructive' as const,
        icon: DismissCircle24Regular,
      },
    ]
  }
  if (current.value.status === PointOrderStatus.InProgress) {
    return [
      {
        label: '标记完成',
        status: PointOrderStatus.Completed,
        variant: 'default' as const,
        icon: CheckmarkCircle24Regular,
      },
      {
        label: '取消并退回积分',
        status: PointOrderStatus.Cancelled,
        variant: 'destructive' as const,
        icon: DismissCircle24Regular,
      },
    ]
  }
  return []
})
const canBuyerCancel = computed(() => props.role === 'buyer' && current.value?.status === PointOrderStatus.Pending)

function normalizeTimestamp(value?: number | string | null) {
  if (value == null || value === '') return undefined
  const n = typeof value === 'number' ? value : Date.parse(value)
  if (!Number.isFinite(n)) return undefined
  return n < 10_000_000_000 ? n * 1000 : n
}

function formatDate(timestamp?: number | string | null) {
  const ts = normalizeTimestamp(timestamp)
  if (!ts) return ''
  return new Date(ts).toLocaleString()
}

function syncForm(data?: ServiceOrderData) {
  const ts = normalizeTimestamp(data?.appointmentAt)
  if (ts) {
    const d = new Date(ts)
    const pad = (n: number) => String(n).padStart(2, '0')
    appointmentAt.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } else {
    appointmentAt.value = ''
  }
  deliveryUrl.value = data?.deliveryUrl ?? ''
}

async function load() {
  if (!props.order || props.order.type !== GoodsTypes.Service) return
  loading.value = true
  loadError.value = undefined
  try {
    current.value =
      props.role === 'owner'
        ? await fetchOwnerServiceOrder(props.order.id)
        : await fetchUserServiceOrder(props.order.id)
    syncForm(current.value.serviceData)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
}

watch(
  () => [props.show, props.order?.id, props.role] as const,
  ([show]) => {
    if (show) {
      current.value = props.order
      syncForm(props.order?.serviceData)
      void load()
    }
  },
  { immediate: true },
)

async function applyOwner(status?: PointOrderStatus) {
  if (!current.value || props.role !== 'owner') return
  if ((status === PointOrderStatus.Rejected || status === PointOrderStatus.Cancelled) && !reason.value.trim()) {
    toast.warning('请填写取消或拒绝原因')
    return
  }
  actionLoading.value = true
  try {
    const appointmentTs = appointmentAt.value ? Math.floor(new Date(appointmentAt.value).getTime() / 1000) : undefined
    const updated = await updateOwnerServiceOrder({
      orderId: current.value.id,
      ...(status === undefined ? {} : { status }),
      ...(reason.value.trim() ? { reason: reason.value.trim() } : {}),
      ...(appointmentTs ? { appointmentAt: appointmentTs } : {}),
      ...(deliveryUrl.value.trim() ? { deliveryUrl: deliveryUrl.value.trim() } : {}),
      ...(note.value.trim() ? { message: note.value.trim() } : {}),
    })
    current.value = updated
    syncForm(updated.serviceData)
    note.value = ''
    reason.value = ''
    emit('updated', updated)
    toast.success('服务订单已更新')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : `更新失败: ${error}`)
  } finally {
    actionLoading.value = false
  }
}

async function applyBuyer(cancel = false) {
  if (!current.value || props.role !== 'buyer') return
  if (cancel && !reason.value.trim()) {
    toast.warning('请填写取消原因')
    return
  }
  actionLoading.value = true
  try {
    const updated = await updateUserServiceOrder({
      orderId: current.value.id,
      ...(cancel ? { cancel: true, reason: reason.value.trim() } : {}),
      ...(note.value.trim() ? { message: note.value.trim() } : {}),
    })
    current.value = updated
    syncForm(updated.serviceData)
    note.value = ''
    reason.value = ''
    emit('updated', updated)
    toast.success(cancel ? '订单已取消，积分将按规则退回' : '留言已发送')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : `更新失败: ${error}`)
  } finally {
    actionLoading.value = false
  }
}

const actorLabel: Record<ServiceTimelineActor, string> = {
  [ServiceTimelineActor.Buyer]: '买家',
  [ServiceTimelineActor.Owner]: '创作者',
  [ServiceTimelineActor.System]: '系统',
}
</script>

<template>
  <Dialog
    :open="show"
    @update:open="emit('update:show', $event)"
  >
    <DialogContent class="sm:max-w-2xl max-h-[85vh] flex flex-col p-4 gap-3">
      <DialogHeader class="pb-2 border-b border-border/60">
        <DialogTitle class="text-sm font-semibold">服务订单</DialogTitle>
      </DialogHeader>

      <ScrollArea class="flex-1 min-h-0 pr-2">
        <div
          v-if="loading"
          class="py-16 flex justify-center"
        >
          <Spin />
        </div>

        <div
          v-else-if="loadError"
          class="space-y-3 py-6 text-center"
        >
          <Alert class="text-xs bg-destructive/10 border-destructive/20 text-destructive text-left">
            <AlertTitle class="text-xs font-semibold">服务订单加载失败</AlertTitle>
            <AlertDescription class="text-xs">{{ loadError }}</AlertDescription>
          </Alert>
          <Button
            variant="outline"
            @click="load"
          >
            <component
              :is="ArrowClockwise24Regular"
              class="size-3.5 mr-1"
            />
            重试
          </Button>
        </div>

        <Empty
          v-else-if="!current"
          description="没有可查看的服务订单"
          class="py-12"
        />

        <div
          v-else-if="isService"
          class="space-y-4 text-xs"
        >
          <!-- 概览网格 -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-lg border border-border/80 bg-muted/20">
            <div>
              <span class="text-muted-foreground block text-[11px]">订单号</span>
              <strong class="font-mono text-foreground text-xs">#{{ current.id }}</strong>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">兑换时间</span>
              <span class="text-foreground text-xs">{{ formatDate(current.createAt) }}</span>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">使用积分</span>
              <strong class="font-mono text-primary text-xs">{{ Number(current.point.toFixed(1)) }}</strong>
            </div>
            <div>
              <span class="text-muted-foreground block text-[11px]">状态</span>
              <Badge
                :variant="statusMeta[current.status].variant"
                class="text-[10px] h-4.5 px-1.5 font-normal"
              >
                {{ statusMeta[current.status].label }}
              </Badge>
            </div>
          </div>

          <Alert class="text-xs bg-muted/30 border-border/60">
            <AlertDescription class="text-xs text-muted-foreground leading-relaxed">
              {{ statusMeta[current.status].hint }}
            </AlertDescription>
          </Alert>

          <Alert
            v-if="orderData?.cancelReason"
            class="text-xs bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
          >
            <AlertTitle class="text-xs font-semibold">处理原因</AlertTitle>
            <AlertDescription class="text-xs">{{ orderData.cancelReason }}</AlertDescription>
          </Alert>

          <!-- 服务与需求快照 -->
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-foreground text-xs">服务与需求快照</span>
              <Separator class="flex-1" />
            </div>

            <div class="p-3 rounded-lg border border-border/80 bg-background space-y-2">
              <strong class="text-sm font-semibold text-foreground block">{{ current.goods.name }}</strong>
              <p
                v-if="config?.rules"
                class="text-muted-foreground text-xs leading-relaxed"
              >
                规则：{{ config.rules }}
              </p>
              <span
                v-if="config?.estimatedDays"
                class="text-muted-foreground text-xs block"
              >
                预计周期：{{ config.estimatedDays }} 天
              </span>

              <div
                v-if="fields.length"
                class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/50"
              >
                <div
                  v-for="field in fields"
                  :key="field.id"
                  class="space-y-0.5"
                >
                  <span class="text-muted-foreground text-[11px] block">{{ field.label }}</span>
                  <strong class="text-foreground text-xs">{{ displayAnswer(answers.get(field.id)?.value) }}</strong>
                </div>
              </div>
              <div
                v-else-if="orderData?.answers?.length"
                class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border/50"
              >
                <div
                  v-for="answer in orderData.answers"
                  :key="answer.fieldId"
                  class="space-y-0.5"
                >
                  <span class="text-muted-foreground text-[11px] block">{{ answer.label }}</span>
                  <strong class="text-foreground text-xs">{{ displayAnswer(answer.value) }}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- 安排与交付 -->
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-foreground text-xs">安排与交付</span>
              <Separator class="flex-1" />
            </div>

            <div class="p-3 rounded-lg border border-border/80 bg-background space-y-3">
              <div class="space-y-1">
                <span class="text-muted-foreground text-[11px] block">预约时间</span>
                <Input
                  v-if="
                    role === 'owner' &&
                    (current.status === PointOrderStatus.Pending || current.status === PointOrderStatus.InProgress)
                  "
                  v-model="appointmentAt"
                  type="datetime-local"
                  class="font-mono max-w-xs"
                />
                <span
                  v-else-if="orderData?.appointmentAt"
                  class="text-foreground text-xs"
                >
                  {{ formatDate(orderData.appointmentAt) }}
                </span>
                <span
                  v-else
                  class="text-muted-foreground text-xs"
                >
                  尚未安排
                </span>
              </div>

              <div class="space-y-1">
                <span class="text-muted-foreground text-[11px] block">交付链接</span>
                <Input
                  v-if="
                    role === 'owner' &&
                    (current.status === PointOrderStatus.Pending || current.status === PointOrderStatus.InProgress)
                  "
                  v-model="deliveryUrl"
                  placeholder="可选，填写外部交付链接"
                />
                <a
                  v-else-if="orderData?.deliveryUrl"
                  :href="orderData.deliveryUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                >
                  <component
                    :is="Link24Regular"
                    class="size-3.5"
                  />
                  打开交付链接
                </a>
                <span
                  v-else
                  class="text-muted-foreground text-xs"
                >
                  尚未提供
                </span>
              </div>

              <Button
                v-if="
                  role === 'owner' &&
                  (current.status === PointOrderStatus.Pending || current.status === PointOrderStatus.InProgress)
                "
                variant="outline"
                :disabled="actionLoading"
                @click="applyOwner()"
              >
                保存安排与交付信息
              </Button>
            </div>
          </div>

          <!-- 沟通记录 -->
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="font-semibold text-foreground text-xs">沟通记录</span>
              <Separator class="flex-1" />
            </div>

            <div
              v-if="orderData?.timeline?.length"
              class="space-y-2 pl-2 border-l-2 border-border/80"
            >
              <div
                v-for="item in orderData.timeline"
                :key="item.id"
                class="space-y-0.5 text-xs"
              >
                <div class="flex items-center gap-2 text-muted-foreground text-[11px]">
                  <strong class="text-foreground">{{ actorLabel[item.actor] }}</strong>
                  <span>{{ formatDate(item.createdAt) }}</span>
                </div>
                <p class="text-foreground text-xs m-0 leading-relaxed">{{ item.message }}</p>
              </div>
            </div>
            <span
              v-else
              class="text-muted-foreground text-xs block"
            >
              暂无沟通记录
            </span>

            <div
              v-if="canMessage"
              class="space-y-2 pt-2"
            >
              <Textarea
                v-model="note"
                rows="2"
                placeholder="补充留言、需求确认或进度说明..."
                class="text-xs resize-none"
              />
              <div class="flex justify-end">
                <Button
                  :disabled="actionLoading || !note.trim()"
                  @click="role === 'owner' ? applyOwner() : applyBuyer()"
                >
                  <component
                    :is="Send24Regular"
                    class="size-3.5 mr-1"
                  />
                  发送留言
                </Button>
              </div>
            </div>
          </div>

          <!-- 订单处理操作 -->
          <div
            v-if="ownerActions.length || canBuyerCancel"
            class="space-y-2 pt-2 border-t border-border/60"
          >
            <span class="font-semibold text-foreground text-xs block">订单处理</span>

            <Textarea
              v-if="
                ownerActions.some(
                  (item) => item.status === PointOrderStatus.Rejected || item.status === PointOrderStatus.Cancelled,
                ) || canBuyerCancel
              "
              v-model="reason"
              rows="2"
              placeholder="取消或拒绝原因（必填）"
              class="text-xs resize-none"
            />

            <div class="flex items-center justify-end gap-2 flex-wrap">
              <Button
                v-for="action in ownerActions"
                :key="action.status"
                :variant="action.variant"
                class="flex items-center gap-1"
                :disabled="actionLoading"
                @click="applyOwner(action.status)"
              >
                <component
                  :is="action.icon"
                  class="size-3.5"
                />
                {{ action.label }}
              </Button>

              <Button
                v-if="canBuyerCancel"
                variant="destructive"
                class="flex items-center gap-1"
                :disabled="actionLoading"
                @click="applyBuyer(true)"
              >
                <component
                  :is="DismissCircle24Regular"
                  class="size-3.5"
                />
                取消订单并退回积分
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </DialogContent>
  </Dialog>
</template>
