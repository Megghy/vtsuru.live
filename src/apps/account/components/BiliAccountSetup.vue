<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { applyAccountSession, completeBiliAccount, useAccount } from '@/api/account'
import type { BiliAccountProof } from '@/api/account'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { useMessage } from '@/shared/utils'

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
  <section class="account-setup space-y-4">
    <template v-if="proof?.linked && !account.id && !resetting">
      <p>这个 B 站账号已经设置过本站密码，直接登录即可。登录 UID：{{ proof.userId }}</p>
      <div class="space-y-2">
        <Button class="w-full" @click="router.push({ name: 'manage-index' })">
          前往登录
        </Button>
        <Button variant="secondary" class="w-full" @click="resetting = true">
          忘记密码，设置新密码
        </Button>
      </div>
    </template>
    <template v-else-if="proof && !completed">
      <h3 class="text-base font-medium">{{ resetting ? '重置本站登录密码' : account.id ? '绑定到当前账号' : '设置本站登录密码' }}</h3>
      <p>
        登录 UID：<strong>{{ proof.userId }}</strong>
      </p>
      <p v-if="resetting">已重新确认 B 站身份，无需旧密码。重置后，原有网页登录会失效。</p>
      <p v-if="!needsPassword">将绑定到 {{ account.name }}，继续使用当前账号的密码。</p>
      <form
        v-else
        class="space-y-3"
        @submit.prevent="submit"
      >
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-muted-foreground">本站密码</label>
          <Input v-model="password" type="password" placeholder="6–63 位，包含英文和数字" autocomplete="new-password" />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-medium text-muted-foreground">确认密码</label>
          <Input v-model="confirmation" type="password" placeholder="再次输入本站密码" autocomplete="new-password" @keydown.enter="submit" />
        </div>
      </form>
      <Button class="w-full" :disabled="pending" @click="submit">
        {{ resetting ? '重置密码并查看积分' : account.id ? '确认绑定' : '设置密码并查看积分' }}
      </Button>
    </template>
    <Alert
      v-else-if="error"
      variant="destructive"
    >
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>
    <p v-else-if="bound">已连接站内账号，可使用 B 站 UID 和本站密码登录。</p>
    <template v-else>
      <p>重新确认 B 站身份后，可设置本站密码，下次直接通过 UID 登录。</p>
      <Button variant="secondary" class="w-full" @click="emit('restart')">
        认证并设置密码
      </Button>
    </template>
  </section>
</template>

<style scoped>
.account-setup {
  margin-block: 20px;
  color: var(--foreground);
}
.account-setup h3 {
  font-size: 16px;
  margin: 0 0 12px;
}
.account-setup p {
  color: var(--muted-foreground);
  line-height: 1.6;
}
</style>
