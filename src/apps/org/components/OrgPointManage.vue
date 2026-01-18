<script setup lang="ts">
import { NAlert, NButton, NCard, NEmpty, NSelect, NGrid, NGridItem, NIcon, NList, NListItem, NSkeleton, NFlex, NStatistic, NTag, NTime, useMessage } from 'naive-ui';
import { CashOutline, CubeOutline, GiftOutline, PeopleOutline, RefreshOutline, StorefrontOutline, TimeOutline } from '@vicons/ionicons5'
import { computed, onMounted, ref } from 'vue'
import { QueryGetAPI, unwrapOk } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'
import PointSettings from '@/shared/components/points/PointSettings.vue'

const props = defineProps<{
  orgId: number
  streamerOptions?: { label: string, value: number }[]
}>()

const message = useMessage()

// 状态管理
const isLoading = ref(true)
const pointStats = ref<any>(null)
const pointGoods = ref<any[]>([])
const auditLogs = ref<any[]>([])
const selectedStreamerId = ref<number | null>(null)

// 统计数据
const stats = computed(() => {
  if (!pointStats.value) return null
  return {
    totalPointsIssued: pointStats.value.totalPointsIssued ?? 0,
    totalPointsUsed: pointStats.value.totalPointsUsed ?? 0,
    activeUsers: pointStats.value.activeUsers ?? 0,
    totalOrders: pointStats.value.totalOrders ?? 0,
    pendingOrders: pointStats.value.pendingOrders ?? 0,
    shippedOrders: pointStats.value.shippedOrders ?? 0,
    completedOrders: pointStats.value.completedOrders ?? 0,
  }
})

// 加载组织积分数据
async function loadOrgPointData() {
  if (!props.orgId) return

  isLoading.value = true
  try {
    // 加载积分统计
    pointStats.value = unwrapOk(
      await QueryGetAPI(`${ORG_API_URL}${props.orgId}/points/stats`, selectedStreamerId.value ? { streamerId: selectedStreamerId.value } : undefined),
      '加载积分统计失败',
    )

    // 加载积分商品
    pointGoods.value = unwrapOk(
      await QueryGetAPI(`${ORG_API_URL}${props.orgId}/points/goods`, selectedStreamerId.value ? { streamerId: selectedStreamerId.value } : undefined),
      '加载积分商品失败',
    )

    // 加载审计记录
    auditLogs.value = unwrapOk(
      await QueryGetAPI(`${ORG_API_URL}${props.orgId}/points/audit`, { take: 100 }),
      '加载操作审计失败',
    )
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    isLoading.value = false
  }
}

// 刷新数据
async function refreshData() {
  await loadOrgPointData()
}

onMounted(() => {
  loadOrgPointData()
})
</script>

<template>
  <div>
    <NCard
      title="主播"
      size="small"
      style="margin-bottom: 16px;"
    >
      <NSelect
        v-model:value="selectedStreamerId"
        :options="streamerOptions || []"
        placeholder="选择主播后，可单独查看/修改积分规则与筛选统计"
        clearable
        @update:value="() => refreshData()"
      />
    </NCard>

    <!-- 统计卡片 -->
    <div style="margin-bottom: 16px;">
      <NGrid :x-gap="12" :y-gap="12" :cols="4" item-responsive responsive="screen">
        <NGridItem span="4 m:2 l:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="总发放积分" :value="stats?.totalPointsIssued || 0">
              <template #prefix>
                <NIcon :component="CashOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
        <NGridItem span="4 m:2 l:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="总使用积分" :value="stats?.totalPointsUsed || 0">
              <template #prefix>
                <NIcon :component="GiftOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
        <NGridItem span="4 m:2 l:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="活跃用户" :value="stats?.activeUsers || 0">
              <template #prefix>
                <NIcon :component="PeopleOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
        <NGridItem span="4 m:2 l:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="总订单数" :value="stats?.totalOrders || 0">
              <template #prefix>
                <NIcon :component="StorefrontOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
      </NGrid>
    </div>

    <!-- 订单状态统计 -->
    <div style="margin-bottom: 16px;">
      <NGrid :x-gap="12" :y-gap="12" :cols="3" item-responsive responsive="screen">
        <NGridItem span="3 m:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="待处理订单" :value="stats?.pendingOrders || 0" class="pending">
              <template #prefix>
                <NIcon :component="TimeOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
        <NGridItem span="3 m:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="已发货订单" :value="stats?.shippedOrders || 0" class="shipped">
              <template #prefix>
                <NIcon :component="CubeOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
        <NGridItem span="3 m:1">
          <NCard size="small" :bordered="false">
            <NStatistic label="已完成订单" :value="stats?.completedOrders || 0" class="completed">
              <template #prefix>
                <NIcon :component="GiftOutline" />
              </template>
            </NStatistic>
          </NCard>
        </NGridItem>
      </NGrid>
    </div>

    <!-- 控制栏 -->
    <div style="margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
      <NFlex>
        <NButton :loading="isLoading" @click="refreshData">
          <template #icon>
            <NIcon :component="RefreshOutline" />
          </template>
          刷新
        </NButton>
      </NFlex>
    </div>

    <!-- 加载状态 -->
    <template v-if="isLoading">
      <NSkeleton text :repeat="4" />
    </template>

    <!-- 无数据状态 -->
    <template v-else-if="!pointStats && !pointGoods.length">
      <NEmpty description="暂无积分数据">
        <template #extra>
          <NButton @click="refreshData">
            刷新
          </NButton>
        </template>
      </NEmpty>
    </template>

    <!-- 商品列表 -->
    <template v-if="pointGoods.length > 0">
      <NCard title="积分商品" size="small" style="margin-bottom: 16px;">
        <NList>
          <NListItem v-for="goods in pointGoods.slice(0, 5)" :key="goods.id">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 600;">
                  {{ goods.name }}
                </div>
                <div style="font-size: 12px; opacity: 0.7;">
                  {{ goods.description }}
                </div>
              </div>
              <div>
                <NTag type="info" size="small">
                  {{ goods.price }} 积分
                </NTag>
                <NTag v-if="goods.stock > 0" type="success" size="small">
                  库存: {{ goods.stock }}
                </NTag>
                <NTag v-else type="error" size="small">
                  缺货
                </NTag>
              </div>
            </div>
          </NListItem>
        </NList>
      </NCard>
    </template>

    <NCard
      title="积分规则"
      size="small"
      style="margin-bottom: 16px;"
    >
      <template v-if="!selectedStreamerId">
        <NAlert type="warning" :bordered="false">
          请选择一个主播后再修改积分规则
        </NAlert>
      </template>
      <template v-else>
        <PointSettings :org-id="orgId" :streamer-id="selectedStreamerId" />
      </template>
    </NCard>

    <!-- 审计记录 -->
    <template v-if="auditLogs.length">
      <NCard title="操作审计" size="small" style="margin-top: 16px;">
        <NList>
          <NListItem v-for="log in auditLogs" :key="log.id">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: 600;">
                  {{ log.action }}
                </div>
                <div style="font-size: 12px; opacity: 0.7;">
                  {{ log.detail }}
                </div>
                <div style="font-size: 12px; opacity: 0.7;">
                  {{ log.userName || (`用户${ log.userId}`) }} · <NTime :time="log.createdAt" format="yyyy-MM-dd HH:mm" />
                </div>
              </div>
            </div>
          </NListItem>
        </NList>
      </NCard>
    </template>
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
