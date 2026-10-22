<script setup lang="ts">
import { Key24Regular, Mail24Regular } from '@vicons/fluent'
import { useMessage } from '@/shared/utils'
import { computed, onUnmounted, ref } from 'vue'

import { GetSelfAccount, logoutAccount, useAccount } from '@/api/account'
import { cookie } from '@/api/auth'
import {
  postApiAccountChangePassword,
  postApiAccountResetEmail,
  postApiAccountResetEmailCode,
} from '@/api/generated/account/account'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { useBiliAuth } from '@/store/useBiliAuth'

const account = useAccount()
const biliAuth = useBiliAuth()
const message = useMessage()

const emailModalVisible = ref(false)
const passwordModalVisible = ref(false)

const email = ref('')
const emailCode = ref('')
const oldPassword = ref('')
const password = ref('')
const passwordAgain = ref('')

const sendingCode = ref(false)
const countdownSeconds = ref(0)
let timerId: ReturnType<typeof setInterval> | null = null

const saving = ref(false)

const emailAction = computed(() => (account.value.bindEmail ? '修改邮箱' : '绑定邮箱'))

function startCountdown(seconds = 60) {
  countdownSeconds.value = seconds
  if (timerId) clearInterval(timerId)
  timerId = setInterval(() => {
    countdownSeconds.value--
    if (countdownSeconds.value <= 0) {
      if (timerId) clearInterval(timerId)
      timerId = null
    }
  }, 1000)
}

onUnmounted(() => {
  if (timerId) clearInterval(timerId)
})

function responseError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function sendEmailCode() {
  if (!email.value.trim()) {
    message.warning('请输入邮箱地址')
    return
  }
  sendingCode.value = true
  try {
    const result = await postApiAccountResetEmailCode({ email: email.value.trim() })
    if (result.code !== 200) throw new Error(result.message)
    startCountdown(60)
    message.success('验证码已发送，请检查邮箱')
  } catch (error) {
    message.error(`发送失败：${responseError(error)}`)
  } finally {
    sendingCode.value = false
  }
}

async function saveEmail() {
  if (!email.value.trim() || !emailCode.value.trim()) {
    message.warning('请填写邮箱和验证码')
    return
  }
  saving.value = true
  try {
    const result = await postApiAccountResetEmail({
      email: email.value.trim(),
      code: emailCode.value.trim(),
    })
    if (result.code !== 200) throw new Error(result.message)
    await GetSelfAccount()
    emailModalVisible.value = false
    email.value = ''
    emailCode.value = ''
    message.success('邮箱已绑定')
  } catch (error) {
    message.error(`绑定失败：${responseError(error)}`)
  } finally {
    saving.value = false
  }
}

async function savePassword() {
  if (!oldPassword.value || !password.value) {
    message.warning('请填写当前密码和新密码')
    return
  }
  if (password.value !== passwordAgain.value) {
    message.warning('两次输入的新密码不一致')
    return
  }
  saving.value = true
  try {
    const result = (await postApiAccountChangePassword({
      oldPassword: oldPassword.value,
      password: password.value,
    })) as unknown as {
      code: number
      message?: string
      data: string
    }
    if (result.code !== 200) throw new Error(result.message)
    cookie.value = { cookie: result.data, refreshDate: Date.now() }
    passwordModalVisible.value = false
    oldPassword.value = ''
    password.value = ''
    passwordAgain.value = ''
    message.success('密码已修改')
  } catch (error) {
    message.error(`修改失败：${responseError(error)}`)
  } finally {
    saving.value = false
  }
}

function reset() {
  emailModalVisible.value = false
  passwordModalVisible.value = false
}

function logout() {
  biliAuth.logout()
  logoutAccount()
}

defineExpose({ reset })
</script>

<template>
  <section class="rounded-lg border border-border bg-card p-4 space-y-3.5 shadow-sm">
    <header class="flex items-center justify-between gap-3">
      <div>
        <h2 class="text-sm font-semibold tracking-tight text-foreground">
          站内账号安全
        </h2>
        <span class="text-xs text-muted-foreground">管理用于登录和找回账号的凭据</span>
      </div>
      <Button size="xs" variant="ghost" class="text-muted-foreground hover:text-destructive" @click="logout">
        退出登录
      </Button>
    </header>

    <div class="grid gap-2">
      <!-- 邮箱条目 -->
      <article class="flex items-center justify-between gap-3 p-3 rounded-md border border-border/60 bg-muted/30">
        <div class="flex items-center gap-3 min-w-0">
          <div class="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <component
              :is="Mail24Regular"
              class="h-4 w-4"
            />
          </div>
          <div class="flex flex-col min-w-0">
            <strong class="text-xs font-medium text-foreground">邮箱</strong>
            <span class="text-xs text-muted-foreground truncate">{{ account.bindEmail || '尚未绑定邮箱' }}</span>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <Badge
            :variant="account.isEmailVerified ? 'success' : account.bindEmail ? 'warning' : 'outline'"
            class="text-[11px]"
          >
            {{ account.isEmailVerified ? '已验证' : account.bindEmail ? '待验证' : '未绑定' }}
          </Badge>
          <Button size="xs" variant="outline" @click="emailModalVisible = true">
            {{ emailAction }}
          </Button>
        </div>
      </article>

      <!-- 密码条目 -->
      <article class="flex items-center justify-between gap-3 p-3 rounded-md border border-border/60 bg-muted/30">
        <div class="flex items-center gap-3 min-w-0">
          <div class="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <component
              :is="Key24Regular"
              class="h-4 w-4"
            />
          </div>
          <div class="flex flex-col min-w-0">
            <strong class="text-xs font-medium text-foreground">登录密码</strong>
            <span class="text-xs text-muted-foreground">定期更新密码可以降低账号风险</span>
          </div>
        </div>

        <Button size="xs" variant="outline" class="shrink-0" @click="passwordModalVisible = true">
          修改密码
        </Button>
      </article>
    </div>
  </section>

  <!-- 邮箱弹窗 -->
  <Dialog v-model:open="emailModalVisible">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="text-base">
          {{ emailAction }}
        </DialogTitle>
        <DialogDescription class="text-xs">
          输入邮箱地址以接收验证码并完成安全绑定。
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 py-2">
        <Input v-model="email" type="email" placeholder="邮箱地址" @keyup.enter="sendEmailCode" />
        <div class="flex gap-2">
          <Input v-model="emailCode" placeholder="邮箱验证码" class="flex-1" @keyup.enter="saveEmail" />
          <Button type="button" variant="outline" :loading="sendingCode" :disabled="countdownSeconds> 0"
            @click="sendEmailCode"
          >
            <template v-if="countdownSeconds > 0">
              {{ countdownSeconds }}s
            </template>
            <template v-else>
              发送验证码
            </template>
          </Button>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="emailModalVisible = false">
          取消
        </Button>
        <Button variant="brand" :loading="saving" @click="saveEmail">
          确认{{ emailAction }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 密码弹窗 -->
  <Dialog v-model:open="passwordModalVisible">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="text-base">
          修改登录密码
        </DialogTitle>
        <DialogDescription class="text-xs">
          请输入当前旧密码以及两次新密码。
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 py-2">
        <Input v-model="oldPassword" type="password" placeholder="当前旧密码" />
        <Input v-model="password" type="password" placeholder="新密码" />
        <Input v-model="passwordAgain" type="password" placeholder="再次输入新密码" @keyup.enter="savePassword" />
      </div>

      <DialogFooter>
        <Button variant="outline" @click="passwordModalVisible = false">
          取消
        </Button>
        <Button variant="brand" :loading="saving" @click="savePassword">
          确认修改
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
