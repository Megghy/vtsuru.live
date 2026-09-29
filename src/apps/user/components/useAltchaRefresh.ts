import { nextTick, watch, type Ref } from 'vue'

import { parseAltchaExpiresAtMs } from '@/shared/captcha'

const ALTCHA_READY_MS = 20_000
const REFRESH_MARGIN_MS = 60_000
const FALLBACK_REFRESH_MS = 8 * 60_000
const MAX_VERIFY_RETRIES = 3
const RETRY_DELAY_MS = 800

type AltchaState = 'unverified' | 'verifying' | 'verified' | 'error' | 'expired' | 'code'
type AltchaEl = HTMLElementTagNameMap['altcha-widget'] | null

export interface AltchaRefreshOptions {
  token: Ref<string>
  provider: Ref<'altcha' | 'turnstile'>
  altchaState: Ref<AltchaState>
  showAltchaUi: Ref<boolean>
  altchaEl: Ref<AltchaEl>
  isFallback: () => boolean
  startReadyTimer: () => void
  clearReadyTimer: () => void
}

interface SessionRuntime {
  options: AltchaRefreshOptions
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
  const expiresAtMs = parseAltchaExpiresAtMs(payload)
  return expiresAtMs ? Math.max(5_000, expiresAtMs - REFRESH_MARGIN_MS - Date.now()) : FALLBACK_REFRESH_MS
}

function reverify(runtime: SessionRuntime, opts: { keepToken: boolean; delay?: number }) {
  const { options } = runtime
  if (options.provider.value !== 'altcha' || options.isFallback()) return
  if (runtime.reverifyInFlight && opts.keepToken) return
  const run = () => {
    runtime.reverifyInFlight = true
    if (!opts.keepToken) {
      if (options.token.value) runtime.retiredPayload = options.token.value
      options.token.value = ''
    }
    options.altchaState.value = 'unverified'
    options.showAltchaUi.value = false
    options.altchaEl.value?.reset?.()
    void nextTick(() => {
      void options.altchaEl.value?.verify?.()
      if (!options.token.value) options.startReadyTimer()
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
  if (options.provider.value !== 'altcha' || options.isFallback() || runtime.verifyRetryCount >= MAX_VERIFY_RETRIES) {
    return false
  }
  runtime.verifyRetryCount++
  reverify(runtime, { keepToken: Boolean(options.token.value), delay: RETRY_DELAY_MS * runtime.verifyRetryCount })
  return true
}

export function useAltchaRefresh(options: AltchaRefreshOptions) {
  const runtime: SessionRuntime = {
    options,
    verifyRetryCount: 0,
    reverifyInFlight: false,
    retiredPayload: '',
  }

  function applyVerifiedPayload(payload?: string) {
    if (!payload || payload === runtime.retiredPayload) return
    options.token.value = payload
    options.altchaState.value = 'verified'
    runtime.verifyRetryCount = 0
    runtime.reverifyInFlight = false
    options.clearReadyTimer()
    clearTimer(runtime.retryTimer)
    runtime.retryTimer = undefined
    options.showAltchaUi.value = false
    clearTimer(runtime.refreshTimer)
    runtime.refreshTimer = setTimeout(() => reverify(runtime, { keepToken: true }), refreshDelayMs(payload))
  }

  function waitForFreshToken(previous?: string, timeoutMs = ALTCHA_READY_MS) {
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
    applyVerifiedPayload,
    handleChallengeFailure(state: 'error' | 'expired') {
      runtime.reverifyInFlight = false
      if (state === 'expired') options.token.value = ''
      return tryRetryVerify(runtime)
    },
    reverify: (keepToken: boolean) => reverify(runtime, { keepToken }),
    resetSession,
    waitForFreshToken,
    dispose() {
      resetSession()
    },
    markInteractive() {
      runtime.reverifyInFlight = false
    },
  }
}
