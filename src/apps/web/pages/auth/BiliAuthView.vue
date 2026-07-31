<script setup lang="ts">
import {
  ArrowRight24Regular,
  CheckmarkCircle24Regular,
  Clock24Regular,
  Copy24Regular,
  Dismiss24Regular,
  Key24Regular,
  Live24Regular,
  LockClosed24Regular,
  Open24Regular,
  ShieldCheckmark24Regular,
} from '@vicons/fluent'
import { NButton, NCountdown, NIcon, NInput, NPopconfirm, NTooltip, useMessage } from 'naive-ui'
import { v4 as uuidv4 } from 'uuid'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { QueryGetAPI } from '@/api/query'
import HomeEmojiBackdrop from '@/apps/web/components/HomeEmojiBackdrop.vue'
import { BILI_AUTH_API_URL, CURRENT_HOST } from '@/shared/config'
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

const message = useMessage()
const biliAuth = useBiliAuth()
const guidKey = usePersistedStorage('Bili.Auth.Key', uuidv4())
const currentToken = usePersistedStorage<string | null>('Bili.Auth.Selected', null)
const startModel = ref<AuthStartModel>()
const currentStep = ref(currentToken.value ? 2 : 0)
const timeLeft = ref(0)
const timeOut = ref(false)
const isStarting = ref(false)
const authUrl = computed(() => `${CURRENT_HOST}bili-user?auth=${currentToken.value ?? ''}`)
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
    message.success('认证成功')
    return
  }

  if (response.code === 400 && currentStep.value === 1) {
    timeOut.value = true
    stopPolling()
    message.error('认证已超时')
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
    message.info('认证已开始，请前往直播间发送认证码')
  } catch (error) {
    message.error(`无法开启认证流程：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isStarting.value = false
  }
}

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success(successMessage)
  } catch {
    message.warning('无法复制，请手动选择内容')
  }
}

function restart() {
  stopPolling()
  startModel.value = undefined
  currentStep.value = 0
  timeOut.value = false
}

function authenticateAnotherAccount() {
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
              <NIcon
                v-if="currentStep > index"
                :component="CheckmarkCircle24Regular"
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
          <NIcon :component="ShieldCheckmark24Regular" />
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
              <NIcon :component="Key24Regular" />
            </div>
            <p class="state-kicker">准备认证</p>
            <h2>用弹幕完成身份确认</h2>
            <p class="state-summary">开始后，你会获得一个一次性认证码。请在 5 分钟内用需要认证的账号发送它。</p>

            <div class="quick-facts">
              <span><NIcon :component="Clock24Regular" />大约 1 分钟</span>
              <span><NIcon :component="Live24Regular" />需要打开直播间</span>
            </div>

            <NButton
              type="primary"
              size="large"
              block
              color="#fb7299"
              text-color="#ffffff"
              :loading="isStarting"
              class="primary-action"
              @click="startVerify"
            >
              开始认证
              <template #icon>
                <NIcon :component="ArrowRight24Regular" />
              </template>
            </NButton>
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
              <strong><NCountdown :duration="timeLeft" /></strong>
            </div>

            <div class="verification-code">
              <span>{{ startModel?.code }}</span>
              <NTooltip>
                <template #trigger>
                  <NButton
                    quaternary
                    circle
                    aria-label="复制认证码"
                    @click="copyText(startModel?.code ?? '', '已复制认证码')"
                  >
                    <template #icon><NIcon :component="Copy24Regular" /></template>
                  </NButton>
                </template>
                复制认证码
              </NTooltip>
            </div>

            <NButton
              tag="a"
              :href="`https://live.bilibili.com/${startModel?.targetRoomId}`"
              target="_blank"
              rel="noopener noreferrer"
              type="primary"
              size="large"
              block
              color="#00aeec"
              text-color="#ffffff"
              class="primary-action"
            >
              前往直播间
              <template #icon><NIcon :component="Open24Regular" /></template>
            </NButton>
            <p class="waiting-note">发送后页面会自动完成认证，无需刷新。</p>
          </div>

          <div
            v-else-if="currentStep === 1"
            key="timeout"
            class="state-content"
          >
            <div class="state-icon state-icon--error">
              <NIcon :component="Dismiss24Regular" />
            </div>
            <p class="state-kicker state-kicker--error">认证已结束</p>
            <h2>本次认证已超时</h2>
            <p class="state-summary">一次性认证码已经失效，请重新开始认证流程。</p>
            <NButton
              size="large"
              block
              class="primary-action"
              @click="restart"
            >
              重新开始
            </NButton>
          </div>

          <div
            v-else
            key="success"
            class="state-content"
          >
            <div class="state-icon state-icon--success">
              <NIcon :component="CheckmarkCircle24Regular" />
            </div>
            <p class="state-kicker state-kicker--success">认证完成</p>
            <h2>账户已成功连接</h2>
            <p class="state-summary">你的专属登录链接已经生成，可用于在其他浏览器中恢复登录。</p>

            <label
              class="login-link-label"
              for="bili-login-link"
              >专属登录链接</label
            >
            <NInput
              id="bili-login-link"
              :value="authUrl"
              readonly
              class="login-link-input"
            >
              <template #suffix>
                <NTooltip>
                  <template #trigger>
                    <NButton
                      text
                      aria-label="复制登录链接"
                      @click="copyText(authUrl, '已复制登录链接')"
                    >
                      <template #icon><NIcon :component="Copy24Regular" /></template>
                    </NButton>
                  </template>
                  复制登录链接
                </NTooltip>
              </template>
            </NInput>

            <div class="security-notice">
              <NIcon :component="LockClosed24Regular" />
              <p><strong>请妥善保管此链接</strong><span>任何获得链接的人都能以你的身份登录。</span></p>
            </div>

            <div class="success-actions">
              <NButton
                type="primary"
                size="large"
                color="#18a058"
                text-color="#ffffff"
                @click="$router.push({ name: 'bili-user' })"
              >
                前往个人中心
                <template #icon><NIcon :component="ArrowRight24Regular" /></template>
              </NButton>
              <NPopconfirm
                positive-text="继续"
                negative-text="取消"
                @positive-click="authenticateAnotherAccount"
              >
                <template #trigger>
                  <NButton size="large">认证其他账号</NButton>
                </template>
                这会退出当前账号。请先保存登录链接，再继续认证其他账号。
              </NPopconfirm>
            </div>
          </div>
        </Transition>
      </section>
    </div>
  </main>
</template>

<style scoped src="./BiliAuthView.css"></style>
