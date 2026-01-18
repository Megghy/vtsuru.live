<script lang="ts" setup>
import type { ScheduleWeekInfo, UserInfo } from '@/api/api-models'
import { TagQuestionMark16Filled } from '@vicons/fluent'
import { NButton, NDivider, NFlex, NInput, NInputGroup, NSpin, NTooltip, useMessage } from 'naive-ui';
import { computed, onMounted, ref } from 'vue'
import { QueryGetAPI } from '@/api/query'
import { SCHEDULE_API_URL } from '@/shared/config'
import { ScheduleTemplateMap } from '@/shared/config/templates'
import { copyToClipboard } from '@/shared/utils'

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
const message = useMessage()

const errMessage = ref('')

async function get() {
  isLoading.value = true
  await QueryGetAPI<ScheduleWeekInfo[]>(`${SCHEDULE_API_URL}get`, {
    id: props.userInfo?.id,
  })
    .then((data) => {
      if (data.code == 200) {
        currentData.value = data.data
      } else {
        errMessage.value = data.message
        message.error(`加载失败: ${data.message}`)
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

<template>
  <NSpin
    v-if="isLoading"
    show
  />
  <div v-else>
    <NDivider
      style="margin: 16px 0 16px 0"
      title-placement="left"
    >
      订阅链接
      <NTooltip>
        <template #trigger>
          <NIcon>
            <TagQuestionMark16Filled />
          </NIcon>
        </template>
        通过订阅链接可以订阅日程表到日历软件中
      </NTooltip>
    </NDivider>
    <NFlex align="center">
      <NInputGroup style="max-width: 400px;">
        <NInput
          :value="`${SCHEDULE_API_URL}${userInfo?.id}.ics`"
          readonly
        />
        <NButton
          secondary
          @click="copyToClipboard(`${SCHEDULE_API_URL}${userInfo?.id}.ics`)"
        >
          复制
        </NButton>
      </NInputGroup>
    </NFlex>
    <NDivider />
    <component
      :is="ScheduleTemplateMap[componentType ?? ''].component"
      :bili-info="biliInfo"
      :user-info="userInfo"
      :data="currentData"
      v-bind="$attrs"
    />
  </div>
</template>
