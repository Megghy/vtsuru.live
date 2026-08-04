<script setup lang="ts">
import { NSpin, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { DownloadConfig } from '@/api/account'
import type { ScheduleWeekInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import ScheduleSubscription from '@/components/ScheduleSubscription.vue'
import { SCHEDULE_API_URL } from '@/shared/config'
import { ScheduleTemplateMap } from '@/shared/config/templates'

const props = defineProps<{
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
  template?: string
  fakeData?: ScheduleWeekInfo[]
}>()

const message = useMessage()
const currentData = ref<ScheduleWeekInfo[]>([])
const currentConfig = ref<Record<string, unknown>>({})
const loadingData = ref(true)
const loadingConfig = ref(true)

const componentType = computed(
  () => props.template ?? props.userInfo?.extra?.templateTypes.schedule?.toLowerCase() ?? '',
)
const selectedTemplate = computed(() => ScheduleTemplateMap[componentType.value] ?? ScheduleTemplateMap[''])
const isLoading = computed(() => loadingData.value || loadingConfig.value)

async function loadSchedule() {
  if (props.fakeData) {
    currentData.value = props.fakeData
    loadingData.value = false
    return
  }

  const userId = props.userInfo?.id
  if (!userId) {
    currentData.value = []
    loadingData.value = false
    return
  }

  loadingData.value = true
  try {
    const response = await QueryGetAPI<ScheduleWeekInfo[]>(`${SCHEDULE_API_URL}get`, { id: userId })
    if (response.code !== 200) throw new Error(response.message)
    currentData.value = response.data ?? []
  } catch (error) {
    console.error('加载日程失败', error)
    message.error('日程加载失败')
  } finally {
    loadingData.value = false
  }
}

async function loadTemplateConfig() {
  const settingName = selectedTemplate.value.settingName
  const userId = props.userInfo?.id
  if (!settingName || !userId) {
    currentConfig.value = {}
    loadingConfig.value = false
    return
  }

  loadingConfig.value = true
  const result = await DownloadConfig<Record<string, unknown>>(settingName, userId)
  currentConfig.value = result.data ?? {}
  if (result.status === 'error') message.warning('日程模板配置加载失败，已使用模板默认样式')
  loadingConfig.value = false
}

watch(() => [props.userInfo?.id, props.fakeData] as const, loadSchedule, { immediate: true })
watch(() => [props.userInfo?.id, selectedTemplate.value.settingName] as const, loadTemplateConfig, { immediate: true })
</script>

<template>
  <NSpin
    v-if="isLoading"
    show
  />
  <div
    v-else
    class="schedule-page"
  >
    <component
      :is="selectedTemplate.component"
      :bili-info="biliInfo"
      :user-info="userInfo"
      :data="currentData"
      v-bind="selectedTemplate.settingName ? { config: currentConfig } : {}"
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
  min-width: 0;
}
</style>
