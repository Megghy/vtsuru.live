<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'

import type { ScheduleWeekInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import ScheduleSubscription from '@/components/ScheduleSubscription.vue'
import { SCHEDULE_API_URL } from '@/shared/config'
import { ScheduleTemplateMap } from '@/shared/config/templates'

const props = defineProps<{
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
  template?: string | undefined
  fakeData?: ScheduleWeekInfo[]
}>()

const componentType = computed(() => {
  return props.template ?? props.userInfo?.extra?.templateTypes.schedule?.toLowerCase()
})
const currentData = ref<ScheduleWeekInfo[]>()
const isLoading = ref(true)
const toast = useToast()

async function get() {
  isLoading.value = true
  await QueryGetAPI<ScheduleWeekInfo[]>(`${SCHEDULE_API_URL}get`, {
    id: props.userInfo?.id,
  })
    .then((data) => {
      if (data.code == 200) {
        currentData.value = data.data
      } else {
        toast.add({ title: `加载失败: ${data.message}`, color: 'error' })
      }
    })
    .catch((err) => {
      console.error(err)
      toast.add({ title: '加载失败', color: 'error' })
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

<template>
  <div
    v-if="isLoading"
    show
  />
  <div
    v-else
    class="schedule-page"
  >
    <component
      :is="ScheduleTemplateMap[componentType ?? ''].component"
      :bili-info="biliInfo"
      :user-info="userInfo"
      :data="currentData"
    />
    <ScheduleSubscription
      v-if="userInfo?.id"
      :url="`${SCHEDULE_API_URL}${userInfo.id}.ics`"
    />
  </div>
</template>

<style scoped>
.schedule-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--vtsuru-page-spacing);
}
</style>
