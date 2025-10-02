<script setup lang="ts">
import type { QAInfo, Setting_QuestionDisplay } from '@/api/api-models'
import { useRouteQuery } from '@vueuse/router'
import { onMounted, onUnmounted, ref } from 'vue'
import { QueryGetAPI } from '@/api/query'
import { QUESTION_API_URL } from '@/data/constants'
import { useWebRTC } from '@/store/useRTC'
import QuestionDisplayCard from '../manage/QuestionDisplayCard.vue'

const props = defineProps<{
  id?: number
  active?: boolean
  visible?: boolean
}>()

const hash = ref('')
const token = useRouteQuery('token')
const rtc = await useWebRTC().Init('slave')

const question = ref<QAInfo>()
const setting = ref<Setting_QuestionDisplay>({} as Setting_QuestionDisplay)

const cardRef = ref()

async function checkIfChanged() {
  try {
    const data = await QueryGetAPI<string>(`${QUESTION_API_URL}get-hash`, {
      token: token.value,
    })
    if (data.code == 200) {
      if (data.data != hash.value) {
        getQuestionAndSetting()
      }
      hash.value = data.data
    }
  } catch (err) {
    console.log(err)
  }
}
async function getQuestionAndSetting() {
  try {
    const data = await QueryGetAPI<{
      question: QAInfo
      setting: Setting_QuestionDisplay
    }>(`${QUESTION_API_URL}get-current-and-settings`, {
      token: token.value,
    })
    if (data.code == 200) {
      question.value = data.data.question
      setting.value = data.data.setting
    }
  } catch (err) {
    console.log(err)
  }
}
function handleScroll(value: { clientHeight: number, scrollHeight: number, scrollTop: number }) {
  cardRef.value?.setScroll(value)
}
let timer: any
onMounted(() => {
  window.$mitt.on('onOBSComponentUpdate', () => {
    checkIfChanged()
  })

  rtc?.on('function.question.sync-scroll', handleScroll)
})
onUnmounted(() => {
  window.$mitt.off('onOBSComponentUpdate')
  rtc?.off('function.question.sync-scroll', handleScroll)
})
</script>

<template>
  <QuestionDisplayCard
    ref="cardRef"
    :question="question"
    :setting="setting"
  />
</template>
