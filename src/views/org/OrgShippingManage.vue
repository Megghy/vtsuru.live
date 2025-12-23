<script setup lang="ts">
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NEmpty,
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
import {
  ArchiveOutline,
  CubeOutline,
  GiftOutline,
  RefreshOutline,
  TimeOutline,
  WarningOutline,
} from '@vicons/ionicons5'
import { computed, onMounted, ref } from 'vue'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { ORG_API_URL } from '@/data/constants'

const props = defineProps<{
  orgId: number
}>()

const message = useMessage()

// 状态管理
const isLoading = ref(true)
const shippingStats = ref<any>(null)
const shippingRecords = ref<any[]>([])
const pendingShipments = ref<any[]>([])

// 统计数据
const stats = computed(() => {
  if (!shippingStats.value) return null
  return {
    totalShipments: shippingStats.value.totalShipments || 0,
    pendingShipments: shippingStats.value.pendingShipments || 0,
    processingShipments: shippingStats.value.processingShipments || 0,
    shippedShipments: shippingStats.value.shippedShipments || 0,
    deliveredShipments: shippingStats.value.deliveredShipments || 0,
    todayShipments: shippingStats.value.todayShipments || 0,
    weekShipments: shippingStats.value.weekShipments || 0,
    monthShipments: shippingStats.value.monthShipments || 0,
  }
})

// 加载发货数据
async function loadShippingData() {
  if (!props.orgId) return

  isLoading.value = true
  try {
    // 加载发货统计
    const statsResp = await QueryGetAPI(`${ORG_API_URL}${props.orgId}/shipping/stats`)
    if (statsResp.code === 200) {
      shippingStats.value = statsResp.data
    }

    // 加载发货记录
    const recordsResp = await QueryGetAPI(`${ORG_API_URL}${props.orgId}/shipping/records`)
    if (recordsResp.code === 200) {
      shippingRecords.value = recordsResp.data
    }

    // 加载待发货订单
    const pendingResp = await QueryGetAPI(`${ORG_API_URL}${props.orgId}/shipping/pending`)
    if (pendingResp.code === 200) {
      pendingShipments.value = pendingResp.data
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    isLoading.value = false
  }
}

// 标记为已发货
async function markAsShipped(recordId: number, expressCompany: string, expressNumber: string) {
  try {
    const resp = await QueryPostAPI(`${ORG_API_URL}${props.orgId}/shipping/mark-shipped`, {
      recordId,
      expressCompany,
      expressNumber,
    })
    if (resp.code === 200) {
      message.success('已标记为已发货')
      await loadShippingData()
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
  }
}

// 标记为已送达
async function markAsDelivered(recordId: number) {
  try {
    const resp = await QueryPostAPI(`${ORG_API_URL}${props.orgId}/shipping/mark-delivered`, {
      recordId,
    })
    if (resp.code === 200) {
      message.success('已标记为已送达')
      await loadShippingData()
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
  }
}

// 刷新数据
async function refreshData() {
  await loadShippingData()
}

onMounted(() => {
  loadShippingData()
})
</script>

<template>
  <div>
    <!-- 统计卡片 -->
    <div style="margin-bottom: 16px;">
      <NGrid :x-gap="12" :y-gap="12" :cols="4" item-responsive responsive="screen">
        <NGridItem span="4 m:2 l:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="总发货数" :value="stats?.totalShipments || 0">
              <template #prefix>
                <NIcon :component="CubeOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
        <NGridItem span="4 m:2 l:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="待发货" :value="stats?.pendingShipments || 0" class="pending">
              <template #prefix>
                <NIcon :component="TimeOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
        <NGridItem span="4 m:2 l:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="处理中" :value="stats?.processingShipments || 0" class="processing">
              <template #prefix>
                <NIcon :component="ArchiveOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
        <NGridItem span="4 m:2 l:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="已送达" :value="stats?.deliveredShipments || 0" class="delivered">
              <template #prefix>
                <NIcon :component="GiftOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
      </NGrid>
    </div>

    <!-- 时间范围统计 -->
    <div style="margin-bottom: 16px;">
      <NGrid :x-gap="12" :y-gap="12" :cols="3" item-responsive responsive="screen">
        <NGridItem span="3 m:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="今日发货" :value="stats?.todayShipments || 0">
              <template #prefix>
                <NIcon :component="TimeOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
        <NGridItem span="3 m:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="本周发货" :value="stats?.weekShipments || 0">
              <template #prefix>
                <NIcon :component="TimeOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
        <NGridItem span="3 m:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="本月发货" :value="stats?.monthShipments || 0">
              <template #prefix>
                <NIcon :component="TimeOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
      </NGrid>
    </div>

    <!-- 控制栏 -->
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

    <!-- 加载状态 -->
    <template v-if="isLoading">
      <NSkeleton text :repeat="4" />
    </template>

    <!-- 待发货订单 -->
    <template v-if="pendingShipments.length > 0">
      <NCard title="待发货订单" size="small" style="margin-bottom: 16px;">
        <NAlert type="warning" :bordered="false" style="margin-bottom: 12px;">
          有 {{ pendingShipments.length }} 个订单等待发货
        </NAlert>
        <NList>
          <NListItem v-for="shipment in pendingShipments.slice(0, 5)" :key="shipment.id">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="flex: 1;">
                <div style="font-weight: 600;">{{ shipment.goodsName }}</div>
                <div style="font-size: 12px; opacity: 0.7;">
                  用户: {{ shipment.userName }} · 数量: {{ shipment.quantity }}
                </div>
                <div style="font-size: 12px; opacity: 0.7;">
                  地址: {{ shipment.shippingAddress?.province }}{{ shipment.shippingAddress?.city }}{{ shipment.shippingAddress?.district }}{{ shipment.shippingAddress?.address }}
                </div>
                <div style="font-size: 12px; opacity: 0.7;">
                  联系电话: {{ shipment.shippingAddress?.phone }}
                </div>
                <div style="font-size: 12px; opacity: 0.7;">
                  <NTime :time="shipment.createdAt" format="yyyy-MM-dd HH:mm" />
                </div>
              </div>
              <div>
                <NButton size="small" type="primary" @click="markAsShipped(shipment.id, '顺丰', 'SF123456789')">
                  标记发货
                </NButton>
              </div>
            </div>
          </NListItem>
        </NList>
      </NCard>
    </template>

    <!-- 最近发货记录 -->
    <template v-if="shippingRecords.length > 0">
      <NCard title="最近发货记录" size="small">
        <NList>
          <NListItem v-for="record in shippingRecords.slice(0, 5)" :key="record.id">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="flex: 1;">
                <div style="font-weight: 600;">{{ record.goodsName }}</div>
                <div style="font-size: 12px; opacity: 0.7;">
                  用户: {{ record.userName }} · 物流: {{ record.expressCompany }} {{ record.expressNumber }}
                </div>
                <div style="font-size: 12px; opacity: 0.7;">
                  发货时间: <NTime :time="record.shippedAt" format="yyyy-MM-dd HH:mm" />
                </div>
                <div v-if="record.deliveredAt" style="font-size: 12px; opacity: 0.7;">
                  送达时间: <NTime :time="record.deliveredAt" format="yyyy-MM-dd HH:mm" />
                </div>
              </div>
              <div>
                <NTag :type="record.status === 0 ? 'warning' : record.status === 1 ? 'info' : 'success'" size="small">
                  {{ record.status === 0 ? '待发货' : record.status === 1 ? '处理中' : record.status === 2 ? '已发货' : '已送达' }}
                </NTag>
                <NButton
                  v-if="record.status === 2"
                  size="small"
                  type="success"
                  style="margin-left: 8px;"
                  @click="markAsDelivered(record.id)"
                >
                  标记送达
                </NButton>
              </div>
            </div>
          </NListItem>
        </NList>
      </NCard>
    </template>

    <!-- 无数据状态 -->
    <template v-if="!isLoading && pendingShipments.length === 0 && shippingRecords.length === 0">
      <NEmpty description="暂无发货数据">
        <template #extra>
          <NButton @click="refreshData">
            刷新
          </NButton>
        </template>
      </NEmpty>
    </template>

    <!-- 功能开发提示 -->
    <div style="margin-top: 16px;">
      <NAlert type="info" :bordered="false">
        礼物发货管理功能正在开发中，更多功能即将上线...
      </NAlert>
    </div>
  </div>
</template>

<style scoped>
.pending :deep(.n-statistic-value) {
  color: var(--n-warning-color);
}
.processing :deep(.n-statistic-value) {
  color: var(--n-info-color);
}
.delivered :deep(.n-statistic-value) {
  color: var(--n-success-color);
}
</style>