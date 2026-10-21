<script setup lang="ts">
import { ArrowSync24Regular, Search24Regular } from '@vicons/fluent'
import { computed, onMounted, ref } from 'vue'

import type { ResponsePointOrder2UserModel } from '@/api/api-models'
import { PointOrderStatus } from '@/api/api-models'
import { getApiPointUserGetOrders } from '@/api/generated/point/point'
import AccountDataPanel from '@/apps/account/components/AccountDataPanel.vue'
import AccountPageHeader from '@/apps/account/components/AccountPageHeader.vue'
import UserPointOrderList from '@/apps/account/components/UserPointOrderList.vue'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { toast } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

const emit = defineEmits<{ dataLoaded: [] }>()
const auth = useBiliAuth()
const orders = ref<ResponsePointOrder2UserModel[]>([])
const loading = ref(false)
const loaded = ref(false)
let generation = 0
let request: { generation: number; promise: Promise<void> } | undefined

const keyword = ref('')
const status = ref<string>('all')

const filteredOrders = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase()
  const statusNum = status.value === 'all' ? null : Number(status.value)
  return orders.value.filter((order) => {
    const matchesStatus = statusNum === null || order.status === statusNum
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
      toast.error(error instanceof Error ? error.message : `获取订单失败: ${error}`)
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
  status.value = 'all'
}

defineExpose({ getOrders: loadOrders, reset })

onMounted(() => void loadOrders())
</script>

<template>
  <div class="point-orders-page flex flex-col gap-4">
    <AccountPageHeader
      title="我的订单"
      subtitle="查看并跟踪你使用积分兑换的实物礼物与互动服务。"
    >
      <template #actions>
        <Button
          variant="outline"
          :disabled="loading"
          class="flex items-center gap-1.5"
          @click="refresh"
        >
          <component :is="ArrowSync24Regular" class="size-4" :class="{ 'animate-spin': loading }" />
          刷新
        </Button>
      </template>
    </AccountPageHeader>

    <div v-if="loading" class="py-16 flex justify-center">
      <Spin />
    </div>

    <template v-else>
      <AccountDataPanel :stats="stats">
        <template #toolbar>
          <div class="order-toolbar flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/20 border-b border-border/60 text-xs">
            <div class="order-filters flex flex-wrap items-center gap-2">
              <div class="relative w-48">
                <component :is="Search24Regular" class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  v-model="keyword"
                  placeholder="搜索礼物名或订单号"
                  class="h-8 pl-8 text-xs"
                />
              </div>

              <Select v-model="status">
                <SelectTrigger class="w-36 h-8 text-xs">
                  <SelectValue placeholder="订单状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" class="text-xs">全部状态</SelectItem>
                  <SelectItem :value="String(PointOrderStatus.Pending)" class="text-xs">待处理</SelectItem>
                  <SelectItem :value="String(PointOrderStatus.Shipped)" class="text-xs">已发货</SelectItem>
                  <SelectItem :value="String(PointOrderStatus.InProgress)" class="text-xs">服务进行中</SelectItem>
                  <SelectItem :value="String(PointOrderStatus.Rejected)" class="text-xs">已拒绝</SelectItem>
                  <SelectItem :value="String(PointOrderStatus.Cancelled)" class="text-xs">已取消</SelectItem>
                  <SelectItem :value="String(PointOrderStatus.Completed)" class="text-xs">已完成</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="order-toolbar__meta">
              <span class="filter-result text-xs text-muted-foreground font-mono">
                显示 {{ filteredOrders.length }} / {{ orders.length }} 条
              </span>
            </div>
          </div>
        </template>
      </AccountDataPanel>

      <UserPointOrderList :orders="filteredOrders" />
    </template>
  </div>
</template>

<style scoped>
.point-orders-page {
  width: 100%;
}
</style>
