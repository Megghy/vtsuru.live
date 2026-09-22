<script setup lang="ts">
import { NAlert, NButton, NForm, NFormItem, NInput, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { applyAccountSession, completeBiliAccount, useAccount } from '@/api/account'
import type { BiliAccountProof } from '@/api/account'

const props = defineProps<{ proof?: BiliAccountProof; error?: string }>()
const emit = defineEmits<{ restart: [] }>()
const account = useAccount()
const router = useRouter()
const message = useMessage()
const password = ref('')
const confirmation = ref('')
const pending = ref(false)
const completed = ref(false)
const resetting = ref(false)
const needsPassword = computed(() => resetting.value || !account.value.id)
const bound = computed(() => completed.value || Boolean(account.value.biliUserAuthInfo))

watch(
  () => props.proof?.proof,
  () => {
    resetting.value = false
    password.value = ''
    confirmation.value = ''
    completed.value = false
  },
)

async function submit() {
  if (!props.proof || pending.value) return
  if (needsPassword.value && password.value !== confirmation.value) {
    message.warning('两次密码输入不一致')
    return
  }
  pending.value = true
  try {
    const response = await completeBiliAccount(
      props.proof.proof,
      needsPassword.value ? password.value : undefined,
      resetting.value,
    )
    if (response.code !== 200) throw new Error(response.message)
    applyAccountSession(response.data)
    password.value = ''
    confirmation.value = ''
    completed.value = true
    message.success(resetting.value ? '密码已重置，已使用新密码登录' : '账号已连接，可使用 B 站 UID 和本站密码登录')
    await router.push('/manage/user')
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error))
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="account-setup">
    <template v-if="proof?.linked && !account.id && !resetting">
      <p>UID {{ proof.userId }} 已关联站内账号，请使用 UID 和已有密码登录。</p>
      <NButton
        type="primary"
        block
        @click="router.push({ name: 'manage' })"
        >前往登录</NButton
      >
      <NButton
        block
        secondary
        @click="resetting = true"
        >忘记密码，设置新密码</NButton
      >
    </template>
    <template v-else-if="proof && !completed">
      <h3>{{ resetting ? '重置本站登录密码' : account.id ? '绑定到当前账号' : '设置本站登录密码' }}</h3>
      <p>
        登录 UID：<strong>{{ proof.userId }}</strong>
      </p>
      <p v-if="resetting">已重新确认 B 站身份，无需旧密码。重置后，原有网页登录会失效。</p>
      <p v-if="!needsPassword">将绑定到 {{ account.name }}，继续使用当前账号的密码。</p>
      <NForm
        v-else
        @submit.prevent="submit"
      >
        <NFormItem label="本站密码">
          <NInput
            v-model:value="password"
            type="password"
            show-password-on="click"
            placeholder="6–63 位，包含英文和数字"
            :input-props="{ autocomplete: 'new-password' }"
          />
        </NFormItem>
        <NFormItem label="确认密码">
          <NInput
            v-model:value="confirmation"
            type="password"
            show-password-on="click"
            placeholder="再次输入本站密码"
            :input-props="{ autocomplete: 'new-password' }"
            @keydown.enter="submit"
          />
        </NFormItem>
      </NForm>
      <NButton
        type="primary"
        block
        :loading="pending"
        @click="submit"
      >
        {{ resetting ? '重置密码并进入后台' : account.id ? '确认绑定' : '设置密码并进入后台' }}
      </NButton>
    </template>
    <NAlert
      v-else-if="error"
      type="warning"
      :show-icon="false"
      >{{ error }}</NAlert
    >
    <p v-else-if="bound">已连接站内账号，可使用 B 站 UID 和本站密码登录。</p>
    <template v-else>
      <p>重新确认 B 站身份后，可设置本站密码，下次直接通过 UID 登录。</p>
      <NButton
        secondary
        block
        @click="emit('restart')"
        >认证并设置密码</NButton
      >
    </template>
  </section>
</template>

<style scoped>
.account-setup {
  margin-block: 20px;
  color: var(--vtsuru-fg);
}
.account-setup h3 {
  font-size: 16px;
  margin: 0 0 12px;
}
.account-setup p {
  color: var(--vtsuru-fg-muted);
  line-height: 1.6;
}
</style>
