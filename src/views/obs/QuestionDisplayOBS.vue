<script setup lang="ts">
import { QAInfo, Setting_QuestionDisplay } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { QUESTION_API_URL } from '@/data/constants'
import { useRouteQuery } from '@vueuse/router'
import { onMounted, ref } from 'vue'
import QuestionDisplayCard from '../manage/QuestionDisplayCard.vue'

const hash = ref('')
const token = useRouteQuery('token')

const question = ref<QAInfo>()
const setting = ref<Setting_QuestionDisplay>({} as Setting_QuestionDisplay)

async function checkIfChanged() {
  try {
    const data = await QueryGetAPI<string>(QUESTION_API_URL + 'get-hash', {
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
    }>(QUESTION_API_URL + 'get-current-and-settings', {
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

onMounted(() => {
  setInterval(() => {
    checkIfChanged()
  }, 1000)
})
</script>

<template>
  <QuestionDisplayCard :question="question" :setting="setting" />
</template>
