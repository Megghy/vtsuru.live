<template>
  <NSpin v-if="isLoading" show />
  <component
    v-else
    :is="ScheduleTemplateMap[componentType ?? ''].compoent"
    :bili-info="biliInfo"
    :user-info="userInfo"
    :data="currentData"
    v-bind="$attrs"
  />
</template>

<script lang="ts" setup>
import { ScheduleWeekInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { SCHEDULE_API_URL, ScheduleTemplateMap } from '@/data/constants'
import { NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
  template?: string | undefined
  fakeData?: ScheduleWeekInfo[]
}>()

const componentType = computed(() => {
  return props.template ?? props.userInfo?.extra?.templateTypes['schedule']?.toLowerCase()
})
const currentData = ref<ScheduleWeekInfo[]>()
const isLoading = ref(true)
const message = useMessage()

const errMessage = ref('')

async function get() {
  isLoading.value = true
  await QueryGetAPI<ScheduleWeekInfo[]>(SCHEDULE_API_URL + 'get', {
    id: props.userInfo?.id,
  })
    .then((data) => {
      if (data.code == 200) {
        currentData.value = data.data
      } else {
        errMessage.value = data.message
        message.error('加载失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('加载失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}

onMounted(async () => {
  if (!props.fakeData) {
    await get()
  } else {
    currentData.value = props.fakeData
    isLoading.value = false
  }
})
</script>
