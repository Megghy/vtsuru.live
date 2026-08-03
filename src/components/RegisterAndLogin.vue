<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import VueTurnstile from 'vue-turnstile'

import { GetSelfAccount, useAccount } from '@/api/account'
import type { AccountInfo } from '@/api/api-models'
import { cookie } from '@/api/auth'
import { QueryGetAPI, QueryPostAPI, QueryRequestError } from '@/api/query'
import { ACCOUNT_API_URL, TURNSTILE_KEY } from '@/shared/config'

interface RegisterModel {
  username: string
  email: string
  password: string
  reenteredPassword: string
}

interface LoginModel {
  account: string
  password: string
}

type AuthAction = 'idle' | 'login' | 'register' | 'forget'
type AuthFeedbackTone = 'info' | 'warning' | 'success' | 'error'
type AuthProgressState = 'idle' | 'submitting' | 'slow' | 'success' | 'error' | 'timeout'

const props = withDefaults(defineProps<{ closable?: boolean }>(), { closable: false })
const emit = defineEmits<{ close: []; success: [accountId: number | undefined] }>()

const toast = useToast()
const account = useAccount()
const registerModel = ref<RegisterModel>({ username: '', email: '', password: '', reenteredPassword: '' })
const loginModel = ref<LoginModel>({ account: '', password: '' })
const token = ref('')
const turnstile = ref<{ reset?: () => void; remove?: () => void }>()
const selectedTab = ref<'login' | 'register' | 'forget'>('login')
const inputForgetPasswordValue = ref('')
const isForgetPassword = ref(false)
const canSendForgetPassword = ref(true)
const forgetCooldownSeconds = ref(0)
const activeAction = ref<AuthAction>('idle')
const progressState = ref<AuthProgressState>('idle')
const feedbackTone = ref<AuthFeedbackTone>('info')
const feedbackText = ref('')
const activeController = ref<AbortController>()

let slowTimer: number | undefined
let feedbackResetTimer: number | undefined
let forgetCooldownTimer: number | undefined

const isLoggedInNow = computed(() => Boolean(cookie.value?.cookie))
const currentAccountName = computed(() => account.value?.name || '当前账号')
const isRequestPending = computed(() => progressState.value === 'submitting' || progressState.value === 'slow')
const loginPending = computed(() => isRequestPending.value && activeAction.value === 'login')
const registerPending = computed(() => isRequestPending.value && activeAction.value === 'register')
const forgetPending = computed(() => isRequestPending.value && activeAction.value === 'forget')
const isBusy = computed(() => loginPending.value || registerPending.value || forgetPending.value)
const canSubmitRegister = computed(() => Boolean(token.value) && !isBusy.value)
const canSubmitForget = computed(() => Boolean(token.value) && canSendForgetPassword.value && !isBusy.value)
const defaultFeedback = computed<{ tone: AuthFeedbackTone; text: string }>(() => {
  if (selectedTab.value === 'register') {
    return token.value ? { tone: 'info', text: '验证已完成' } : { tone: 'warning', text: '先完成人机验证，再提交注册' }
  }

  if (selectedTab.value === 'forget') {
    if (!token.value) return { tone: 'warning', text: '先完成人机验证，再发送密码重置邮件' }
    if (!canSendForgetPassword.value) {
      return { tone: 'success', text: '重置邮件已经发送，如果没有收到请检查邮箱的垃圾箱，或稍后重试发送' }
    }
    return { tone: 'info', text: '验证完成后即可发送邮件' }
  }

  return { tone: 'info', text: '输入账号和密码进行登录' }
})
const currentFeedbackTone = computed(() =>
  progressState.value === 'idle' ? defaultFeedback.value.tone : feedbackTone.value,
)
const currentFeedbackText = computed(() =>
  progressState.value === 'idle' ? defaultFeedback.value.text : feedbackText.value,
)
const loginButtonText = computed(() =>
  !loginPending.value ? '登录并继续' : progressState.value === 'slow' ? '登录中，网络较慢...' : '正在登录...',
)
const registerButtonText = computed(() =>
  !registerPending.value ? '创建账号并继续' : progressState.value === 'slow' ? '注册中，网络较慢...' : '正在注册...',
)
const forgetButtonText = computed(() =>
  !forgetPending.value ? '发送重置邮件' : progressState.value === 'slow' ? '发送中，网络较慢...' : '正在发送...',
)

watch(selectedTab, () => {
  if (!isRequestPending.value) resetProgressFeedback()
})

function clearSlowTimer() {
  if (slowTimer === undefined) return
  window.clearTimeout(slowTimer)
  slowTimer = undefined
}

function clearFeedbackResetTimer() {
  if (feedbackResetTimer === undefined) return
  window.clearTimeout(feedbackResetTimer)
  feedbackResetTimer = undefined
}

function setFeedback(state: AuthProgressState, tone: AuthFeedbackTone, text: string, resetAfter?: number) {
  progressState.value = state
  feedbackTone.value = tone
  feedbackText.value = text
  clearFeedbackResetTimer()

  if (resetAfter) {
    feedbackResetTimer = window.setTimeout(() => {
      if (!isRequestPending.value) resetProgressFeedback()
    }, resetAfter)
  }
}

function resetProgressFeedback() {
  progressState.value = 'idle'
  feedbackTone.value = 'info'
  feedbackText.value = ''
  clearFeedbackResetTimer()
}

function beginRequest(action: Exclude<AuthAction, 'idle'>, label: string) {
  clearSlowTimer()
  const controller = new AbortController()
  activeAction.value = action
  activeController.value = controller
  setFeedback('submitting', 'info', `${label}请求已发送，正在等待服务器响应...`)
  slowTimer = window.setTimeout(() => {
    if (activeController.value === controller) {
      setFeedback('slow', 'warning', `${label}等待时间较长，你可以继续等待，也可以取消后重试。`)
    }
  }, 5000)
  return controller
}

function releaseRequest(controller?: AbortController) {
  clearSlowTimer()
  if (controller && activeController.value !== controller) return
  activeController.value = undefined
  activeAction.value = 'idle'
}

function resetTurnstile() {
  token.value = ''
  turnstile.value?.reset?.()
}

function validateLogin() {
  if (loginModel.value.account.trim() && loginModel.value.password) return true
  setFeedback('error', 'warning', '请先补全登录信息。', 4000)
  return false
}

function validateRegister() {
  if (!registerModel.value.username.trim() || !registerModel.value.email.trim() || !registerModel.value.password) {
    setFeedback('error', 'warning', '请先补全注册信息。', 4000)
    return false
  }
  if (registerModel.value.password !== registerModel.value.reenteredPassword) {
    setFeedback('error', 'warning', '两次密码输入不一致。', 4000)
    return false
  }
  return true
}

function startForgetCooldown() {
  canSendForgetPassword.value = false
  forgetCooldownSeconds.value = 60
  if (forgetCooldownTimer !== undefined) window.clearInterval(forgetCooldownTimer)
  forgetCooldownTimer = window.setInterval(() => {
    forgetCooldownSeconds.value -= 1
    if (forgetCooldownSeconds.value > 0) return
    if (forgetCooldownTimer !== undefined) window.clearInterval(forgetCooldownTimer)
    forgetCooldownTimer = undefined
    canSendForgetPassword.value = true
  }, 1000)
}

function cancelActiveRequest() {
  const controller = activeController.value
  if (!controller) return
  controller.abort()
  releaseRequest(controller)
  setFeedback('idle', 'warning', '当前请求已取消，你可以修改信息后立即重试。', 4000)
}

function closePanel() {
  if (isRequestPending.value) cancelActiveRequest()
  emit('close')
}

function showForgetPassword() {
  isForgetPassword.value = true
  selectedTab.value = 'forget'
}

function backToLogin() {
  selectedTab.value = 'login'
}

async function finalizeAuthenticatedSession(tokenValue: string, successMessage: string) {
  cookie.value = { cookie: tokenValue, refreshDate: Date.now() }
  setFeedback('success', 'success', '认证成功，正在同步账号信息并继续下一步...')

  try {
    await GetSelfAccount()
    toast.add({ title: successMessage, color: 'success' })
    emit('success', account.value.id)
    emit('close')
  } catch (error) {
    console.error('[Auth] 账号同步失败:', error)
    setFeedback('error', 'warning', '账号已登录，但同步当前账户信息失败。你可以关闭窗口继续，或稍后刷新页面。')
    toast.add({ title: '账号已登录，但同步账户信息失败，请稍后刷新页面。', color: 'warning' })
  }
}

function handleRequestError(actionLabel: string, error: unknown) {
  const requestError =
    error instanceof QueryRequestError ? error : new QueryRequestError('network', `${actionLabel}失败`, error)
  if (requestError.kind === 'aborted') {
    setFeedback('idle', 'warning', `${actionLabel}已取消，你可以立即重试。`, 4000)
    return
  }
  if (requestError.kind === 'timeout') {
    setFeedback('timeout', 'error', `${actionLabel}等待超时，系统已切换到备用节点，请重试。`)
    toast.add({ title: `${actionLabel}超时，请重试。`, color: 'error' })
    return
  }
  setFeedback('error', 'error', `${actionLabel}失败，请检查网络连接后重试。`)
  toast.add({ title: requestError.message || `${actionLabel}失败`, color: 'error' })
}

async function onRegisterButtonClick() {
  if (registerPending.value || !validateRegister()) return
  if (!token.value) {
    setFeedback('idle', 'warning', '请先完成人机验证，再提交注册。', 4000)
    return
  }

  const controller = beginRequest('register', '注册')
  try {
    const response = await QueryPostAPI<string>(
      `${ACCOUNT_API_URL}register`,
      { name: registerModel.value.username, email: registerModel.value.email, password: registerModel.value.password },
      [['Turnstile', token.value]],
      undefined,
      { signal: controller.signal, timeoutMs: 8000, retryOnFailover: false },
    )
    if (response.code !== 200) {
      const message = response.message || '注册失败'
      setFeedback('error', 'error', `无法完成注册：${message}`)
      toast.add({ title: message, color: 'error' })
      return
    }
    await finalizeAuthenticatedSession(response.data, '注册成功')
  } catch (error) {
    handleRequestError('注册', error)
  } finally {
    releaseRequest(controller)
    resetTurnstile()
  }
}

async function onLoginButtonClick() {
  if (loginPending.value || !validateLogin()) return
  const controller = beginRequest('login', '登录')
  try {
    const response = await QueryPostAPI<{ account: AccountInfo; token: string }>(
      `${ACCOUNT_API_URL}login`,
      { nameOrEmail: loginModel.value.account, password: loginModel.value.password },
      undefined,
      undefined,
      { signal: controller.signal, timeoutMs: 8000, retryOnFailover: false },
    )
    if (response.code !== 200) {
      setFeedback('error', 'error', response.message || '登录失败')
      toast.add({ title: response.message || '登录失败', color: 'error' })
      return
    }
    await finalizeAuthenticatedSession(response.data.token, `成功登录为 ${response.data.account.name}`)
  } catch (error) {
    handleRequestError('登录', error)
  } finally {
    releaseRequest(controller)
  }
}

async function onForgetPassword() {
  if (forgetPending.value) return
  if (!inputForgetPasswordValue.value.trim()) {
    setFeedback('error', 'warning', '请输入邮箱后再发送重置邮件。', 4000)
    return
  }
  if (!token.value) {
    setFeedback('idle', 'warning', '请先完成人机验证，再发送密码重置邮件。', 4000)
    return
  }

  const controller = beginRequest('forget', '重置密码')
  try {
    const response = await QueryGetAPI(
      `${ACCOUNT_API_URL}reset-password`,
      { email: inputForgetPasswordValue.value.trim() },
      [['Turnstile', token.value]],
      { signal: controller.signal, timeoutMs: 8000, retryOnFailover: false },
    )
    if (response.code !== 200) {
      setFeedback('error', 'error', response.message || '发送失败')
      toast.add({ title: response.message || '发送失败', color: 'error' })
      return
    }
    startForgetCooldown()
    setFeedback('success', 'success', '重置链接已发送到邮箱，请检查收件箱或垃圾箱。')
    toast.add({ title: '已发送密码重置链接到你的邮箱，请检查。', color: 'success' })
  } catch (error) {
    handleRequestError('重置密码', error)
  } finally {
    releaseRequest(controller)
    resetTurnstile()
  }
}

onUnmounted(() => {
  activeController.value?.abort()
  clearSlowTimer()
  clearFeedbackResetTimer()
  if (forgetCooldownTimer !== undefined) window.clearInterval(forgetCooldownTimer)
  turnstile.value?.remove?.()
})
</script>

<template>
  <UCard class="register-and-login">
    <template #header>
      <div class="register-and-login__header">
        <strong>账号认证</strong>
        <div class="register-and-login__header-actions">
          <slot name="header-extra" />
          <UButton
            v-if="closable"
            color="neutral"
            variant="ghost"
            size="sm"
            label="关闭"
            @click="closePanel"
          />
        </div>
      </div>
    </template>

    <template v-if="isLoggedInNow">
      <div class="register-and-login__logged-in">
        <UAlert
          color="success"
          variant="soft"
          :description="`已以 ${currentAccountName} 登录，当前页面会自动解锁后续操作。`"
        />
        <UButton
          v-if="closable"
          color="primary"
          label="继续"
          @click="closePanel"
        />
      </div>
    </template>

    <template v-else>
      <div class="register-and-login__content">
        <UAlert
          :color="currentFeedbackTone"
          variant="soft"
          :description="currentFeedbackText"
        />

        <div
          class="register-and-login__tabs"
          role="tablist"
        >
          <UButton
            :variant="selectedTab === 'login' ? 'soft' : 'ghost'"
            size="sm"
            label="登录"
            @click="selectedTab = 'login'"
          />
          <UButton
            :variant="selectedTab === 'register' ? 'soft' : 'ghost'"
            size="sm"
            label="注册"
            @click="selectedTab = 'register'"
          />
          <UButton
            v-if="isForgetPassword"
            :variant="selectedTab === 'forget' ? 'soft' : 'ghost'"
            size="sm"
            label="忘记密码"
            @click="selectedTab = 'forget'"
          />
        </div>

        <form
          v-if="selectedTab === 'login'"
          class="register-and-login__form"
          @submit.prevent="onLoginButtonClick"
        >
          <UFormField label="用户名或邮箱">
            <UInput
              v-model="loginModel.account"
              placeholder="输入用户名或邮箱"
            />
          </UFormField>
          <UFormField label="密码">
            <UInput
              v-model="loginModel.password"
              type="password"
              placeholder="输入密码"
            />
          </UFormField>
          <div class="register-and-login__form-actions">
            <UButton
              color="neutral"
              variant="link"
              size="sm"
              label="忘记密码"
              @click="showForgetPassword"
            />
            <div>
              <UButton
                v-if="loginPending"
                color="neutral"
                variant="soft"
                size="sm"
                label="取消"
                @click="cancelActiveRequest"
              />
              <UButton
                type="submit"
                color="primary"
                size="lg"
                :loading="loginPending"
                :disabled="isBusy && !loginPending"
                :label="loginButtonText"
              />
            </div>
          </div>
        </form>

        <form
          v-else-if="selectedTab === 'register'"
          class="register-and-login__form"
          @submit.prevent="onRegisterButtonClick"
        >
          <UFormField label="用户名">
            <UInput
              v-model="registerModel.username"
              placeholder="输入一个用户名，不允许纯数字"
            />
          </UFormField>
          <UFormField label="邮箱">
            <UInput
              v-model="registerModel.email"
              type="email"
              placeholder="请输入可接收邮件的邮箱"
            />
          </UFormField>
          <UFormField label="密码">
            <UInput
              v-model="registerModel.password"
              type="password"
              placeholder="输入密码，需要包含英文和数字"
            />
          </UFormField>
          <UFormField label="重复密码">
            <UInput
              v-model="registerModel.reenteredPassword"
              :disabled="!registerModel.password"
              type="password"
              placeholder="再次输入密码"
            />
          </UFormField>
          <div class="register-and-login__form-actions register-and-login__form-actions--end">
            <div>
              <UButton
                v-if="registerPending"
                color="neutral"
                variant="soft"
                size="sm"
                label="取消"
                @click="cancelActiveRequest"
              />
              <UButton
                type="submit"
                color="primary"
                size="lg"
                :loading="registerPending"
                :disabled="!canSubmitRegister"
                :label="registerButtonText"
              />
            </div>
          </div>
        </form>

        <form
          v-else
          class="register-and-login__form"
          @submit.prevent="onForgetPassword"
        >
          <UFormField label="邮箱">
            <UInput
              v-model="inputForgetPasswordValue"
              type="email"
              placeholder="请输入邮箱"
              maxlength="64"
            />
          </UFormField>
          <div class="register-and-login__form-actions">
            <UButton
              color="neutral"
              variant="link"
              size="sm"
              label="返回登录"
              @click="backToLogin"
            />
            <div>
              <UButton
                v-if="forgetPending"
                color="neutral"
                variant="soft"
                size="sm"
                label="取消"
                @click="cancelActiveRequest"
              />
              <UButton
                type="submit"
                color="primary"
                size="lg"
                :loading="forgetPending"
                :disabled="!canSubmitForget"
                :label="forgetButtonText"
              />
            </div>
          </div>
          <span
            v-if="!canSendForgetPassword"
            class="register-and-login__cooldown"
            >{{ forgetCooldownSeconds }} 秒后可重新发送</span
          >
        </form>

        <template v-if="selectedTab !== 'login'">
          <USeparator />
          <div class="register-and-login__turnstile">
            <p>{{ token ? '安全验证已完成，可以继续提交。' : '先完成人机验证，再解锁注册和密码找回操作。' }}</p>
            <VueTurnstile
              ref="turnstile"
              v-model="token"
              :site-key="TURNSTILE_KEY"
              theme="auto"
            />
          </div>
        </template>
      </div>
    </template>
  </UCard>
</template>

<style scoped>
.register-and-login__header,
.register-and-login__header-actions,
.register-and-login__tabs,
.register-and-login__form-actions,
.register-and-login__form-actions > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.register-and-login__header,
.register-and-login__form-actions {
  justify-content: space-between;
}

.register-and-login__content,
.register-and-login__logged-in,
.register-and-login__form,
.register-and-login__turnstile {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.register-and-login__tabs {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--vtsuru-border);
}

.register-and-login__form-actions--end {
  justify-content: flex-end;
}

.register-and-login__turnstile p,
.register-and-login__cooldown {
  margin: 0;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}
</style>
