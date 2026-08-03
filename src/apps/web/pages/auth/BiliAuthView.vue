<script setup lang="ts">
import { v4 as uuidv4 } from 'uuid'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { QueryGetAPI } from '@/api/query'
import { createBiliAuthUrl } from '@/apps/account/components/biliAuthCredential'
import HomeEmojiBackdrop from '@/apps/web/components/HomeEmojiBackdrop.vue'
import { BILI_AUTH_API_URL, CURRENT_HOST } from '@/shared/config'
import { showErrorToast, showInfoToast, showSuccessToast, showWarningToast } from '@/shared/services/toast'
import { usePersistedStorage } from '@/shared/storage/persist'
import { useBiliAuth } from '@/store/useBiliAuth'
import BilibiliIcon from '@/svgs/social/bilibili.svg?component'

interface AuthStartModel {
  code: string
  endAt: number
  startAt: number
  targetRoomId: number
}

const steps = [
  { title: '准备认证', detail: '创建一次性认证流程' },
  { title: '直播间确认', detail: '使用目标账号发送认证码' },
  { title: '完成连接', detail: '保存专属登录链接' },
]

const router = useRouter()
const biliAuth = useBiliAuth()
const guidKey = usePersistedStorage('Bili.Auth.Key', uuidv4())
const currentToken = usePersistedStorage<string | null>('Bili.Auth.Selected', null)
const startModel = ref<AuthStartModel>()
const currentStep = ref(currentToken.value ? 2 : 0)
const timeLeft = ref(0)
const timeOut = ref(false)
const isStarting = ref(false)
const confirmAnotherAccount = ref(false)
const authUrl = computed(() => createBiliAuthUrl(CURRENT_HOST, currentToken.value ?? ''))
const countdown = computed(() => {
  const seconds = Math.max(0, Math.ceil(timeLeft.value / 1000))
  const minutes = Math.floor(seconds / 60)
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
})
let timer: ReturnType<typeof setInterval> | undefined

function stopPolling() {
  clearInterval(timer)
  timer = undefined
}

function startPolling(interval: number) {
  stopPolling()
  timer = setInterval(() => {
    void syncStatus().catch((error) => console.error('[bili-auth] 查询认证状态失败', error))
  }, interval)
}

function updateTimeLeft() {
  if (!startModel.value) return
  timeLeft.value = startModel.value.endAt - Date.now()
  timeOut.value = timeLeft.value <= 0
  if (timeOut.value) stopPolling()
}

async function syncStatus() {
  const response = await QueryGetAPI(`${BILI_AUTH_API_URL}status`, { key: guidKey.value })

  if (response.code === 201) {
    startModel.value = response.data as AuthStartModel
    currentStep.value = 1
    updateTimeLeft()
    return
  }

  if (response.code === 200) {
    stopPolling()
    currentToken.value = response.data as string
    void biliAuth.setCurrentAuth(currentToken.value)
    guidKey.value = uuidv4()
    currentStep.value = 2
    showSuccessToast('认证成功')
    return
  }

  if (response.code === 400 && currentStep.value === 1) {
    timeOut.value = true
    stopPolling()
    showErrorToast('认证已超时')
  }
}

async function startVerify() {
  isStarting.value = true
  try {
    const response = await QueryGetAPI<AuthStartModel>(`${BILI_AUTH_API_URL}start`, { key: guidKey.value })
    if (response.code !== 200) throw new Error(response.message)

    startModel.value = response.data
    currentStep.value = 1
    timeOut.value = false
    updateTimeLeft()
    startPolling(2500)
    showInfoToast('认证已开始，请前往直播间发送认证码')
  } catch (error) {
    showErrorToast(`无法开启认证流程：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isStarting.value = false
  }
}

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text)
    showSuccessToast(successMessage)
  } catch {
    showWarningToast('无法复制，请手动选择内容')
  }
}

function restart() {
  stopPolling()
  startModel.value = undefined
  currentStep.value = 0
  timeOut.value = false
}

function authenticateAnotherAccount() {
  confirmAnotherAccount.value = false
  restart()
  currentToken.value = null
  guidKey.value = uuidv4()
}

onMounted(async () => {
  if (currentToken.value) return
  try {
    await syncStatus()
    if (currentStep.value === 1 && !timeOut.value) startPolling(5000)
  } catch (error) {
    console.error('[bili-auth] 恢复认证状态失败', error)
  }
})

onBeforeUnmount(stopPolling)
</script>

<template>
  <main class="bili-auth-page">
    <HomeEmojiBackdrop variant="bilibili" />

    <div class="auth-shell">
      <section class="auth-overview">
        <div class="brand-lockup">
          <span class="brand-mark">
            <BilibiliIcon />
          </span>
          <span class="brand-name">VTsuru <i>×</i> Bilibili</span>
        </div>

        <div class="overview-copy">
          <p class="eyebrow">ACCOUNT CONNECTION</p>
          <h1>连接你的<br /><span>Bilibili 账户</span></h1>
          <p class="overview-lead">通过一条直播间弹幕确认身份，连接后即可使用面向观众的互动功能。</p>
        </div>

        <ol class="auth-steps">
          <li
            v-for="(step, index) in steps"
            :key="step.title"
            :class="{
              'is-active': currentStep === index,
              'is-complete': currentStep > index,
            }"
          >
            <span class="step-marker">
              <UIcon
                v-if="currentStep > index"
                name="i-lucide-circle-check"
              />
              <span v-else>{{ index + 1 }}</span>
            </span>
            <span class="step-copy">
              <strong>{{ step.title }}</strong>
              <small>{{ step.detail }}</small>
            </span>
          </li>
        </ol>

        <div class="trust-note">
          <UIcon name="i-lucide-shield-check" />
          <p><strong>无需密码或 Cookie</strong><span>认证码仅用于确认当前 Bilibili 账号归属。</span></p>
        </div>
      </section>

      <section class="auth-action">
        <Transition
          name="auth-state"
          mode="out-in"
        >
          <div
            v-if="currentStep === 0"
            key="ready"
            class="state-content"
          >
            <div class="state-icon state-icon--brand">
              <UIcon name="i-lucide-key-round" />
            </div>
            <p class="state-kicker">准备认证</p>
            <h2>用弹幕完成身份确认</h2>
            <p class="state-summary">开始后，你会获得一个一次性认证码。请在 5 分钟内用需要认证的账号发送它。</p>

            <div class="quick-facts">
              <span><UIcon name="i-lucide-clock-3" />大约 1 分钟</span>
              <span><UIcon name="i-lucide-radio" />需要打开直播间</span>
            </div>

            <UButton
              size="xl"
              block
              trailing-icon="i-lucide-arrow-right"
              :loading="isStarting"
              class="primary-action"
              @click="startVerify"
            >
              开始认证
            </UButton>
          </div>

          <div
            v-else-if="currentStep === 1 && !timeOut"
            key="verifying"
            class="state-content"
          >
            <div class="live-status"><i />正在等待直播间消息</div>
            <h2>发送这条认证码</h2>
            <p class="state-summary">复制认证码，用目标 Bilibili 账号发送到指定直播间。</p>

            <div class="countdown-row">
              <span>剩余时间</span>
              <strong>{{ countdown }}</strong>
            </div>

            <div class="verification-code">
              <span>{{ startModel?.code }}</span>
              <UTooltip text="复制认证码">
                <UButton
                  color="neutral"
                  variant="ghost"
                  square
                  icon="i-lucide-copy"
                  aria-label="复制认证码"
                  @click="copyText(startModel?.code ?? '', '已复制认证码')"
                />
              </UTooltip>
            </div>

            <UButton
              as="a"
              :href="`https://live.bilibili.com/${startModel?.targetRoomId}`"
              target="_blank"
              rel="noopener noreferrer"
              size="xl"
              block
              trailing-icon="i-lucide-external-link"
              class="primary-action"
            >
              前往直播间
            </UButton>
            <p class="waiting-note">发送后页面会自动完成认证，无需刷新。</p>
          </div>

          <div
            v-else-if="currentStep === 1"
            key="timeout"
            class="state-content"
          >
            <div class="state-icon state-icon--error">
              <UIcon name="i-lucide-circle-x" />
            </div>
            <p class="state-kicker state-kicker--error">认证已结束</p>
            <h2>本次认证已超时</h2>
            <p class="state-summary">一次性认证码已经失效，请重新开始认证流程。</p>
            <UButton
              size="xl"
              block
              class="primary-action"
              @click="restart"
            >
              重新开始
            </UButton>
          </div>

          <div
            v-else
            key="success"
            class="state-content"
          >
            <div class="state-icon state-icon--success">
              <UIcon name="i-lucide-circle-check" />
            </div>
            <p class="state-kicker state-kicker--success">认证完成</p>
            <h2>账户已成功连接</h2>
            <p class="state-summary">你的专属登录链接已经生成，可用于在其他浏览器中恢复登录。</p>

            <label
              class="login-link-label"
              for="bili-login-link"
              >专属登录链接</label
            >
            <UFieldGroup class="login-link-input">
              <UInput
                id="bili-login-link"
                :model-value="authUrl"
                type="password"
                readonly
                class="login-link-field"
              />
              <UTooltip text="复制登录链接">
                <UButton
                  color="neutral"
                  variant="soft"
                  icon="i-lucide-copy"
                  aria-label="复制登录链接"
                  @click="copyText(authUrl, '已复制登录链接')"
                />
              </UTooltip>
            </UFieldGroup>

            <div class="security-notice">
              <UIcon name="i-lucide-lock-keyhole" />
              <p><strong>请妥善保管此链接</strong><span>任何获得链接的人都能以你的身份登录。</span></p>
            </div>

            <div class="success-actions">
              <UButton
                size="xl"
                color="success"
                trailing-icon="i-lucide-arrow-right"
                @click="router.push({ name: 'bili-user-points' })"
              >
                前往 Bilibili 账户中心
              </UButton>
              <UButton
                size="xl"
                color="neutral"
                variant="soft"
                @click="confirmAnotherAccount = true"
              >
                认证其他账号
              </UButton>
            </div>
          </div>
        </Transition>
      </section>
    </div>

    <UModal
      v-model:open="confirmAnotherAccount"
      title="认证其他账号"
      description="这会退出当前账号。请先保存登录链接，再继续认证其他账号。"
    >
      <template #footer>
        <div class="confirm-actions">
          <UButton
            color="neutral"
            variant="ghost"
            @click="confirmAnotherAccount = false"
          >
            取消
          </UButton>
          <UButton @click="authenticateAnotherAccount">继续</UButton>
        </div>
      </template>
    </UModal>
  </main>
</template>

<style scoped src="./BiliAuthView.css"></style>
