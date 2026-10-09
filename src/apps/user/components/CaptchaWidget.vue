<script setup lang="ts">
import '@/shared/config/capEnv'
import Cap from 'cap-widget'
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import VueTurnstile from 'vue-turnstile'

import { CAP_API_ENDPOINT, CAP_PROBE_URL, TURNSTILE_KEY } from '@/shared/config'
import { isDarkMode } from '@/shared/utils'

import { useCapRefresh } from './useCapRefresh'

type CaptchaProvider = 'cap' | 'turnstile'
type CapState = 'unverified' | 'verifying' | 'verified' | 'error'

const { action } = defineProps<{
  action?: string
}>()

const token = defineModel<string>({ default: '' })

const canSolve = ref(false)
const provider = ref<CaptchaProvider>('cap')
const cap = shallowRef<Cap | null>(null)
const turnstile = ref<{ reset?: () => void; remove?: () => void }>()
const capState = ref<CapState>('unverified')

const CHALLENGE_PROBE_MS = 6_000
const CAP_READY_MS = 20_000

let probeAbort: AbortController | undefined
let readyTimer: ReturnType<typeof setTimeout> | undefined
let fallbackTriggered = false

const turnstileTheme = computed(() => (isDarkMode.value ? 'dark' : 'light'))
const isPassed = computed(() => Boolean(token.value))
const isVerifying = computed(
  () => provider.value === 'cap' && canSolve.value && !isPassed.value && capState.value !== 'error',
)
const statusText = computed(() => {
  if (isPassed.value) return '验证通过'
  if (!canSolve.value && provider.value === 'cap') return ''
  if (capState.value === 'error') return '验证失败，正在切换备用验证'
  return '正在进行安全验证'
})

function clearReadyTimer() {
  if (readyTimer) {
    clearTimeout(readyTimer)
    readyTimer = undefined
  }
}

function startReadyTimer() {
  clearReadyTimer()
  readyTimer = setTimeout(() => {
    if (provider.value === 'cap' && !token.value) {
      fallbackToTurnstile()
    }
  }, CAP_READY_MS)
}

async function solveCap() {
  capState.value = 'verifying'
  cap.value ??= new Cap({ apiEndpoint: CAP_API_ENDPOINT })
  const result = await cap.value.solve()
  if (!result?.token) throw new Error('empty cap token')
  return result.token
}

const capRefresh = useCapRefresh({
  token,
  provider,
  capState,
  isFallback: () => fallbackTriggered,
  startReadyTimer,
  clearReadyTimer,
  solve: solveCap,
  onGiveUp: () => fallbackToTurnstile(),
})

async function probeCap() {
  probeAbort?.abort()
  probeAbort = new AbortController()
  const timer = setTimeout(() => probeAbort?.abort(), CHALLENGE_PROBE_MS)
  try {
    const res = await fetch(CAP_PROBE_URL, {
      method: 'GET',
      signal: probeAbort.signal,
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`probe ${res.status}`)
    capRefresh.reverify(false)
  } catch {
    fallbackToTurnstile()
  } finally {
    clearTimeout(timer)
  }
}

function fallbackToTurnstile() {
  if (fallbackTriggered || provider.value === 'turnstile') return
  fallbackTriggered = true
  clearReadyTimer()
  capRefresh.dispose()
  probeAbort?.abort()
  destroyCap()
  token.value = ''
  provider.value = 'turnstile'
}

function destroyCap() {
  cap.value?.reset()
  cap.value?.widget.remove()
  cap.value = null
}

function reset() {
  fallbackTriggered = false
  capRefresh.resetSession()
  if (provider.value === 'cap') {
    cap.value?.reset()
    capRefresh.reverify(false)
    return
  }
  token.value = ''
  try {
    turnstile.value?.reset?.()
  } catch {
    // Turnstile 在容器已空/未 render 时 reset 会抛
  }
}

function refresh() {
  if (provider.value === 'turnstile') {
    reset()
    return Promise.reject(new Error('请完成人机验证'))
  }
  const previous = token.value
  reset()
  return capRefresh.waitForFreshToken(previous)
}

function remove() {
  clearReadyTimer()
  capRefresh.dispose()
  probeAbort?.abort()
  destroyCap()
  try {
    turnstile.value?.remove?.()
  } catch {
    // widget 已卸载
  }
}

onMounted(() => {
  const start = () => {
    canSolve.value = true
    if (provider.value === 'cap') {
      startReadyTimer()
      void probeCap()
    }
  }
  const idle = window.requestIdleCallback
  if (idle) idle(start, { timeout: 2500 })
  else window.setTimeout(start, 800)
})

onUnmounted(() => {
  remove()
})

defineExpose({
  reset,
  refresh,
  remove,
  provider,
})
</script>

<template>
  <div
    class="captcha-widget"
    :class="{
      'captcha-widget--passed': isPassed,
      'captcha-widget--verifying': isVerifying,
    }"
  >
    <div
      v-if="provider === 'cap' || isPassed"
      class="captcha-status-slot"
    >
      <Transition
        name="captcha-fade"
        mode="out-in"
      >
        <p
          v-if="isPassed"
          key="passed"
          class="captcha-status captcha-status--passed"
          role="status"
          aria-live="polite"
        >
          <span
            class="captcha-status__check"
            aria-hidden="true"
          />
          <span>{{ statusText }}</span>
        </p>

        <p
          v-else
          :key="statusText"
          class="captcha-status"
          :class="{
            'captcha-status--verifying': isVerifying,
            'captcha-status--error': capState === 'error',
          }"
          role="status"
          aria-live="polite"
        >
          <span
            v-if="isVerifying"
            class="captcha-status__spinner"
            aria-hidden="true"
          />
          <span>{{ statusText }}</span>
        </p>
      </Transition>
    </div>

    <VueTurnstile
      v-if="provider === 'turnstile'"
      v-show="!isPassed"
      ref="turnstile"
      v-model="token"
      :site-key="TURNSTILE_KEY"
      :theme="turnstileTheme"
      :action="action || ''"
      size="flexible"
      class="captcha-widget__turnstile"
    />
  </div>
</template>

<style scoped>
.captcha-widget {
  position: relative;
  display: flex;
  min-width: 0;
  max-width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.captcha-status-slot {
  position: relative;
  display: grid;
  place-items: center;
  width: 100%;
  min-width: 0;
}

.captcha-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.2;
  letter-spacing: 0;
  text-align: center;
  overflow-wrap: anywhere;
  grid-area: 1 / 1;
}

.captcha-status--verifying {
  color: var(--vtsuru-fg-muted);
}

.captcha-status--passed {
  color: var(--vtsuru-success, #18a058);
}

.captcha-status--error {
  color: var(--vtsuru-error, #d03050);
}

.captcha-status__spinner {
  width: 11px;
  height: 11px;
  flex: none;
  border-radius: 50%;
  border: 1.5px solid color-mix(in srgb, currentColor 22%, transparent);
  border-top-color: currentColor;
  opacity: 0.85;
  animation: captcha-spin 0.65s linear infinite;
}

.captcha-status__check {
  position: relative;
  width: 11px;
  height: 11px;
  flex: none;
  border-radius: 50%;
  background: currentColor;
}

.captcha-status__check::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 3.5px;
  width: 2.5px;
  height: 5px;
  border: solid #fff;
  border-width: 0 1.4px 1.4px 0;
  transform: rotate(45deg);
}

.captcha-widget__turnstile {
  display: flex;
  max-width: 100%;
  justify-content: center;
  overflow: hidden;
}

.captcha-fade-enter-active,
.captcha-fade-leave-active {
  transition: opacity 160ms ease;
}

.captcha-fade-enter-from,
.captcha-fade-leave-to {
  opacity: 0;
}

.captcha-fade-enter-to,
.captcha-fade-leave-from {
  opacity: 1;
}

@keyframes captcha-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .captcha-fade-enter-active,
  .captcha-fade-leave-active {
    transition-duration: 100ms;
  }

  .captcha-status__spinner {
    animation-duration: 1.4s;
  }
}
</style>
