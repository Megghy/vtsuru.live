import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { QAInfo, Setting_QuestionDisplay } from '@/api/api-models'
import { QueryGetAPI, QueryRequestError } from '@/api/query'
import { QUESTION_API_URL } from '@/shared/config'
import { parsePositiveId } from '@/shared/obs/obsUrl'
import { normalizeQuestionDisplaySetting } from '@/shared/questionDisplay'
import { createDefaultQuestionDisplaySetting } from '@/shared/questionDisplayPresets'

export type QuestionDisplayOBSState = 'loading' | 'ready' | 'empty' | 'stale' | 'unauthorized' | 'error'

export const QUESTION_DISPLAY_OBS_ENDPOINTS = {
  snapshot: `${QUESTION_API_URL}get-current-and-settings`,
  version: `${QUESTION_API_URL}get-hash`,
} as const

const POLL_INTERVAL_MS = 3000
const REQUEST_TIMEOUT_MS = 8000

export interface QuestionDisplaySnapshot {
  question?: QAInfo | null
  setting: Setting_QuestionDisplay
}

export interface UseQuestionDisplayOBSOptions {
  userId?: MaybeRefOrGetter<number | string | null | undefined>
  token?: MaybeRefOrGetter<string | null | undefined>
  active?: MaybeRefOrGetter<boolean>
  visible?: MaybeRefOrGetter<boolean>
  pollIntervalMs?: number
}

export function useQuestionDisplayOBS(options: UseQuestionDisplayOBSOptions) {
  const question = ref<QAInfo>()
  const setting = ref<Setting_QuestionDisplay>(createDefaultQuestionDisplaySetting())
  const state = ref<QuestionDisplayOBSState>('loading')
  const lastUpdatedAt = ref<number>()
  const version = ref('')
  const componentActive = ref(false)

  const pollInterval = options.pollIntervalMs ?? POLL_INTERVAL_MS

  let pollTimer: number | undefined
  let requestController: AbortController | undefined
  let requestInFlight: Promise<void> | undefined

  const isActive = computed(() => (options.active === undefined ? true : toValue(options.active)))
  const isVisible = computed(() => (options.visible === undefined ? true : toValue(options.visible)))
  const userIdValue = computed(() => parsePositiveId(options.userId === undefined ? undefined : toValue(options.userId)))
  const tokenValue = computed(() => String(toValue(options.token) ?? '').trim())
  const hasIdentity = computed(() => Boolean(userIdValue.value) || Boolean(tokenValue.value))

  const shouldRun = computed(
    () => componentActive.value && isActive.value && isVisible.value && hasIdentity.value,
  )

  function identityParams(): Record<string, string> {
    const params: Record<string, string> = {}
    if (userIdValue.value) params.id = userIdValue.value
    if (tokenValue.value) params.token = tokenValue.value
    return params
  }

  function applySnapshot(snapshot: QuestionDisplaySnapshot, newVersion?: string) {
    question.value = snapshot.question ?? undefined
    setting.value = normalizeQuestionDisplaySetting(snapshot.setting)
    lastUpdatedAt.value = Date.now()
    if (newVersion !== undefined) {
      version.value = newVersion
    }
    state.value = question.value ? 'ready' : 'empty'
  }

  function applyFailure(code?: number) {
    if (code === 401 || code === 403) {
      state.value = 'unauthorized'
    } else {
      state.value = lastUpdatedAt.value ? 'stale' : 'error'
    }
  }

  async function fetchSnapshot(signal: AbortSignal, associatedVersion?: string): Promise<boolean> {
    if (!hasIdentity.value) {
      state.value = 'unauthorized'
      return false
    }

    const response = await QueryGetAPI<QuestionDisplaySnapshot>(
      QUESTION_DISPLAY_OBS_ENDPOINTS.snapshot,
      identityParams(),
      undefined,
      { signal, timeoutMs: REQUEST_TIMEOUT_MS, retryOnFailover: false },
    )

    if (response.code !== 200) {
      applyFailure(response.code)
      return false
    }

    applySnapshot(response.data, associatedVersion)
    return true
  }

  async function fetchVersion(signal: AbortSignal): Promise<void> {
    if (!hasIdentity.value) return

    const response = await QueryGetAPI<string>(
      QUESTION_DISPLAY_OBS_ENDPOINTS.version,
      identityParams(),
      undefined,
      { signal, timeoutMs: REQUEST_TIMEOUT_MS, retryOnFailover: false },
    )

    if (response.code !== 200) {
      applyFailure(response.code)
      return
    }

    const newHash = response.data ?? ''
    // 若首次还没有记录 version，但已有了快照数据，说明是首次快照后的初次哈希探测，直接对齐版本号，无需重复请求快照
    if (!version.value && lastUpdatedAt.value) {
      version.value = newHash
      return
    }

    // 哈希确实发生变化时才拉取全量快照
    if (newHash !== version.value) {
      const ok = await fetchSnapshot(signal, newHash)
      if (ok) {
        version.value = newHash
      }
    }
  }

  function schedulePoll() {
    window.clearTimeout(pollTimer)
    if (!shouldRun.value) return
    pollTimer = window.setTimeout(() => void refresh(false), pollInterval)
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
        if (!(error instanceof QueryRequestError && error.kind === 'aborted')) {
          applyFailure()
        }
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
    [userIdValue, tokenValue],
    () => {
      version.value = ''
      question.value = undefined
      setting.value = createDefaultQuestionDisplaySetting()
      lastUpdatedAt.value = undefined
      state.value = hasIdentity.value ? 'loading' : 'unauthorized'
    },
    { immediate: true },
  )

  return { question, setting, state, lastUpdatedAt, version, refresh, pause, resume }
}
