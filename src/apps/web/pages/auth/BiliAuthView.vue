<script setup lang="ts">
import {
  ArrowRight24Regular,
  CheckmarkCircle24Regular,
  Clock24Regular,
  Copy24Regular,
  Dismiss24Regular,
  Eye24Regular,
  EyeOff24Regular,
  Key24Regular,
  Live24Regular,
  LockClosed24Regular,
  Open24Regular,
  ShieldCheckmark24Regular,
} from '@vicons/fluent'
import { v4 as uuidv4 } from 'uuid'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { prepareBiliAccount } from '@/api/account'
import type { BiliAccountProof } from '@/api/account'
import { getApiBiliAuthStatus, postApiBiliAuthStart } from '@/api/generated/bili-auth-v2/bili-auth-v2'
import BiliAccountSetup from '@/apps/account/components/BiliAccountSetup.vue'
import { createBiliAuthUrl } from '@/apps/account/components/biliAuthCredential'
import HomeEmojiBackdrop from '@/apps/web/components/HomeEmojiBackdrop.vue'
import { CURRENT_HOST } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { toast } from '@/shared/utils'
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
  { title: '完成连接', detail: '设置本站登录密码' },
]

const biliAuth = useBiliAuth()
const guidKey = usePersistedStorage('Bili.Auth.Key', uuidv4())
const currentToken = computed(() => (biliAuth.usesAccountIdentity ? null : biliAuth.currentToken))
const accountProof = ref<BiliAccountProof>()
const accountSetupError = ref('')
const startModel = ref<AuthStartModel>()
const currentStep = ref(currentToken.value ? 2 : 0)
const timeLeft = ref(0)
const timeOut = ref(false)
const isStarting = ref(false)
const showPasswordLink = ref(false)
const authUrl = computed(() => createBiliAuthUrl(CURRENT_HOST, currentToken.value ?? ''))
let timer: ReturnType<typeof setInterval> | undefined
let countdownTimer: ReturnType<typeof setInterval> | undefined
let pendingStatus: Promise<void> | undefined

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
  timeLeft.value = Math.max(0, startModel.value.endAt - Date.now())
  timeOut.value = timeLeft.value <= 0
  if (timeOut.value) {
    stopPolling()
    clearInterval(countdownTimer)
  }
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function syncStatus() {
  pendingStatus ??= readStatus().finally(() => {
    pendingStatus = undefined
  })
  return pendingStatus
}

async function readStatus() {
  const key = guidKey.value
  const response = await getApiBiliAuthStatus({ key })
  if (key !== guidKey.value) return

  if (response.code === 201) {
    startModel.value = response.data as AuthStartModel
    currentStep.value = 1
    updateTimeLeft()
    return
  }

  if (response.code === 200) {
    stopPolling()
    clearInterval(countdownTimer)
    if (!biliAuth.usesAccountIdentity) await biliAuth.setCurrentAuth(response.data as string)
    const prepared = await prepareBiliAccount(key)
    if (key !== guidKey.value) return
    accountProof.value = prepared.code === 200 ? prepared.data : undefined
    accountSetupError.value = prepared.code === 200 ? '' : prepared.message
    guidKey.value = uuidv4()
    currentStep.value = 2
    toast.success('认证成功')
    return
  }

  if (response.code === 400 && currentStep.value === 1) {
    timeOut.value = true
    stopPolling()
    clearInterval(countdownTimer)
    toast.error('认证已超时')
  }
}

async function startVerify() {
  isStarting.value = true
  try {
    const response = (await postApiBiliAuthStart({
      key: guidKey.value,
    })) as unknown as {
      code: number
      message?: string
      data: AuthStartModel
    }
    if (response.code !== 200) throw new Error(response.message)

    startModel.value = response.data
    currentStep.value = 1
    timeOut.value = false
    updateTimeLeft()
    clearInterval(countdownTimer)
    countdownTimer = setInterval(updateTimeLeft, 1000)
    startPolling(2500)
    toast.info('认证已开始，请前往直播间发送认证码')
  } catch (error) {
    toast.error(`无法开启认证流程：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isStarting.value = false
  }
}

async function copyText(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(successMessage)
  } catch {
    toast.warning('无法复制，请手动选择内容')
  }
}

function restart() {
  stopPolling()
  clearInterval(countdownTimer)
  startModel.value = undefined
  currentStep.value = 0
  timeOut.value = false
  accountProof.value = undefined
  accountSetupError.value = ''
}

function authenticateAnotherAccount() {
  restart()
  if (!biliAuth.usesAccountIdentity) biliAuth.logout()
  guidKey.value = uuidv4()
}

onMounted(async () => {
  if (currentToken.value) return
  try {
    await syncStatus()
    if (currentStep.value === 1 && !timeOut.value) {
      clearInterval(countdownTimer)
      countdownTimer = setInterval(updateTimeLeft, 1000)
      startPolling(5000)
    }
  } catch (error) {
    console.error('[bili-auth] 恢复认证状态失败', error)
  }
})

onBeforeUnmount(() => {
  stopPolling()
  clearInterval(countdownTimer)
})
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
              <component
                :is="CheckmarkCircle24Regular"
                v-if="currentStep > index"
                class="size-5"
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
          <component
            :is="ShieldCheckmark24Regular"
            class="size-5 shrink-0"
          />
          <p><strong>无需 B 站密码或 Cookie</strong><span>认证码仅用于确认当前 Bilibili 账号归属。</span></p>
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
              <component
                :is="Key24Regular"
                class="size-6"
              />
            </div>
            <p class="state-kicker">准备认证</p>
            <h2>用弹幕完成身份确认</h2>
            <p class="state-summary">开始后，你会获得一个一次性认证码。请在 5 分钟内用需要认证的账号发送它。</p>

            <div class="quick-facts">
              <span
                ><component
                  :is="Clock24Regular"
                  class="size-4"
                />大约 1 分钟</span
              >
              <span
                ><component
                  :is="Live24Regular"
                  class="size-4"
                />需要打开直播间</span
              >
            </div>

            <Button
              size="lg"
              class="w-full bg-[#fb7299] hover:bg-[#fb7299]/90 text-white flex items-center justify-center gap-2"
              :disabled="isStarting"
              @click="startVerify"
            >
              {{ isStarting ? '处理中...' : '开始认证' }}
              <component
                :is="ArrowRight24Regular"
                class="size-4"
              />
            </Button>
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
              <strong class="font-mono text-base">{{ formatCountdown(timeLeft) }}</strong>
            </div>

            <div class="verification-code">
              <span>{{ startModel?.code }}</span>
              <button
                type="button"
                class="size-8 rounded-full flex items-center justify-center hover:bg-muted/80 text-muted-foreground hover:text-foreground transition"
                aria-label="复制认证码"
                title="复制认证码"
                @click="copyText(startModel?.code ?? '', '已复制认证码')"
              >
                <component
                  :is="Copy24Regular"
                  class="size-4"
                />
              </button>
            </div>

            <Button
              as-child
              size="lg"
              class="w-full bg-[#00aeec] hover:bg-[#00aeec]/90 text-white flex items-center justify-center gap-2"
            >
              <a
                :href="`https://live.bilibili.com/${startModel?.targetRoomId}`"
                target="_blank"
                rel="noopener noreferrer"
              >
                前往直播间
                <component
                  :is="Open24Regular"
                  class="size-4"
                />
              </a>
            </Button>
            <p class="waiting-note">发送后页面会自动完成认证，无需刷新。</p>
          </div>

          <div
            v-else-if="currentStep === 1"
            key="timeout"
            class="state-content"
          >
            <div class="state-icon state-icon--error">
              <component
                :is="Dismiss24Regular"
                class="size-6 text-destructive"
              />
            </div>
            <p class="state-kicker state-kicker--error">认证已结束</p>
            <h2>本次认证已超时</h2>
            <p class="state-summary">一次性认证码已经失效，请重新开始认证流程。</p>
            <Button
              size="lg"
              class="w-full"
              @click="restart"
            >
              重新开始
            </Button>
          </div>

          <div
            v-else
            key="success"
            class="state-content"
          >
            <div class="state-icon state-icon--success">
              <component
                :is="CheckmarkCircle24Regular"
                class="size-6 text-emerald-500"
              />
            </div>
            <p class="state-kicker state-kicker--success">认证完成</p>
            <h2>账户已成功连接</h2>
            <p class="state-summary">完成账号设置后，可以使用 B 站 UID 和本站密码登录。</p>

            <BiliAccountSetup
              :proof="accountProof"
              :error="accountSetupError"
              @restart="authenticateAnotherAccount"
            />

            <template v-if="currentToken">
              <label
                class="login-link-label"
                for="bili-login-link"
                >专属登录链接</label
              >
              <div class="relative flex items-center">
                <Input
                  id="bili-login-link"
                  :type="showPasswordLink ? 'text' : 'password'"
                  :model-value="authUrl"
                  readonly
                  class="pr-16 font-mono"
                />
                <div class="absolute right-1.5 flex items-center gap-1">
                  <button
                    type="button"
                    class="size-6 flex items-center justify-center text-muted-foreground hover:text-foreground"
                    title="显示/隐藏"
                    @click="showPasswordLink = !showPasswordLink"
                  >
                    <component
                      :is="showPasswordLink ? EyeOff24Regular : Eye24Regular"
                      class="size-3.5"
                    />
                  </button>
                  <button
                    type="button"
                    class="size-6 flex items-center justify-center text-muted-foreground hover:text-foreground"
                    title="复制登录链接"
                    @click="copyText(authUrl, '已复制登录链接')"
                  >
                    <component
                      :is="Copy24Regular"
                      class="size-3.5"
                    />
                  </button>
                </div>
              </div>

              <div class="security-notice">
                <component
                  :is="LockClosed24Regular"
                  class="size-4 shrink-0"
                />
                <p><strong>请妥善保管此链接</strong><span>任何获得链接的人都能以你的身份登录。</span></p>
              </div>
            </template>

            <div class="success-actions flex flex-col gap-2 pt-2">
              <Button
                size="lg"
                class="w-full bg-[#18a058] hover:bg-[#18a058]/90 text-white flex items-center justify-center gap-2"
                @click="$router.push({ name: 'bili-user-points' })"
              >
                查看我的积分
                <component
                  :is="ArrowRight24Regular"
                  class="size-4"
                />
              </Button>
              <Popconfirm
                positive-text="继续"
                negative-text="取消"
                title="切换账号提示"
                @positive-click="authenticateAnotherAccount"
              >
                <template #trigger>
                  <Button
                    variant="outline"
                    size="lg"
                    class="w-full"
                    >认证其他账号</Button
                  >
                </template>
                这会退出当前账号。请先保存登录链接，再继续认证其他账号。
              </Popconfirm>
            </div>
          </div>
        </Transition>
      </section>
    </div>
  </main>
</template>

<style scoped src="./BiliAuthView.css"></style>
