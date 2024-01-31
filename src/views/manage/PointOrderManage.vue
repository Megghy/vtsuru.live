<script setup lang="ts">
import { PointOrderModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { POINT_API_URL } from '@/data/constants'
import { useMessage } from 'naive-ui'
import { ref } from 'vue'

const message = useMessage()

const orders = ref<PointOrderModel[]>(await getOrders())

async function getOrders() {
  try {
    const data = await QueryGetAPI<PointOrderModel[]>(POINT_API_URL + 'get-orders')
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
</script>

<template></template>
