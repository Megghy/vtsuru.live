<script setup lang="ts">
import { Key24Regular, Mail24Regular } from '@vicons/fluent'
import { NButton, NCountdown, NIcon, NInput, NInputGroup, NModal, NTag, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'

import { GetSelfAccount, useAccount } from '@/api/account'
import { cookie } from '@/api/auth'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { ACCOUNT_API_URL } from '@/shared/config'
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
const canSendCode = ref(true)
const saving = ref(false)

const emailAction = computed(() => (account.value.isEmailVerified ? '修改邮箱' : '绑定邮箱'))

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
    const result = await QueryGetAPI(`${ACCOUNT_API_URL}reset-email/code`, { email: email.value.trim() })
    if (result.code !== 200) throw new Error(result.message)
    canSendCode.value = false
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
    const result = await QueryGetAPI(`${ACCOUNT_API_URL}reset-email`, {
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
    const result = await QueryPostAPI<string>(`${ACCOUNT_API_URL}change-password`, {
      oldPassword: oldPassword.value,
      password: password.value,
    })
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
  cookie.value = undefined
  window.location.reload()
}

defineExpose({ reset })
</script>

<template>
  <section class="account-security">
    <header class="account-security__header">
      <div>
        <h2>站内账号安全</h2>
        <span>管理用于登录和找回账号的凭据</span>
      </div>
      <NButton
        size="small"
        quaternary
        @click="logout"
        >退出登录</NButton
      >
    </header>
    <div class="account-security__items">
      <article class="account-security__item">
        <span class="account-security__icon"><NIcon :component="Mail24Regular" /></span>
        <div class="account-security__copy">
          <strong>邮箱</strong>
          <span>{{ account.bindEmail || '尚未绑定邮箱' }}</span>
        </div>
        <NTag
          :type="account.isEmailVerified ? 'success' : 'warning'"
          size="small"
          :bordered="false"
        >
          {{ account.isEmailVerified ? '已验证' : account.bindEmail ? '待验证' : '未绑定' }}
        </NTag>
        <NButton
          size="small"
          secondary
          @click="emailModalVisible = true"
          >{{ emailAction }}</NButton
        >
      </article>
      <article class="account-security__item">
        <span class="account-security__icon"><NIcon :component="Key24Regular" /></span>
        <div class="account-security__copy">
          <strong>登录密码</strong>
          <span>定期更新密码可以降低账号风险</span>
        </div>
        <NButton
          size="small"
          secondary
          @click="passwordModalVisible = true"
          >修改密码</NButton
        >
      </article>
    </div>
  </section>

  <NModal
    v-model:show="emailModalVisible"
    preset="card"
    :title="emailAction"
    :style="{ width: '420px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="account-security__form">
      <NInput
        v-model:value="email"
        placeholder="邮箱地址"
        @keyup.enter="sendEmailCode"
      />
      <NInputGroup>
        <NInput
          v-model:value="emailCode"
          placeholder="邮箱验证码"
          @keyup.enter="saveEmail"
        />
        <NButton
          :loading="sendingCode"
          :disabled="!canSendCode"
          @click="sendEmailCode"
        >
          <template v-if="canSendCode">发送验证码</template>
          <NCountdown
            v-else
            :duration="60000"
            @finish="canSendCode = true"
          />
        </NButton>
      </NInputGroup>
      <NButton
        type="primary"
        :loading="saving"
        @click="saveEmail"
        >确认{{ emailAction }}</NButton
      >
    </div>
  </NModal>

  <NModal
    v-model:show="passwordModalVisible"
    preset="card"
    title="修改密码"
    :style="{ width: '420px', maxWidth: 'calc(100vw - 32px)' }"
  >
    <div class="account-security__form">
      <NInput
        v-model:value="oldPassword"
        type="password"
        show-password-on="click"
        placeholder="当前密码"
      />
      <NInput
        v-model:value="password"
        type="password"
        show-password-on="click"
        placeholder="新密码"
      />
      <NInput
        v-model:value="passwordAgain"
        type="password"
        show-password-on="click"
        placeholder="再次输入新密码"
        @keyup.enter="savePassword"
      />
      <NButton
        type="primary"
        :loading="saving"
        @click="savePassword"
        >确认修改</NButton
      >
    </div>
  </NModal>
</template>

<style scoped>
.account-security {
  padding: 20px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 14px;
  background: var(--vtsuru-bg-elevated);
}
.account-security__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.account-security__header h2 {
  margin: 0;
  font-size: 16px;
}
.account-security__header span,
.account-security__copy span {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.account-security__items {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}
.account-security__item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 10px 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 10px;
  background: var(--vtsuru-bg);
}
.account-security__icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--vtsuru-fg);
  background: var(--vtsuru-bg-muted);
}
.account-security__copy {
  display: grid;
  flex: 1;
  min-width: 0;
}
.account-security__form {
  display: grid;
  gap: 12px;
}
@media (max-width: 560px) {
  .account-security__item {
    flex-wrap: wrap;
  }
  .account-security__copy {
    min-width: calc(100% - 44px);
  }
}
</style>
