<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'

import type { ResponseQAInfoToTarget, ResponseUserInfo } from '@/api/generated/model'
import { getApiQaGetPublic, getApiQaGetTags } from '@/api/generated/qa/qa'
import LocalQuestionDrawer from '@/apps/user/components/question-box/LocalQuestionDrawer.vue'
import PublicQuestionFeed from '@/apps/user/components/question-box/PublicQuestionFeed.vue'
import { useQuestionBoxHistory } from '@/apps/user/components/question-box/questionBoxHistory'
import QuestionComposer from '@/apps/user/components/question-box/QuestionComposer.vue'
import { useMessage } from '@/shared/utils'

const props = defineProps<{
  userInfo?: ResponseUserInfo
  embedded?: boolean
  defaultTag?: string
  showPublicQuestions?: boolean
}>()

const message = useMessage()
const target = toRef(props, 'userInfo')
const history = useQuestionBoxHistory()
const publicQuestions = ref<ResponseQAInfoToTarget[]>([])
const tags = ref<string[]>([])
const isLoadingQuestions = ref(false)
const showHistory = ref(false)
const showPublicReplies = computed(() => {
  if (target.value?.extra?.showQuestionBoxPublicReplies === false) return false
  return !props.embedded || props.showPublicQuestions !== false
})

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
  if (!target.value?.id || !showPublicReplies.value) return
  isLoadingQuestions.value = true
  try {
    const response = (await getApiQaGetPublic({
      id: String(target.value.id),
    })) as unknown as {
      code: number
      message?: string
      data: ResponseQAInfoToTarget[]
    }
    if (response.code !== 200) throw new Error(response.message)
    publicQuestions.value = response.data
  } catch (error) {
    console.error('加载公开回复失败', error)
    message.error(error instanceof Error ? error.message : '加载公开回复失败')
  } finally {
    isLoadingQuestions.value = false
  }
}

async function loadTags() {
  if (!target.value?.id) return
  try {
    const response = (await getApiQaGetTags({
      id: String(target.value.id),
    })) as unknown as {
      code: number
      message?: string
      data: unknown[]
    }
    if (response.code !== 200) throw new Error(response.message)
    tags.value = response.data.map(normalizeTag)
  } catch (error) {
    console.error('加载提问话题失败', error)
    message.error(error instanceof Error ? error.message : '加载提问话题失败')
  }
}

function removeHistory(id: string) {
  history.remove(id)
  message.success('已删除本地记录')
}

function clearHistory() {
  history.clear()
  message.success('已清空本地记录')
}
</script>

<template>
  <main
    class="grid w-full min-w-0 mx-auto max-w-[var(--vtsuru-page-max-width,880px)] gap-[clamp(28px,5vw,52px)] pb-6 max-[600px]:gap-[30px] max-[600px]:pb-2.5"
  >
    <QuestionComposer
      :user-info="userInfo"
      :tags="tags"
      :embedded="embedded"
      :default-tag="defaultTag"
      @open-history="showHistory = true"
      @submitted="loadPublicQuestions"
    />
    <PublicQuestionFeed
      v-if="showPublicReplies"
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
