<script setup lang="ts">
import { ResponsePointOrder2StreamerModel, ResponsePointUserModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { POINT_API_URL } from '@/data/constants'
import { NCard, NDataTable, NDivider, NFlex, NList, NListItem, NModal, NSpin, useMessage } from 'naive-ui'
import { ref } from 'vue'

const props = defineProps<{
  user: ResponsePointUserModel
}>()

const orders = ref<ResponsePointOrder2StreamerModel[]>(await getOrders())
const pointHistory = ref([])
const isLoading = ref(false)

const message = useMessage()

async function getOrders() {
  try {
    isLoading.value = true
    const data = await QueryGetAPI<ResponsePointOrder2StreamerModel[]>(POINT_API_URL + 'get-user-orders', {
      id: props.user.info?.id,
    })
    if (data.code == 200) {
      return data.data
    } else {
      message.error('获取订单失败: ' + data.message)
      console.error(data)
    }
  } catch (err) {
    message.error('获取订单失败: ' + err)
    console.error(err)
  } finally {
    isLoading.value = false
  }
  return []
}
</script>

<template>
  <NCard :bordered="false">
    <NCard title="用户信息">
      <NFlex>

      </NFlex>
    </NCard>
    <NDivider>
      订单
    </NDivider>
    <NSpin :show="isLoading">
      <NList>
        <NListItem v-for="order in orders" v-bind:key="order.id"> </NListItem>
      </NList>
    </NSpin>
  </NCard>
</template>
