<script setup lang="ts">
import {
  Add24Regular,
  ArrowLeft24Regular,
  History24Regular,
  Home24Regular,
  PersonAccounts24Regular,
  Receipt24Regular,
  Settings24Regular,
} from '@vicons/fluent'
import { NAvatar, NButton, NDropdown, NIcon, NInput, NModal, NResult, NSpin, NTag, useMessage } from 'naive-ui'
import { computed, h, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { createBiliAuthUrl, hasBiliAuthInUrl, readBiliAuthFromUrl } from '@/apps/account/components/biliAuthCredential'
import { CURRENT_HOST } from '@/shared/config'
import { useBiliAuth } from '@/store/useBiliAuth'

const auth = useBiliAuth()
const message = useMessage()
const route = useRoute()
const router = useRouter()

const navigation = [
  { name: 'bili-user-points', label: '我的积分', icon: Home24Regular },
  { name: 'bili-user-orders', label: '我的订单', icon: Receipt24Regular },
  { name: 'bili-user-history', label: '积分记录', icon: History24Regular },
  { name: 'bili-user-settings', label: '账户设置', icon: Settings24Regular },
]

const isReady = computed(() => !auth.isInvalid && auth.biliAuth.id > 0)
const hasSavedAccounts = computed(() => auth.biliTokens.length > 0)
const currentAccountId = computed(() => String(auth.biliAuth.id || ''))
const isMigrating = ref(false)
const migrationError = ref('')
const migrationLink = computed(() => createBiliAuthUrl(CURRENT_HOST, auth.replacementToken ?? ''))
const accountOptions = computed(() => [
  ...auth.biliTokens.map((account) => ({
    key: String(account.id),
    label: account.name || `Bilibili 用户 ${account.uId}`,
    disabled: account.id === auth.biliAuth.id,
  })),
  { type: 'divider' as const, key: 'divider' },
  { key: 'add', label: '认证其他账号', icon: hIcon(Add24Regular) },
])

function hIcon(component: typeof Add24Regular) {
  return () => h(NIcon, { component })
}

async function clearAuthFromUrl() {
  const query = { ...route.query }
  delete query.auth
  await router.replace({ path: route.path, query, hash: '' })
}

async function consumeAuthToken() {
  if (route.query.auth) {
    await clearAuthFromUrl()
    message.warning('旧版认证链接已失效，请重新完成账户认证')
    return
  }

  const source = window.location.hash
  if (!hasBiliAuthInUrl(source)) return

  await clearAuthFromUrl()
  try {
    const token = readBiliAuthFromUrl(source)
    if (token) await auth.setCurrentAuth(token)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '认证链接格式无效')
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
    message.error('该账号的认证已失效')
    return
  }
  message.success(`已切换至 ${account.name || account.uId}`)
}

async function openSavedAccount(accountId: number) {
  await switchAccount(String(accountId))
}

async function migrateLegacyAuth() {
  if (isMigrating.value) return
  isMigrating.value = true
  migrationError.value = ''
  try {
    if (!await auth.migrateLegacyToken()) {
      migrationError.value = '旧登录链接无法迁移，请重新认证'
    }
  } catch (error) {
    migrationError.value = error instanceof Error ? error.message : '旧登录链接无法迁移，请重新认证'
  } finally {
    isMigrating.value = false
  }
}

async function copyMigrationLink() {
  try {
    await navigator.clipboard.writeText(migrationLink.value)
    message.success('已复制新的登录链接')
  } catch {
    message.warning('无法复制，请手动选择登录链接')
  }
}

function isNavigationActive(name: string) {
  return route.name === name
}

watch(() => route.fullPath, consumeAuthToken, { immediate: true })
watch(() => auth.legacyToken, (token) => {
  if (token) void migrateLegacyAuth()
})
</script>

<template>
  <main class="account-center">
    <header class="account-header">
      <div class="account-header__inner">
        <NButton
          quaternary
          circle
          aria-label="返回首页"
          @click="router.push({ name: 'index' })"
        >
          <template #icon><NIcon :component="ArrowLeft24Regular" /></template>
        </NButton>
        <div class="account-brand">
          <span class="account-brand__mark">VT</span>
          <div>
            <strong>Bilibili 账户中心</strong>
            <span>积分与互动记录</span>
          </div>
        </div>
        <NButton
          secondary
          size="small"
          @click="router.push({ name: 'bili-auth' })"
        >
          <template #icon><NIcon :component="Add24Regular" /></template>
          <span class="desktop-label">认证其他账号</span>
          <span class="mobile-label">添加账号</span>
        </NButton>
      </div>
    </header>

    <section
      v-if="auth.isLoading && auth.currentToken"
      class="account-state"
    >
      <NSpin size="large" />
      <div>
        <strong>正在载入账户</strong>
        <span>正在同步认证信息，请稍候</span>
      </div>
    </section>

    <section
      v-else-if="!isReady"
      class="account-state account-state--panel"
    >
      <NResult
        :status="auth.isInvalid ? 'warning' : 'info'"
        :title="auth.isInvalid ? '当前账户认证已失效' : '连接 Bilibili 账户后继续'"
      >
        <template #footer>
          <div class="state-actions">
            <NButton
              type="primary"
              @click="router.push({ name: 'bili-auth' })"
            >
              {{ hasSavedAccounts ? '认证其他账号' : '开始认证' }}
            </NButton>
            <NButton @click="router.push({ name: 'index' })">返回首页</NButton>
          </div>
        </template>
      </NResult>

      <div
        v-if="hasSavedAccounts"
        class="saved-accounts"
      >
        <div class="saved-accounts__heading">
          <div>
            <strong>已保存的账户</strong>
            <span>选择一个仍然有效的账户继续</span>
          </div>
          <NTag
            size="small"
            round
            :bordered="false"
          >
            {{ auth.biliTokens.length }} 个账户
          </NTag>
        </div>
        <button
          v-for="account in auth.biliTokens"
          :key="account.id"
          type="button"
          class="saved-account"
          @click="openSavedAccount(account.id)"
        >
          <NAvatar round>{{ (account.name || 'B').slice(0, 1) }}</NAvatar>
          <span>
            <strong>{{ account.name || '未命名账户' }}</strong>
            <small>UID {{ account.uId }}</small>
          </span>
          <NIcon :component="PersonAccounts24Regular" />
        </button>
      </div>
    </section>

    <div
      v-else
      class="account-workspace"
    >
      <aside class="account-sidebar">
        <div class="identity-card">
          <NAvatar
            :src="auth.biliAuth.avatar"
            round
            :size="48"
          >
            {{ auth.biliAuth.name?.slice(0, 1) }}
          </NAvatar>
          <div class="identity-card__copy">
            <strong>{{ auth.biliAuth.name }}</strong>
            <span>UID {{ auth.biliAuth.userId }}</span>
          </div>
          <NTag
            type="success"
            size="small"
            round
            :bordered="false"
          >
            已认证
          </NTag>
        </div>

        <NDropdown
          trigger="click"
          placement="bottom-start"
          :options="accountOptions"
          @select="switchAccount"
        >
          <NButton
            secondary
            block
          >
            <template #icon><NIcon :component="PersonAccounts24Regular" /></template>
            切换账户
          </NButton>
        </NDropdown>

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
            <NIcon :component="item.icon" />
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

  <NModal
    :show="auth.requiresLegacyMigration"
    :mask-closable="false"
    :closable="false"
  >
    <section class="legacy-migration-modal">
      <template v-if="auth.replacementToken">
        <p class="legacy-migration-modal__eyebrow">登录链接已更新</p>
        <h2>保存新的登录链接</h2>
        <p>新链接将长期有效。旧链接已失效。</p>
        <NInput
          :value="migrationLink"
          readonly
          type="password"
          show-password-on="click"
        />
        <div class="legacy-migration-modal__actions">
          <NButton @click="copyMigrationLink">复制链接</NButton>
          <NButton
            type="primary"
            @click="auth.finishLegacyMigration()"
          >
            我已保存
          </NButton>
        </div>
      </template>
      <template v-else>
        <p class="legacy-migration-modal__eyebrow">正在更新登录链接</p>
        <h2>{{ migrationError ? '无法生成新链接' : '正在生成新的登录链接' }}</h2>
        <p>{{ migrationError || '完成后会在这里显示新的长期登录链接。' }}</p>
        <div
          v-if="migrationError"
          class="legacy-migration-modal__actions"
        >
          <NButton
            type="primary"
            @click="migrateLegacyAuth"
          >
            重试
          </NButton>
        </div>
        <NSpin
          v-else
          size="small"
        />
      </template>
    </section>
  </NModal>
</template>

<style scoped src="../account/components/PointUserLayout.css"></style>
