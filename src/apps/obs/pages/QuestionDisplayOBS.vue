<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, toRef, watch } from 'vue'

import { useQuestionDisplayOBS } from '@/apps/obs/composables/useQuestionDisplayOBS'
import { useRouteQueryParam } from '@/composables/useRouteQueryParam'
import QuestionDisplayCard from '@/shared/components/QuestionDisplayCard.vue'
import { useWebRTC } from '@/store/useRTC'

const props = withDefaults(
  defineProps<{
    id?: number
    active?: boolean
    visible?: boolean
  }>(),
  { active: true, visible: true },
)

const token = useRouteQueryParam('token')
const tokenStr = computed(() => {
  const v = token.value
  return String(Array.isArray(v) ? (v[0] ?? '') : (v ?? ''))
})
const { question, setting, state } = useQuestionDisplayOBS({
  token: tokenStr,
  active: toRef(props, 'active'),
  visible: toRef(props, 'visible'),
})
const cardState = computed(() => (state.value === 'unauthorized' ? 'error' : state.value))

const cardRef = ref<{ setScrollProgress: (progress: number) => void }>()
const rtc = useWebRTC()
let rtcListening = false
let lifecycle = 0
let mounted = false

function handleScroll(progress: number) {
  cardRef.value?.setScrollProgress(Math.min(1, Math.max(0, progress)))
}

async function startRTC() {
  const currentLifecycle = lifecycle
  try {
    const initializedRTC = await rtc.Init('slave', { timeoutMs: 5000 })
    if (currentLifecycle !== lifecycle || rtcListening) return
    initializedRTC.on('function.question.sync-scroll', handleScroll)
    rtcListening = true
  } catch (error) {
    console.warn('[QuestionDisplayOBS] RTC 滚动同步不可用', error)
  }
}

function stopRTC() {
  lifecycle++
  if (!rtcListening) return
  rtc.off('function.question.sync-scroll', handleScroll)
  rtcListening = false
}

function syncRTC() {
  if (mounted && props.active && props.visible) void startRTC()
  else stopRTC()
}

onMounted(() => {
  mounted = true
  syncRTC()
})
onActivated(() => {
  mounted = true
  syncRTC()
})
onDeactivated(() => {
  mounted = false
  stopRTC()
})
onUnmounted(() => {
  mounted = false
  stopRTC()
})

watch([() => props.active, () => props.visible], syncRTC)
</script>

<template>
  <QuestionDisplayCard
    ref="cardRef"
    :question="question"
    :setting="setting"
    :status="cardState"
  />
</template>
