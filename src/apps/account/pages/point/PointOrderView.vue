<script setup lang="ts">
import { ArrowSync24Regular, Search24Regular } from '@vicons/fluent'
import { NButton, NFlex, NIcon, NInput, NSelect, NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'

import type { ResponsePointOrder2UserModel } from '@/api/api-models'
import { PointOrderStatus } from '@/api/api-models'
import AccountDataPanel from '@/apps/account/components/AccountDataPanel.vue'
import UserPointOrderList from '@/apps/account/components/UserPointOrderList.vue'
import { POINT_API_URL } from '@/shared/config'
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
  <NSpin :show="loading">
    <AccountDataPanel :stats="stats">
      <template #toolbar>
        <NFlex
          align="center"
          justify="space-between"
          wrap
          :gap="8"
        >
          <NFlex
            class="order-filters"
            align="center"
            wrap
            :gap="8"
          >
            <NInput
              v-model:value="keyword"
              clearable
              placeholder="搜索礼物名或订单号"
              style="width: 240px"
            >
              <template #prefix><NIcon :component="Search24Regular" /></template>
            </NInput>
            <NSelect
              v-model:value="status"
              clearable
              :options="[
                { label: '全部状态', value: null },
                { label: '待发货', value: PointOrderStatus.Pending },
                { label: '已发货', value: PointOrderStatus.Shipped },
                { label: '已完成', value: PointOrderStatus.Completed },
              ]"
              placeholder="订单状态"
              style="width: 140px"
            />
            <span class="filter-result">显示 {{ filteredOrders.length }} / {{ orders.length }} 条</span>
          </NFlex>
          <NButton
            secondary
            @click="refresh"
          >
            <template #icon><NIcon :component="ArrowSync24Regular" /></template>
            刷新
          </NButton>
        </NFlex>
      </template>
    </AccountDataPanel>

    <UserPointOrderList :orders="filteredOrders" />
  </NSpin>
</template>

<style scoped>
.filter-result {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

@media (max-width: 600px) {
  .order-filters {
    width: 100%;
  }

  .order-filters :deep(.n-input),
  .order-filters :deep(.n-select) {
    width: 100% !important;
  }
}
</style>
