<script setup lang="ts">
import type {
  FormInst,
  FormItemInst,
  FormItemRule,
  FormRules,
} from 'naive-ui'
import type { AccountInfo } from '@/api/api-models'
import { NButton, NCard, NCountdown, NDivider, NFlex, NForm, NFormItem, NInput, NTabPane, NTabs, NText, useMessage } from 'naive-ui'
import { computed, onUnmounted, ref, watch } from 'vue'
import VueTurnstile from 'vue-turnstile'
import { GetSelfAccount, useAccount } from '@/api/account'
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

const props = withDefaults(defineProps<{
  closable?: boolean
}>(), {
  closable: false,
})

const emit = defineEmits<{
  close: []
  success: [accountId: number | undefined]
}>()

const message = useMessage()
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
const turnstile = ref<{ reset?: () => void, remove?: () => void }>()

const selectedTab = ref<'login' | 'register' | 'forget'>('login')
const inputForgetPasswordValue = ref('')
const isForgetPassword = ref(false)
const canSendForgetPassword = ref(true)

const loginFormRef = ref<FormInst | null>(null)
const registerFormRef = ref<FormInst | null>(null)
const rPasswordFormItemRef = ref<FormItemInst | null>(null)

const activeAction = ref<AuthAction>('idle')
const progressState = ref<AuthProgressState>('idle')
const feedbackTone = ref<AuthFeedbackTone>('info')
const feedbackText = ref('')
const activeController = ref<AbortController | null>(null)

let slowTimer: number | undefined
let feedbackResetTimer: number | undefined

const registerRules: FormRules = {
  username: [
    {
      required: true,
      message: '请输入用户名',
    },
  ],
  email: [
    {
      required: true,
      message: '请输入邮箱',
    },
  ],
  password: [
    {
      required: true,
      message: '请输入密码',
    },
  ],
  reenteredPassword: [
    {
      required: true,
      message: '请再次输入密码',
      trigger: ['input', 'blur'],
    },
    {
      validator: validatePasswordStartWith,
      message: '两次密码输入不一致',
      trigger: 'input',
    },
    {
      validator: validatePasswordSame,
      message: '两次密码输入不一致',
      trigger: ['blur', 'password-input'],
    },
  ],
}

const loginRules: FormRules = {
  account: [
    {
      required: true,
      message: '请输入用户名或邮箱',
    },
  ],
  password: [
    {
      required: true,
      message: '请输入密码',
    },
  ],
}

const isLoggedInNow = computed(() => Boolean(cookie.value?.cookie))
const currentAccountName = computed(() => account.value?.name || '当前账号')
const isRequestPending = computed(() => progressState.value === 'submitting' || progressState.value === 'slow')
const loginPending = computed(() => isRequestPending.value && activeAction.value === 'login')
const registerPending = computed(() => isRequestPending.value && activeAction.value === 'register')
const forgetPending = computed(() => isRequestPending.value && activeAction.value === 'forget')
const isBusy = computed(() => loginPending.value || registerPending.value || forgetPending.value)
const canSubmitRegister = computed(() => Boolean(token.value) && !isBusy.value)
const canSubmitForget = computed(() => Boolean(token.value) && canSendForgetPassword.value && !isBusy.value)

const defaultFeedback = computed<{ tone: AuthFeedbackTone, text: string }>(() => {
  if (selectedTab.value === 'register') {
    if (!token.value) {
      return {
        tone: 'warning',
        text: '先完成人机验证，再提交注册',
      }
    }

    return {
      tone: 'info',
      text: '验证已完成',
    }
  }

  if (selectedTab.value === 'forget') {
    if (!token.value) {
      return {
        tone: 'warning',
        text: '先完成人机验证，再发送密码重置邮件',
      }
    }

    if (!canSendForgetPassword.value) {
      return {
        tone: 'success',
        text: '重置邮件已经发送，如果没有收到请检查邮箱的垃圾箱，或稍后重试发送',
      }
    }

    return {
      tone: 'info',
      text: '验证完成后即可发送邮件',
    }
  }

  return {
    tone: 'info',
    text: '输入账号和密码进行登陆',
  }
})

const currentFeedbackTone = computed(() => {
  return progressState.value === 'idle' ? defaultFeedback.value.tone : feedbackTone.value
})

const currentFeedbackText = computed(() => {
  return progressState.value === 'idle' ? defaultFeedback.value.text : feedbackText.value
})

const currentFeedbackType = computed(() => {
  if (progressState.value === 'idle') return undefined
  return currentFeedbackTone.value
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

function validatePasswordStartWith(rule: FormItemRule, value: string): boolean {
  return (
    !!registerModel.value.password
    && registerModel.value.password.startsWith(value)
    && registerModel.value.password.length >= value.length
  )
}

function validatePasswordSame(rule: FormItemRule, value: string): boolean {
  return value === registerModel.value.password
}

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

function setFeedback(
  state: AuthProgressState,
  tone: AuthFeedbackTone,
  text: string,
  autoResetMs?: number,
) {
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

function onPasswordInput() {
  if (registerModel.value.reenteredPassword) {
    rPasswordFormItemRef.value?.validate({ trigger: 'password-input' })
  }
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

async function validateForm(formRef: FormInst | null, messageText: string) {
  try {
    await formRef?.validate()
    return true
  } catch {
    setFeedback('error', 'warning', messageText, 4000)
    return false
  }
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
    message.success(successMessage)
    emit('success', account.value.id)
    emit('close')
  } catch (error) {
    console.error('[Auth] 账号同步失败:', error)
    setFeedback('error', 'warning', '账号已登录，但同步当前账户信息失败。你可以关闭窗口继续，或稍后刷新页面。')
    message.warning('账号已登录，但同步账户信息失败，请稍后刷新页面。')
  }
}

function handleRequestError(actionLabel: string, error: unknown) {
  const requestError = error instanceof QueryRequestError
    ? error
    : new QueryRequestError('network', `${actionLabel}失败`, error)

  if (requestError.kind === 'aborted') {
    setFeedback('idle', 'warning', `${actionLabel}已取消，你可以立即重试。`, 4000)
    return
  }

  if (requestError.kind === 'timeout') {
    setFeedback('timeout', 'error', `${actionLabel}等待超时，系统已切换到备用节点，请重试。`)
    message.error(`${actionLabel}超时，请重试。`)
    return
  }

  setFeedback('error', 'error', `${actionLabel}失败，请检查网络连接后重试。`)
  message.error(requestError.message || `${actionLabel}失败`)
}

async function onRegisterButtonClick() {
  if (registerPending.value) return

  const valid = await validateForm(registerFormRef.value, '请先修正注册表单中的问题。')
  if (!valid) return

  if (!token.value) {
    setFeedback('idle', 'warning', '请先完成人机验证，再提交注册。', 4000)
    return
  }

  const controller = beginRequest('register', '注册')

  try {
    const data = await QueryPostAPI<string>(
      `${ACCOUNT_API_URL}register`,
      {
        name: registerModel.value.username,
        email: registerModel.value.email,
        password: registerModel.value.password,
      },
      [['Turnstile', token.value]],
      undefined,
      {
        signal: controller.signal,
        timeoutMs: 8000,
        retryOnFailover: false,
      },
    )

    if (data.code !== 200) {
      const failureMessage = data.message || '注册失败'
      setFeedback('error', 'error', `无法完成注册：${failureMessage}`)
      message.error(failureMessage)
      return
    }

    await finalizeAuthenticatedSession(data.data, '注册成功')
  } catch (error) {
    handleRequestError('注册', error)
  } finally {
    releaseRequest(controller)
    resetTurnstile()
  }
}

async function onLoginButtonClick() {
  if (loginPending.value) return

  const valid = await validateForm(loginFormRef.value, '请先补全登录信息。')
  if (!valid) return

  const controller = beginRequest('login', '登录')

  try {
    const data = await QueryPostAPI<{
      account: AccountInfo
      token: string
    }>(
      `${ACCOUNT_API_URL}login`,
      {
        nameOrEmail: loginModel.value.account,
        password: loginModel.value.password,
      },
      undefined,
      undefined,
      {
        signal: controller.signal,
        timeoutMs: 8000,
        retryOnFailover: false,
      },
    )

    if (data.code !== 200) {
      setFeedback('error', 'error', data.message || '登录失败')
      message.error(data.message || '登录失败')
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
    const data = await QueryGetAPI(
      `${ACCOUNT_API_URL}reset-password`,
      { email: inputForgetPasswordValue.value.trim() },
      [['Turnstile', token.value]],
      {
        signal: controller.signal,
        timeoutMs: 8000,
        retryOnFailover: false,
      },
    )

    if (data.code !== 200) {
      setFeedback('error', 'error', data.message || '发送失败')
      message.error(data.message || '发送失败')
      return
    }

    canSendForgetPassword.value = false
    setFeedback('success', 'success', '重置链接已发送到邮箱，请检查收件箱或垃圾箱。')
    message.success('已发送密码重置链接到你的邮箱，请检查。')
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
  turnstile.value?.remove?.()
})
</script>

<template>
  <NCard embedded>
    <template #header>
      <NFlex justify="space-between" align="center">
        <NText strong>
          账号认证
        </NText>
        <NFlex align="center" size="small">
          <slot name="header-extra" />
          <NButton
            v-if="props.closable"
            text
            @click="closePanel"
          >
            关闭
          </NButton>
        </NFlex>
      </NFlex>
    </template>

    <template v-if="isLoggedInNow">
      <NFlex vertical size="large">
        <NText type="success">
          已以 {{ currentAccountName }} 登录，当前页面会自动解锁后续操作。
        </NText>
        <NFlex
          v-if="props.closable"
          justify="end"
        >
          <NButton
            type="primary"
            @click="closePanel"
          >
            继续
          </NButton>
        </NFlex>
      </NFlex>
    </template>

    <template v-else>
      <NFlex vertical size="large">
        <NText
          :type="currentFeedbackType"
          :depth="currentFeedbackType ? undefined : 3"
        >
          {{ currentFeedbackText }}
        </NText>

        <NTabs
          v-model:value="selectedTab"
          size="large"
          animated
        >
          <NTabPane
            name="login"
            tab="登录"
          >
            <NForm
              ref="loginFormRef"
              :rules="loginRules"
              :model="loginModel"
            >
              <NFormItem
                path="account"
                label="用户名或邮箱"
              >
                <NInput
                  v-model:value="loginModel.account"
                  placeholder="输入用户名或邮箱"
                />
              </NFormItem>
              <NFormItem
                path="password"
                label="密码"
              >
                <NInput
                  v-model:value="loginModel.password"
                  type="password"
                  placeholder="输入密码"
                  @keydown.enter="onLoginButtonClick"
                />
              </NFormItem>
            </NForm>

            <NFlex vertical size="medium">
              <NButton
                text
                secondary
                @click="onForgetPasswordClick"
              >
                忘记密码
              </NButton>
              <NFlex justify="end">
                <NButton
                  v-if="loginPending"
                  secondary
                  @click="cancelActiveRequest"
                >
                  取消
                </NButton>
                <NButton
                  :loading="loginPending"
                  :disabled="isBusy && !loginPending"
                  type="primary"
                  size="large"
                  @click="onLoginButtonClick"
                >
                  {{ loginButtonText }}
                </NButton>
              </NFlex>
            </NFlex>
          </NTabPane>

          <NTabPane
            name="register"
            tab="注册"
          >
            <NForm
              ref="registerFormRef"
              :rules="registerRules"
              :model="registerModel"
            >
              <NFormItem
                path="username"
                label="用户名"
              >
                <NInput
                  v-model:value="registerModel.username"
                  placeholder="输入一个用户名，不允许纯数字"
                />
              </NFormItem>
              <NFormItem
                path="email"
                label="邮箱"
              >
                <NInput
                  v-model:value="registerModel.email"
                  placeholder="请输入可接收邮件的邮箱"
                />
              </NFormItem>
              <NFormItem
                path="password"
                label="密码"
              >
                <NInput
                  v-model:value="registerModel.password"
                  type="password"
                  placeholder="输入密码，需要包含英文和数字"
                  @input="onPasswordInput"
                  @keydown.enter.prevent
                />
              </NFormItem>
              <NFormItem
                ref="rPasswordFormItemRef"
                first
                path="reenteredPassword"
                label="重复密码"
              >
                <NInput
                  v-model:value="registerModel.reenteredPassword"
                  :disabled="!registerModel.password"
                  type="password"
                  placeholder="再次输入密码"
                  @keydown.enter="onRegisterButtonClick"
                />
              </NFormItem>
            </NForm>

            <NFlex vertical size="medium">
              <NFlex justify="end">
                <NButton
                  v-if="registerPending"
                  secondary
                  @click="cancelActiveRequest"
                >
                  取消
                </NButton>
                <NButton
                  :loading="registerPending"
                  :disabled="!canSubmitRegister"
                  type="primary"
                  size="large"
                  @click="onRegisterButtonClick"
                >
                  {{ registerButtonText }}
                </NButton>
              </NFlex>
            </NFlex>
          </NTabPane>

          <NTabPane
            v-if="isForgetPassword"
            name="forget"
            tab="忘记密码"
          >
            <NFlex vertical size="medium">
              <NInput
                v-model:value="inputForgetPasswordValue"
                placeholder="请输入邮箱"
                maxlength="64"
              />

              <NFlex justify="space-between" align="center">
                <NButton
                  text
                  secondary
                  @click="backToLogin"
                >
                  返回登录
                </NButton>
                <NFlex justify="end">
                  <NButton
                    v-if="forgetPending"
                    secondary
                    @click="cancelActiveRequest"
                  >
                    取消
                  </NButton>
                  <NButton
                    :loading="forgetPending"
                    :disabled="!canSubmitForget"
                    type="primary"
                    size="large"
                    @click="onForgetPassword"
                  >
                    {{ forgetButtonText }}
                  </NButton>
                </NFlex>
              </NFlex>

              <NCountdown
                v-if="!canSendForgetPassword"
                :duration="60000"
                @finish="canSendForgetPassword = true"
              />
            </NFlex>
          </NTabPane>
        </NTabs>

        <template v-if="selectedTab !== 'login'">
          <NDivider />
          <NFlex vertical size="small">
            <NText depth="3">
              {{ token ? '安全验证已完成，可以继续提交。' : '先完成人机验证，再解锁注册和密码找回操作。' }}
            </NText>
            <VueTurnstile
              ref="turnstile"
              v-model="token"
              :site-key="TURNSTILE_KEY"
              theme="auto"
            />
          </NFlex>
        </template>
      </NFlex>
    </template>
  </NCard>
</template>
