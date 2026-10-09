import { watch, type Ref } from 'vue'

import { parseCapExpiresAtMs } from '@/shared/captcha'

const CAP_READY_MS = 20_000
const REFRESH_MARGIN_MS = 60_000
const FALLBACK_REFRESH_MS = 8 * 60_000
const MAX_VERIFY_RETRIES = 3
const RETRY_DELAY_MS = 800

type CapState = 'unverified' | 'verifying' | 'verified' | 'error'

export interface CapRefreshOptions {
  token: Ref<string>
  provider: Ref<'cap' | 'turnstile'>
  capState: Ref<CapState>
  isFallback: () => boolean
  startReadyTimer: () => void
  clearReadyTimer: () => void
  solve: () => Promise<string>
  onGiveUp: () => void
}

interface SessionRuntime {
  options: CapRefreshOptions
  refreshTimer?: ReturnType<typeof setTimeout>
  retryTimer?: ReturnType<typeof setTimeout>
  verifyRetryCount: number
  reverifyInFlight: boolean
  retiredPayload: string
}

function clearTimer(timer: ReturnType<typeof setTimeout> | undefined) {
  if (timer) clearTimeout(timer)
}

function refreshDelayMs(payload: string) {
  const expiresAtMs = parseCapExpiresAtMs(payload)
  return expiresAtMs ? Math.max(5_000, expiresAtMs - REFRESH_MARGIN_MS - Date.now()) : FALLBACK_REFRESH_MS
}

function reverify(runtime: SessionRuntime, opts: { keepToken: boolean; delay?: number }) {
  const { options } = runtime
  if (options.provider.value !== 'cap' || options.isFallback()) return
  if (runtime.reverifyInFlight && opts.keepToken) return
  const run = () => {
    runtime.reverifyInFlight = true
    if (!opts.keepToken) {
      if (options.token.value) runtime.retiredPayload = options.token.value
      options.token.value = ''
    }
    options.capState.value = 'verifying'
    if (!options.token.value) options.startReadyTimer()
    void options
      .solve()
      .then((token) => applyVerifiedPayload(runtime, token))
      .catch(() => {
        runtime.reverifyInFlight = false
        if (tryRetryVerify(runtime)) return
        if (options.token.value) {
          clearTimer(runtime.refreshTimer)
          runtime.refreshTimer = setTimeout(() => reverify(runtime, { keepToken: true }), FALLBACK_REFRESH_MS)
          return
        }
        options.capState.value = 'error'
        options.onGiveUp()
      })
  }
  if (opts.delay && opts.delay > 0) {
    clearTimer(runtime.retryTimer)
    runtime.retryTimer = setTimeout(run, opts.delay)
    return
  }
  run()
}

function tryRetryVerify(runtime: SessionRuntime) {
  const { options } = runtime
  if (options.provider.value !== 'cap' || options.isFallback() || runtime.verifyRetryCount >= MAX_VERIFY_RETRIES) {
    return false
  }
  runtime.verifyRetryCount++
  reverify(runtime, { keepToken: Boolean(options.token.value), delay: RETRY_DELAY_MS * runtime.verifyRetryCount })
  return true
}

function applyVerifiedPayload(runtime: SessionRuntime, payload?: string) {
  const { options } = runtime
  if (!payload || payload === runtime.retiredPayload) return
  options.token.value = payload
  options.capState.value = 'verified'
  runtime.verifyRetryCount = 0
  runtime.reverifyInFlight = false
  options.clearReadyTimer()
  clearTimer(runtime.retryTimer)
  runtime.retryTimer = undefined
  clearTimer(runtime.refreshTimer)
  runtime.refreshTimer = setTimeout(() => reverify(runtime, { keepToken: true }), refreshDelayMs(payload))
}

export function useCapRefresh(options: CapRefreshOptions) {
  const runtime: SessionRuntime = {
    options,
    verifyRetryCount: 0,
    reverifyInFlight: false,
    retiredPayload: '',
  }

  function resetSession() {
    runtime.verifyRetryCount = 0
    runtime.reverifyInFlight = false
    clearTimer(runtime.refreshTimer)
    clearTimer(runtime.retryTimer)
    runtime.refreshTimer = undefined
    runtime.retryTimer = undefined
  }

  return {
    reverify: (keepToken: boolean) => reverify(runtime, { keepToken }),
    resetSession,
    waitForFreshToken(previous?: string, timeoutMs = CAP_READY_MS) {
      if (options.token.value && options.token.value !== previous) return Promise.resolve(options.token.value)
      return new Promise<string>((resolve, reject) => {
        const stop = watch(options.token, (value) => {
          if (!value || value === previous) return
          stop()
          clearTimeout(timer)
          resolve(value)
        })
        const timer = setTimeout(() => {
          stop()
          reject(new Error('人机验证超时，请重试'))
        }, timeoutMs)
      })
    },
    dispose() {
      resetSession()
    },
  }
}
