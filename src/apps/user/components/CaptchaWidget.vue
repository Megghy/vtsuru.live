<script setup lang="ts">
import 'altcha'
import 'altcha/i18n/zh-cn'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import VueTurnstile from 'vue-turnstile'

import { ALTCHA_CHALLENGE_URL, TURNSTILE_KEY } from '@/shared/config'
import { isDarkMode } from '@/shared/utils'

import { useAltchaRefresh } from './useAltchaRefresh'

type CaptchaProvider = 'altcha' | 'turnstile'
type AltchaState = 'unverified' | 'verifying' | 'verified' | 'error' | 'expired' | 'code'

interface AltchaStateDetail {
  state?: AltchaState
  payload?: string
}

interface AltchaVerifiedDetail {
  payload?: string
}

const { action } = defineProps<{
  action?: string
}>()

const token = defineModel<string>({ default: '' })

const canSolve = ref(false)
const provider = ref<CaptchaProvider>('altcha')
const altchaEl = shallowRef<HTMLElementTagNameMap['altcha-widget'] | null>(null)
const turnstile = ref<{ reset?: () => void; remove?: () => void }>()
const altchaState = ref<AltchaState>('unverified')
/** 仅在需要人工交互（code / error）时展示 widget */
const showAltchaUi = ref(false)

const CHALLENGE_PROBE_MS = 6_000
const ALTCHA_READY_MS = 20_000

let probeAbort: AbortController | undefined
let readyTimer: ReturnType<typeof setTimeout> | undefined
let fallbackTriggered = false

const turnstileTheme = computed(() => (isDarkMode.value ? 'dark' : 'light'))
const isPassed = computed(() => Boolean(token.value))
const isInteractive = computed(() => provider.value === 'altcha' && showAltchaUi.value && !isPassed.value)
/** Altcha 无感验证中：展示自定义动画状态条 */
const isVerifying = computed(
  () =>
    provider.value === 'altcha' &&
    canSolve.value &&
    !isPassed.value &&
    !isInteractive.value &&
    altchaState.value !== 'error',
)
const statusText = computed(() => {
  if (isPassed.value) return '验证通过'
  if (!canSolve.value && provider.value === 'altcha') return ''
  if (altchaState.value === 'error') return '验证失败，请按提示完成验证'
  if (isInteractive.value) return '请完成验证'
  return '正在进行安全验证'
})

const altchaConfiguration = JSON.stringify({
  codeChallengeDisplay: 'overlay',
  // 保留最短可见验证时长，让状态动画能被感知
  minDuration: 900,
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
    if (provider.value === 'altcha' && !token.value && !showAltchaUi.value) {
      fallbackToTurnstile('验证超时，已切换备用验证')
    }
  }, ALTCHA_READY_MS)
}

const altchaRefresh = useAltchaRefresh({
  token,
  provider,
  altchaState,
  showAltchaUi,
  altchaEl,
  isFallback: () => fallbackTriggered,
  startReadyTimer,
  clearReadyTimer,
})

async function probeAltchaChallenge() {
  probeAbort?.abort()
  probeAbort = new AbortController()
  const timer = setTimeout(() => probeAbort?.abort(), CHALLENGE_PROBE_MS)
  try {
    const res = await fetch(ALTCHA_CHALLENGE_URL, {
      method: 'GET',
      signal: probeAbort.signal,
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`challenge ${res.status}`)
  } catch {
    fallbackToTurnstile('验证服务不可用，已切换备用验证')
  } finally {
    clearTimeout(timer)
  }
}

function fallbackToTurnstile(_reason?: string) {
  if (fallbackTriggered || provider.value === 'turnstile') return
  fallbackTriggered = true
  clearReadyTimer()
  altchaRefresh.dispose()
  probeAbort?.abort()
  token.value = ''
  provider.value = 'turnstile'
  showAltchaUi.value = false
}

function revealAltchaUi() {
  showAltchaUi.value = true
  // 进入人工交互后取消自动回退，避免用户输入验证码时被切到 Turnstile
  clearReadyTimer()
  // 切到 overlay，确保 code challenge 能以弹层展示
  void altchaEl.value?.configure?.({ display: 'overlay', codeChallengeDisplay: 'overlay' })
  altchaEl.value?.show?.()
}

function onAltchaStateChange(ev: Event) {
  const detail = (ev as CustomEvent<AltchaStateDetail>).detail
  const state = detail?.state
  if (!state) return
  altchaState.value = state

  if (state === 'verified') {
    altchaRefresh.applyVerifiedPayload(detail.payload)
    return
  }
  if (state === 'verifying' || state === 'unverified') {
    showAltchaUi.value = false
    return
  }
  if (state === 'code') {
    altchaRefresh.markInteractive()
    revealAltchaUi()
    return
  }
  if (state === 'error' || state === 'expired') {
    if (altchaRefresh.handleChallengeFailure(state)) return
    if (!token.value) revealAltchaUi()
  }
}

function onAltchaVerified(ev: Event) {
  altchaRefresh.applyVerifiedPayload((ev as CustomEvent<AltchaVerifiedDetail>).detail?.payload)
}

function onAltchaCodeChallenge() {
  revealAltchaUi()
}

function bindAltchaEvents(el: HTMLElementTagNameMap['altcha-widget'] | null) {
  if (!el) return
  el.addEventListener('statechange', onAltchaStateChange)
  el.addEventListener('verified', onAltchaVerified)
  el.addEventListener('codechallenge', onAltchaCodeChallenge)
}

function unbindAltchaEvents(el: HTMLElementTagNameMap['altcha-widget'] | null) {
  if (!el) return
  el.removeEventListener('statechange', onAltchaStateChange)
  el.removeEventListener('verified', onAltchaVerified)
  el.removeEventListener('codechallenge', onAltchaCodeChallenge)
}

function reset() {
  fallbackTriggered = false
  altchaRefresh.resetSession()
  if (provider.value === 'altcha') {
    altchaRefresh.reverify(false)
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
  return altchaRefresh.waitForFreshToken(previous)
}

function remove() {
  clearReadyTimer()
  altchaRefresh.dispose()
  probeAbort?.abort()
  unbindAltchaEvents(altchaEl.value)
  try {
    turnstile.value?.remove?.()
  } catch {
    // widget 已卸载
  }
}

watch(altchaEl, (el, prev) => {
  unbindAltchaEvents(prev)
  bindAltchaEvents(el)
})

onMounted(() => {
  const start = () => {
    canSolve.value = true
    if (provider.value === 'altcha') {
      startReadyTimer()
      void probeAltchaChallenge()
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
      v-if="provider === 'altcha' || isPassed"
      class="captcha-status-slot"
    >
      <Transition
        name="captcha-fade"
        mode="out-in"
      >
        <!-- 通过：轻量文字态 -->
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

        <!-- 验证中、交互和错误 -->
        <p
          v-else
          :key="statusText"
          class="captcha-status"
          :class="{
            'captcha-status--verifying': isVerifying,
            'captcha-status--interactive': isInteractive,
            'captcha-status--error': altchaState === 'error',
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

    <template v-if="provider === 'altcha' && canSolve">
      <div
        class="captcha-widget__altcha"
        :class="{ 'captcha-widget__altcha--visible': showAltchaUi && !isPassed }"
        :aria-hidden="showAltchaUi && !isPassed ? undefined : 'true'"
      >
        <altcha-widget
          ref="altchaEl"
          :challenge="ALTCHA_CHALLENGE_URL"
          auto="onload"
          display="invisible"
          language="zh-cn"
          name="altcha"
          :configuration="altchaConfiguration"
        />
      </div>
    </template>

    <!-- Turnstile：通过后隐藏，组件仍挂载以免卸载清掉 token -->
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

.captcha-status--interactive {
  color: var(--vtsuru-brand, var(--vtsuru-fg-muted));
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

.captcha-widget__altcha {
  width: 100%;
  max-width: 360px;
}

/* 无感阶段：裁剪进 1px 容器，避免 fixed 全屏/overflow:visible 触发原生滚动条 */
.captcha-widget__altcha:not(.captcha-widget__altcha--visible) {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
  opacity: 0;
  pointer-events: none;
}

.captcha-widget__altcha--visible {
  position: relative;
  z-index: 1;
  width: 100%;
  height: auto;
  margin: 0;
  overflow: visible;
  clip-path: none;
  white-space: normal;
  opacity: 1;
  pointer-events: auto;
}

.captcha-widget__turnstile {
  display: flex;
  max-width: 100%;
  justify-content: center;
  overflow: hidden;
}

/* 仅做透明度过渡，不用位移，避免瞬时溢出 */
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
