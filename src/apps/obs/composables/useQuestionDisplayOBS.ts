import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { ResponseQAInfo, SettingQuestionDisplay } from '@/api/generated/model'
import { getApiQaGetCurrentAndSettings, getApiQaGetHash } from '@/api/generated/qa/qa'
import { QueryRequestError } from '@/api/query'
import { QUESTION_API_URL } from '@/shared/config'
import { parsePositiveId } from '@/shared/obs/obsUrl'
import { normalizeQuestionDisplaySetting } from '@/shared/questionDisplay'
import { createDefaultQuestionDisplaySetting } from '@/shared/questionDisplayPresets'
import { getRealtimeBus } from '@/shared/realtime'

export type QuestionDisplayOBSState = 'loading' | 'ready' | 'empty' | 'stale' | 'unauthorized' | 'error'

export const QUESTION_DISPLAY_OBS_ENDPOINTS = {
  snapshot: `${QUESTION_API_URL}get-current-and-settings`,
  version: `${QUESTION_API_URL}get-hash`,
} as const

const CONNECTED_SAFETY_POLL_INTERVAL_MS = 60000
const DISCONNECTED_POLL_INTERVAL_MS = 5000
const REQUEST_TIMEOUT_MS = 8000

export interface QuestionDisplaySnapshot {
  question?: ResponseQAInfo | null
  setting: SettingQuestionDisplay
}

export interface UseQuestionDisplayOBSOptions {
  userId?: MaybeRefOrGetter<number | string | null | undefined>
  token?: MaybeRefOrGetter<string | null | undefined>
  active?: MaybeRefOrGetter<boolean>
  visible?: MaybeRefOrGetter<boolean>
  pollIntervalMs?: number
}

export function useQuestionDisplayOBS(options: UseQuestionDisplayOBSOptions) {
  const question = ref<ResponseQAInfo>()
  const setting = ref<SettingQuestionDisplay>(createDefaultQuestionDisplaySetting())
  const state = ref<QuestionDisplayOBSState>('loading')
  const lastUpdatedAt = ref<number>()
  const version = ref('')
  const componentActive = ref(false)

  const realtimeStatus = getRealtimeBus().getStatus()

  let pollTimer: number | undefined
  let requestController: AbortController | undefined
  let requestInFlight: Promise<void> | undefined
  let inFlightMode: 'snapshot' | 'version' | undefined
  let inFlightExpectedVersion: string | undefined
  let pendingForceSnapshot = false
  let pendingExpectedVersion: string | undefined
  let requestSeq = 0

  const isActive = computed(() => (options.active === undefined ? true : toValue(options.active)))
  const isVisible = computed(() => (options.visible === undefined ? true : toValue(options.visible)))
  const userIdValue = computed(() =>
    parsePositiveId(options.userId === undefined ? undefined : toValue(options.userId)),
  )
  const tokenValue = computed(() => String(toValue(options.token) ?? '').trim())
  const hasIdentity = computed(() => Boolean(userIdValue.value) || Boolean(tokenValue.value))

  const shouldRun = computed(() => componentActive.value && isActive.value && isVisible.value && hasIdentity.value)

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

  async function fetchSnapshot(signal: AbortSignal, associatedVersion: string | undefined, seq: number): Promise<boolean> {
    if (!hasIdentity.value) {
      if (seq === requestSeq) state.value = 'unauthorized'
      return false
    }

    const response = await getApiQaGetCurrentAndSettings(identityParams(), {
      signal,
      timeoutMs: REQUEST_TIMEOUT_MS,
      retryOnFailover: false,
    } as any)

    if (seq !== requestSeq || signal.aborted) return false

    if (response.code !== 200) {
      applyFailure(response.code)
      return false
    }

    applySnapshot(response.data, associatedVersion)
    return true
  }

  async function fetchVersion(signal: AbortSignal, seq: number): Promise<void> {
    if (!hasIdentity.value) return

    const response = await getApiQaGetHash(identityParams(), {
      signal,
      timeoutMs: REQUEST_TIMEOUT_MS,
      retryOnFailover: false,
    } as any)

    if (seq !== requestSeq || signal.aborted) return

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
      const ok = await fetchSnapshot(signal, newHash, seq)
      if (ok && seq === requestSeq) {
        version.value = newHash
      }
    }
  }

  function schedulePoll() {
    window.clearTimeout(pollTimer)
    if (!shouldRun.value) return
    const delay =
      options.pollIntervalMs ??
      (realtimeStatus.value.connected ? CONNECTED_SAFETY_POLL_INTERVAL_MS : DISCONNECTED_POLL_INTERVAL_MS)
    pollTimer = window.setTimeout(() => void refresh(false), delay)
  }

  async function refresh(forceSnapshot = true, expectedVersion?: string) {
    if (!shouldRun.value) return
    if (requestInFlight) {
      const shouldQueueSnapshot =
        forceSnapshot &&
        (inFlightMode === 'version' ||
          (expectedVersion !== undefined && expectedVersion !== inFlightExpectedVersion))
      if (shouldQueueSnapshot) {
        pendingForceSnapshot = true
        pendingExpectedVersion = expectedVersion
      }
      return requestInFlight
    }

    const seq = ++requestSeq
    const mode = forceSnapshot || !lastUpdatedAt.value ? 'snapshot' : 'version'
    const controller = new AbortController()
    inFlightMode = mode
    inFlightExpectedVersion = expectedVersion
    requestController = controller
    const currentFlight = (async () => {
      try {
        if (mode === 'snapshot') {
          const ok = await fetchSnapshot(controller.signal, expectedVersion, seq)
          if (ok && expectedVersion === undefined && seq === requestSeq) {
            version.value = ''
          }
        } else {
          await fetchVersion(controller.signal, seq)
        }
      } catch (error) {
        if (seq === requestSeq && !(error instanceof QueryRequestError && error.kind === 'aborted')) {
          applyFailure()
        }
      } finally {
        if (requestInFlight === currentFlight) {
          requestController = undefined
          requestInFlight = undefined
          inFlightMode = undefined
          inFlightExpectedVersion = undefined
        }
        if (seq === requestSeq) {
          if (pendingForceSnapshot && shouldRun.value) {
            const nextExpectedVersion = pendingExpectedVersion
            pendingForceSnapshot = false
            pendingExpectedVersion = undefined
            void refresh(true, nextExpectedVersion)
          } else {
            schedulePoll()
          }
        }
      }
    })()
    requestInFlight = currentFlight

    return currentFlight
  }

  function cancelPendingRequests() {
    requestSeq++
    pendingForceSnapshot = false
    pendingExpectedVersion = undefined
    window.clearTimeout(pollTimer)
    requestController?.abort()
    requestController = undefined
    requestInFlight = undefined
    inFlightMode = undefined
    inFlightExpectedVersion = undefined
  }

  function pause() {
    componentActive.value = false
    cancelPendingRequests()
  }

  function resume() {
    componentActive.value = true
  }

  onMounted(resume)
  onActivated(resume)
  onDeactivated(pause)
  onUnmounted(pause)

  watch(
    [shouldRun, userIdValue, tokenValue],
    ([running], oldVal) => {
      const identityChanged = !oldVal || oldVal[1] !== userIdValue.value || oldVal[2] !== tokenValue.value
      if (identityChanged) {
        cancelPendingRequests()
        version.value = ''
        question.value = undefined
        setting.value = createDefaultQuestionDisplaySetting()
        lastUpdatedAt.value = undefined
        state.value = hasIdentity.value ? 'loading' : 'unauthorized'
      }
      if (!running) {
        cancelPendingRequests()
      } else {
        void refresh(true)
      }
    },
    { flush: 'sync', immediate: true },
  )

  return { question, setting, state, lastUpdatedAt, version, refresh, pause, resume }
}
