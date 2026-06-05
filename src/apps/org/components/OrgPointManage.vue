<script setup lang="ts">
import { NAlert, NButton, NCard, NEmpty, NSelect, NGrid, NGridItem, NIcon, NList, NListItem, NSkeleton, NFlex, NStatistic, NTag, useMessage } from 'naive-ui'
import { CashOutline, CubeOutline, GiftOutline, PeopleOutline, RefreshOutline, StorefrontOutline, TimeOutline } from '@vicons/ionicons5'
import { computed, onMounted, ref } from 'vue'
import { QueryGetAPI, unwrapOk } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'
import PointSettings from '@/shared/components/points/PointSettings.vue'
import { useOrgContext } from '../composables/useOrgContext'
import { injectOrgStreamers } from '../composables/useOrgStreamers'
import OrgAuditList from './OrgAuditList.vue'

const { orgId } = useOrgContext()
const { options: streamerOptions } = injectOrgStreamers()
const message = useMessage()

const isLoading = ref(true)
const pointStats = ref<Record<string, number> | null>(null)
const pointGoods = ref<{ id: number, name: string, description?: string, price: number, stock: number }[]>([])
const auditLogs = ref<{ id: number, action: string, detail: string, createdAt: number, userId: number, userName?: string }[]>([])
const selectedStreamerId = ref<number | null>(null)

const statItems = computed(() => {
  const s = pointStats.value
  return [
    { label: '总发放积分', value: s?.totalPointsIssued ?? 0, icon: CashOutline },
    { label: '总使用积分', value: s?.totalPointsUsed ?? 0, icon: GiftOutline },
    { label: '活跃用户', value: s?.activeUsers ?? 0, icon: PeopleOutline },
    { label: '总订单数', value: s?.totalOrders ?? 0, icon: StorefrontOutline },
  ]
})

const orderItems = computed(() => {
  const s = pointStats.value
  return [
    { label: '待处理订单', value: s?.pendingOrders ?? 0, icon: TimeOutline, cls: 'pending' },
    { label: '已发货订单', value: s?.shippedOrders ?? 0, icon: CubeOutline, cls: 'shipped' },
    { label: '已完成订单', value: s?.completedOrders ?? 0, icon: GiftOutline, cls: 'completed' },
  ]
})

async function loadData() {
  if (!orgId.value) return
  isLoading.value = true
  const streamerParam = selectedStreamerId.value ? { streamerId: selectedStreamerId.value } : undefined
  try {
    pointStats.value = unwrapOk(await QueryGetAPI(`${ORG_API_URL}${orgId.value}/points/stats`, streamerParam), '加载积分统计失败')
    pointGoods.value = unwrapOk(await QueryGetAPI(`${ORG_API_URL}${orgId.value}/points/goods`, streamerParam), '加载积分商品失败')
    auditLogs.value = unwrapOk(await QueryGetAPI(`${ORG_API_URL}${orgId.value}/points/audit`, { take: 100 }), '加载操作审计失败')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await loadData()
})
</script>

<template>
  <NFlex vertical :size="16">
    <NCard title="主播" size="small">
      <NSelect
        v-model:value="selectedStreamerId"
        :options="streamerOptions"
        placeholder="选择主播后，可单独查看/修改积分规则与筛选统计"
        clearable
        @update:value="loadData"
      />
    </NCard>

    <NGrid :x-gap="12" :y-gap="12" :cols="4" item-responsive responsive="screen">
      <NGridItem v-for="item in statItems" :key="item.label" span="4 m:2 l:1">
        <NCard size="small" :bordered="false">
          <NStatistic :label="item.label" :value="item.value">
            <template #prefix>
              <NIcon :component="item.icon" />
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
    </NGrid>

    <NGrid :x-gap="12" :y-gap="12" :cols="3" item-responsive responsive="screen">
      <NGridItem v-for="item in orderItems" :key="item.label" span="3 m:1">
        <NCard size="small" :bordered="false">
          <NStatistic :label="item.label" :value="item.value" :class="item.cls">
            <template #prefix>
              <NIcon :component="item.icon" />
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
    </NGrid>

    <NFlex>
      <NButton :loading="isLoading" @click="loadData">
        <template #icon>
          <NIcon :component="RefreshOutline" />
        </template>
        刷新
      </NButton>
    </NFlex>

    <NSkeleton v-if="isLoading" text :repeat="4" />
    <NEmpty v-else-if="!pointStats && !pointGoods.length" description="暂无积分数据" />

    <NCard v-if="pointGoods.length > 0" title="积分商品" size="small">
      <NList>
        <NListItem v-for="goods in pointGoods.slice(0, 5)" :key="goods.id">
          <NFlex justify="space-between" align="center">
            <div>
              <div style="font-weight: 600;">
                {{ goods.name }}
              </div>
              <div style="font-size: 12px; opacity: 0.7;">
                {{ goods.description }}
              </div>
            </div>
            <NFlex :size="6">
              <NTag type="info" size="small">
                {{ goods.price }} 积分
              </NTag>
              <NTag :type="goods.stock > 0 ? 'success' : 'error'" size="small">
                {{ goods.stock > 0 ? `库存: ${goods.stock}` : '缺货' }}
              </NTag>
            </NFlex>
          </NFlex>
        </NListItem>
      </NList>
    </NCard>

    <NCard title="积分规则" size="small">
      <NAlert v-if="!selectedStreamerId" type="warning" :bordered="false">
        请选择一个主播后再修改积分规则
      </NAlert>
      <PointSettings v-else :org-id="orgId" :streamer-id="selectedStreamerId" />
    </NCard>

    <NCard v-if="auditLogs.length" title="操作审计" size="small">
      <OrgAuditList :logs="auditLogs" />
    </NCard>
  </NFlex>
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
