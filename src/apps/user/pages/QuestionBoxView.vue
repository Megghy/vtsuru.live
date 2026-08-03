<script setup lang="ts">
import { ref, toRef, watch } from 'vue'

import type { QAInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import LocalQuestionDrawer from '@/apps/user/components/question-box/LocalQuestionDrawer.vue'
import PublicQuestionFeed from '@/apps/user/components/question-box/PublicQuestionFeed.vue'
import { useQuestionBoxHistory } from '@/apps/user/components/question-box/questionBoxHistory'
import QuestionComposer from '@/apps/user/components/question-box/QuestionComposer.vue'
import { QUESTION_API_URL } from '@/shared/config'

const props = defineProps<{
  userInfo?: UserInfo
  embedded?: boolean
}>()

const toast = useToast()
const target = toRef(props, 'userInfo')
const history = useQuestionBoxHistory()
const publicQuestions = ref<QAInfo[]>([])
const tags = ref<string[]>([])
const isLoadingQuestions = ref(false)
const showHistory = ref(false)

watch(
  () => target.value?.id,
  (id) => {
    publicQuestions.value = []
    tags.value = []
    if (!id) return
    void loadPublicQuestions()
    void loadTags()
  },
  { immediate: true },
)

function normalizeTag(value: unknown) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'name' in value && typeof value.name === 'string') return value.name
  throw new TypeError('提问话题数据格式错误')
}

async function loadPublicQuestions() {
  if (!target.value?.id) return
  isLoadingQuestions.value = true
  try {
    const response = await QueryGetAPI<QAInfo[]>(`${QUESTION_API_URL}get-public`, { id: target.value.id })
    if (response.code !== 200) throw new Error(response.message)
    publicQuestions.value = response.data
  } catch (error) {
    console.error('加载公开回复失败', error)
    toast.add({ title: error instanceof Error ? error.message : '加载公开回复失败', color: 'error' })
  } finally {
    isLoadingQuestions.value = false
  }
}

async function loadTags() {
  if (!target.value?.id) return
  try {
    const response = await QueryGetAPI<unknown[]>(`${QUESTION_API_URL}get-tags`, { id: target.value.id })
    if (response.code !== 200) throw new Error(response.message)
    tags.value = response.data.map(normalizeTag)
  } catch (error) {
    console.error('加载提问话题失败', error)
    toast.add({ title: error instanceof Error ? error.message : '加载提问话题失败', color: 'error' })
  }
}

function removeHistory(id: string) {
  history.remove(id)
  toast.add({ title: '已删除本地记录', color: 'success' })
}

function clearHistory() {
  history.clear()
  toast.add({ title: '已清空本地记录', color: 'success' })
}
</script>

<template>
  <main
    class="question-box-page"
    :class="{ 'is-embedded': embedded }"
  >
    <QuestionComposer
      :user-info="userInfo"
      :tags="tags"
      :embedded="embedded"
      @open-history="showHistory = true"
      @submitted="loadPublicQuestions"
    />
    <PublicQuestionFeed
      :questions="publicQuestions"
      :is-loading="isLoadingQuestions"
      :user-info="userInfo"
      :embedded="embedded"
    />
    <LocalQuestionDrawer
      v-model:show="showHistory"
      :questions="history.questions.value"
      @remove="removeHistory"
      @clear="clearHistory"
    />
  </main>
</template>

<style scoped>
.question-box-page {
  display: grid;
  gap: clamp(28px, 5vw, 52px);
  width: min(100%, var(--vtsuru-page-max-width, 880px));
  min-width: 0;
  margin: 0 auto;
  padding-bottom: 24px;
}

@media (max-width: 600px) {
  .question-box-page {
    gap: 30px;
    padding-bottom: 10px;
  }
}
</style>
