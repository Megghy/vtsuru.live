<script setup lang="ts">
import {
  ArrowClockwise24Regular,
  CalendarLtr24Regular,
  CheckmarkCircle24Regular,
  DismissCircle24Regular,
  Link24Regular,
  Send24Regular,
} from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NDatePicker,
  NDivider,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NModal,
  NScrollbar,
  NSpin,
  NTag,
  NTimeline,
  NTimelineItem,
  NTime,
  useMessage,
} from 'naive-ui'
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

const message = useMessage()
const current = ref<ServiceOrder>()
const loading = ref(false)
const actionLoading = ref(false)
const loadError = ref<string>()
const note = ref('')
const reason = ref('')
const deliveryUrl = ref('')
const appointmentAt = ref<number | null>(null)

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
  { label: string; type: 'default' | 'warning' | 'info' | 'success' | 'error'; hint: string }
> = {
  [PointOrderStatus.Pending]: { label: '待接单', type: 'warning', hint: '需求已提交，等待创作者确认。' },
  [PointOrderStatus.Shipped]: { label: '已发货', type: 'info', hint: '订单已发货。' },
  [PointOrderStatus.Completed]: { label: '已完成', type: 'success', hint: '服务已完成。' },
  [PointOrderStatus.InProgress]: { label: '进行中', type: 'info', hint: '创作者已接单，正在安排或制作。' },
  [PointOrderStatus.Rejected]: { label: '已拒绝', type: 'error', hint: '创作者无法承接，积分已退回。' },
  [PointOrderStatus.Cancelled]: { label: '已取消', type: 'default', hint: '订单已取消，符合条件的积分已退回。' },
}

const isService = computed(() => current.value?.type === GoodsTypes.Service)
const canMessage = computed(
  () => current.value?.status === PointOrderStatus.Pending || current.value?.status === PointOrderStatus.InProgress,
)
const ownerActions = computed(() => {
  if (!current.value || props.role !== 'owner') return []
  if (current.value.status === PointOrderStatus.Pending) {
    return [
      { label: '接单', status: PointOrderStatus.InProgress, type: 'primary' as const, icon: CheckmarkCircle24Regular },
      {
        label: '拒绝并退回积分',
        status: PointOrderStatus.Rejected,
        type: 'error' as const,
        icon: DismissCircle24Regular,
      },
    ]
  }
  if (current.value.status === PointOrderStatus.InProgress) {
    return [
      {
        label: '标记完成',
        status: PointOrderStatus.Completed,
        type: 'primary' as const,
        icon: CheckmarkCircle24Regular,
      },
      {
        label: '取消并退回积分',
        status: PointOrderStatus.Cancelled,
        type: 'warning' as const,
        icon: DismissCircle24Regular,
      },
    ]
  }
  return []
})
const canBuyerCancel = computed(() => props.role === 'buyer' && current.value?.status === PointOrderStatus.Pending)

function normalizeTimestamp(value?: number | null) {
  if (!value) return undefined
  return value < 10_000_000_000 ? value * 1000 : value
}

function syncForm(data?: ServiceOrderData) {
  appointmentAt.value = normalizeTimestamp(data?.appointmentAt) ?? null
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
    message.warning('请填写取消或拒绝原因')
    return
  }
  actionLoading.value = true
  try {
    const updated = await updateOwnerServiceOrder({
      orderId: current.value.id,
      ...(status === undefined ? {} : { status }),
      ...(reason.value.trim() ? { reason: reason.value.trim() } : {}),
      ...(appointmentAt.value ? { appointmentAt: Math.floor(appointmentAt.value / 1000) } : {}),
      ...(deliveryUrl.value.trim() ? { deliveryUrl: deliveryUrl.value.trim() } : {}),
      ...(note.value.trim() ? { message: note.value.trim() } : {}),
    })
    current.value = updated
    syncForm(updated.serviceData)
    note.value = ''
    reason.value = ''
    emit('updated', updated)
    message.success('服务订单已更新')
  } catch (error) {
    message.error(error instanceof Error ? error.message : `更新失败: ${error}`)
  } finally {
    actionLoading.value = false
  }
}

async function applyBuyer(cancel = false) {
  if (!current.value || props.role !== 'buyer') return
  if (cancel && !reason.value.trim()) {
    message.warning('请填写取消原因')
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
    message.success(cancel ? '订单已取消，积分将按规则退回' : '留言已发送')
  } catch (error) {
    message.error(error instanceof Error ? error.message : `更新失败: ${error}`)
  } finally {
    actionLoading.value = false
  }
}

const timelineType: Record<ServiceTimelineType, { type: 'default' | 'info' | 'success' | 'warning' | 'error'; icon?: Component }> = {
  [ServiceTimelineType.Message]: { type: 'info', icon: Send24Regular },
  [ServiceTimelineType.Appointment]: { type: 'warning', icon: CalendarLtr24Regular },
  [ServiceTimelineType.Delivery]: { type: 'success', icon: Link24Regular },
  [ServiceTimelineType.Refund]: { type: 'error', icon: DismissCircle24Regular },
  [ServiceTimelineType.Status]: { type: 'default' },
}
const actorLabel: Record<ServiceTimelineActor, string> = {
  [ServiceTimelineActor.Buyer]: '买家',
  [ServiceTimelineActor.Owner]: '创作者',
  [ServiceTimelineActor.System]: '系统',
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="service-order-modal"
    title="服务订单"
    @update:show="emit('update:show', $event)"
  >
    <NScrollbar class="service-order-scrollbar">
      <NSpin :show="loading">
        <NAlert
          v-if="loadError"
          type="error"
          title="服务订单加载失败"
          closable
        >
          {{ loadError }}
        </NAlert>
        <NButton
          v-if="loadError"
          size="small"
          secondary
          @click="load"
        >
          <template #icon><NIcon :component="ArrowClockwise24Regular" /></template>
          重试
        </NButton>

        <NEmpty
          v-else-if="!current"
          description="没有可查看的服务订单"
        />
        <div
          v-else-if="isService"
          class="service-order-detail"
        >
          <div class="service-order-summary">
            <div>
              <span>订单号</span><strong>#{{ current.id }}</strong>
            </div>
            <div><span>兑换时间</span><NTime :time="current.createAt" /></div>
            <div>
              <span>使用积分</span><strong>{{ Number(current.point.toFixed(1)) }}</strong>
            </div>
            <div>
              <span>状态</span>
              <NTag
                :type="statusMeta[current.status].type"
                size="small"
                :bordered="false"
                >{{ statusMeta[current.status].label }}</NTag
              >
            </div>
          </div>

          <NAlert :type="statusMeta[current.status].type">{{ statusMeta[current.status].hint }}</NAlert>
          <NAlert
            v-if="orderData?.cancelReason"
            type="warning"
            title="处理原因"
          >
            {{ orderData.cancelReason }}
          </NAlert>

          <NDivider>服务与需求快照</NDivider>
          <div class="service-card">
            <strong>{{ current.goods.name }}</strong>
            <span
              v-if="config?.rules"
              class="service-rules"
              >规则：{{ config.rules }}</span
            >
            <span
              v-if="config?.estimatedDays"
              class="service-rules"
              >预计周期：{{ config.estimatedDays }} 天</span
            >
            <div
              v-if="fields.length"
              class="service-answers"
            >
              <div
                v-for="field in fields"
                :key="field.id"
                class="service-answer"
              >
                <span>{{ field.label }}</span>
                <strong>{{ displayAnswer(answers.get(field.id)?.value) }}</strong>
              </div>
            </div>
            <div
              v-else-if="orderData?.answers?.length"
              class="service-answers"
            >
              <div
                v-for="answer in orderData.answers"
                :key="answer.fieldId"
                class="service-answer"
              >
                <span>{{ answer.label }}</span
                ><strong>{{ displayAnswer(answer.value) }}</strong>
              </div>
            </div>
          </div>

          <NDivider>安排与交付</NDivider>
          <div class="service-card service-delivery">
            <div class="service-field-row">
              <span>预约时间</span>
              <NDatePicker
                v-if="
                  role === 'owner' &&
                  (current.status === PointOrderStatus.Pending || current.status === PointOrderStatus.InProgress)
                "
                v-model:value="appointmentAt"
                type="datetime"
                clearable
                placeholder="选择预约时间"
              />
              <NTime
                v-else-if="orderData?.appointmentAt"
                :time="normalizeTimestamp(orderData.appointmentAt)"
              />
              <NText
                v-else
                depth="3"
                >尚未安排</NText
              >
            </div>
            <div class="service-field-row">
              <span>交付链接</span>
              <NInput
                v-if="
                  role === 'owner' &&
                  (current.status === PointOrderStatus.Pending || current.status === PointOrderStatus.InProgress)
                "
                v-model:value="deliveryUrl"
                placeholder="可选，填写外部交付链接"
              />
              <NButton
                v-else-if="orderData?.deliveryUrl"
                tag="a"
                :href="orderData.deliveryUrl"
                target="_blank"
                text
                type="primary"
                ><template #icon><NIcon :component="Link24Regular" /></template>打开交付链接</NButton
              >
              <NText
                v-else
                depth="3"
                >尚未提供</NText
              >
            </div>
            <NButton
              v-if="
                role === 'owner' &&
                (current.status === PointOrderStatus.Pending || current.status === PointOrderStatus.InProgress)
              "
              :loading="actionLoading"
              type="primary"
              secondary
              @click="applyOwner()"
              >保存安排与交付信息</NButton
            >
          </div>

          <NDivider>沟通记录</NDivider>
          <NTimeline v-if="orderData?.timeline?.length">
            <NTimelineItem
              v-for="item in orderData.timeline"
              :key="item.id"
              :type="timelineType[item.type]?.type ?? 'default'"
              :time="new Date(normalizeTimestamp(item.createdAt) ?? item.createdAt).toLocaleString()"
            >
              <template
                #icon
                v-if="timelineType[item.type]?.icon"
                ><NIcon :component="timelineType[item.type].icon"
              /></template>
              <span>{{ actorLabel[item.actor] }}：{{ item.message }}</span>
            </NTimelineItem>
          </NTimeline>
          <NText
            v-else
            depth="3"
            >暂无沟通记录</NText
          >

          <div
            v-if="canMessage"
            class="service-compose"
          >
            <NInput
              v-model:value="note"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 5 }"
              placeholder="补充留言、需求确认或进度说明"
            />
            <NButton
              :loading="actionLoading"
              type="primary"
              secondary
              @click="role === 'owner' ? applyOwner() : applyBuyer()"
              >发送留言</NButton
            >
          </div>

          <NDivider v-if="ownerActions.length || canBuyerCancel">订单处理</NDivider>
          <NInput
            v-if="
              ownerActions.some(
                (item) => item.status === PointOrderStatus.Rejected || item.status === PointOrderStatus.Cancelled,
              ) || canBuyerCancel
            "
            v-model:value="reason"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
            placeholder="取消或拒绝原因（必填）"
          />
          <NFlex
            v-if="ownerActions.length || canBuyerCancel"
            justify="end"
            wrap
          >
            <NButton
              v-for="action in ownerActions"
              :key="action.status"
              :loading="actionLoading"
              :type="action.type"
              secondary
              @click="applyOwner(action.status)"
              ><template #icon><NIcon :component="action.icon" /></template>{{ action.label }}</NButton
            >
            <NButton
              v-if="canBuyerCancel"
              :loading="actionLoading"
              type="warning"
              secondary
              @click="applyBuyer(true)"
              ><template #icon><NIcon :component="DismissCircle24Regular" /></template>取消订单并退回积分</NButton
            >
          </NFlex>
        </div>
      </NSpin>
    </NScrollbar>
  </NModal>
</template>

<style scoped>
.service-order-modal {
  width: min(760px, calc(100vw - 24px));
  max-width: calc(100vw - 24px);
}
.service-order-scrollbar {
  max-height: min(80vh, 780px);
}
.service-order-detail {
  display: grid;
  gap: 12px;
  padding-right: 8px;
}
.service-order-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}
.service-order-summary > div,
.service-card {
  display: grid;
  gap: 6px;
  padding: 11px 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-elevated);
}
.service-order-summary span,
.service-field-row > span,
.service-answer span {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.service-answers {
  display: grid;
  gap: 8px;
  margin-top: 4px;
}
.service-rules {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  white-space: pre-wrap;
}
.service-answer {
  display: grid;
  gap: 3px;
  padding: 8px;
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-muted);
  overflow-wrap: anywhere;
}
.service-delivery {
  gap: 10px;
}
.service-field-row {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}
.service-compose {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
}
.service-order-detail :deep(.n-divider) {
  margin: 4px 0;
}
@media (max-width: 620px) {
  .service-order-modal {
    width: calc(100vw - 16px);
    max-width: calc(100vw - 16px);
  }
  .service-order-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .service-compose {
    grid-template-columns: 1fr;
  }
  .service-field-row {
    grid-template-columns: 1fr;
    align-items: start;
  }
}
</style>
