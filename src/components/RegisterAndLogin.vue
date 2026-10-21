<script setup lang="ts">
import { Dismiss16Regular } from '@vicons/fluent'
import { computed, onUnmounted, ref, watch } from 'vue'

import { GetSelfAccount, useAccount } from '@/api/account'
import type { AccountInfo } from '@/api/api-models'
import {
  postApiAccountLogin,
  postApiAccountRegister,
  postApiAccountResetPassword,
} from '@/api/generated/account/account'
import { cookie } from '@/api/auth'
import { QueryRequestError } from '@/api/query'
import CaptchaWidget from '@/apps/user/components/CaptchaWidget.vue'
import { refreshCaptcha, requestWithCaptchaRetry } from '@/shared/captcha'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { toast } from '@/shared/utils'

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

const props = withDefaults(
  defineProps<{
    closable?: boolean
    initialTab?: 'login' | 'register'
  }>(),
  {
    closable: false,
    initialTab: 'login',
  },
)

const emit = defineEmits<{
  close: []
  success: [accountId: number | undefined]
}>()

const account = useAccount()

const registerModel = ref<RegisterModel>({
  username: '',
  email: '',
  password: '',
  reenteredPassword: '',
})

const loginModel = ref<LoginModel>({
  account: '',
  password: '',
})

const token = ref('')
const turnstile = ref<InstanceType<typeof CaptchaWidget>>()

const selectedTab = ref<'login' | 'register' | 'forget'>(props.initialTab)
const inputForgetPasswordValue = ref('')
const isForgetPassword = ref(false)
const canSendForgetPassword = ref(true)
const forgetCountdown = ref(0)
let forgetTimer: number | undefined

const activeAction = ref<AuthAction>('idle')
const progressState = ref<AuthProgressState>('idle')
const feedbackTone = ref<AuthFeedbackTone>('info')
const feedbackText = ref('')
const activeController = ref<AbortController | null>(null)

let slowTimer: number | undefined
let feedbackResetTimer: number | undefined

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
    if (!token.value) {
      return { tone: 'warning', text: '先完成人机验证，再提交注册' }
    }
    return { tone: 'info', text: '验证已完成' }
  }

  if (selectedTab.value === 'forget') {
    if (!token.value) {
      return { tone: 'warning', text: '先完成人机验证，再发送密码重置邮件' }
    }
    if (!canSendForgetPassword.value) {
      return { tone: 'success', text: '重置邮件已经发送，如果没有收到请检查邮箱的垃圾箱，或稍后重试发送' }
    }
    return { tone: 'info', text: '验证完成后即可发送邮件' }
  }

  return { tone: 'info', text: '输入账号和密码进行登录' }
})

const currentFeedbackTone = computed(() => {
  return progressState.value === 'idle' ? defaultFeedback.value.tone : feedbackTone.value
})

const currentFeedbackText = computed(() => {
  return progressState.value === 'idle' ? defaultFeedback.value.text : feedbackText.value
})

const loginButtonText = computed(() => {
  if (!loginPending.value) return '登录并继续'
  return progressState.value === 'slow' ? '登录中，网络较慢...' : '正在登录...'
})

const registerButtonText = computed(() => {
  if (!registerPending.value) return '创建账号并继续'
  return progressState.value === 'slow' ? '注册中，网络较慢...' : '正在注册...'
})

const forgetButtonText = computed(() => {
  if (!forgetPending.value) return '发送重置邮件'
  return progressState.value === 'slow' ? '发送中，网络较慢...' : '正在发送...'
})

watch(selectedTab, () => {
  if (!isRequestPending.value) {
    resetProgressFeedback()
  }
})

function clearSlowTimer() {
  if (slowTimer !== undefined) {
    window.clearTimeout(slowTimer)
    slowTimer = undefined
  }
}

function clearFeedbackResetTimer() {
  if (feedbackResetTimer !== undefined) {
    window.clearTimeout(feedbackResetTimer)
    feedbackResetTimer = undefined
  }
}

function scheduleFeedbackReset(delay = 5000) {
  clearFeedbackResetTimer()
  feedbackResetTimer = window.setTimeout(() => {
    if (!isRequestPending.value) {
      resetProgressFeedback()
    }
  }, delay)
}

function setFeedback(state: AuthProgressState, tone: AuthFeedbackTone, text: string, autoResetMs?: number) {
  progressState.value = state
  feedbackTone.value = tone
  feedbackText.value = text

  if (autoResetMs) {
    scheduleFeedbackReset(autoResetMs)
  } else {
    clearFeedbackResetTimer()
  }
}

function resetProgressFeedback() {
  progressState.value = 'idle'
  feedbackTone.value = 'info'
  feedbackText.value = ''
  clearFeedbackResetTimer()
}

function beginRequest(action: Exclude<AuthAction, 'idle'>, label: string) {
  clearFeedbackResetTimer()
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

function releaseRequest(controller?: AbortController | null) {
  clearSlowTimer()

  if (!controller || activeController.value === controller) {
    activeController.value = null
    activeAction.value = 'idle'
  }
}

function resetTurnstile() {
  token.value = ''
  turnstile.value?.reset?.()
}

function onForgetPasswordClick() {
  isForgetPassword.value = true
  selectedTab.value = 'forget'
  resetProgressFeedback()
}

function backToLogin() {
  selectedTab.value = 'login'
  resetProgressFeedback()
}

function cancelActiveRequest() {
  const controller = activeController.value
  if (!controller) return

  controller.abort()
  releaseRequest(controller)
  setFeedback('idle', 'warning', '当前请求已取消，你可以修改信息后立即重试。', 4000)
}

function closePanel() {
  if (isRequestPending.value) {
    cancelActiveRequest()
  }
  emit('close')
}

async function finalizeAuthenticatedSession(tokenValue: string, successMessage: string) {
  cookie.value = {
    cookie: tokenValue,
    refreshDate: Date.now(),
  }

  setFeedback('success', 'success', '认证成功，正在同步账号信息并继续下一步...')

  try {
    await GetSelfAccount()
    toast.success(successMessage)
    emit('success', account.value?.id)
    emit('close')
  } catch (error) {
    console.error('[Auth] 账号同步失败:', error)
    setFeedback('error', 'warning', '账号已登录，但同步当前账户信息失败。你可以关闭窗口继续，或稍后刷新页面。')
    toast.warning('账号已登录，但同步账户信息失败，请稍后刷新页面。')
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
    toast.error(`${actionLabel}超时，请重试。`)
    return
  }

  setFeedback('error', 'error', `${actionLabel}失败，请检查网络连接后重试。`)
  toast.error(requestError.message || `${actionLabel}失败`)
}

async function onRegisterButtonClick() {
  if (registerPending.value) return

  if (!registerModel.value.username.trim()) {
    setFeedback('error', 'warning', '请输入用户名', 4000)
    return
  }
  if (!registerModel.value.email.trim()) {
    setFeedback('error', 'warning', '请输入邮箱', 4000)
    return
  }
  if (!registerModel.value.password) {
    setFeedback('error', 'warning', '请输入密码', 4000)
    return
  }
  if (registerModel.value.password !== registerModel.value.reenteredPassword) {
    setFeedback('error', 'warning', '两次密码输入不一致', 4000)
    return
  }
  if (!token.value) {
    setFeedback('idle', 'warning', '请先完成人机验证，再提交注册。', 4000)
    return
  }

  const controller = beginRequest('register', '注册')

  try {
    const data = await requestWithCaptchaRetry<{ code: number; message?: string; data: string }>({
      getToken: () => token.value,
      refresh: () => refreshCaptcha(turnstile.value),
      request: (captchaToken) =>
        postApiAccountRegister(
          {
            name: registerModel.value.username,
            email: registerModel.value.email,
            password: registerModel.value.password,
          },
          {
            headers: { Turnstile: captchaToken },
            signal: controller.signal,
            timeoutMs: 8000,
            retryOnFailover: false,
          } as any,
        ) as any,
    })

    if (data.code !== 200) {
      const failureMessage = data.message || '注册失败'
      setFeedback('error', 'error', `无法完成注册：${failureMessage}`)
      toast.error(failureMessage)
      return
    }

    await finalizeAuthenticatedSession(data.data, '注册成功，请查收验证邮件')
  } catch (error) {
    handleRequestError('注册', error)
  } finally {
    releaseRequest(controller)
    resetTurnstile()
  }
}

async function onLoginButtonClick() {
  if (loginPending.value) return

  if (!loginModel.value.account.trim()) {
    setFeedback('error', 'warning', '请输入用户名 / 邮箱 / B站 UID', 4000)
    return
  }
  if (!loginModel.value.password) {
    setFeedback('error', 'warning', '请输入密码', 4000)
    return
  }

  const controller = beginRequest('login', '登录')

  try {
    const data = (await postApiAccountLogin(
      {
        nameOrEmail: loginModel.value.account,
        password: loginModel.value.password,
      },
      {
        signal: controller.signal,
        timeoutMs: 8000,
        retryOnFailover: false,
      } as any,
    )) as unknown as {
      code: number
      message?: string
      data: {
        account: AccountInfo
        token: string
      }
    }

    if (data.code !== 200) {
      setFeedback('error', 'error', data.message || '登录失败')
      toast.error(data.message || '登录失败')
      return
    }

    await finalizeAuthenticatedSession(data.data.token, `成功登录为 ${data.data.account.name}`)
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
    setFeedback('idle', 'warning', '请先完成人机验证，再发送重置邮件。', 4000)
    return
  }

  const controller = beginRequest('forget', '重置密码')

  try {
    const data = await requestWithCaptchaRetry<{ code: number; message?: string; data: string }>({
      getToken: () => token.value,
      refresh: () => refreshCaptcha(turnstile.value),
      request: (captchaToken) =>
        postApiAccountResetPassword(
          { email: inputForgetPasswordValue.value.trim() },
          {
            headers: { Turnstile: captchaToken },
            signal: controller.signal,
            timeoutMs: 8000,
            retryOnFailover: false,
          },
        ) as Promise<{ code: number; message?: string; data: string }>,
    })

    if (data.code !== 200) {
      setFeedback('error', 'error', data.message || '发送失败')
      toast.error(data.message || '发送失败')
      return
    }

    canSendForgetPassword.value = false
    forgetCountdown.value = 60
    forgetTimer = window.setInterval(() => {
      forgetCountdown.value -= 1
      if (forgetCountdown.value <= 0) {
        clearInterval(forgetTimer)
        canSendForgetPassword.value = true
      }
    }, 1000)
    setFeedback('success', 'success', '重置链接已发送到邮箱，请检查收件箱或垃圾箱。')
    toast.success('已发送密码重置链接到你的邮箱，请检查。')
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
  if (forgetTimer) clearInterval(forgetTimer)
  turnstile.value?.remove?.()
})
</script>

<template>
  <section class="account-auth text-xs text-foreground">
    <header class="flex items-center justify-between gap-3 pb-3 border-b border-border/60">
      <h2 class="text-base font-semibold m-0 text-foreground">登录或注册</h2>
      <div class="flex items-center gap-2">
        <slot name="header-extra" />
        <Button
          v-if="props.closable"
          variant="ghost"
          size="icon"
          class="size-7 rounded-full text-muted-foreground hover:text-foreground"
          title="关闭"
          aria-label="关闭"
          @click="closePanel"
        >
          <component :is="Dismiss16Regular" class="size-4" />
        </Button>
      </div>
    </header>

    <div
      v-if="isLoggedInNow"
      class="py-6 flex flex-col items-center justify-center gap-3 text-center"
    >
      <p class="text-sm font-medium text-emerald-600 dark:text-emerald-400 m-0">
        已以 {{ currentAccountName }} 登录，当前页面会自动解锁后续操作。
      </p>
      <Button
        v-if="props.closable"
        size="sm"
        class="text-xs"
        @click="closePanel"
      >
        继续
      </Button>
    </div>

    <div
      v-else
      class="pt-3 space-y-3"
    >
      <!-- 提示反馈行 -->
      <div
        class="p-2.5 rounded-lg border flex items-center gap-2 text-xs"
        :class="{
          'bg-muted/40 border-border/80 text-muted-foreground': currentFeedbackTone === 'info',
          'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400': currentFeedbackTone === 'warning',
          'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400': currentFeedbackTone === 'success',
          'bg-destructive/10 border-destructive/30 text-destructive': currentFeedbackTone === 'error',
        }"
        role="status"
        aria-live="polite"
      >
        <span
          class="size-1.5 rounded-full shrink-0"
          :class="{
            'bg-muted-foreground': currentFeedbackTone === 'info',
            'bg-amber-500': currentFeedbackTone === 'warning',
            'bg-emerald-500': currentFeedbackTone === 'success',
            'bg-destructive': currentFeedbackTone === 'error',
          }"
        />
        <span class="flex-1 leading-relaxed">{{ currentFeedbackText }}</span>
      </div>

      <Tabs
        :model-value="selectedTab"
        class="w-full"
        @update:model-value="selectedTab = $event as any"
      >
        <TabsList class="grid w-full h-8" :class="isForgetPassword ? 'grid-cols-3' : 'grid-cols-2'">
          <TabsTrigger value="login" class="text-xs">登录</TabsTrigger>
          <TabsTrigger value="register" class="text-xs">注册</TabsTrigger>
          <TabsTrigger v-if="isForgetPassword" value="forget" class="text-xs">忘记密码</TabsTrigger>
        </TabsList>

        <!-- 登录面板 -->
        <TabsContent value="login" class="pt-3 space-y-3">
          <div class="space-y-1">
            <label class="font-medium text-foreground text-xs">用户名 / 邮箱 / B站 UID</label>
            <Input
              v-model="loginModel.account"
              placeholder="输入用户名 / 邮箱 / B站 UID"
              autocomplete="username"
              class="h-8 text-xs"
            />
          </div>

          <div class="space-y-1">
            <label class="font-medium text-foreground text-xs">密码</label>
            <Input
              v-model="loginModel.password"
              type="password"
              placeholder="输入密码"
              autocomplete="current-password"
              class="h-8 text-xs"
              @keydown.enter="onLoginButtonClick"
            />
          </div>

          <div class="flex items-center justify-between pt-1">
            <button
              type="button"
              class="text-xs text-muted-foreground hover:text-foreground transition underline-offset-4 hover:underline"
              @click="onForgetPasswordClick"
            >
              忘记密码
            </button>

            <div class="flex items-center gap-2">
              <Button
                v-if="loginPending"
                variant="outline"
                size="sm"
                class="text-xs"
                @click="cancelActiveRequest"
              >
                取消
              </Button>
              <Button
                size="sm"
                class="text-xs"
                :disabled="isBusy && !loginPending"
                @click="onLoginButtonClick"
              >
                {{ loginButtonText }}
              </Button>
            </div>
          </div>
        </TabsContent>

        <!-- 注册面板 -->
        <TabsContent value="register" class="pt-3 space-y-3">
          <div class="space-y-1">
            <label class="font-medium text-foreground text-xs">用户名</label>
            <Input
              v-model="registerModel.username"
              placeholder="输入一个用户名，不允许纯数字"
              autocomplete="username"
              class="h-8 text-xs"
            />
          </div>

          <div class="space-y-1">
            <label class="font-medium text-foreground text-xs">邮箱</label>
            <Input
              v-model="registerModel.email"
              type="email"
              placeholder="请输入可接收邮件的邮箱"
              autocomplete="email"
              class="h-8 text-xs"
            />
          </div>

          <div class="space-y-1">
            <label class="font-medium text-foreground text-xs">密码</label>
            <Input
              v-model="registerModel.password"
              type="password"
              placeholder="输入密码，需要包含英文和数字"
              autocomplete="new-password"
              class="h-8 text-xs"
            />
          </div>

          <div class="space-y-1">
            <label class="font-medium text-foreground text-xs">重复密码</label>
            <Input
              v-model="registerModel.reenteredPassword"
              type="password"
              placeholder="再次输入密码"
              autocomplete="new-password"
              class="h-8 text-xs"
              @keydown.enter="onRegisterButtonClick"
            />
          </div>

          <div class="flex items-center justify-end gap-2 pt-1">
            <Button
              v-if="registerPending"
              variant="outline"
              size="sm"
              class="text-xs"
              @click="cancelActiveRequest"
            >
              取消
            </Button>
            <Button
              size="sm"
              class="text-xs"
              :disabled="!canSubmitRegister"
              @click="onRegisterButtonClick"
            >
              {{ registerButtonText }}
            </Button>
          </div>
        </TabsContent>

        <!-- 忘记密码面板 -->
        <TabsContent v-if="isForgetPassword" value="forget" class="pt-3 space-y-3">
          <p class="text-xs text-muted-foreground leading-relaxed m-0">
            已关联 B 站的账号，也可以重新认证身份后设置新密码。
          </p>

          <Button
            as="a"
            href="/bili-auth"
            variant="outline"
            size="sm"
            class="w-full text-xs"
          >
            通过 B 站认证重置密码
          </Button>

          <div class="space-y-1">
            <label class="font-medium text-foreground text-xs">注册邮箱</label>
            <Input
              v-model="inputForgetPasswordValue"
              type="email"
              placeholder="请输入注册邮箱"
              class="h-8 text-xs"
            />
          </div>

          <div class="flex items-center justify-between pt-1">
            <button
              type="button"
              class="text-xs text-muted-foreground hover:text-foreground transition underline-offset-4 hover:underline"
              @click="backToLogin"
            >
              返回登录
            </button>

            <div class="flex items-center gap-2">
              <Button
                v-if="forgetPending"
                variant="outline"
                size="sm"
                class="text-xs"
                @click="cancelActiveRequest"
              >
                取消
              </Button>
              <Button
                size="sm"
                class="text-xs"
                :disabled="!canSubmitForget"
                @click="onForgetPassword"
              >
                {{ forgetButtonText }}
              </Button>
            </div>
          </div>

          <p
            v-if="!canSendForgetPassword"
            class="text-center text-xs text-muted-foreground m-0"
          >
            {{ forgetCountdown }} 秒后可重新发送
          </p>
        </TabsContent>
      </Tabs>

      <!-- 人机验证区域 -->
      <section
        v-if="selectedTab !== 'login'"
        class="pt-2 flex justify-center"
      >
        <CaptchaWidget
          :key="selectedTab"
          ref="turnstile"
          v-model="token"
          :action="selectedTab === 'register' ? 'register' : undefined"
        />
      </section>
    </div>
  </section>
</template>
