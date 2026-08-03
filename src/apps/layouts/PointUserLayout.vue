<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { hasBiliAuthInUrl, readBiliAuthFromUrl } from '@/apps/account/components/biliAuthCredential'
import { showToast } from '@/shared/services/toast'
import { useBiliAuth } from '@/store/useBiliAuth'

const auth = useBiliAuth()
const route = useRoute()
const router = useRouter()

const navigation = [
  { name: 'bili-user-points', label: '我的积分', icon: 'i-lucide-house' },
  { name: 'bili-user-orders', label: '我的订单', icon: 'i-lucide-receipt-text' },
  { name: 'bili-user-history', label: '积分记录', icon: 'i-lucide-history' },
  { name: 'bili-user-settings', label: '账户设置', icon: 'i-lucide-settings' },
]

const isReady = computed(() => Boolean(auth.currentToken && !auth.isInvalid && auth.biliAuth.id > 0))
const hasSavedAccounts = computed(() => auth.biliTokens.length > 0)
const currentAccountId = computed(() => String(auth.biliAuth.id || ''))
const accountOptions = computed(() => [
  ...auth.biliTokens.map((account) => ({
    label: account.name || `Bilibili 用户 ${account.uId}`,
    disabled: account.id === auth.biliAuth.id,
    onSelect: () => switchAccount(String(account.id)),
  })),
  { type: 'separator' as const },
  { label: '认证其他账号', icon: 'i-lucide-plus', onSelect: () => switchAccount('add') },
])

async function clearAuthFromUrl() {
  const query = { ...route.query }
  delete query.auth
  await router.replace({ path: route.path, query, hash: '' })
}

async function consumeAuthToken() {
  if (route.query.auth) {
    await clearAuthFromUrl()
    showToast({ title: '旧版认证链接已失效', description: '请重新完成账户认证', color: 'warning' })
    return
  }

  const source = window.location.hash
  if (!hasBiliAuthInUrl(source)) return

  await clearAuthFromUrl()
  try {
    const token = readBiliAuthFromUrl(source)
    if (token) await auth.setCurrentAuth(token)
  } catch (error) {
    showToast({ title: error instanceof Error ? error.message : '认证链接格式无效', color: 'error' })
  }
}

async function switchAccount(accountId: string) {
  if (accountId === 'add') {
    await router.push({ name: 'bili-auth' })
    return
  }

  const account = auth.biliTokens.find((item) => String(item.id) === accountId)
  if (!account || (account.id === auth.biliAuth.id && account.token === auth.currentToken)) return

  await auth.setCurrentAuth(account.token)
  if (auth.isInvalid) {
    showToast({ title: '该账号的认证已失效', color: 'error' })
    return
  }
  showToast({ title: `已切换至 ${account.name || account.uId}`, color: 'success' })
}

async function openSavedAccount(accountId: number) {
  await switchAccount(String(accountId))
}

function isNavigationActive(name: string) {
  return route.name === name
}

watch(() => route.fullPath, consumeAuthToken, { immediate: true })
</script>

<template>
  <main class="account-center">
    <header class="account-header">
      <div class="account-header__inner">
        <UButton
          variant="ghost"
          square
          color="neutral"
          icon="i-lucide-arrow-left"
          aria-label="返回首页"
          @click="router.push({ name: 'index' })"
        />
        <div class="account-brand">
          <span class="account-brand__mark">VT</span>
          <div>
            <strong>Bilibili 账户中心</strong>
            <span>积分与互动记录</span>
          </div>
        </div>
        <UButton
          color="neutral"
          variant="soft"
          size="sm"
          icon="i-lucide-plus"
          @click="router.push({ name: 'bili-auth' })"
        >
          <span class="desktop-label">认证其他账号</span>
          <span class="mobile-label">添加账号</span>
        </UButton>
      </div>
    </header>

    <section
      v-if="auth.isLoading && auth.currentToken"
      class="account-state"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-7 animate-spin"
      />
      <div>
        <strong>正在载入账户</strong>
        <span>正在同步认证信息，请稍候</span>
      </div>
    </section>

    <section
      v-else-if="!isReady"
      class="account-state account-state--panel"
    >
      <UIcon
        :name="auth.isInvalid ? 'i-lucide-circle-alert' : 'i-lucide-user-round-plus'"
        class="account-state__icon"
      />
      <strong>{{ auth.isInvalid ? '当前账户认证已失效' : '连接 Bilibili 账户后继续' }}</strong>
      <div class="state-actions">
        <UButton @click="router.push({ name: 'bili-auth' })">
          {{ hasSavedAccounts ? '认证其他账号' : '开始认证' }}
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          @click="router.push({ name: 'index' })"
        >
          返回首页
        </UButton>
      </div>

      <div
        v-if="hasSavedAccounts"
        class="saved-accounts"
      >
        <div class="saved-accounts__heading">
          <div>
            <strong>已保存的账户</strong>
            <span>选择一个仍然有效的账户继续</span>
          </div>
          <UBadge
            color="neutral"
            variant="soft"
            size="sm"
          >
            {{ auth.biliTokens.length }} 个账户
          </UBadge>
        </div>
        <button
          v-for="account in auth.biliTokens"
          :key="account.id"
          type="button"
          class="saved-account"
          @click="openSavedAccount(account.id)"
        >
          <UAvatar :text="(account.name || 'B').slice(0, 1)" />
          <span>
            <strong>{{ account.name || '未命名账户' }}</strong>
            <small>UID {{ account.uId }}</small>
          </span>
          <UIcon
            name="i-lucide-users-round"
            class="nav-icon"
          />
        </button>
      </div>
    </section>

    <div
      v-else
      class="account-workspace"
    >
      <aside class="account-sidebar">
        <div class="identity-card">
          <UAvatar
            :src="auth.biliAuth.avatar"
            :text="auth.biliAuth.name?.slice(0, 1)"
            class="identity-avatar size-12"
          />
          <div class="identity-card__copy">
            <strong>{{ auth.biliAuth.name }}</strong>
            <span>UID {{ auth.biliAuth.userId }}</span>
          </div>
          <UBadge
            class="auth-badge"
            color="success"
            variant="soft"
            size="sm"
          >
            已认证
          </UBadge>
        </div>

        <UDropdownMenu :items="accountOptions">
          <UButton
            color="neutral"
            variant="soft"
            block
            icon="i-lucide-users-round"
            label="切换账户"
          />
        </UDropdownMenu>

        <nav
          class="account-navigation"
          aria-label="账户中心导航"
        >
          <button
            v-for="item in navigation"
            :key="item.name"
            type="button"
            :class="{ 'is-active': isNavigationActive(item.name) }"
            @click="router.push({ name: item.name })"
          >
            <UIcon
              :name="item.icon"
              class="nav-icon"
            />
            <span>{{ item.label }}</span>
          </button>
        </nav>
      </aside>

      <section class="account-content">
        <RouterView v-slot="{ Component }">
          <Transition
            name="account-view"
            mode="out-in"
          >
            <component
              :is="Component"
              :key="`${String(route.name)}-${currentAccountId}`"
            />
          </Transition>
        </RouterView>
      </section>
    </div>
  </main>
</template>

<style scoped src="../account/components/PointUserLayout.css"></style>
