<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, toRef, watch } from 'vue'

import { useAccount } from '@/api/account'
import { useQuestionDisplayOBS } from '@/apps/obs/composables/useQuestionDisplayOBS'
import { useRouteQueryParam } from '@/composables/useRouteQueryParam'
import QuestionDisplayCard from '@/shared/components/QuestionDisplayCard.vue'
import { firstQueryValue, parsePositiveId } from '@/shared/obs/obsUrl'
import { getRealtimeBus, useRealtimeTopic } from '@/shared/realtime'

interface ImagePreviewPayload {
  questionId?: number | null
  index?: number | null
}

const props = withDefaults(
  defineProps<{
    id?: number
    active?: boolean
    visible?: boolean
    /** 供场景编辑器内嵌时同步覆盖卡片圆角（独立 OBS 页面不传，沿用提问箱自身设置） */
    borderRadiusOverride?: number
  }>(),
  { active: true, visible: true, borderRadiusOverride: undefined },
)

const account = useAccount()
const idFromQuery = useRouteQueryParam('id')
const token = useRouteQueryParam('token')
const userId = computed(() => parsePositiveId(props.id ?? idFromQuery.value))
const tokenStr = computed(() => firstQueryValue(token.value).trim())
const { question, setting, state, version, refresh } = useQuestionDisplayOBS({
  userId,
  token: tokenStr,
  active: toRef(props, 'active'),
  visible: toRef(props, 'visible'),
})
const cardState = computed(() => (state.value === 'unauthorized' ? 'error' : state.value))
const effectiveSetting = computed(() => {
  if (props.borderRadiusOverride === undefined) return setting.value
  return {
    ...setting.value,
    borderRadius: Math.max(0, props.borderRadiusOverride),
  }
})

const cardRef = ref<{ setScrollProgress: (progress: number) => void }>()
const mounted = ref(false)
const activeImageIndex = ref<number | null>(null)
const pendingImagePreview = ref<{ questionId: number; index: number | null } | null>(null)

const effectiveUserId = computed(() => userId.value || (account.value.id > 0 ? String(account.value.id) : ''))
const qaTopic = computed(() =>
  mounted.value && props.active && props.visible && effectiveUserId.value
    ? `obs:display:qa:${effectiveUserId.value}`
    : '',
)
const { on: onQaEvent } = useRealtimeTopic(qaTopic)

onQaEvent<number>('Scroll', (progress) => {
  cardRef.value?.setScrollProgress(Math.min(1, Math.max(0, Number(progress) || 0)))
})

onQaEvent<ImagePreviewPayload>('ImagePreview', (payload) => {
  const index = typeof payload?.index === 'number' && Number.isInteger(payload.index) && payload.index >= 0 ? payload.index : null
  const qid = typeof payload?.questionId === 'number' ? payload.questionId : null
  if (index === null) {
    activeImageIndex.value = null
    pendingImagePreview.value = null
    return
  }
  if (qid !== null && question.value?.id === qid) {
    activeImageIndex.value = index
    pendingImagePreview.value = null
  } else if (qid !== null) {
    pendingImagePreview.value = { questionId: qid, index }
    void refresh(true)
  } else if (question.value) {
    activeImageIndex.value = index
  }
})

onQaEvent<{ hash?: string }>('Changed', (payload) => {
  if (payload?.hash && payload.hash === version.value) return
  void refresh(true, payload?.hash)
})

watch(
  () => question.value?.id,
  (newId) => {
    if (newId && pendingImagePreview.value?.questionId === newId) {
      activeImageIndex.value = pendingImagePreview.value.index
      pendingImagePreview.value = null
    } else {
      activeImageIndex.value = null
    }
  },
)

watch(getRealtimeBus().getReconnectedCount(), () => {
  if (mounted.value && props.active && props.visible) {
    void refresh(true)
  }
})

onMounted(() => {
  mounted.value = true
})
onActivated(() => {
  mounted.value = true
})
onDeactivated(() => {
  mounted.value = false
})
onUnmounted(() => {
  mounted.value = false
})
</script>

<template>
  <QuestionDisplayCard
    ref="cardRef"
    :question="question"
    :setting="effectiveSetting"
    :status="cardState"
    :active-image-index="activeImageIndex"
  />
</template>
