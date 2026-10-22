<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isLoadingAccount } from '@/api/account'
import HomeEmojiBackdrop from '@/apps/web/components/HomeEmojiBackdrop.vue'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { currentAPIKey, setSelectedAPIKey } from '@/shared/config'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { useBiliAuth } from '@/store/useBiliAuth'
import VtsuruLogo from '@/svgs/ic_vtuber.svg?component'

const route = useRoute()
const router = useRouter()
const biliAuth = useBiliAuth()
const showAPISwitchDialog = ref(false)
const showSiteLogin = ref(false)
const isUserWorkspace = computed(() => route.meta.workspace === 'user')
const pending = computed(() => isLoadingAccount.value || (isUserWorkspace.value && !biliAuth.sessionLoaded))
let loadingTimer: number | null = null

watch(
  pending,
  (loading) => {
    if (loading) {
      showAPISwitchDialog.value = false
      loadingTimer = window.setTimeout(() => {
        if (pending.value && currentAPIKey.value === 'main') {
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

async function switchToBackupAPI() {
  await setSelectedAPIKey('failover')
  showAPISwitchDialog.value = false
  location.reload()
}
</script>

<template>
  <main class="auth-page">
    <HomeEmojiBackdrop />

    <section
      v-if="!pending"
      class="auth-shell"
      aria-labelledby="auth-title"
    >
      <header class="auth-header">
        <VtsuruLogo class="auth-logo" />
        <p class="auth-eyebrow">VTSURU CENTER</p>
        <h1 id="auth-title">{{ isUserWorkspace ? '查看积分和订单' : '登录或创建账号' }}</h1>
        <p class="auth-lead">
          {{
            isUserWorkspace
              ? '用 Bilibili 发一条弹幕完成认证。不用注册本站账号。'
              : '主播使用本站账号管理直播工具。'
          }}
        </p>
      </header>

      <div
        v-if="isUserWorkspace"
        class="auth-actions"
      >
        <Button variant="brand" size="default" class="font-semibold" @click="router.push({ name: 'bili-auth' })">
          开始认证
        </Button>
        <Button v-if="!showSiteLogin" variant="ghost" size="default" @click="showSiteLogin = true">
          已有本站账号，登录
        </Button>
      </div>

      <div
        v-if="!isUserWorkspace || showSiteLogin"
        class="auth-form"
      >
        <RegisterAndLogin initial-tab="login" />
      </div>

      <Alert
        v-if="!isUserWorkspace"
        class="bg-muted/30 border-border"
      >
        <AlertTitle class="text-xs font-semibold">不是主播？</AlertTitle>
        <AlertDescription class="text-xs text-muted-foreground mt-1 space-y-2">
          <p>看积分和订单不用注册。用 Bilibili 发一条弹幕完成认证即可。</p>
          <div>
            <Button size="xs" variant="outline" @click="router.push({ name: 'bili-auth' })">
              前往观众认证
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <Button variant="outline" as-child class="home-action mx-auto">
        <a href="/">回到主页</a>
      </Button>
    </section>

    <section
      v-else
      class="loading-panel"
      aria-live="polite"
    >
      <div class="flex flex-col items-center gap-3 py-6">
        <div class="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        <span class="text-xs text-muted-foreground">正在请求账户数据...</span>
      </div>

      <Alert
        v-if="showAPISwitchDialog"
        class="w-full border-warning/50 bg-warning/10 text-warning-foreground"
      >
        <AlertTitle class="text-xs font-semibold">加载时间较长</AlertTitle>
        <AlertDescription class="text-xs text-muted-foreground mt-1 space-y-2.5">
          <p>当前 API 响应较慢，是否切换到备用 API？</p>
          <div class="flex justify-end gap-2">
            <Button size="xs" variant="ghost" @click="showAPISwitchDialog = false">
              继续等待
            </Button>
            <Button size="xs" variant="brand" @click="switchToBackupAPI">
              切换到备用 API
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  position: relative;
  display: grid;
  min-height: 100vh;
  min-width: 0;
  place-items: center;
  box-sizing: border-box;
  overflow-x: hidden;
  padding: 48px 20px;
  isolation: isolate;
  background: var(--background);
  color: var(--foreground);
}

.auth-shell,
.loading-panel {
  position: relative;
  z-index: 1;
  width: min(100%, 520px);
  min-width: 0;
}

.auth-shell {
  display: grid;
  gap: 18px;
}

.auth-header {
  text-align: center;
}

.auth-logo {
  width: 72px;
  height: 72px;
  margin: 0 auto;
  color: var(--brand);
}

.auth-eyebrow {
  margin: 12px 0 5px;
  color: var(--muted-foreground);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
}

.auth-header h1 {
  margin: 0;
  color: var(--foreground);
  font-size: 28px;
  font-weight: 750;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.auth-lead {
  margin: 8px 0 0;
  color: var(--muted-foreground);
  font-size: 14px;
  line-height: 1.6;
  text-align: center;
}

.auth-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.auth-form {
  min-width: 0;
  padding: 20px;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--popover) 94%, transparent);
  box-shadow: 0 18px 52px color-mix(in srgb, var(--foreground) 10%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.home-action {
  min-width: 112px;
}

.loading-panel {
  display: grid;
  justify-items: center;
  gap: 20px;
  padding: 28px;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--popover) 94%, transparent);
  box-shadow: 0 18px 52px color-mix(in srgb, var(--foreground) 10%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

@media (max-width: 480px) {
  .auth-page {
    align-items: start;
    padding: 24px 12px 40px;
  }

  .auth-logo {
    width: 58px;
    height: 58px;
  }
}
</style>
