<script setup lang="ts">
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  KeyRound,
  LogOut,
  Radio,
  ShieldCheck,
  XCircle,
} from 'lucide-vue-next'
import { v4 as uuidv4 } from 'uuid'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { applyAccountSession, logoutAccount, useAccount } from '@/api/account'
import { getApiBiliAuthStatus, postApiBiliAuthStart } from '@/api/generated/bili-auth-v2/bili-auth-v2'
import { type BiliAuthExchangeAction, exchangeBiliAccount } from '@/api/viewer-records'
import HomeEmojiBackdrop from '@/apps/web/components/HomeEmojiBackdrop.vue'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Button } from '@/shared/ui/button'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Spin } from '@/shared/ui/spin'
import { toast } from '@/shared/utils'
import { DEFAULT_USER_HOME, sanitizeRedirectPath } from '@/shared/utils/authRedirect'
import { useBiliAuth } from '@/store/useBiliAuth'
import BilibiliIcon from '@/svgs/social/bilibili.svg?component'

interface AuthStartModel {
  code: string
  endAt: number
  startAt: number
  targetRoomId: number
}

const steps = [
  { title: '发起认证', detail: '获取一次性弹幕认证码' },
  { title: '直播间确认', detail: '发送弹幕确认账号归属' },
  { title: '自动登录', detail: '一步完成连接并返回' },
]

const route = useRoute()
const router = useRouter()
const account = useAccount()
const biliAuth = useBiliAuth()

const guidKey = usePersistedStorage('Bili.Auth.Key', uuidv4())
const startModel = ref<AuthStartModel>()
const currentStep = ref(0)
const timeLeft = ref(0)
const timeOut = ref(false)
const isStarting = ref(false)
const isExchanging = ref(false)
const exchangeError = ref('')
const completedAction = ref<BiliAuthExchangeAction | null>(null)

const redirectTarget = computed(() => sanitizeRedirectPath(route.query.redirect, DEFAULT_USER_HOME))
const hasCustomRedirect = computed(() => redirectTarget.value !== DEFAULT_USER_HOME)
const alreadyBoundAccount = computed(() => Boolean(account.value.id && account.value.biliUserAuthInfo?.id))
const isBindingExistingAccount = computed(() => Boolean(account.value.id && !account.value.biliUserAuthInfo?.id))

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

async function finishWithExchange(key: string) {
  isExchanging.value = true
  exchangeError.value = ''
  currentStep.value = 2
  try {
    const response = await exchangeBiliAccount(key)
    if (response.code !== 200 || !response.data?.token) {
      throw new Error(response.message || '未能完成站内账号连接')
    }
    applyAccountSession({
      account: response.data.account,
      token: response.data.token,
    })
    completedAction.value = response.data.action
    guidKey.value = uuidv4()

    const tip =
      response.data.action === 'created'
        ? '认证成功，已自动创建并登录账号'
        : response.data.action === 'bound'
          ? '已成功绑定 Bilibili 账号'
          : 'Bilibili 一键登录成功'
    toast.success(tip)

    await router.replace(redirectTarget.value)
  } catch (error) {
    guidKey.value = uuidv4()
    exchangeError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isExchanging.value = false
  }
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
    await finishWithExchange(key)
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
  exchangeError.value = ''
  try {
    const response = await postApiBiliAuthStart({
      key: guidKey.value,
    })
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
  exchangeError.value = ''
  completedAction.value = null
  guidKey.value = uuidv4()
}

function switchAndLogout() {
  biliAuth.logout()
  logoutAccount()
}

onMounted(async () => {
  if (alreadyBoundAccount.value) {
    currentStep.value = 2
    return
  }
  try {
    await syncStatus()
    if (currentStep.value === 1 && !timeOut.value) {
      clearInterval(countdownTimer)
      countdownTimer = setInterval(updateTimeLeft, 1000)
      startPolling(3000)
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
          <p class="m-0 mb-3 text-[#fb7299] text-xs font-bold">ONE-STEP AUTH</p>
          <h1 class="m-0 text-foreground text-[38px] leading-tight max-[840px]:text-[32px] max-[520px]:text-[28px]">
            {{ isBindingExistingAccount ? '绑定你的' : '连接你的' }}<br class="max-[840px]:hidden" /><span
              class="text-[#fb7299]"
              >Bilibili 账户</span
            >
          </h1>
          <p
            class="max-w-[340px] mt-[22px] mb-0 text-muted-foreground text-[15px] leading-[1.8] max-[840px]:max-w-[560px] max-[520px]:text-sm"
          >
            {{
              isBindingExistingAccount
                ? '发一条认证弹幕即可将 B 站身份绑定到当前账号，绑定后自动返回原页面。'
                : '发送一条直播间弹幕即可自动登录或创建账号，无需额外设置密码，完成后自动返回。'
            }}
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
              <CheckCircle2
                v-if="currentStep > index"
                class="size-4"
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
          <ShieldCheck class="size-5 shrink-0" />
          <p class="flex flex-col gap-[3px] m-0">
            <strong class="text-foreground text-[13px]">无需 B 站密码或 Cookie</strong
            ><span class="text-muted-foreground text-xs leading-[1.55] max-[520px]:hidden"
              >认证码仅用于确认 B 站账号归属，登录密码与邮箱可在日后按需补充。</span
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
              <KeyRound class="size-6" />
            </div>
            <p class="m-0 mb-3 text-[#fb7299] text-xs font-bold">准备认证</p>
            <h2 class="m-0 text-foreground text-[27px] leading-tight max-[520px]:text-2xl">
              {{ isBindingExistingAccount ? '绑定到当前站内账号' : '用弹幕一键登录' }}
            </h2>
            <p class="mt-3.5 mb-7 text-muted-foreground text-sm leading-[1.75]">
              {{
                isBindingExistingAccount
                  ? `当前已登录「${account.name}」，发完认证码后会自动绑定你的 Bilibili 身份。`
                  : '开始后会生成一个 5 分钟有效的一次性认证码，用你的 B 站账号发送后将自动登录。'
              }}
            </p>

            <div class="grid grid-cols-2 gap-2 mb-7 max-[520px]:grid-cols-1">
              <span
                class="flex gap-[7px] items-center min-w-0 py-[11px] px-3 text-muted-foreground text-xs bg-muted border border-border rounded-md"
              >
                <Clock class="size-4 shrink-0 text-[#00aeec]" />约 30 秒完成
              </span>
              <span
                class="flex gap-[7px] items-center min-w-0 py-[11px] px-3 text-muted-foreground text-xs bg-muted border border-border rounded-md"
              >
                <Radio class="size-4 shrink-0 text-[#00aeec]" />发一条弹幕即自动跳转
              </span>
            </div>

            <Button
              size="lg"
              class="w-full bg-[#fb7299] hover:bg-[#fb7299]/90 text-white"
              :disabled="isStarting"
              @click="startVerify"
            >
              {{ isStarting ? '正在生成认证码...' : '开始认证' }}
              <ArrowRight class="size-4" />
            </Button>

            <Button
              v-if="hasCustomRedirect"
              variant="ghost"
              class="w-full mt-2 text-muted-foreground"
              @click="router.push(redirectTarget)"
            >
              暂不认证，返回原页面
            </Button>
          </div>

          <div
            v-else-if="currentStep === 1 && !timeOut"
            key="verifying"
            class="state-content w-full max-w-[440px]"
          >
            <div class="live-status inline-flex gap-[9px] items-center mb-[18px] text-[#00aeec] text-xs font-bold">
              <i />正在等待直播间弹幕
            </div>
            <h2 class="m-0 text-foreground text-[27px] leading-tight max-[520px]:text-2xl">发送这条认证码</h2>
            <p class="mt-3.5 mb-7 text-muted-foreground text-sm leading-[1.75]">
              复制认证码，用你的 Bilibili 账号发送到指定直播间，收到后会自动完成登录。
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
              <Button
                variant="ghost"
                size="icon-xs"
                class="size-8 rounded-full text-muted-foreground"
                aria-label="复制认证码"
                @click="copyText(startModel?.code ?? '', '已复制认证码')"
              >
                <Copy class="size-4" />
              </Button>
            </div>

            <Button
              as-child
              size="lg"
              class="w-full bg-[#00aeec] hover:bg-[#00aeec]/90 text-white"
            >
              <a
                :href="`https://live.bilibili.com/${startModel?.targetRoomId}`"
                target="_blank"
                rel="noopener noreferrer"
              >
                前往直播间发送
                <ExternalLink class="size-4" />
              </a>
            </Button>
            <p class="mt-[15px] mb-0 text-muted-foreground text-xs text-center">
              发送后页面会自动完成登录并跳转，无需手动刷新。
            </p>
          </div>

          <div
            v-else-if="currentStep === 1"
            key="timeout"
            class="state-content w-full max-w-[440px]"
          >
            <div class="state-icon state-icon--error grid size-[54px] mb-6 rounded-lg place-items-center">
              <XCircle class="size-6 text-destructive" />
            </div>
            <p class="m-0 mb-3 text-destructive text-xs font-bold">认证已结束</p>
            <h2 class="m-0 text-foreground text-[27px] leading-tight max-[520px]:text-2xl">本次认证已超时</h2>
            <p class="mt-3.5 mb-7 text-muted-foreground text-sm leading-[1.75]">
              一次性认证码已经失效，请重新发起认证。
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
            v-else-if="isExchanging"
            key="exchanging"
            class="state-content w-full max-w-[440px] flex flex-col items-center text-center py-8 gap-3"
          >
            <Spin size="large" />
            <h2 class="m-0 text-foreground text-xl font-semibold">正在完成登录...</h2>
            <p class="m-0 text-xs text-muted-foreground">已确认你的 Bilibili 身份，正在自动进入页面。</p>
          </div>

          <div
            v-else-if="exchangeError"
            key="exchange-error"
            class="state-content w-full max-w-[440px]"
          >
            <div class="state-icon state-icon--error grid size-[54px] mb-6 rounded-lg place-items-center">
              <AlertTriangle class="size-6 text-destructive" />
            </div>
            <p class="m-0 mb-3 text-destructive text-xs font-bold">无法完成连接</p>
            <h2 class="m-0 text-foreground text-[27px] leading-tight max-[520px]:text-2xl">账号绑定存在冲突</h2>
            <p class="mt-3.5 mb-6 text-muted-foreground text-sm leading-[1.75]">
              {{ exchangeError }}
            </p>
            <div class="flex flex-col gap-2">
              <Button
                v-if="account.id"
                size="lg"
                variant="destructive"
                class="w-full"
                @click="switchAndLogout"
              >
                <LogOut class="size-4 mr-1.5" />
                退出当前账号并重新认证
              </Button>
              <Button
                size="lg"
                variant="outline"
                class="w-full"
                @click="restart"
              >
                重新发起认证
              </Button>
            </div>
          </div>

          <div
            v-else
            key="success"
            class="state-content w-full max-w-[440px]"
          >
            <div class="state-icon state-icon--success grid size-[54px] mb-6 rounded-lg place-items-center">
              <CheckCircle2 class="size-6 text-emerald-500" />
            </div>
            <p class="m-0 mb-3 text-emerald-600 dark:text-emerald-400 text-xs font-bold">身份已连接</p>
            <h2 class="m-0 text-foreground text-[27px] leading-tight max-[520px]:text-2xl">
              {{ completedAction ? '已完成登录' : '当前账号已绑定 Bilibili' }}
            </h2>
            <p class="mt-3.5 mb-6 text-muted-foreground text-sm leading-[1.75]">
              已连接 <strong class="text-foreground">{{ account.biliUserAuthInfo?.name || account.name }}</strong>
              <span
                v-if="account.biliUserAuthInfo?.userId"
                class="font-mono ml-1"
                >(UID {{ account.biliUserAuthInfo.userId }})</span
              >，随时可以在用户中心查看你的积分、棉花糖、投稿与点播记录。
            </p>

            <div class="flex flex-col gap-2">
              <Button
                size="lg"
                class="w-full bg-emerald-600 hover:bg-emerald-600/90 text-white"
                @click="router.push(redirectTarget)"
              >
                {{ hasCustomRedirect ? '返回原页面' : '进入用户中心' }}
                <ArrowRight class="size-4" />
              </Button>
              <Popconfirm
                positive-text="退出并切换"
                negative-text="取消"
                title="切换其他 Bilibili 账号？"
                @positive-click="switchAndLogout"
              >
                <template #trigger>
                  <Button
                    variant="outline"
                    size="lg"
                    class="w-full"
                  >
                    切换其他账号
                  </Button>
                </template>
                这会退出当前登录状态，之后可用另一个 B 站账号发弹幕一键登录。
              </Popconfirm>
            </div>
          </div>
        </Transition>
      </section>
    </div>
  </main>
</template>

<style scoped src="./BiliAuthView.css"></style>
