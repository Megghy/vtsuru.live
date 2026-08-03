<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { QueryGetAPI, unwrapOk } from '@/api/query'
import PointSettings from '@/shared/components/points/PointSettings.vue'
import { ORG_API_URL } from '@/shared/config'

import { useOrgContext } from '../composables/useOrgContext'
import { injectOrgStreamers } from '../composables/useOrgStreamers'
import OrgAuditList from './OrgAuditList.vue'

const { orgId } = useOrgContext()
const { options: streamerOptions } = injectOrgStreamers()
const toast = useToast()

const isLoading = ref(true)
const pointStats = ref<Record<string, number> | null>(null)
const pointGoods = ref<{ id: number; name: string; description?: string; price: number; stock: number }[]>([])
const auditLogs = ref<
  { id: number; action: string; detail: string; createdAt: number; userId: number; userName?: string }[]
>([])
const selectedStreamerId = ref<number | null>(null)

const statItems = computed(() => {
  const s = pointStats.value
  return [
    { label: '总发放积分', value: s?.totalPointsIssued ?? 0, icon: 'i-lucide-circle-dollar-sign' },
    { label: '总使用积分', value: s?.totalPointsUsed ?? 0, icon: 'i-lucide-gift' },
    { label: '活跃用户', value: s?.activeUsers ?? 0, icon: 'i-lucide-users' },
    { label: '总订单数', value: s?.totalOrders ?? 0, icon: 'i-lucide-store' },
  ]
})

const orderItems = computed(() => {
  const s = pointStats.value
  return [
    { label: '待处理订单', value: s?.pendingOrders ?? 0, icon: 'i-lucide-clock-3', color: 'warning' },
    { label: '已发货订单', value: s?.shippedOrders ?? 0, icon: 'i-lucide-package-check', color: 'info' },
    { label: '已完成订单', value: s?.completedOrders ?? 0, icon: 'i-lucide-circle-check-big', color: 'success' },
  ]
})

async function loadData() {
  if (!orgId.value) return
  isLoading.value = true
  const streamerParam = selectedStreamerId.value ? { streamerId: selectedStreamerId.value } : undefined
  try {
    pointStats.value = unwrapOk(
      await QueryGetAPI(`${ORG_API_URL}${orgId.value}/points/stats`, streamerParam),
      '加载积分统计失败',
    )
    pointGoods.value = unwrapOk(
      await QueryGetAPI(`${ORG_API_URL}${orgId.value}/points/goods`, streamerParam),
      '加载积分商品失败',
    )
    auditLogs.value = unwrapOk(
      await QueryGetAPI(`${ORG_API_URL}${orgId.value}/points/audit`, { take: 100 }),
      '加载操作审计失败',
    )
  } catch (err) {
    toast.add({ title: err instanceof Error ? err.message : '加载失败', color: 'error' })
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await loadData()
})
</script>

<template>
  <div class="point-manage">
    <UCard>
      <template #header><h2 class="text-sm font-semibold">主播</h2></template>
      <USelectMenu
        v-model="selectedStreamerId"
        :items="streamerOptions"
        value-key="value"
        placeholder="选择主播后，可单独查看/修改积分规则与筛选统计"
        @update:model-value="loadData"
      />
    </UCard>

    <div class="stat-grid stat-grid--four">
      <UCard
        v-for="item in statItems"
        :key="item.label"
      >
        <div class="stat-card">
          <UIcon
            :name="item.icon"
            class="stat-card__icon"
          />
          <span>{{ item.label }}</span>
          <strong>{{ item.value.toLocaleString() }}</strong>
        </div>
      </UCard>
    </div>

    <div class="stat-grid stat-grid--three">
      <UCard
        v-for="item in orderItems"
        :key="item.label"
      >
        <div
          class="stat-card"
          :class="`stat-card--${item.color}`"
        >
          <UIcon
            :name="item.icon"
            class="stat-card__icon"
          />
          <span>{{ item.label }}</span>
          <strong>{{ item.value.toLocaleString() }}</strong>
        </div>
      </UCard>
    </div>

    <div>
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-refresh-cw"
        :loading="isLoading"
        @click="loadData"
      >
        刷新
      </UButton>
    </div>

    <div
      v-if="isLoading"
      class="loading-state"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-5 animate-spin"
      />
    </div>
    <UEmpty
      v-else-if="!pointStats && !pointGoods.length"
      description="暂无积分数据"
    />

    <UCard v-if="pointGoods.length > 0">
      <template #header><h2 class="text-sm font-semibold">积分商品</h2></template>
      <div class="goods-list">
        <div
          v-for="goods in pointGoods.slice(0, 5)"
          :key="goods.id"
          class="goods-item"
        >
          <div>
            <strong>{{ goods.name }}</strong>
            <p>{{ goods.description }}</p>
          </div>
          <div class="flex gap-2">
            <UBadge
              color="info"
              variant="soft"
              >{{ goods.price }} 积分</UBadge
            >
            <UBadge
              :color="goods.stock > 0 ? 'success' : 'error'"
              variant="soft"
              >{{ goods.stock > 0 ? `库存: ${goods.stock}` : '缺货' }}</UBadge
            >
          </div>
        </div>
      </div>
    </UCard>

    <UCard>
      <template #header><h2 class="text-sm font-semibold">积分规则</h2></template>
      <UAlert
        v-if="!selectedStreamerId"
        color="warning"
        title="请选择一个主播后再修改积分规则"
      >
      </UAlert>
      <PointSettings
        v-else
        :org-id="orgId"
        :streamer-id="selectedStreamerId"
      />
    </UCard>

    <UCard v-if="auditLogs.length">
      <template #header><h2 class="text-sm font-semibold">操作审计</h2></template>
      <OrgAuditList :logs="auditLogs" />
    </UCard>
  </div>
</template>

<style scoped>
.point-manage {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stat-grid {
  display: grid;
  gap: 12px;
}

.stat-grid--four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.stat-grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.stat-card {
  display: grid;
  gap: 4px;
  color: var(--vtsuru-fg-muted);
}
.stat-card strong {
  color: var(--vtsuru-fg);
  font-size: 1.5rem;
}
.stat-card__icon {
  color: var(--vtsuru-primary);
  font-size: 1.25rem;
}
.stat-card--warning strong {
  color: var(--vtsuru-warning);
}
.stat-card--info strong {
  color: var(--vtsuru-info);
}
.stat-card--success strong {
  color: var(--vtsuru-success);
}
.loading-state {
  display: flex;
  min-height: 160px;
  align-items: center;
  justify-content: center;
}
.goods-list {
  display: flex;
  flex-direction: column;
}
.goods-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--vtsuru-border);
}
.goods-item:last-child {
  border-bottom: 0;
}
.goods-item p {
  margin: 4px 0 0;
  color: var(--vtsuru-fg-muted);
  font-size: 0.8125rem;
}

@media (max-width: 800px) {
  .stat-grid--four,
  .stat-grid--three {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .goods-item {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
