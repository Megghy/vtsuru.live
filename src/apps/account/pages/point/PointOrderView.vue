<script setup lang="ts">
import type { ResponsePointOrder2UserModel } from '@/api/api-models'
import { ArrowSync24Regular } from '@vicons/fluent'
import { NButton, NEmpty, NFlex, NGrid, NIcon, NSelect, NSpin, useMessage } from 'naive-ui';
import { computed, onMounted, ref } from 'vue'
import { PointOrderStatus } from '@/api/api-models'
import PointOrderCard from '@/shared/components/points/PointOrderCard.vue'
import { POINT_API_URL } from '@/shared/config'
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
  const totalPoints = orders.value.reduce((sum, o) => sum + o.point, 0)
  return {
    total: orders.value.length,
    pending: orders.value.filter(o => o.status === PointOrderStatus.Pending).length,
    shipped: orders.value.filter(o => o.status === PointOrderStatus.Shipped).length,
    completed: orders.value.filter(o => o.status === PointOrderStatus.Completed).length,
    totalPoints: Number(totalPoints.toFixed(1)),
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
    <NGrid
      cols="2 600:3 900:5"
      :x-gap="12"
      :y-gap="12"
      style="margin-bottom: 16px"
    >
      <div class="stat-card">
        <div class="stat-label">
          总订单
        </div>
        <div class="stat-value">
          {{ orderStats.total }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          待发货
        </div>
        <div class="stat-value warning">
          {{ orderStats.pending }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          已发货
        </div>
        <div class="stat-value info">
          {{ orderStats.shipped }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          已完成
        </div>
        <div class="stat-value success">
          {{ orderStats.completed }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          总消耗积分
        </div>
        <div class="stat-value primary">
          {{ orderStats.totalPoints }}
        </div>
      </div>
    </NGrid>

    <!-- 工具栏 -->
    <div class="toolbar-section">
      <NFlex justify="space-between" align="center" wrap :gap="12">
        <NFlex align="center" :gap="12">
          <NSelect
            v-model:value="statusFilter"
            :options="[
              { label: '全部状态', value: null as any },
              { label: '待发货', value: PointOrderStatus.Pending },
              { label: '已发货', value: PointOrderStatus.Shipped },
              { label: '已完成', value: PointOrderStatus.Completed },
            ]"
            style="width: 140px"
            placeholder="订单状态"
            clearable
            size="medium"
          />
        </NFlex>

        <NFlex align="center" :gap="8">
          <NButton secondary size="medium" @click="getOrders">
            <template #icon>
              <NIcon :component="ArrowSync24Regular" />
            </template>
            刷新
          </NButton>
        </NFlex>
      </NFlex>
    </div>

    <div style="margin-top: 16px;" />

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
.stat-card {
  background-color: var(--n-card-color);
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.3s var(--n-bezier);
}

.stat-card:hover {
  border-color: var(--n-primary-color);
  box-shadow: 0 0 0 1px var(--n-primary-color) inset;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--n-text-color);
}

.stat-label {
  font-size: 13px;
  color: var(--n-text-color-3);
}

.stat-value.primary { color: var(--n-primary-color); }
.stat-value.success { color: var(--n-success-color); }
.stat-value.info { color: var(--n-info-color); }
.stat-value.warning { color: var(--n-warning-color); }

.toolbar-section {
  background-color: var(--n-card-color);
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  padding: 12px 16px;
}

@media (max-width: 768px) {
  .stat-value {
    font-size: 20px;
  }
}
</style>
