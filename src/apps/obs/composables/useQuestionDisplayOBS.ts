import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { QAInfo, Setting_QuestionDisplay } from '@/api/api-models'
import { QueryGetAPI, QueryRequestError } from '@/api/query'
import { QUESTION_API_URL } from '@/shared/config'
import { normalizeQuestionDisplaySetting } from '@/shared/questionDisplay'
import { createDefaultQuestionDisplaySetting } from '@/shared/questionDisplayPresets'

export type QuestionDisplayOBSState = 'loading' | 'ready' | 'empty' | 'stale' | 'unauthorized' | 'error'

export const QUESTION_DISPLAY_OBS_ENDPOINTS = {
  snapshot: `${QUESTION_API_URL}get-current-and-settings`,
  version: `${QUESTION_API_URL}get-hash`,
} as const

const POLL_INTERVAL_MS = 3000
const REQUEST_TIMEOUT_MS = 8000

interface QuestionDisplaySnapshot {
  question?: QAInfo | null
  setting: Setting_QuestionDisplay
}

interface UseQuestionDisplayOBSOptions {
  token: MaybeRefOrGetter<string>
  active: MaybeRefOrGetter<boolean>
  visible: MaybeRefOrGetter<boolean>
}

export function useQuestionDisplayOBS(options: UseQuestionDisplayOBSOptions) {
  const question = ref<QAInfo>()
  const setting = ref<Setting_QuestionDisplay>(createDefaultQuestionDisplaySetting())
  const state = ref<QuestionDisplayOBSState>('loading')
  const lastUpdatedAt = ref<number>()
  const version = ref('')
  const componentActive = ref(false)

  let pollTimer: number | undefined
  let requestController: AbortController | undefined
  let requestInFlight: Promise<void> | undefined

  const shouldRun = computed(
    () => componentActive.value && toValue(options.active) && toValue(options.visible) && Boolean(toValue(options.token)),
  )

  function applySnapshot(snapshot: QuestionDisplaySnapshot) {
    question.value = snapshot.question ?? undefined
    setting.value = normalizeQuestionDisplaySetting(snapshot.setting)
    lastUpdatedAt.value = Date.now()
    state.value = question.value ? 'ready' : 'empty'
  }

  function applyFailure(code?: number) {
    if (code === 401 || code === 403) {
      state.value = 'unauthorized'
    } else {
      state.value = lastUpdatedAt.value ? 'stale' : 'error'
    }
  }

  async function fetchSnapshot(signal: AbortSignal) {
    const response = await QueryGetAPI<QuestionDisplaySnapshot>(
      QUESTION_DISPLAY_OBS_ENDPOINTS.snapshot,
      { token: toValue(options.token) },
      undefined,
      { signal, timeoutMs: REQUEST_TIMEOUT_MS, retryOnFailover: false },
    )
    if (response.code !== 200) {
      applyFailure(response.code)
      return false
    }
    applySnapshot(response.data)
    return true
  }

  async function fetchVersion(signal: AbortSignal) {
    const response = await QueryGetAPI<string>(
      QUESTION_DISPLAY_OBS_ENDPOINTS.version,
      { token: toValue(options.token) },
      undefined,
      { signal, timeoutMs: REQUEST_TIMEOUT_MS, retryOnFailover: false },
    )
    if (response.code !== 200) {
      applyFailure(response.code)
      return
    }
    if (response.data !== version.value) {
      if (await fetchSnapshot(signal)) version.value = response.data
    }
  }

  function schedulePoll() {
    window.clearTimeout(pollTimer)
    if (!shouldRun.value) return
    pollTimer = window.setTimeout(() => void refresh(false), POLL_INTERVAL_MS)
  }

  async function refresh(forceSnapshot = true) {
    if (!shouldRun.value) return
    if (requestInFlight) return requestInFlight

    requestController = new AbortController()
    requestInFlight = (async () => {
      try {
        if (forceSnapshot || !lastUpdatedAt.value) {
          await fetchSnapshot(requestController!.signal)
        } else {
          await fetchVersion(requestController!.signal)
        }
      } catch (error) {
        if (!(error instanceof QueryRequestError && error.kind === 'aborted')) applyFailure()
      } finally {
        requestController = undefined
        requestInFlight = undefined
        schedulePoll()
      }
    })()
    return requestInFlight
  }

  function pause() {
    componentActive.value = false
    window.clearTimeout(pollTimer)
    requestController?.abort()
  }

  function resume() {
    componentActive.value = true
    void refresh(true)
  }

  onMounted(resume)
  onActivated(resume)
  onDeactivated(pause)
  onUnmounted(pause)

  watch(shouldRun, (running) => {
    if (running) void refresh(true)
    else {
      window.clearTimeout(pollTimer)
      requestController?.abort()
    }
  })

  watch(
    () => toValue(options.token),
    (token) => {
      version.value = ''
      question.value = undefined
      setting.value = createDefaultQuestionDisplaySetting()
      lastUpdatedAt.value = undefined
      state.value = token ? 'loading' : 'unauthorized'
    },
    { immediate: true },
  )

  return { question, setting, state, lastUpdatedAt }
}
