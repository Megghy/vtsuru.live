<script setup lang="ts">
import { error as logError, info as logInfo } from '@tauri-apps/plugin-log'
import { openUrl } from '@tauri-apps/plugin-opener'
import { intervalToDuration } from 'date-fns'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { getLoginInfoAsync, getLoginUrlDataAsync } from '@/apps/client/data/biliLogin'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useSettings } from '@/apps/client/store/useSettings'

import FetcherCookieCloudCard from './FetcherCookieCloudCard.vue'

const biliCookie = useBiliCookie()
const settings = useSettings()
const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}

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
        feedback('success', '登录成功')
        finishLogin()
        await biliCookie.check()
      } else if (login.status === 'expired') {
        finishLogin()
        feedback('error', '二维码已过期')
      }
    }, 2000)
  } catch (err: any) {
    logError(err.toString())
    feedback('error', '获取登录二维码失败')
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
  feedback('info', '已退出登录')
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
  <UCard
    title="凭据 & 账户"
    size="small"
    bordered
    style="width: 100%"
  >
    <template #header-extra>
      <UBadge
        v-if="biliCookie.isCookieValid"
        type="success"
        size="small"
      >
        <template #leading>
          <UIcon name="i-lucide-circle" />
        </template>
        已登录
      </UBadge>
      <UBadge
        v-else
        type="error"
        size="small"
      >
        <template #leading>
          <UIcon name="i-lucide-circle" />
        </template>
        未登录
      </UBadge>
    </template>
    <div
      vertical
      :size="12"
    >
      <div
        label-placement="left"
        bordered
        size="small"
        :columns="1"
      >
        <div
          v-if="biliCookie.isCookieValid"
          label="B站用户名"
        >
          <div
            :show="biliCookie.isCookieValid && !biliCookie.userInfo"
            size="small"
            style="display: inline-block; width: 100%"
          >
            <span>{{ biliCookie.userInfo?.name ?? '未登录或加载中...' }}</span>
          </div>
        </div>
        <div
          v-if="biliCookie.isCookieValid"
          label="用户UID"
        >
          <div
            :show="biliCookie.isCookieValid && !biliCookie.userInfo"
            size="small"
            style="display: inline-block"
          >
            <span>{{ biliCookie.userInfo?.mid ?? 'N/A' }}</span>
          </div>
        </div>
        <div label="登录状态">
          {{ loginStatusString ?? (biliCookie.isCookieValid ? '已登录' : '未登录') }}
          <UBadge
            v-if="loginStatus === 'waiting' || loginStatus === 'scanned'"
            :key="countdownKey"
            class="ml-1"
            :bordered="false"
            type="info"
            size="small"
          >
            {{ formatTimeDifference(Date.now(), startAt + QRCODE_EXPIRE_MS) }}
          </UBadge>
        </div>
      </div>

      <div v-if="biliCookie.isCookieValid">
        <div
          align="center"
          justify="space-between"
          style="margin-bottom: 4px"
        >
          <span
            small
            depth="3"
          >
            登录凭据 (Cookie - 敏感信息)
          </span>
          <UButton
            variant="link"
            size="tiny"
            @click="showCookie = !showCookie"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
            {{ showCookie ? '隐藏' : '显示' }}
          </UButton>
        </div>
        <UInput
          type="textarea"
          :value="showCookie ? cookie : maskedCookie"
          placeholder="已登录"
          readonly
          autosize
          :min-rows="1"
          :max-rows="3"
          style="max-height: 150px"
        />
        <UButton
          color="error"
          ghost
          size="small"
          style="margin-top: 8px"
          @click="logout"
        >
          <template #leading>
            <UIcon name="i-lucide-circle" />
          </template>
          退出登录
        </UButton>
      </div>
      <USeparator style="margin: 0"> 登录方式 </USeparator>
      <div>
        <UTabs
          v-model="settings.settings.loginType"
          :items="[
            { label: '扫码登录', value: 'qrcode' },
            { label: 'Cookie Cloud', value: 'cookiecloud' },
          ]"
          :content="false"
          @update:model-value="settings.save()"
        />
        <section v-show="settings.settings.loginType === 'qrcode'">
          <div
            v-if="!isQRCodeLogining || loginStatus === 'expired'"
            align="center"
            :size="8"
          >
            <UButton
              id="bilibili-login"
              @click="startLogin"
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
              {{ loginStatus === 'expired' ? '重新获取二维码' : '获取二维码' }}
            </UButton>
            <UTooltip>
              <UIcon name="i-lucide-circle" />
              <template #content>
                <div>
                  <p>所有关于Cookie的操作都将在本地进行, 不会上传到任何服务器。</p>
                  <p>
                    相关代码开源于
                    <UButton
                      variant="link"
                      color="info"
                      @click="openUrl('https://github.com/Megghy/vtsuru.live/tree/master/src/client')"
                    >
                      GitHub
                    </UButton>
                  </p>
                </div>
              </template>
            </UTooltip>
          </div>
          <div
            v-else
            align="center"
            justify="center"
            :size="16"
          >
            <div v-if="!loginUrl" />
            <div
              v-else
              type="image/png"
              :value="loginUrl"
              error-level="H"
              :size="180"
            />
          </div>
        </section>
        <section v-show="settings.settings.loginType === 'cookiecloud'">
          <FetcherCookieCloudCard />
        </section>
      </div>
    </div>
  </UCard>
</template>
