<script setup lang="ts">
import { ResponsePointOrder2UserModel } from '@/api/api-models'
import PointOrderCard from '@/components/manage/PointOrderCard.vue'
import { POINT_API_URL } from '@/data/constants'
import { useAuthStore } from '@/store/useAuthStore'
import { NButton, NEmpty, NFlex, NSpin, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'

const message = useMessage()
const useAuth = useAuthStore()

const orders = ref<ResponsePointOrder2UserModel[]>([])
const isLoading = ref(false)

// 定义加载完成的事件
const emit = defineEmits(['dataLoaded'])

async function getOrders() {
  try {
    isLoading.value = true
    const data = await useAuth.QueryBiliAuthGetAPI<ResponsePointOrder2UserModel[]>(POINT_API_URL + 'user/get-orders')
    if (data.code == 200) {
      orders.value = data.data
      // 触发数据加载完成事件
      emit('dataLoaded')
      return data.data
    } else {
      message.error('获取订单失败: ' + data.message)
    }
  } catch (err) {
    console.log(err)
    message.error('获取订单失败: ' + err)
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
  reset
})

onMounted(async () => {
  orders.value = await getOrders()
})
</script>

<template>
  <NSpin :show="isLoading">
    <NFlex justify="end" style="margin-bottom: 10px">
      <NButton size="small" type="primary" @click="getOrders">刷新订单</NButton>
    </NFlex>
    <NEmpty
      v-if="orders.length == 0"
      description="暂无订单"
    />
    <PointOrderCard
      v-else
      :order="orders"
      :loading="isLoading"
      type="user"
    />
  </NSpin>
</template>
