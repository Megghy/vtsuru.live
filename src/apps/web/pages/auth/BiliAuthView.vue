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
  <main
    class="bili-auth-page relative grid min-h-svh box-border py-10 px-6 overflow-hidden bg-muted place-items-center max-[840px]:items-start max-[840px]:py-5 max-[840px]:px-4 max-[840px]:overflow-auto max-[520px]:p-2.5"
  >
    <HomeEmojiBackdrop variant="bilibili" />

    <div
      class="auth-shell relative z-1 grid grid-cols-[minmax(320px,0.88fr)_minmax(420px,1.12fr)] w-[min(100%,1080px)] min-h-[640px] overflow-hidden rounded-lg max-[840px]:grid-cols-1 max-[840px]:min-h-0"
    >
      <section
        class="auth-overview flex flex-col py-11 px-10 pb-9 min-w-0 max-[840px]:py-7 max-[840px]:px-[30px] max-[840px]:pb-6 max-[520px]:px-[22px] max-[520px]:pt-[22px]"
      >
        <div class="flex gap-3 items-center">
          <span class="brand-mark grid size-11 text-white rounded-lg place-items-center">
            <BilibiliIcon />
          </span>
          <span class="text-foreground text-base font-bold"
            >VTsuru <i class="mx-1 text-muted-foreground not-italic font-normal">×</i> Bilibili</span
          >
        </div>

        <div class="my-[58px] max-[840px]:my-8">
          <p class="m-0 mb-3 text-[#fb7299] text-xs font-bold">ACCOUNT CONNECTION</p>
          <h1 class="m-0 text-foreground text-[38px] leading-tight max-[840px]:text-[32px] max-[520px]:text-[28px]">
            连接你的<br class="max-[840px]:hidden" /><span class="text-[#fb7299]">Bilibili 账户</span>
          </h1>
          <p
            class="max-w-[340px] mt-[22px] mb-0 text-muted-foreground text-[15px] leading-[1.8] max-[840px]:max-w-[560px] max-[520px]:text-sm"
          >
            通过一条直播间弹幕确认身份，连接后即可使用面向观众的互动功能。
          </p>
        </div>

        <ol class="auth-steps grid p-0 m-0 list-none max-[840px]:grid-cols-3 max-[840px]:gap-3.5">
          <li
            v-for="(step, index) in steps"
            :key="step.title"
            class="relative grid grid-cols-[34px_minmax(0,1fr)] gap-[13px] min-h-[66px] text-muted-foreground max-[840px]:grid-cols-[28px_minmax(0,1fr)] max-[840px]:gap-2 max-[840px]:min-h-0"
            :class="{
              'is-active': currentStep === index,
              'is-complete': currentStep > index,
            }"
          >
            <span
              class="step-marker relative z-1 grid size-8 box-border text-[13px] font-bold bg-popover border border-border rounded-full place-items-center max-[840px]:size-7"
            >
              <component
                :is="CheckmarkCircle24Regular"
                v-if="currentStep > index"
                class="size-5"
              />
              <span v-else>{{ index + 1 }}</span>
            </span>
            <span class="flex flex-col pt-[3px]">
              <strong class="text-inherit text-sm max-[520px]:text-xs">{{ step.title }}</strong>
              <small class="mt-[3px] text-muted-foreground text-xs max-[840px]:hidden">{{ step.detail }}</small>
            </span>
          </li>
        </ol>

        <div
          class="trust-note grid grid-cols-[22px_minmax(0,1fr)] gap-[11px] items-start pt-5 mt-auto max-[840px]:mt-[26px]"
        >
          <component
            :is="ShieldCheckmark24Regular"
            class="size-5 shrink-0"
          />
          <p class="flex flex-col gap-[3px] m-0">
            <strong class="text-foreground text-[13px]">无需 B 站密码或 Cookie</strong
            ><span class="text-muted-foreground text-xs leading-[1.55] max-[520px]:hidden"
              >认证码仅用于确认当前 Bilibili 账号归属。</span
            >
          </p>
        </div>
      </section>

      <section
        class="auth-action grid py-14 px-16 min-w-0 place-items-center max-[840px]:min-h-[460px] max-[840px]:py-[42px] max-[840px]:px-12 max-[520px]:min-h-[430px] max-[520px]:py-[34px] max-[520px]:px-[22px]"
      >
        <Transition
          name="auth-state"
          mode="out-in"
        >
          <div
            v-if="currentStep === 0"
            key="ready"
            class="state-content w-full max-w-[440px]"
          >
            <div class="state-icon state-icon--brand grid size-[54px] mb-6 rounded-lg place-items-center">
              <component
                :is="Key24Regular"
                class="size-6"
              />
            </div>
            <p class="m-0 mb-3 text-[#fb7299] text-xs font-bold">准备认证</p>
            <h2 class="m-0 text-foreground text-[27px] leading-tight max-[520px]:text-2xl">用弹幕完成身份确认</h2>
            <p class="mt-3.5 mb-7 text-muted-foreground text-sm leading-[1.75]">
              开始后，你会获得一个一次性认证码。请在 5 分钟内用需要认证的账号发送它。
            </p>

            <div class="grid grid-cols-2 gap-2 mb-7 max-[520px]:grid-cols-1">
              <span
                class="flex gap-[7px] items-center min-w-0 py-[11px] px-3 text-muted-foreground text-xs bg-muted border border-border rounded-md"
                ><component
                  :is="Clock24Regular"
                  class="size-4 shrink-0 text-[#00aeec]"
                />大约 1 分钟</span
              >
              <span
                class="flex gap-[7px] items-center min-w-0 py-[11px] px-3 text-muted-foreground text-xs bg-muted border border-border rounded-md"
                ><component
                  :is="Live24Regular"
                  class="size-4 shrink-0 text-[#00aeec]"
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
            class="state-content w-full max-w-[440px]"
          >
            <div class="live-status inline-flex gap-[9px] items-center mb-[18px] text-[#00aeec] text-xs font-bold">
              <i />正在等待直播间消息
            </div>
            <h2 class="m-0 text-foreground text-[27px] leading-tight max-[520px]:text-2xl">发送这条认证码</h2>
            <p class="mt-3.5 mb-7 text-muted-foreground text-sm leading-[1.75]">
              复制认证码，用目标 Bilibili 账号发送到指定直播间。
            </p>

            <div class="flex-between py-[13px] text-muted-foreground text-[13px] border-y border-border">
              <span>剩余时间</span>
              <strong class="font-mono text-lg tabular-nums text-foreground">{{ formatCountdown(timeLeft) }}</strong>
            </div>

            <div
              class="verification-code grid grid-cols-[minmax(0,1fr)_38px] gap-2.5 items-center min-h-[74px] pl-5 pr-3.5 my-5 text-foreground rounded-lg"
            >
              <span class="overflow-hidden font-mono text-2xl font-bold text-center truncate max-[520px]:text-xl">{{
                startModel?.code
              }}</span>
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
            <p class="mt-[15px] mb-0 text-muted-foreground text-xs text-center">发送后页面会自动完成认证，无需刷新。</p>
          </div>

          <div
            v-else-if="currentStep === 1"
            key="timeout"
            class="state-content w-full max-w-[440px]"
          >
            <div class="state-icon state-icon--error grid size-[54px] mb-6 rounded-lg place-items-center">
              <component
                :is="Dismiss24Regular"
                class="size-6 text-destructive"
              />
            </div>
            <p class="m-0 mb-3 text-[#d03050] text-xs font-bold">认证已结束</p>
            <h2 class="m-0 text-foreground text-[27px] leading-tight max-[520px]:text-2xl">本次认证已超时</h2>
            <p class="mt-3.5 mb-7 text-muted-foreground text-sm leading-[1.75]">
              一次性认证码已经失效，请重新开始认证流程。
            </p>
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
            class="state-content w-full max-w-[440px]"
          >
            <div class="state-icon state-icon--success grid size-[54px] mb-6 rounded-lg place-items-center">
              <component
                :is="CheckmarkCircle24Regular"
                class="size-6 text-emerald-500"
              />
            </div>
            <p class="m-0 mb-3 text-[#18a058] text-xs font-bold">认证完成</p>
            <h2 class="m-0 text-foreground text-[27px] leading-tight max-[520px]:text-2xl">账户已成功连接</h2>
            <p class="mt-3.5 mb-7 text-muted-foreground text-sm leading-[1.75]">
              完成账号设置后，可以使用 B 站 UID 和本站密码登录。
            </p>

            <BiliAccountSetup
              :proof="accountProof"
              :error="accountSetupError"
              @restart="authenticateAnotherAccount"
            />

            <template v-if="currentToken">
              <label
                class="block mb-2 text-foreground text-[13px] font-semibold"
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

              <div
                class="security-notice grid grid-cols-[22px_minmax(0,1fr)] gap-[11px] items-start py-[13px] px-3.5 mb-6 rounded"
              >
                <component
                  :is="LockClosed24Regular"
                  class="size-4 shrink-0 mt-px"
                />
                <p class="flex flex-col gap-[3px] m-0">
                  <strong class="text-foreground text-[13px]">请妥善保管此链接</strong
                  ><span class="text-xs leading-[1.55]">任何获得链接的人都能以你的身份登录。</span>
                </p>
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
