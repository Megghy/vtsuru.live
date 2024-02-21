<script setup lang="ts">
import { ResponsePointHisrotyModel } from '@/api/api-models'
import PointHistoryCard from '@/components/manage/PointHistoryCard.vue'
import { POINT_API_URL } from '@/data/constants'
import { useAuthStore } from '@/store/useAuthStore'
import { useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'

const message = useMessage()
const useAuth = useAuthStore()
const isLoading = ref(false)

const history = ref<ResponsePointHisrotyModel[]>([])

async function getHistories() {
  try {
    isLoading.value = true
    const data = await useAuth.QueryBiliAuthGetAPI<ResponsePointHisrotyModel[]>(POINT_API_URL + 'user/get-histories')
    if (data.code == 200) {
      console.log('[point] 已获取积分历史')
      return data.data
    } else {
      message.error('获取积分历史失败: ' + data.message)
      console.error(data)
    }
  } catch (err) {
    message.error('获取积分历史失败: ' + err)
    console.error(err)
  }
  return []
}

onMounted(async () => {
  history.value = await getHistories()
})
</script>

<template>
  <PointHistoryCard :histories="history" />
</template>
