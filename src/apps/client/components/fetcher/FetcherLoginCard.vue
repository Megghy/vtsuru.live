<script setup lang="ts">
import { error as logError, info as logInfo } from '@tauri-apps/plugin-log'
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  CheckmarkCircleOutline,
  CloseCircleOutline,
  EyeOffOutline,
  EyeOutline,
  HelpCircle,
  LogInOutline,
  LogOutOutline,
} from '@vicons/ionicons5'
import { intervalToDuration } from 'date-fns'
import QrcodeVue from 'qrcode.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { getLoginInfoAsync, getLoginUrlDataAsync } from '@/apps/client/data/biliLogin'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useSettings } from '@/apps/client/store/useSettings'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Spin } from '@/shared/ui/spin'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import FetcherCookieCloudCard from './FetcherCookieCloudCard.vue'

const biliCookie = useBiliCookie()
const settings = useSettings()

// 登录状态
const isQRCodeLogining = ref(false)
const loginUrl = ref('')
const loginKey = ref('')
const cookie = ref<string>() // 本地展示用
const showCookie = ref(false) // Cookie 脱敏显示开关
const timer = ref(0)
const expiredTimer = ref(0)
const countdownTimer = ref(0)
const countdownKey = ref(0)
const loginStatus = ref<'expired' | 'unknown' | 'scanned' | 'waiting' | 'confirmed'>()
const startAt = ref(Date.now())

const QRCODE_EXPIRE_MS = 3 * 60 * 1000 // 二维码有效期 3 分钟

const loginStatusString = computed(() => {
  switch (loginStatus.value) {
    case 'expired':
      return '过期'
    case 'unknown':
      return '未知'
    case 'scanned':
      return '已扫描, 等待确认'
    case 'waiting':
      return '等待扫描'
    case 'confirmed':
      return '已登录'
    default:
      return undefined
  }
})

// Cookie 脱敏: 保留首尾少量字符
const maskedCookie = computed(() => {
  const c = cookie.value
  if (!c) return ''
  if (c.length <= 16) return '••••••••'
  return `${c.slice(0, 8)}••••••••••••••••${c.slice(-8)}`
})

async function startLogin() {
  if (isQRCodeLogining.value) return
  isQRCodeLogining.value = true
  try {
    const data = await getLoginUrlDataAsync()
    loginUrl.value = data.url
    loginKey.value = data.qrcode_key
    loginStatus.value = 'waiting'
    startAt.value = Date.now()
    expiredTimer.value = window.setTimeout(() => {
      loginStatus.value = 'expired'
      clearInterval(timer.value)
    }, QRCODE_EXPIRE_MS)
    countdownTimer.value = window.setInterval(() => {
      countdownKey.value++
    }, 500)
    timer.value = window.setInterval(async () => {
      const login = await getLoginInfoAsync(loginKey.value)
      loginStatus.value = login.status
      if (login.status === 'confirmed') {
        biliCookie.setBiliCookie(login.cookie, login.refresh_token)
        cookie.value = login.cookie
        logInfo(`扫码登录成功`)
        toast.success('登录成功')
        finishLogin()
        await biliCookie.check()
      } else if (login.status === 'expired') {
        finishLogin()
        toast.error('二维码已过期')
      }
    }, 2000)
  } catch (err: any) {
    logError(err.toString())
    toast.error('获取登录二维码失败')
    isQRCodeLogining.value = false
    loginStatus.value = undefined
  }
}

function finishLogin() {
  clearInterval(timer.value)
  clearTimeout(expiredTimer.value)
  clearInterval(countdownTimer.value)
  isQRCodeLogining.value = false
  loginStatus.value = undefined
  loginUrl.value = ''
  loginKey.value = ''
  cookie.value = ''
}

function formatTimeDifference(startUnix: number, endUnix: number) {
  const duration = intervalToDuration({ start: new Date(startUnix), end: new Date(endUnix) })
  const minutes = duration.minutes || 0
  const seconds = duration.seconds || 0
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

async function logout() {
  await biliCookie.logout()
  toast.info('已退出登录')
}

onMounted(async () => {
  cookie.value = await biliCookie.getBiliCookie()
})
onUnmounted(() => {
  clearInterval(timer.value)
  clearTimeout(expiredTimer.value)
  clearInterval(countdownTimer.value)
})
</script>

<template>
  <Card class="border bg-card w-full">
    <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
      <CardTitle class="text-sm font-semibold">凭据 & 账户</CardTitle>
      <Badge
        v-if="biliCookie.isCookieValid"
        variant="outline"
        class="h-5 text-[10px] gap-1 border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
      >
        <CheckmarkCircleOutline class="size-3" />
        已登录
      </Badge>
      <Badge
        v-else
        variant="outline"
        class="h-5 text-[10px] gap-1 border-destructive/40 text-destructive bg-destructive/10"
      >
        <CloseCircleOutline class="size-3" />
        未登录
      </Badge>
    </CardHeader>
    <CardContent class="p-3 space-y-3">
      <!-- 描述列表 -->
      <div class="border rounded-md divide-y text-xs">
        <div
          v-if="biliCookie.isCookieValid"
          class="flex items-center px-3 py-2 bg-muted/10"
        >
          <span class="w-24 text-muted-foreground shrink-0">B站用户名</span>
          <span class="font-medium text-foreground">
            {{ biliCookie.userInfo?.name ?? '未登录或加载中...' }}
          </span>
        </div>
        <div
          v-if="biliCookie.isCookieValid"
          class="flex items-center px-3 py-2 bg-muted/10"
        >
          <span class="w-24 text-muted-foreground shrink-0">用户UID</span>
          <span class="font-medium text-foreground">
            {{ biliCookie.userInfo?.mid ?? 'N/A' }}
          </span>
        </div>
        <div class="flex items-center px-3 py-2 bg-muted/10">
          <span class="w-24 text-muted-foreground shrink-0">登录状态</span>
          <div class="flex items-center gap-1.5 font-medium text-foreground">
            <span>{{ loginStatusString ?? (biliCookie.isCookieValid ? '已登录' : '未登录') }}</span>
            <Badge
              v-if="loginStatus === 'waiting' || loginStatus === 'scanned'"
              :key="countdownKey"
              variant="outline"
              class="h-4.5 px-1.5 text-[10px] border-sky-500/40 text-sky-600 bg-sky-500/10"
            >
              {{ formatTimeDifference(Date.now(), startAt + QRCODE_EXPIRE_MS) }}
            </Badge>
          </div>
        </div>
      </div>

      <!-- Cookie 展示与操作 -->
      <div v-if="biliCookie.isCookieValid" class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground">登录凭据 (Cookie - 敏感信息)</span>
          <Button
            size="xs"
            variant="ghost"
            class="h-6 text-[11px] gap-1"
            @click="showCookie = !showCookie"
          >
            <EyeOffOutline v-if="showCookie" class="size-3.5" />
            <EyeOutline v-else class="size-3.5" />
            {{ showCookie ? '隐藏' : '显示' }}
          </Button>
        </div>

        <Textarea
          :value="showCookie ? cookie : maskedCookie"
          placeholder="已登录"
          readonly
          class="text-xs font-mono resize-none h-16"
        />

        <Button
          size="sm"
          variant="outline"
          class="h-8 text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
          @click="logout"
        >
          <LogOutOutline class="size-3.5" />
          退出登录
        </Button>
      </div>

      <div class="relative py-1">
        <div class="absolute inset-0 flex items-center">
          <span class="w-full border-t" />
        </div>
        <div class="relative flex justify-center text-[10px] uppercase">
          <span class="bg-card px-2 text-muted-foreground font-medium">登录方式</span>
        </div>
      </div>

      <Tabs
        v-model="settings.settings.loginType"
        class="w-full"
        @update:model-value="settings.save()"
      >
        <TabsList class="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="qrcode" class="text-xs">
            扫码登录
          </TabsTrigger>
          <TabsTrigger value="cookiecloud" class="text-xs">
            Cookie Cloud
          </TabsTrigger>
        </TabsList>

        <TabsContent value="qrcode" class="pt-3">
          <div
            v-if="!isQRCodeLogining || loginStatus === 'expired'"
            class="flex items-center gap-2"
          >
            <Button
              id="bilibili-login"
              size="sm"
              class="h-8 text-xs gap-1.5"
              @click="startLogin"
            >
              <LogInOutline class="size-4" />
              {{ loginStatus === 'expired' ? '重新获取二维码' : '获取二维码' }}
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <HelpCircle class="size-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent class="text-xs max-w-[260px]">
                  <p class="mb-1">所有关于Cookie的操作都将在本地进行, 不会上传到任何服务器。</p>
                  <p>
                    相关代码开源于
                    <a
                      href="javascript:;"
                      class="text-sky-500 hover:underline"
                      @click="openUrl('https://github.com/Megghy/vtsuru.live/tree/master/src/client')"
                    >
                      GitHub
                    </a>
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div
            v-else
            class="flex items-center justify-center py-4"
          >
            <Spin v-if="!loginUrl" :show="true" size="medium" />
            <div
              v-else
              class="p-2.5 bg-white rounded-lg border shadow-sm flex items-center justify-center"
            >
              <QrcodeVue
                :value="loginUrl"
                level="H"
                :size="180"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cookiecloud" class="pt-2">
          <FetcherCookieCloudCard />
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>
