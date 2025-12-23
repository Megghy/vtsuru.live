<script setup lang="ts">
import type { APIRoot } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { ORG_API_URL } from '@/data/constants'
import { CheckmarkDoneOutline, CubeOutline, RefreshOutline, TimeOutline } from '@vicons/ionicons5'
import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NList,
  NListItem,
  NModal,
  NPopconfirm,
  NSkeleton,
  NSpace,
  NStatistic,
  NTag,
  NTime,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{
  orgId: number
}>()

type PointOrderStatus = 0 | 1 | 2

interface PointOrderItem {
  orderId: number
  goodsName: string
  userName: string
  quantity: number
  trackingNumber?: string
  expressCompany?: string
  createdAt: number
  status: PointOrderStatus
}

interface PointStats {
  totalOrders: number
  pendingOrders: number
  shippedOrders: number
  completedOrders: number
}

const message = useMessage()

const isLoading = ref(true)
const pointStats = ref<PointStats | null>(null)
const orders = ref<PointOrderItem[]>([])

const shipModalVisible = ref(false)
const shipForm = ref({
  orderId: 0,
  expressCompany: '',
  trackingNumber: '',
})

function unwrapOk<T>(resp: APIRoot<T>, failMessage: string): T {
  if (resp.code !== 200) throw new Error(resp.message || failMessage)
  return resp.data
}

const stats = computed(() => {
  if (!pointStats.value) return null
  return {
    totalOrders: pointStats.value.totalOrders ?? 0,
    pendingOrders: pointStats.value.pendingOrders ?? 0,
    shippedOrders: pointStats.value.shippedOrders ?? 0,
    completedOrders: pointStats.value.completedOrders ?? 0,
  }
})

const pendingOrders = computed(() => orders.value.filter(o => o.status === 0))
const processedOrders = computed(() => orders.value.filter(o => o.status !== 0))

async function loadData() {
  if (!props.orgId) return

  isLoading.value = true
  try {
    pointStats.value = unwrapOk(
      await QueryGetAPI(`${ORG_API_URL}${props.orgId}/points/stats`),
      '加载统计失败',
    ) as PointStats

    orders.value = unwrapOk(
      await QueryGetAPI(`${ORG_API_URL}${props.orgId}/points/orders`),
      '加载订单失败',
    ) as PointOrderItem[]
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    isLoading.value = false
  }
}

function openShipModal(order: PointOrderItem) {
  shipForm.value = {
    orderId: order.orderId,
    expressCompany: order.expressCompany || '',
    trackingNumber: order.trackingNumber || '',
  }
  shipModalVisible.value = true
}

async function submitShip() {
  const { orderId, expressCompany, trackingNumber } = shipForm.value
  const tn = trackingNumber.trim()
  if (!tn) {
    message.warning('请填写运单号')
    return
  }

  try {
    unwrapOk(
      await QueryPostAPI(`${ORG_API_URL}${props.orgId}/points/orders/express`, {
        orderId,
        trackingNumber: tn,
        expressCompany: expressCompany.trim() || undefined,
      }),
      '更新物流失败',
    )

    unwrapOk(
      await QueryPostAPI(`${ORG_API_URL}${props.orgId}/points/orders/status`, {
        orderIds: [orderId],
        status: 1,
      }),
      '更新状态失败',
    )

    message.success('已标记为已发货')
    shipModalVisible.value = false
    await loadData()
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
  }
}

async function markAsCompleted(orderId: number) {
  try {
    unwrapOk(
      await QueryPostAPI(`${ORG_API_URL}${props.orgId}/points/orders/status`, {
        orderIds: [orderId],
        status: 2,
      }),
      '更新状态失败',
    )
    message.success('已标记为已完成')
    await loadData()
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
  }
}

async function refreshData() {
  await loadData()
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div>
    <div style="margin-bottom: 16px;">
      <NGrid :x-gap="12" :y-gap="12" :cols="4" item-responsive responsive="screen">
        <NGridItem span="4 m:2 l:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="总订单" :value="stats?.totalOrders || 0">
              <template #prefix>
                <NIcon :component="CubeOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
        <NGridItem span="4 m:2 l:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="待发货" :value="stats?.pendingOrders || 0" class="pending">
              <template #prefix>
                <NIcon :component="TimeOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
        <NGridItem span="4 m:2 l:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="已发货" :value="stats?.shippedOrders || 0" class="shipped">
              <template #prefix>
                <NIcon :component="CubeOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
        <NGridItem span="4 m:2 l:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="已完成" :value="stats?.completedOrders || 0" class="completed">
              <template #prefix>
                <NIcon :component="CheckmarkDoneOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
      </NGrid>
    </div>

    <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
      <NSpace>
        <NButton :loading="isLoading" @click="refreshData">
          <template #icon>
            <NIcon :component="RefreshOutline" />
          </template>
          刷新
        </NButton>
      </NSpace>
    </div>

    <template v-if="isLoading">
      <NSkeleton text :repeat="4" />
    </template>

    <template v-else-if="orders.length === 0">
      <NEmpty description="暂无礼物订单">
        <template #extra>
          <NButton @click="refreshData">
            刷新
          </NButton>
        </template>
      </NEmpty>
    </template>

    <template v-else>
      <template v-if="pendingOrders.length > 0">
        <NCard title="待发货订单" size="small" style="margin-bottom: 16px;">
          <NAlert type="warning" :bordered="false" style="margin-bottom: 12px;">
            有 {{ pendingOrders.length }} 个订单等待发货
          </NAlert>
          <NList>
            <NListItem v-for="order in pendingOrders.slice(0, 10)" :key="order.orderId">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <div style="flex: 1;">
                  <div style="font-weight: 600;">{{ order.goodsName }}</div>
                  <div style="font-size: 12px; opacity: 0.7;">
                    用户: {{ order.userName }} · 数量: {{ order.quantity }}
                  </div>
                  <div style="font-size: 12px; opacity: 0.7;">
                    <NTime :time="order.createdAt" format="yyyy-MM-dd HH:mm" />
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <NTag type="warning" size="small">
                    待发货
                  </NTag>
                  <NButton size="small" type="primary" @click="openShipModal(order)">
                    填写物流并发货
                  </NButton>
                </div>
              </div>
            </NListItem>
          </NList>
        </NCard>
      </template>

      <template v-if="processedOrders.length > 0">
        <NCard title="最近处理" size="small">
          <NList>
            <NListItem v-for="order in processedOrders.slice(0, 10)" :key="order.orderId">
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
                <div style="flex: 1;">
                  <div style="font-weight: 600;">{{ order.goodsName }}</div>
                  <div style="font-size: 12px; opacity: 0.7;">
                    用户: {{ order.userName }} · 数量: {{ order.quantity }}
                  </div>
                  <div style="font-size: 12px; opacity: 0.7;">
                    物流: {{ order.expressCompany || '-' }} {{ order.trackingNumber || '-' }}
                  </div>
                  <div style="font-size: 12px; opacity: 0.7;">
                    <NTime :time="order.createdAt" format="yyyy-MM-dd HH:mm" />
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <NTag :type="order.status === 1 ? 'info' : 'success'" size="small">
                    {{ order.status === 1 ? '已发货' : '已完成' }}
                  </NTag>
                  <NPopconfirm v-if="order.status === 1" @positive-click="markAsCompleted(order.orderId)">
                    <template #trigger>
                      <NButton size="small" tertiary type="success">
                        标记完成
                      </NButton>
                    </template>
                    确定将该订单标记为已完成吗？
                  </NPopconfirm>
                </div>
              </div>
            </NListItem>
          </NList>
        </NCard>
      </template>
    </template>

    <NModal v-model:show="shipModalVisible" preset="dialog" title="填写物流并发货">
      <NForm label-placement="left" label-width="80">
        <NFormItem label="快递公司">
          <NInput v-model:value="shipForm.expressCompany" placeholder="如：顺丰" />
        </NFormItem>
        <NFormItem label="运单号">
          <NInput v-model:value="shipForm.trackingNumber" placeholder="请输入运单号" />
        </NFormItem>
      </NForm>
      <template #action>
        <NSpace justify="end">
          <NButton @click="shipModalVisible = false">取消</NButton>
          <NButton type="primary" @click="submitShip">确认发货</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.pending :deep(.n-statistic-value) {
  color: var(--n-warning-color);
}
.shipped :deep(.n-statistic-value) {
  color: var(--n-info-color);
}
.completed :deep(.n-statistic-value) {
  color: var(--n-success-color);
}
</style>

