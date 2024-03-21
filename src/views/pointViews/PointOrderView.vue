<script setup lang="ts">
import { ResponsePointOrder2UserModel } from '@/api/api-models'
import PointOrderCard from '@/components/manage/PointOrderCard.vue'
import { POINT_API_URL } from '@/data/constants'
import { useAuthStore } from '@/store/useAuthStore'
import { NEmpty, NSpin, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'

const message = useMessage()
const useAuth = useAuthStore()

const orders = ref<ResponsePointOrder2UserModel[]>([])
const isLoading = ref(false)

async function getOrders() {
  try {
    isLoading.value = true
    const data = await useAuth.QueryBiliAuthGetAPI<ResponsePointOrder2UserModel[]>(POINT_API_URL + 'user/get-orders')
    if (data.code == 200) {
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

onMounted(async () => {
  orders.value = await getOrders()
})
</script>

<template>
  <NSpin :show="isLoading">
    <NEmpty v-if="orders.length == 0" description="暂无订单" />
    <PointOrderCard v-else :order="orders" :loading="isLoading" type="user" />
  </NSpin>
</template>
