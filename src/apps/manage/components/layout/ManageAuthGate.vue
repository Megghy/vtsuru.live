<script setup lang="ts">
import { ref, watch } from 'vue'

import { isLoadingAccount } from '@/api/account'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { selectedAPIKey } from '@/shared/config'

const toast = useToast()
const showAPISwitchDialog = ref(false)
let loadingTimer: number | null = null

watch(
  isLoadingAccount,
  (loading) => {
    if (loading) {
      showAPISwitchDialog.value = false
      loadingTimer = window.setTimeout(() => {
        if (isLoadingAccount.value && selectedAPIKey.value === 'main') {
          showAPISwitchDialog.value = true
        }
      }, 3000)
      return
    }

    if (loadingTimer) {
      clearTimeout(loadingTimer)
      loadingTimer = null
    }
    showAPISwitchDialog.value = false
  },
  { immediate: true },
)

function switchToBackupAPI() {
  selectedAPIKey.value = 'failover'
  toast.add({ title: '已切换到备用API，正在重新加载...', color: 'info' })
  showAPISwitchDialog.value = false
  setTimeout(() => location.reload(), 500)
}
</script>

<template>
  <main class="manage-auth-gate">
    <template v-if="!isLoadingAccount">
      <UCard class="login-card">
        <template #header>
          <h1 class="login-card__title">VTSURU CENTER</h1>
        </template>

        <div class="login-card__content">
          <p class="login-card__intro">请登录或注册后使用</p>

          <UAlert
            color="info"
            variant="soft"
          >
            <template #description>
              <div class="login-card__notice">
                如果你不是主播且不发送棉花糖(提问)的话则不需要注册登录, 直接访问认证完成后给出的链接即可
              </div>
              <div class="login-card__notice-action">
                <UButton
                  color="primary"
                  size="sm"
                  @click="$router.push({ name: 'bili-user' })"
                >
                  <template #leading><UIcon name="i-lucide-globe" /></template>
                  前往 Bilibili 认证用户主页
                </UButton>
              </div>
            </template>
          </UAlert>

          <USeparator />

          <RegisterAndLogin />

          <div class="login-card__home-action">
            <UButton
              color="neutral"
              variant="soft"
              to="/"
            >
              回到主页
            </UButton>
          </div>
        </div>
      </UCard>
    </template>

    <template v-else>
      <UCard class="loading-card">
        <div class="loading-card__content">
          <USkeleton class="loading-card__skeleton" />
          <p>正在请求账户数据...</p>
          <UAlert
            v-if="showAPISwitchDialog"
            color="warning"
            variant="soft"
            title="加载时间较长"
          >
            <template #description>当前API响应较慢，是否切换到备用API？</template>
            <template #actions>
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                label="继续等待"
                @click="showAPISwitchDialog = false"
              />
              <UButton
                color="primary"
                size="sm"
                label="切换到备用API"
                @click="switchToBackupAPI"
              />
            </template>
          </UAlert>
        </div>
      </UCard>
    </template>
  </main>
</template>

<style scoped>
.manage-auth-gate {
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  margin: 0;
  padding: 16px 0;
  background: var(--vtsuru-bg);
}

.login-card {
  width: 90%;
  min-width: 300px;
  max-width: 520px;
  margin: 16px;
}

.login-card__title,
.login-card__intro {
  margin: 0;
  text-align: center;
}

.login-card__title {
  font-size: 1.8rem;
}

.login-card__intro {
  font-size: 16px;
}

.login-card__content,
.loading-card__content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.login-card__notice {
  text-align: center;
}

.login-card__notice-action,
.login-card__home-action {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

.loading-card {
  width: 90%;
  min-width: 280px;
  max-width: 400px;
  margin: 16px;
}

.loading-card__content {
  align-items: center;
  padding: 12px 0;
}

.loading-card__skeleton {
  width: 32px;
  height: 32px;
  border-radius: 999px;
}

@media (max-width: 480px) {
  .login-card,
  .loading-card {
    width: 95%;
    margin: 8px;
  }
}
</style>
