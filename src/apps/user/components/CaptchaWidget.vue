<script setup lang="ts">
import 'altcha'
import 'altcha/i18n/zh-cn'

import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import VueTurnstile from 'vue-turnstile'

import { ALTCHA_CHALLENGE_URL, TURNSTILE_KEY } from '@/shared/config'
import { isDarkMode } from '@/shared/utils'

type CaptchaProvider = 'altcha' | 'turnstile'
type AltchaState = 'unverified' | 'verifying' | 'verified' | 'error' | 'expired' | 'code'

interface AltchaStateDetail {
  state?: AltchaState
  payload?: string
}

interface AltchaVerifiedDetail {
  payload?: string
}

const token = defineModel<string>({ default: '' })

const provider = ref<CaptchaProvider>('altcha')
const altchaEl = shallowRef<HTMLElementTagNameMap['altcha-widget'] | null>(null)
const turnstile = ref<{ reset?: () => void; remove?: () => void }>()
const altchaState = ref<AltchaState>('unverified')
/** 仅在需要人工交互（code / error）时展示 widget */
const showAltchaUi = ref(false)
const statusText = ref('安全验证中…')

const CHALLENGE_PROBE_MS = 6_000
const ALTCHA_READY_MS = 20_000

let probeAbort: AbortController | undefined
let readyTimer: ReturnType<typeof setTimeout> | undefined
let fallbackTriggered = false

const turnstileTheme = computed(() => (isDarkMode.value ? 'dark' : 'light'))
const showStatus = computed(
  () => provider.value === 'altcha' && !showAltchaUi.value && !token.value && altchaState.value !== 'error',
)

const altchaConfiguration = JSON.stringify({
  codeChallengeDisplay: 'overlay',
  // 无感时尽量缩短 UI 闪现
  minDuration: 0,
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
    // 已弹出 code/error 交互界面时不回退，等用户完成
    if (provider.value === 'altcha' && !token.value && !showAltchaUi.value) {
      fallbackToTurnstile('验证超时，已切换备用验证')
    }
  }, ALTCHA_READY_MS)
}

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

  if (state === 'code' || state === 'error' || state === 'expired') {
    revealAltchaUi()
  }
  if (state === 'verifying') {
    statusText.value = '安全验证中…'
  }
  if (state === 'verified') {
    if (detail.payload) token.value = detail.payload
    clearReadyTimer()
    showAltchaUi.value = false
  }
  if (state === 'error') {
    statusText.value = '验证失败，请按提示完成验证'
  }
}

function onAltchaVerified(ev: Event) {
  const detail = (ev as CustomEvent<AltchaVerifiedDetail>).detail
  if (!detail?.payload) return
  token.value = detail.payload
  altchaState.value = 'verified'
  clearReadyTimer()
  showAltchaUi.value = false
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
  token.value = ''
  if (provider.value === 'altcha') {
    altchaState.value = 'unverified'
    showAltchaUi.value = false
    statusText.value = '安全验证中…'
    fallbackTriggered = false
    altchaEl.value?.reset?.()
    void nextTick(() => {
      void altchaEl.value?.verify?.()
      startReadyTimer()
    })
    return
  }
  turnstile.value?.reset?.()
}

function remove() {
  clearReadyTimer()
  probeAbort?.abort()
  unbindAltchaEvents(altchaEl.value)
  turnstile.value?.remove?.()
}

watch(altchaEl, (el, prev) => {
  unbindAltchaEvents(prev)
  bindAltchaEvents(el)
})

onMounted(() => {
  if (provider.value === 'altcha') {
    startReadyTimer()
    void probeAltchaChallenge()
  }
})

onUnmounted(() => {
  remove()
})

defineExpose({
  reset,
  remove,
  provider,
})
</script>

<template>
  <div class="captcha-widget">
    <template v-if="provider === 'altcha'">
      <p
        v-if="showStatus"
        class="captcha-widget__status"
      >
        {{ statusText }}
      </p>
      <div
        class="captcha-widget__altcha"
        :class="{ 'captcha-widget__altcha--visible': showAltchaUi }"
        :aria-hidden="showAltchaUi ? undefined : 'true'"
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

    <VueTurnstile
      v-else
      ref="turnstile"
      v-model="token"
      :site-key="TURNSTILE_KEY"
      :theme="turnstileTheme"
      size="flexible"
      class="captcha-widget__turnstile"
    />
  </div>
</template>

<style scoped>
.captcha-widget {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.captcha-widget__status {
  margin: 0;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  line-height: 1.4;
}

.captcha-widget__altcha {
  width: 100%;
  max-width: 360px;
}

/* 默认不占布局；code/error 时由 overlay 弹出，外层也放开 */
.captcha-widget__altcha:not(.captcha-widget__altcha--visible) {
  position: fixed;
  inset: 0;
  z-index: 0;
  width: 0;
  height: 0;
  overflow: visible;
  pointer-events: none;
  opacity: 0;
}

.captcha-widget__altcha--visible {
  position: relative;
  z-index: 1;
  width: 100%;
  height: auto;
  opacity: 1;
  pointer-events: auto;
}

.captcha-widget__turnstile {
  display: flex;
  justify-content: center;
}
</style>
