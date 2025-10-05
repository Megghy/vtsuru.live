<script setup lang="ts">
import type { ResponsePointOrder2UserModel } from '@/api/api-models'
import { NButton, NCard, NDataTable, NEmpty, NFlex, NSelect, NSpin, NTag, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { PointOrderStatus } from '@/api/api-models'
import PointOrderCard from '@/components/manage/PointOrderCard.vue'
import { POINT_API_URL } from '@/data/constants'
import { useBiliAuth } from '@/store/useBiliAuth'

// 定义加载完成的事件
const emit = defineEmits(['dataLoaded'])
const message = useMessage()
const useAuth = useBiliAuth()

const orders = ref<ResponsePointOrder2UserModel[]>([])
const isLoading = ref(false)

// 筛选状态
const statusFilter = ref<PointOrderStatus | null>(null)
const searchKeyword = ref('')

// 筛选后的订单
const filteredOrders = computed(() => {
  let result = orders.value

  // 状态筛选
  if (statusFilter.value !== null) {
    result = result.filter(order => order.status === statusFilter.value)
  }

  // 搜索关键词筛选
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    result = result.filter(order =>
      order.goods?.name.toLowerCase().includes(keyword)
      || order.id.toString().includes(keyword),
    )
  }

  return result
})

// 订单统计
const orderStats = computed(() => {
  return {
    total: orders.value.length,
    pending: orders.value.filter(o => o.status === PointOrderStatus.Pending).length,
    shipped: orders.value.filter(o => o.status === PointOrderStatus.Shipped).length,
    completed: orders.value.filter(o => o.status === PointOrderStatus.Completed).length,
    totalPoints: orders.value.reduce((sum, o) => sum + o.point, 0),
  }
})

async function getOrders() {
  try {
    isLoading.value = true
    const data = await useAuth.QueryBiliAuthGetAPI<ResponsePointOrder2UserModel[]>(`${POINT_API_URL}user/get-orders`)
    if (data.code == 200) {
      orders.value = data.data
      // 触发数据加载完成事件
      emit('dataLoaded')
      return data.data
    } else {
      message.error(`获取订单失败: ${data.message}`)
    }
  } catch (err) {
    console.log(err)
    message.error(`获取订单失败: ${err}`)
  } finally {
    isLoading.value = false
  }
  return []
}

// 提供给父组件调用的重置方法
function reset() {
  orders.value = []
}

// 暴露方法给父组件
defineExpose({
  getOrders,
  reset,
})

onMounted(async () => {
  orders.value = await getOrders()
})
</script>

<template>
  <NSpin :show="isLoading">
    <!-- 统计卡片 -->
    <NCard
      size="small"
      :bordered="false"
      style="margin-bottom: 16px"
    >
      <NFlex
        justify="space-around"
        wrap
        :gap="16"
      >
        <div class="stat-item">
          <div class="stat-value">
            {{ orderStats.total }}
          </div>
          <div class="stat-label">
            总订单
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-value warning">
            {{ orderStats.pending }}
          </div>
          <div class="stat-label">
            待发货
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-value info">
            {{ orderStats.shipped }}
          </div>
          <div class="stat-label">
            已发货
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-value success">
            {{ orderStats.completed }}
          </div>
          <div class="stat-label">
            已完成
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-value primary">
            {{ orderStats.totalPoints }}
          </div>
          <div class="stat-label">
            总积分
          </div>
        </div>
      </NFlex>
    </NCard>

    <!-- 筛选和搜索 -->
    <NFlex
      justify="space-between"
      align="center"
      style="margin-bottom: 12px"
      wrap
      :gap="12"
    >
      <NFlex
        :gap="12"
        wrap
      >
        <NSelect
          v-model:value="statusFilter"
          :options="[
            { label: '全部状态', value: null as any },
            { label: '待发货', value: PointOrderStatus.Pending },
            { label: '已发货', value: PointOrderStatus.Shipped },
            { label: '已完成', value: PointOrderStatus.Completed },
          ]"
          style="width: 120px"
          size="small"
        />
      </NFlex>
      <NButton
        size="small"
        type="primary"
        @click="getOrders"
      >
        刷新订单
      </NButton>
    </NFlex>

    <NEmpty
      v-if="filteredOrders.length === 0"
      description="暂无订单"
    />
    <PointOrderCard
      v-else
      :order="filteredOrders"
      :loading="isLoading"
      type="user"
    />
  </NSpin>
</template>

<style scoped>
.stat-item {
  text-align: center;
  min-width: 80px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-color-1);
  margin-bottom: 4px;
}

.stat-value.primary {
  color: var(--primary-color);
}

.stat-value.success {
  color: var(--success-color);
}

.stat-value.info {
  color: var(--info-color);
}

.stat-value.warning {
  color: var(--warning-color);
}

.stat-label {
  font-size: 12px;
  color: var(--text-color-3);
}
</style>
