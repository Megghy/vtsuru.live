<script setup lang="ts">
import { ResponsePointOrder2UserModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import PointOrderCard from '@/components/manage/PointOrderCard.vue'
import { POINT_API_URL } from '@/data/constants'
import { useAuthStore } from '@/store/useAuthStore'
import { NButton, NCard, NEmpty, NList, NListItem, useMessage } from 'naive-ui'
import { h, onMounted, ref } from 'vue'

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
  }
  isLoading.value = false
  return []
}

onMounted(async () => {
  orders.value = await getOrders()
})
</script>

<template>
  <NEmpty v-if="orders.length == 0" description="暂无订单"></NEmpty>
  <PointOrderCard v-else :order="orders" :loading="isLoading" type="user" />
</template>
