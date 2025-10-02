<script setup lang="ts">
import type { ResponsePointHisrotyModel } from '@/api/api-models'
import { NButton, NEmpty, NFlex, NSelect, NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { PointFrom } from '@/api/api-models'
import PointHistoryCard from '@/components/manage/PointHistoryCard.vue'
import { POINT_API_URL } from '@/data/constants'
import { useBiliAuth } from '@/store/useBiliAuth'

// 定义加载完成的事件
const emit = defineEmits(['dataLoaded'])
const message = useMessage()
const useAuth = useBiliAuth()
const isLoading = ref(false)

const history = ref<ResponsePointHisrotyModel[]>([])
const streamerFilter = ref<string | null>('')

// 获取积分历史记录
async function getHistories() {
  try {
    isLoading.value = true
    const data = await useAuth.QueryBiliAuthGetAPI<ResponsePointHisrotyModel[]>(`${POINT_API_URL}user/get-histories`)
    if (data.code == 200) {
      console.log('[point] 已获取积分历史')
      history.value = data.data
      // 触发数据加载完成事件
      emit('dataLoaded')
      return data.data
    } else {
      message.error(`获取积分历史失败: ${data.message}`)
      console.error(data)
    }
  } catch (err) {
    message.error(`获取积分历史失败: ${err}`)
    console.error(err)
  } finally {
    isLoading.value = false
  }
  return []
}

// 提供给父组件调用的重置方法
function reset() {
  history.value = []
  streamerFilter.value = ''
}

// 暴露方法给父组件
defineExpose({
  getHistories,
  reset,
})

onMounted(async () => {
  history.value = await getHistories()
})

// 根据主播名称筛选历史记录
const filteredHistory = computed(() => {
  if (streamerFilter.value === '' || streamerFilter.value === null) {
    return history.value
  }
  return history.value.filter((item) => {
    // 只筛选主播操作、弹幕来源和签到
    if ([PointFrom.Manual, PointFrom.Danmaku, PointFrom.CheckIn].includes(item.from)) {
      // 精确匹配主播名称
      return item.extra?.user?.name === streamerFilter.value
    }
    // 如果是使用积分的记录，则始终显示
    if (item.from === PointFrom.Use) {
      return true
    }
    // 其他类型的记录，在筛选时隐藏
    return false
  })
})

// 计算可选的主播列表
const streamerOptions = computed(() => {
  const names = new Set<string>()
  history.value.forEach((item) => {
    if ([PointFrom.Manual, PointFrom.Danmaku, PointFrom.CheckIn].includes(item.from) && item.extra?.user?.name) {
      names.add(item.extra.user.name)
    }
  })
  // 添加"全部主播"选项
  const options = [{ label: '全部主播', value: '' }]
  names.forEach((name) => {
    options.push({ label: name, value: name })
  })
  return options
})
</script>

<template>
  <NSpin :show="isLoading">
    <NFlex
      justify="end"
      align="center"
      style="margin-bottom: 10px"
    >
      <NSelect
        v-model:value="streamerFilter"
        :options="streamerOptions"
        placeholder="按主播筛选"
        clearable
        size="small"
        style="max-width: 200px; margin-right: 10px"
      />
      <NButton
        size="small"
        type="primary"
        @click="getHistories"
      >
        刷新记录
      </NButton>
    </NFlex>
    <NEmpty
      v-if="filteredHistory.length == 0"
      description="暂无符合条件的积分记录"
    />
    <PointHistoryCard
      v-else
      :histories="filteredHistory"
    />
  </NSpin>
</template>
