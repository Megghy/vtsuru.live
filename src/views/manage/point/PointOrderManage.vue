<script setup lang="ts">
import { ResponsePointGoodModel, ResponsePointOrder2OwnerModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import PointOrderCard from '@/components/manage/PointOrderCard.vue'
import { POINT_API_URL } from '@/data/constants'
import { NEmpty, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'

const props = defineProps<{
  goods: ResponsePointGoodModel[]
}>()

const message = useMessage()

const orders = ref<ResponsePointOrder2OwnerModel[]>([])

async function getOrders() {
  try {
    const data = await QueryGetAPI<ResponsePointOrder2OwnerModel[]>(POINT_API_URL + 'get-orders')
    if (data.code == 200) {
      return data.data
    } else {
      message.error('获取订单失败: ' + data.message)
    }
  } catch (err) {
    console.log(err)
    message.error('获取订单失败: ' + err)
  }
  return []
}

onMounted(async () => {
  orders.value = await getOrders()
})
</script>

<template>
  <NEmpty v-if="orders.length == 0" description="暂无订单"></NEmpty>
  <PointOrderCard v-else :order="orders" :goods="goods" type="owner" />
</template>
