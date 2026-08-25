<script setup lang="ts">
import { NSpin, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { DownloadConfig } from '@/api/account'
import type { BiliLiveReserveModel, ScheduleWeekInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import type { BiliProfile } from '@/apps/user-page/types'
import BiliLiveReservePanel from '@/components/BiliLiveReservePanel.vue'
import ScheduleSubscription from '@/components/ScheduleSubscription.vue'
import { SCHEDULE_API_URL } from '@/shared/config'
import { ScheduleTemplateMap } from '@/shared/config/templates'
import { mergeBiliReservesIntoWeeks } from '@/apps/user/pages/scheduleTemplate/scheduleTemplateUtils'

const props = defineProps<{
  biliInfo: BiliProfile | undefined
  userInfo: UserInfo | undefined
  template?: string
  fakeData?: ScheduleWeekInfo[]
}>()

const message = useMessage()
const currentData = ref<ScheduleWeekInfo[]>([])
const currentConfig = ref<Record<string, unknown>>({})
const loadingData = ref(true)
const loadingConfig = ref(true)
const biliReserve = ref<BiliLiveReserveModel>({
  items: [],
  fetchedAt: 0,
  intervalMinutes: 15,
  syncEnabled: false,
})
const liveRoomUrl = computed(() =>
  props.userInfo?.biliRoomId ? `https://live.bilibili.com/${props.userInfo.biliRoomId}` : undefined,
)
const displayData = computed(() =>
  biliReserve.value.syncEnabled
    ? mergeBiliReservesIntoWeeks(currentData.value, biliReserve.value.items)
    : currentData.value,
)

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

async function loadBiliReserve() {
  if (props.fakeData || !props.userInfo?.id) {
    biliReserve.value = { items: [], fetchedAt: 0, intervalMinutes: 15, syncEnabled: false }
    return
  }
  try {
    const response = await QueryGetAPI<BiliLiveReserveModel>(`${SCHEDULE_API_URL}bili-reserve`, {
      id: props.userInfo.id,
    })
    if (response.code === 200 && response.data) biliReserve.value = response.data
  } catch (error) {
    console.error('加载 B 站预约失败', error)
  }
}

watch(() => [props.userInfo?.id, props.fakeData] as const, loadSchedule, { immediate: true })
watch(() => [props.userInfo?.id, props.fakeData] as const, loadBiliReserve, { immediate: true })
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
    <BiliLiveReservePanel
      v-if="biliReserve.items.length"
      :items="biliReserve.items"
      :fetched-at="biliReserve.fetchedAt"
      :interval-minutes="biliReserve.intervalMinutes"
      :live-room-url="liveRoomUrl"
    />
    <component
      :is="selectedTemplate.component"
      :bili-info="biliInfo"
      :user-info="userInfo"
      :data="displayData"
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
