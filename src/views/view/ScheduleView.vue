<template>
  <NSpin v-if="isLoading" show />
  <component v-else v-bind="$attrs" :is="componentType" :user-info="userInfo" :currentData="currentData" />
</template>

<script lang="ts" setup>
import { ScheduleWeekInfo } from '@/api/api-models'
import DefaultScheduleTemplate from '@/views/view/scheduleTemplate/DefaultScheduleTemplate.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { SCHEDULE_API_URL } from '@/data/constants'
import { NSpin, useMessage } from 'naive-ui'
import PinkySchedule from './scheduleTemplate/PinkySchedule.vue'

const props = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
  template?: string | undefined
  fakeData?: ScheduleWeekInfo[]
}>()

const componentType = computed(() => {
  const type = props.template ?? props.userInfo?.extra?.templateTypes['schedule']?.toLowerCase()
  if (props.userInfo) {
    switch (type?.toLocaleLowerCase()) {
      case 'test':
        return DefaultScheduleTemplate
      case 'pinkyschedule':
        return PinkySchedule
      default:
        return DefaultScheduleTemplate
    }
  } else {
    return DefaultScheduleTemplate
  }
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
      console.error(err)
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
