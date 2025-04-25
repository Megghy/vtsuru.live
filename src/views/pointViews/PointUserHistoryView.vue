<script setup lang="ts">
import { ResponsePointHisrotyModel } from '@/api/api-models'
import PointHistoryCard from '@/components/manage/PointHistoryCard.vue'
import { POINT_API_URL } from '@/data/constants'
import { useAuthStore } from '@/store/useAuthStore'
import { NButton, NEmpty, NFlex, NSpin, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'

const message = useMessage()
const useAuth = useAuthStore()
const isLoading = ref(false)

const history = ref<ResponsePointHisrotyModel[]>([])

// 定义加载完成的事件
const emit = defineEmits(['dataLoaded'])

// 获取积分历史记录
async function getHistories() {
  try {
    isLoading.value = true
    const data = await useAuth.QueryBiliAuthGetAPI<ResponsePointHisrotyModel[]>(POINT_API_URL + 'user/get-histories')
    if (data.code == 200) {
      console.log('[point] 已获取积分历史')
      history.value = data.data
      // 触发数据加载完成事件
      emit('dataLoaded')
      return data.data
    } else {
      message.error('获取积分历史失败: ' + data.message)
      console.error(data)
    }
  } catch (err) {
    message.error('获取积分历史失败: ' + err)
    console.error(err)
  } finally {
    isLoading.value = false
  }
  return []
}

// 提供给父组件调用的重置方法
function reset() {
  history.value = []
}

// 暴露方法给父组件
defineExpose({
  getHistories,
  reset
})

onMounted(async () => {
  history.value = await getHistories()
})
</script>

<template>
  <NSpin :show="isLoading">
    <NFlex justify="end" style="margin-bottom: 10px">
      <NButton size="small" type="primary" @click="getHistories">刷新记录</NButton>
    </NFlex>
    <NEmpty
      v-if="history.length == 0"
      description="暂无积分记录"
    />
    <PointHistoryCard
      v-else
      :histories="history"
    />
  </NSpin>
</template>
