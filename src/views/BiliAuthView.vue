<script setup lang="ts">
import { QueryGetAPI } from '@/api/query'
import { BILI_AUTH_API_URL, CURRENT_HOST } from '@/data/constants'
import { useBiliAuth } from '@/store/useBiliAuth'
import { useStorage, useBreakpoints as useVueUseBreakpoints, breakpointsTailwind } from '@vueuse/core'
import {
  NAlert,
  NButton,
  NCard,
  NCountdown,
  NFlex,
  NInput,
  NInputGroup,
  NPopconfirm,
  NSpace,
  NSpin,
  NStep,
  NSteps,
  NText,
  useMessage,
} from 'naive-ui'
import { v4 as uuidv4 } from 'uuid'
import { computed, onMounted, ref } from 'vue'

type AuthStartModel = {
  code: string
  endAt: number
  startAt: number
  targetRoomId: number
}

const message = useMessage()
const breakpoints = useVueUseBreakpoints(breakpointsTailwind)
const isSmallScreen = breakpoints.smaller('md')

const guidKey = useStorage('Bili.Auth.Key', uuidv4())
const currentToken = useStorage<string>('Bili.Auth.Selected', null)
const useAuth = useBiliAuth()

const startModel = ref<AuthStartModel>()

const currentStep = ref(currentToken.value ? 2 : 0)

const isStart = computed(() => {
  return currentStep.value > 0
})
const timeLeft = ref(0)
const timeOut = ref(false)

const timer = ref()

function onStartVerify() {
  QueryGetAPI<AuthStartModel>(BILI_AUTH_API_URL + 'start', {
    key: guidKey.value,
  }).then((data) => {
    if (data.code == 200) {
      message.info('已开始认证流程, 请前往直播间发送认证码')
      checkStatus()
      currentStep.value = 1
      timer.value = setInterval(checkStatus, 2500)
      startModel.value = data.data
    } else {
      message.error('无法开启认证流程: ' + data.message)
    }
  })
}
async function checkStatus() {
  const data = await QueryGetAPI(BILI_AUTH_API_URL + 'status', {
    key: guidKey.value,
  })
  if (data.code == 201) {
    startModel.value = data.data as AuthStartModel
    checkTimeLeft()
    return true
  } else if (data.code == 200) {
    clearInterval(timer.value)
    message.success('认证成功')

    guidKey.value = uuidv4()
    useAuth.setCurrentAuth(data.data as string)

    currentStep.value = 2

    return true
  } else if (data.code == 400 && isStart.value) {
    timeOut.value = true
    clearInterval(timer.value)
    message.error('认证超时')
    return false
  }
  return false
}
function checkTimeLeft() {
  if (startModel.value) {
    timeLeft.value = startModel.value.endAt - Date.now()
    if (timeLeft.value <= 0) {
      timeOut.value = true
    }
  }
}
function copyCode() {
  const textToCopy = currentStep.value === 2
    ? `${CURRENT_HOST}bili-user?auth=${currentToken.value}`
    : startModel.value?.code ?? ''

  if (navigator.clipboard && textToCopy) {
    navigator.clipboard.writeText(textToCopy)
    message.success(currentStep.value === 2 ? '已复制登陆链接到剪切板' : '已复制认证码到剪切板')
  } else {
    message.warning('无法复制内容, 请手动选择并复制')
  }
}

onMounted(async () => {
  if (!currentToken.value) {
    if (await checkStatus()) {
      currentStep.value = 1
      timer.value = setInterval(checkStatus, 5000)
    }
  }
})
</script>

<template>
  <div class="auth-container">
    <NCard
      embedded
      class="auth-card"
    >
      <template #header>
        <div class="auth-header">
          <NText class="auth-title">
            Bilibili 身份验证
          </NText>
        </div>
      </template>

      <div class="auth-content">
        <!-- 步骤指示器 -->
        <div class="steps-container">
          <NSteps
            :current="currentStep + 1"
            vertical
            :size="isSmallScreen ? 'small' : 'medium'"
            class="auth-steps"
          >
            <NStep
              title="准备认证"
              description="开始认证前的准备工作"
            />
            <NStep
              title="进行认证"
              description="在指定直播间输入验证码"
            />
            <NStep
              title="认证完成"
              description="验证成功，获取登录链接"
            />
          </NSteps>
        </div>

        <!-- 内容区域 -->
        <div class="content-container">
          <!-- 步骤1: 进行认证 -->
          <div
            v-if="currentStep === 1"
            class="step-content"
          >
            <template v-if="!timeOut">
              <div class="auth-progress">
                <NSpin size="large" />
                <NText class="countdown-text">
                  剩余时间：<NCountdown :duration="timeLeft" />
                </NText>
              </div>

              <div class="verification-section">
                <NText
                  depth="2"
                  class="instruction-text"
                >
                  请复制下方的认证码，并前往指定直播间发送：
                </NText>

                <div class="code-input-section">
                  <NInputGroup class="code-input-group">
                    <NInput
                      :value="startModel?.code"
                      readonly
                      placeholder="认证码"
                      class="code-input"
                    />
                    <NButton
                      type="primary"
                      class="copy-button"
                      @click="copyCode"
                    >
                      复制
                    </NButton>
                  </NInputGroup>
                </div>

                <NButton
                  type="info"
                  tag="a"
                  :href="'https://live.bilibili.com/' + startModel?.targetRoomId"
                  target="_blank"
                  class="live-room-button"
                  size="large"
                >
                  前往直播间
                </NButton>
              </div>
            </template>

            <NAlert
              v-else
              type="error"
              title="认证超时"
              class="timeout-alert"
            >
              <div class="timeout-content">
                <NText depth="3">
                  认证时间已过，请重新开始认证流程
                </NText>
                <NButton
                  type="error"
                  size="large"
                  class="restart-button"
                  @click="
                    () => {
                      currentStep = 0
                      timeOut = false
                    }
                  "
                >
                  重新开始认证
                </NButton>
              </div>
            </NAlert>
          </div>

          <!-- 步骤0: 准备认证 -->
          <div
            v-else-if="currentStep === 0"
            class="step-content"
          >
            <div class="start-section">
              <NAlert
                type="info"
                class="info-alert"
              >
                <div class="info-content">
                  <NText>
                    点击 <NText
                      type="primary"
                      strong
                    >
                      开始认证
                    </NText> 后请在 5 分钟之内使用
                    <NText
                      strong
                      type="primary"
                    >
                      需要认证的B站账户
                    </NText>
                    在指定的直播间内发送给出的验证码
                  </NText>
                </div>
              </NAlert>

              <div class="start-button-section">
                <NButton
                  size="large"
                  type="primary"
                  class="start-button"
                  @click="onStartVerify"
                >
                  开始认证
                </NButton>
              </div>
            </div>
          </div>

          <!-- 步骤2: 认证完成 -->
          <div
            v-else-if="currentStep === 2"
            class="step-content"
          >
            <div class="success-section">
              <NAlert
                type="success"
                title="验证成功！"
                class="success-alert"
              >
                <div class="success-content">
                  <NText>
                    您已完成验证！请妥善保存您的登录链接，请勿让其他人获取。
                    丢失后可以再次通过认证流程获得。
                  </NText>
                  <br><br>
                  <NText depth="2">
                    要在其他地方登录，或者需要重新登录时，
                    请将此链接复制到浏览器地址栏打开即可。
                  </NText>
                </div>
              </NAlert>

              <div class="login-link-section">
                <NText
                  strong
                  class="link-label"
                >
                  您的登录链接：
                </NText>
                <NInput
                  :value="`${CURRENT_HOST}bili-user?auth=${currentToken}`"
                  type="textarea"
                  readonly
                  class="login-link-input"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                />
                <div class="link-actions">
                  <NButton
                    type="primary"
                    size="large"
                    class="copy-link-button"
                    @click="copyCode"
                  >
                    复制登录链接
                  </NButton>
                </div>
              </div>

              <div class="action-buttons">
                <NButton
                  type="primary"
                  size="large"
                  class="dashboard-button"
                  @click="$router.push({ name: 'bili-user' })"
                >
                  前往个人中心
                </NButton>
                <NPopconfirm
                  positive-text="继续"
                  negative-text="取消"
                  @positive-click="
                    () => {
                      currentStep = 0
                      //@ts-ignore
                      currentToken = null
                      guidKey = uuidv4()
                    }
                  "
                >
                  <template #trigger>
                    <NButton
                      type="warning"
                      size="large"
                      class="auth-other-button"
                    >
                      认证其他账号
                    </NButton>
                  </template>
                  这将会登出当前已认证的账号，请先保存您的登录链接再认证其他账号
                </NPopconfirm>
              </div>
            </div>
          </div>
        </div>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.auth-container {
  min-height: 100vh;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, var(--n-color-target) 0%, var(--n-modal-color) 100%);
}

.auth-card {
  width: 100%;
  max-width: 1000px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border-radius: 12px;
}

.auth-header {
  text-align: center;
  padding: 10px 0;
}

.auth-title {
  font-size: 1.5em;
  font-weight: 600;
  color: var(--n-text-color);
}

.auth-content {
  display: flex;
  gap: 30px;
  min-height: 400px;
  border-top: 1px solid var(--n-border-color);
}

.steps-container {
  flex-shrink: 0;
  min-width: 240px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.auth-steps {
  padding: 20px 0;
}

.content-container {
  flex: 1;
  padding-left: 30px;
  border-left: 1px solid var(--n-border-color);
  display: flex;
  margin-top: 20px;
  align-items: center;
  justify-content: center;
}

.step-content {
  width: 100%;
  max-width: 500px;
}

/* 进行认证步骤样式 */
.auth-progress {
  text-align: center;
  margin-bottom: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.countdown-text {
  margin-top: 20px;
  font-size: 1.1em;
  font-weight: 500;
}

.verification-section {
  text-align: center;
}

.instruction-text {
  margin-bottom: 20px;
  line-height: 1.6;
}

.code-input-section {
  margin: 25px 0;
}

.code-input-group {
  max-width: 320px;
  margin: 0 auto;
}

.code-input {
  text-align: center;
  font-size: 1.3em;
  letter-spacing: 3px;
  font-weight: 600;
}

.copy-button {
  font-weight: 500;
}

.live-room-button {
  margin-top: 25px;
  font-weight: 500;
  padding: 0 30px;
}

.timeout-alert {
  text-align: center;
}

.timeout-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.restart-button {
  font-weight: 500;
  padding: 0 30px;
}

/* 准备认证步骤样式 */
.start-section {
  text-align: center;
}

.info-alert {
  margin-bottom: 30px;
}

.info-content {
  line-height: 1.7;
}

.start-button-section {
  margin-top: 30px;
}

.start-button {
  font-weight: 500;
  padding: 0 40px;
  height: 50px;
  font-size: 1.1em;
}

/* 认证完成步骤样式 */
.success-section {
  text-align: center;
}

.success-alert {
  margin-bottom: 30px;
  text-align: left;
}

.success-content {
  line-height: 1.7;
}

.login-link-section {
  margin-bottom: 30px;
  text-align: left;
}

.link-label {
  display: block;
  margin-bottom: 10px;
  font-size: 1.05em;
}

.login-link-input {
  margin-bottom: 15px;
  font-family: monospace;
}

.link-actions {
  text-align: right;
}

.copy-link-button {
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 15px;
  justify-content: center;
  flex-wrap: wrap;
}

.dashboard-button,
.auth-other-button {
  font-weight: 500;
  padding: 0 25px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .auth-container {
    padding: 15px;
  }

  .auth-content {
    flex-direction: column;
    gap: 20px;
    min-height: auto;
  }

  .steps-container {
    min-width: auto;
  }

  .content-container {
    padding-left: 0;
    border-left: none;
    border-top: 1px solid var(--n-border-color);
    padding-top: 20px;
  }

  .auth-title {
    font-size: 1.3em;
  }

  .code-input {
    font-size: 1.1em;
    letter-spacing: 2px;
  }

  .action-buttons {
    flex-direction: column;
    align-items: stretch;
  }

  .dashboard-button,
  .auth-other-button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .auth-container {
    padding: 10px;
  }

  .start-button {
    width: 100%;
    max-width: 280px;
  }

  .live-room-button {
    width: 100%;
    max-width: 200px;
  }
}
</style>
