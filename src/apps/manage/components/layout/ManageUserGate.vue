<script setup lang="ts">
import { NButton, NInput, NModal, NResult, NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import { createBiliAuthUrl, hasBiliAuthInUrl, readBiliAuthFromUrl } from '@/apps/account/components/biliAuthCredential'
import { CURRENT_HOST } from '@/shared/config'
import { useBiliAuth } from '@/store/useBiliAuth'

const auth = useBiliAuth()
const accountInfo = useAccount()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const isMigrating = ref(false)
const migrationError = ref('')
const migrationLink = computed(() => createBiliAuthUrl(CURRENT_HOST, auth.replacementToken ?? ''))
const isReady = computed(() => auth.isAuthed && auth.biliAuth.id > 0 && !auth.isInvalid)

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
  if (!hasBiliAuthInUrl(window.location.hash)) return

  try {
    const source = window.location.hash
    await clearAuthFromUrl()
    const token = readBiliAuthFromUrl(source)
    if (!token) return
    if (auth.usesAccountIdentity) {
      message.warning('当前已登录站内账号，如需绑定身份请使用账户设置中的认证入口')
      return
    }
    await auth.setCurrentAuth(token)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '认证链接格式无效')
  }
}

async function migrateLegacyAuth() {
  if (isMigrating.value) return
  isMigrating.value = true
  migrationError.value = ''
  try {
    if (!(await auth.migrateLegacyToken())) migrationError.value = '旧登录链接无法迁移，请重新认证'
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

watch(() => route.fullPath, consumeAuthToken, { immediate: true })
watch(
  () => auth.legacyToken,
  (token) => token && void migrateLegacyAuth(),
)
onMounted(async () => {
  try {
    await auth.getAuthInfo()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '无法载入 Bilibili 账户')
  }
})
</script>

<template>
  <div
    v-if="auth.isLoading && !isReady"
    class="user-workspace-state"
  >
    <NSpin size="large" />
    <span>正在载入 Bilibili 账户</span>
  </div>

  <RouterView
    v-else-if="isReady"
    v-slot="{ Component, route: viewRoute }"
  >
    <div
      class="manage-page"
      :class="viewRoute.meta.pageWidth ? `manage-page--${viewRoute.meta.pageWidth}` : undefined"
    >
      <component
        :is="Component"
        :key="`${String(viewRoute.name)}-${auth.biliAuth.id}`"
      />
    </div>
  </RouterView>

  <div
    v-else
    class="manage-page manage-page--md"
  >
    <NResult
      :status="auth.isInvalid ? 'warning' : 'info'"
      :title="auth.isInvalid ? 'Bilibili 认证已失效' : '先完成 Bilibili 认证'"
      description="认证后即可查看积分、订单和积分记录。"
    >
      <template #footer>
        <div class="user-workspace-actions">
          <NButton
            type="primary"
            @click="router.push({ name: 'bili-auth' })"
          >
            {{ auth.isInvalid ? '重新认证' : accountInfo.id ? '绑定 Bilibili' : '开始认证' }}
          </NButton>
        </div>
      </template>
    </NResult>
  </div>

  <NModal
    :show="auth.requiresLegacyMigration"
    :mask-closable="false"
    :closable="false"
  >
    <section class="legacy-migration-modal">
      <template v-if="auth.replacementToken">
        <p>登录链接已更新</p>
        <h2>保存新的登录链接</h2>
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
        <h2>{{ migrationError ? '无法生成新链接' : '正在更新登录链接' }}</h2>
        <p>{{ migrationError || '完成后会在这里显示新的长期登录链接。' }}</p>
        <NButton
          v-if="migrationError"
          type="primary"
          @click="migrateLegacyAuth"
        >
          重试
        </NButton>
        <NSpin v-else />
      </template>
    </section>
  </NModal>
</template>

<style scoped>
.user-workspace-state {
  min-height: 280px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  color: var(--vtsuru-fg-muted);
}

.user-workspace-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.legacy-migration-modal {
  width: min(460px, calc(100vw - 32px));
  padding: 22px;
  box-sizing: border-box;
  border: 1px solid var(--vtsuru-border);
  border-radius: 12px;
  background: var(--vtsuru-bg-elevated);
  color: var(--vtsuru-fg);
}

.legacy-migration-modal h2 {
  margin: 0 0 8px;
}

.legacy-migration-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
</style>
