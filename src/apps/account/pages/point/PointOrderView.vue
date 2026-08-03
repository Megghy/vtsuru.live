<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import type { ResponsePointOrder2UserModel } from '@/api/api-models'
import { PointOrderStatus } from '@/api/api-models'
import AccountDataPanel from '@/apps/account/components/AccountDataPanel.vue'
import UserPointOrderList from '@/apps/account/components/UserPointOrderList.vue'
import { POINT_API_URL } from '@/shared/config'
import { useBiliAuth } from '@/store/useBiliAuth'

const emit = defineEmits<{ dataLoaded: [] }>()
const auth = useBiliAuth()
const toast = useToast()
const orders = ref<ResponsePointOrder2UserModel[]>([])
const loading = ref(false)
const loaded = ref(false)
let generation = 0
let request: { generation: number; promise: Promise<void> } | undefined

const keyword = ref('')
const status = ref<PointOrderStatus | null>(null)
const statusOptions = [
  { label: '待发货', value: PointOrderStatus.Pending },
  { label: '已发货', value: PointOrderStatus.Shipped },
  { label: '已完成', value: PointOrderStatus.Completed },
]

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
    label: '待发货',
    value: orders.value.filter((item) => item.status === PointOrderStatus.Pending).length,
    tone: 'warning' as const,
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
    const result = await auth.QueryBiliAuthGetAPI<ResponsePointOrder2UserModel[]>(`${POINT_API_URL}user/get-orders`)
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
      toast.add({ title: error instanceof Error ? error.message : `获取订单失败: ${error}`, color: 'error' })
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
  <div :aria-busy="loading">
    <AccountDataPanel :stats="stats">
      <template #toolbar>
        <div class="order-toolbar">
          <div class="order-filters">
            <UInput
              v-model="keyword"
              class="order-filter-control"
              icon="i-lucide-search"
              placeholder="搜索礼物名或订单号"
            >
              <template #trailing>
                <UButton
                  v-if="keyword"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  square
                  icon="i-lucide-x"
                  aria-label="清除搜索"
                  @click="keyword = ''"
                />
              </template>
            </UInput>
            <USelectMenu
              v-model="status"
              class="order-filter-control"
              :items="statusOptions"
              value-key="value"
              clear
              placeholder="全部状态"
            />
            <span class="filter-result">显示 {{ filteredOrders.length }} / {{ orders.length }} 条</span>
          </div>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            @click="refresh"
          >
            刷新
          </UButton>
        </div>
      </template>
    </AccountDataPanel>

    <UEmpty
      v-if="loading"
      loading
      title="正在加载订单"
    />
    <UserPointOrderList
      v-else
      :orders="filteredOrders"
    />
  </div>
</template>

<style scoped>
.order-toolbar,
.order-filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.order-toolbar {
  justify-content: space-between;
  flex-wrap: wrap;
}

.order-filters {
  flex-wrap: wrap;
}

.order-filter-control:first-child {
  width: 240px;
}

.order-filter-control:nth-child(2) {
  width: 140px;
}

.filter-result {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

@media (max-width: 600px) {
  .order-filters,
  .order-filter-control {
    width: 100% !important;
  }
}
</style>
