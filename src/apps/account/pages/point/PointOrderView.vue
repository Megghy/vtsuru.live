<script setup lang="ts">
import { ArrowSync24Regular, Search24Regular } from '@vicons/fluent'
import { NButton, NFlex, NIcon, NInput, NSelect, NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'

import type { ResponsePointOrder2UserModel } from '@/api/api-models'
import { PointOrderStatus } from '@/api/api-models'
import { getApiPointUserGetOrders } from '@/api/generated/point/point'
import AccountDataPanel from '@/apps/account/components/AccountDataPanel.vue'
import AccountPageHeader from '@/apps/account/components/AccountPageHeader.vue'
import UserPointOrderList from '@/apps/account/components/UserPointOrderList.vue'
import { useBiliAuth } from '@/store/useBiliAuth'

const emit = defineEmits<{ dataLoaded: [] }>()
const auth = useBiliAuth()
const message = useMessage()
const orders = ref<ResponsePointOrder2UserModel[]>([])
const loading = ref(false)
const loaded = ref(false)
let generation = 0
let request: { generation: number; promise: Promise<void> } | undefined

const keyword = ref('')
const status = ref<PointOrderStatus | null>(null)

const filteredOrders = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase()
  return orders.value.filter((order) => {
    const matchesStatus = status.value === null || order.status === status.value
    const matchesKeyword =
      !query || order.goods.name.toLocaleLowerCase().includes(query) || String(order.id).includes(query)
    return matchesStatus && matchesKeyword
  })
})

const stats = computed(() => [
  { label: '全部订单', value: orders.value.length },
  {
    label: '待处理',
    value: orders.value.filter((item) => item.status === PointOrderStatus.Pending).length,
    tone: 'warning' as const,
  },
  {
    label: '服务进行中',
    value: orders.value.filter((item) => item.status === PointOrderStatus.InProgress).length,
    tone: 'info' as const,
  },
  {
    label: '已发货',
    value: orders.value.filter((item) => item.status === PointOrderStatus.Shipped).length,
    tone: 'info' as const,
  },
  {
    label: '已完成',
    value: orders.value.filter((item) => item.status === PointOrderStatus.Completed).length,
    tone: 'success' as const,
  },
  {
    label: '消耗积分',
    value: Number(orders.value.reduce((sum, item) => sum + item.point, 0).toFixed(1)),
    tone: 'primary' as const,
  },
])

async function loadOrders(force = false) {
  if (request?.generation === generation) return request.promise
  if (loaded.value && !force) return

  loading.value = true
  const currentGeneration = generation
  const promise = (async () => {
    const result = (await getApiPointUserGetOrders({
      headers: Object.fromEntries(await auth.getBiliAuthHeaders()),
    })) as unknown as {
      code: number
      message?: string
      data: ResponsePointOrder2UserModel[]
    }
    if (result.code !== 200) throw new Error(result.message || '获取订单失败')
    if (currentGeneration !== generation) return
    orders.value = result.data
    loaded.value = true
    emit('dataLoaded')
  })()
  request = { generation: currentGeneration, promise }

  try {
    await promise
  } catch (error) {
    if (currentGeneration === generation) {
      message.error(error instanceof Error ? error.message : `获取订单失败: ${error}`)
    }
  } finally {
    if (request?.promise === promise) {
      request = undefined
      loading.value = false
    }
  }
}

function refresh() {
  void loadOrders(true)
}

function reset() {
  generation += 1
  orders.value = []
  loaded.value = false
  loading.value = false
  keyword.value = ''
  status.value = null
}

defineExpose({ getOrders: loadOrders, reset })

onMounted(() => void loadOrders())
</script>

<template>
  <div class="point-orders-page">
    <AccountPageHeader
      title="我的订单"
      subtitle="查看并跟踪你使用积分兑换的实物礼物与互动服务。"
    >
      <template #actions>
        <NButton
          secondary
          :loading="loading"
          @click="refresh"
        >
          <template #icon><NIcon :component="ArrowSync24Regular" /></template>
          刷新
        </NButton>
      </template>
    </AccountPageHeader>

    <NSpin :show="loading">
      <AccountDataPanel :stats="stats">
        <template #toolbar>
          <div class="order-toolbar">
            <div class="order-filters">
              <NInput
                v-model:value="keyword"
                clearable
                placeholder="搜索礼物名或订单号"
                class="filter-keyword"
              >
                <template #prefix><NIcon :component="Search24Regular" /></template>
              </NInput>
              <NSelect
                v-model:value="status"
                clearable
                :options="[
                  { label: '全部状态', value: null },
                  { label: '待处理', value: PointOrderStatus.Pending },
                  { label: '已发货', value: PointOrderStatus.Shipped },
                  { label: '服务进行中', value: PointOrderStatus.InProgress },
                  { label: '已拒绝', value: PointOrderStatus.Rejected },
                  { label: '已取消', value: PointOrderStatus.Cancelled },
                  { label: '已完成', value: PointOrderStatus.Completed },
                ]"
                placeholder="订单状态"
                class="filter-status"
              />
            </div>

            <div class="order-toolbar__meta">
              <span class="filter-result">显示 {{ filteredOrders.length }} / {{ orders.length }} 条</span>
            </div>
          </div>
        </template>
      </AccountDataPanel>

      <UserPointOrderList :orders="filteredOrders" />
    </NSpin>
  </div>
</template>

<style scoped>
.point-orders-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.order-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}

.order-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1 1 360px;
}

.filter-keyword {
  flex: 1 1 200px;
  min-width: 160px;
}

.filter-status {
  width: 130px;
  flex-shrink: 0;
}

.order-toolbar__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-result {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .order-filters {
    flex-direction: column;
    align-items: stretch;
    width: 100%;
  }

  .filter-keyword,
  .filter-status {
    width: 100% !important;
  }

  .order-toolbar__meta {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
