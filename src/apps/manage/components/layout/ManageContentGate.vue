<script setup lang="ts">
import { Info24Filled, Mail24Filled, PersonFeedback24Filled } from '@vicons/fluent'
import { computed, onUnmounted, ref, watchEffect } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import { logoutAccount } from '@/api/account'
import type { AccountInfo } from '@/api/api-models'
import { postApiAccountSendVerifyEmail } from '@/api/generated/account/account'
import AccountSecurityPanel from '@/apps/account/components/AccountSecurityPanel.vue'
import ManageDanmakuStatusBanner from '@/apps/manage/components/event-fetcher/ManageDanmakuStatusBanner.vue'
import { useManageWorkspace } from '@/apps/manage/composables/useManageWorkspace'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Separator } from '@/shared/ui/separator'
import { Tag } from '@/shared/ui/tag'
import { useMessage } from '@/shared/utils'

const props = defineProps<{
  accountInfo: AccountInfo
}>()

const message = useMessage()
const route = useRoute()
const canResendEmail = ref(false)
const countdownSeconds = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const { workspace } = useManageWorkspace()
const isEmailWaitPreview = computed(() => {
  if (!('preview' in route.query)) return false
  const raw = route.query.preview
  const text = String(Array.isArray(raw) ? raw[0] : (raw ?? ''))
  return text === '' || text === '1' || text === 'email' || text === 'verify'
})
const displayEmail = computed(() => props.accountInfo.bindEmail || 'you@example.com')
const showDashboard = computed(
  () => workspace.value === 'streamer' && props.accountInfo.isEmailVerified && !isEmailWaitPreview.value,
)
const showBindEmail = computed(
  () => workspace.value === 'streamer' && !props.accountInfo.bindEmail && !isEmailWaitPreview.value,
)
const showEmailWait = computed(() => workspace.value === 'streamer' && !showDashboard.value && !showBindEmail.value)

function updateCountdown() {
  const remain = Math.max(0, Math.ceil(((props.accountInfo?.nextSendEmailTime ?? 0) - Date.now()) / 1000))
  countdownSeconds.value = remain
  canResendEmail.value = remain <= 0
}

watchEffect(() => {
  if (isEmailWaitPreview.value) {
    canResendEmail.value = true
    return
  }
  if (props.accountInfo?.isEmailVerified === false) {
    updateCountdown()
    if (!timer) {
      timer = setInterval(updateCountdown, 1000)
    }
    return
  }
  canResendEmail.value = false
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

async function resendEmail() {
  if (isEmailWaitPreview.value) {
    message.info('预览模式，不会发送邮件')
    return
  }
  try {
    const data = await postApiAccountSendVerifyEmail()
    if (data.code !== 200) {
      message.error(`发送失败: ${data.message}`)
      return
    }
    canResendEmail.value = false
    message.success('发送成功, 请检查你的邮箱. 如果没有收到, 请检查垃圾邮件')
    props.accountInfo.nextSendEmailTime = Date.now() + 1000 * 60
    updateCountdown()
  } catch (err) {
    console.error(err)
    message.error(`发送失败: ${String(err)}`)
  }
}
</script>

<template>
  <div class="content-gate flex flex-1 flex-col min-h-full">
    <RouterView
      v-if="showDashboard"
      v-slot="{ Component, route: viewRoute }"
    >
      <div
        class="manage-page"
        :class="viewRoute.meta.pageWidth ? `manage-page--${viewRoute.meta.pageWidth}` : undefined"
      >
        <ManageDanmakuStatusBanner v-if="viewRoute.meta.danmaku" />
        <KeepAlive>
          <component
            :is="Component"
            v-if="viewRoute.meta.keepAlive"
            :key="String(viewRoute.name ?? viewRoute.path)"
          />
        </KeepAlive>
        <component
          :is="Component"
          v-if="!viewRoute.meta.keepAlive"
          :key="viewRoute.fullPath.split('#')[0]"
        />
      </div>
    </RouterView>

    <template v-else-if="showBindEmail">
      <div class="manage-page manage-page--md">
        <Alert variant="default" class="mb-3 border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <AlertTitle class="text-xs font-semibold">绑定邮箱后使用主播后台</AlertTitle>
          <AlertDescription class="text-xs">
            主播功能需要已验证的邮箱。绑定后我们会发送验证邮件，完成验证即可进入后台。
          </AlertDescription>
        </Alert>
        <AccountSecurityPanel />
      </div>
    </template>

    <template v-else-if="showEmailWait">
      <div class="manage-page manage-page--md manage-page--center flex items-center justify-center p-6">
        <Card class="w-full max-w-lg p-6">
          <CardContent class="flex flex-col items-center text-center p-0 space-y-4">
            <div class="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Mail24Filled class="size-7" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-foreground">请查收验证邮件</h2>
              <p class="text-xs text-muted-foreground mt-1 max-w-sm">
                注册时已向 <strong class="text-primary font-medium">{{ displayEmail }}</strong> 发送验证链接，打开邮件中的链接即可进入后台
              </p>
            </div>

            <Alert variant="default" class="text-left border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Info24Filled class="size-4 shrink-0" />
              <AlertDescription class="text-xs ml-2">
                如果长时间未收到邮件，请检查垃圾邮件文件夹，或点击下方按钮重新发送
              </AlertDescription>
            </Alert>

            <div class="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                :disabled="!canResendEmail"
                class="gap-1.5"
                @click="resendEmail"
              >
                <Mail24Filled class="size-4" />
                重新发送验证邮件
              </Button>
              <Tag v-if="!canResendEmail" type="warning" round>
                {{ countdownSeconds }}s 后可重新发送
              </Tag>
            </div>

            <Separator class="my-4 w-4/5" />

            <Popconfirm positive-text="退出登录" negative-text="取消" @positive-click="logoutAccount">
              <template #trigger>
                <Button variant="outline" size="sm" class="gap-1.5">
                  <PersonFeedback24Filled class="size-4" />
                  切换账号
                </Button>
              </template>
              确定要登出当前账号吗？
            </Popconfirm>
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>

<style scoped>
.content-gate {
  display: flex;
  flex: 1;
  min-height: 100%;
  flex-direction: column;
}
</style>
