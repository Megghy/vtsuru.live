<script setup lang="ts">
import { computed, ref } from 'vue'

import { createBiliAuthUrl, parseBiliAuthCredential } from '@/apps/account/components/biliAuthCredential'
import { CURRENT_HOST } from '@/shared/config'
import { useBiliAuth } from '@/store/useBiliAuth'

const auth = useBiliAuth()
const toast = useToast()
const adding = ref(false)
const working = ref(false)
const credentialInput = ref('')
const accountToRemove = ref<string>()

const accountCount = computed(() => auth.biliTokens.length)
const maskedLoginUrl = computed(() => createBiliAuthUrl(CURRENT_HOST, '************'))

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function accountLabel(token: string) {
  const account = auth.biliTokens.find((item) => item.token === token)
  return account?.name ?? (account ? `UID ${account.uId}` : '该账号')
}

async function switchAccount(token: string) {
  if (token === auth.biliToken) return

  working.value = true
  try {
    await auth.setCurrentAuth(token)
    if (!auth.biliAuth.id || auth.biliToken !== token) throw new Error('账号认证已失效')
    toast.add({ color: 'success', title: `已切换至 ${auth.biliAuth.name}` })
  } catch (error) {
    toast.add({ color: 'error', title: `切换失败：${errorText(error)}` })
  } finally {
    working.value = false
  }
}

async function removeAccount(token: string) {
  if (token !== auth.biliToken) {
    auth.biliTokens = auth.biliTokens.filter((item) => item.token !== token)
    toast.add({ color: 'success', title: '账号已移除' })
    return
  }

  const next = auth.biliTokens.find((item) => item.token !== token)
  auth.logout()
  if (next) await auth.setCurrentAuth(next.token)
  toast.add({ color: 'success', title: next ? `已切换至 ${next.name ?? `UID ${next.uId}`}` : '已退出认证账号' })
}

async function confirmRemoveAccount() {
  const token = accountToRemove.value
  if (!token) return

  accountToRemove.value = undefined
  await removeAccount(token)
}

async function addAccount() {
  let token: string
  try {
    token = parseBiliAuthCredential(credentialInput.value)
  } catch (error) {
    toast.add({ color: 'warning', title: errorText(error) })
    return
  }

  working.value = true
  try {
    await auth.setCurrentAuth(token)
    if (!auth.biliAuth.id || auth.biliToken !== token) throw new Error('认证信息无效或已过期')
    credentialInput.value = ''
    adding.value = false
    toast.add({ color: 'success', title: `已添加 ${auth.biliAuth.name}` })
  } catch (error) {
    toast.add({ color: 'error', title: `添加失败：${errorText(error)}` })
  } finally {
    working.value = false
  }
}

async function copyLoginUrl() {
  try {
    await navigator.clipboard.writeText(createBiliAuthUrl(CURRENT_HOST, auth.biliToken))
    toast.add({ color: 'success', title: '快捷登录链接已复制' })
  } catch (error) {
    toast.add({ color: 'error', title: `复制失败：${errorText(error)}` })
  }
}

function reset() {
  adding.value = false
  credentialInput.value = ''
  accountToRemove.value = undefined
}

defineExpose({ reset })
</script>

<template>
  <section class="point-settings__panel">
    <div class="point-settings__panel-header">
      <div class="point-settings__panel-title">
        <span class="point-settings__panel-icon"><UIcon name="i-lucide-user-round" /></span>
        <div>
          <h2>认证账号</h2>
          <span>{{ accountCount }} 个账号</span>
        </div>
      </div>
      <UButton
        color="primary"
        variant="soft"
        size="sm"
        icon="i-lucide-plus"
        @click="adding = true"
      >
        添加账号
      </UButton>
    </div>

    <div
      v-if="working || auth.isLoading"
      class="point-settings__loading"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="animate-spin"
      />
    </div>
    <UEmpty
      v-else-if="accountCount === 0"
      title="还没有认证账号"
      icon="i-lucide-user-round-x"
      size="sm"
      class="point-settings__empty"
    />
    <div
      v-else
      class="point-settings__accounts"
    >
      <article
        v-for="item in auth.biliTokens"
        :key="item.token"
        class="point-settings__account"
        :class="{ 'is-current': item.token === auth.biliToken }"
      >
        <UAvatar
          :src="item.token === auth.biliToken ? auth.biliAuth.avatar : undefined"
          :alt="item.name ?? 'Bilibili 用户'"
          :text="item.name?.slice(0, 1) ?? 'B'"
        />
        <div class="point-settings__account-copy">
          <strong>{{ item.name || 'Bilibili 用户' }}</strong>
          <span>UID {{ item.uId }}</span>
        </div>
        <UBadge
          v-if="item.token === auth.biliToken"
          color="success"
          variant="subtle"
          size="sm"
          label="当前"
        />
        <UButton
          v-else
          color="primary"
          variant="soft"
          size="xs"
          @click="switchAccount(item.token)"
        >
          切换
        </UButton>
        <UButton
          color="error"
          variant="ghost"
          size="sm"
          square
          icon="i-lucide-trash-2"
          :aria-label="`移除 ${accountLabel(item.token)}`"
          @click="accountToRemove = item.token"
        />
      </article>
    </div>

    <div class="point-settings__credential">
      <div class="point-settings__credential-heading">
        <span class="point-settings__panel-icon"><UIcon name="i-lucide-key-round" /></span>
        <strong>快捷登录链接</strong>
        <UBadge
          color="neutral"
          variant="subtle"
          size="sm"
          label="已遮盖"
        />
      </div>
      <div class="point-settings__credential-row">
        <code>{{ maskedLoginUrl }}</code>
        <UButton
          color="primary"
          variant="soft"
          icon="i-lucide-copy"
          :disabled="!auth.biliToken"
          @click="copyLoginUrl"
        >
          复制
        </UButton>
      </div>
    </div>
  </section>

  <UModal
    v-model:open="adding"
    title="添加认证账号"
    :dismissible="!working"
    :ui="{ content: 'point-settings__account-modal' }"
  >
    <template #body>
      <div class="point-settings__modal-body">
        <UInput
          v-model="credentialInput"
          type="password"
          placeholder="粘贴登录链接、#auth=... 或认证 Token"
          :disabled="working"
          @keyup.enter="addAccount"
        />
      </div>
    </template>
    <template #footer>
      <div class="point-settings__modal-actions">
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="working"
          @click="adding = false"
        >
          取消
        </UButton>
        <UButton
          color="primary"
          :loading="working"
          @click="addAccount"
        >
          添加账号
        </UButton>
      </div>
    </template>
  </UModal>

  <UModal
    :open="Boolean(accountToRemove)"
    title="移除认证账号"
    @update:open="!$event && (accountToRemove = undefined)"
  >
    <template #body>
      <p>
        确认{{ accountToRemove === auth.biliToken ? '退出并' : '' }}移除「{{
          accountLabel(accountToRemove ?? '')
        }}」吗？
      </p>
    </template>
    <template #footer>
      <div class="point-settings__modal-actions">
        <UButton
          color="neutral"
          variant="ghost"
          @click="accountToRemove = undefined"
        >
          取消
        </UButton>
        <UButton
          color="error"
          @click="confirmRemoveAccount"
        >
          移除账号
        </UButton>
      </div>
    </template>
  </UModal>
</template>
