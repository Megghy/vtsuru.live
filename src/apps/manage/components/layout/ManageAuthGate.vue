<script setup lang="ts">
import { NAlert, NButton, NFlex, NSpin, NText, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isLoadingAccount } from '@/api/account'
import HomeEmojiBackdrop from '@/apps/web/components/HomeEmojiBackdrop.vue'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { currentAPIKey, setSelectedAPIKey } from '@/shared/config'
import { useBiliAuth } from '@/store/useBiliAuth'
import VtsuruLogo from '@/svgs/ic_vtuber.svg?component'

const message = useMessage()
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
  message.info('已切换到备用API，正在重新加载...')
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
        <NButton
          type="primary"
          @click="router.push({ name: 'bili-auth' })"
        >
          开始认证
        </NButton>
        <NButton
          v-if="!showSiteLogin"
          quaternary
          @click="showSiteLogin = true"
        >
          已有本站账号，登录
        </NButton>
      </div>

      <div
        v-if="!isUserWorkspace || showSiteLogin"
        class="auth-form"
      >
        <RegisterAndLogin initial-tab="login" />
      </div>

      <NAlert
        v-if="!isUserWorkspace"
        type="info"
        :bordered="false"
        title="不是主播？"
      >
        <NFlex
          vertical
          :size="10"
        >
          <NText>看积分和订单不用注册。用 Bilibili 发一条弹幕完成认证即可。</NText>
          <div>
            <NButton
              size="small"
              type="primary"
              @click="router.push({ name: 'bili-auth' })"
            >
              前往观众认证
            </NButton>
          </div>
        </NFlex>
      </NAlert>

      <NButton
        secondary
        tag="a"
        href="/"
        class="home-action"
      >
        回到主页
      </NButton>
    </section>

    <section
      v-else
      class="loading-panel"
      aria-live="polite"
    >
      <NSpin
        :loading="pending"
        size="large"
      >
        <NText>正在请求账户数据...</NText>
      </NSpin>
      <NAlert
        v-if="showAPISwitchDialog"
        type="warning"
        :bordered="false"
        title="加载时间较长"
      >
        <NFlex vertical>
          <NText>当前API响应较慢，是否切换到备用API？</NText>
          <NFlex
            justify="end"
            :size="8"
          >
            <NButton
              size="small"
              @click="showAPISwitchDialog = false"
            >
              继续等待
            </NButton>
            <NButton
              type="primary"
              size="small"
              @click="switchToBackupAPI"
            >
              切换到备用API
            </NButton>
          </NFlex>
        </NFlex>
      </NAlert>
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
  background: var(--vtsuru-bg);
  color: var(--vtsuru-fg);
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
  color: var(--vtsuru-brand);
}

.auth-eyebrow {
  margin: 12px 0 5px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
}

.auth-header h1 {
  margin: 0;
  color: var(--vtsuru-fg);
  font-size: 30px;
  font-weight: 750;
  line-height: 1.2;
  letter-spacing: 0;
}

.auth-lead {
  margin: 8px 0 0;
  color: var(--vtsuru-fg-muted);
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
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--vtsuru-bg-elevated) 94%, transparent);
  box-shadow: 0 18px 52px color-mix(in srgb, var(--vtsuru-fg) 10%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.home-action {
  justify-self: center;
  min-width: 112px;
}

.loading-panel {
  display: grid;
  justify-items: center;
  gap: 20px;
  padding: 28px;
  box-sizing: border-box;
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--vtsuru-bg-elevated) 94%, transparent);
  box-shadow: 0 18px 52px color-mix(in srgb, var(--vtsuru-fg) 10%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.loading-panel :deep(.n-alert) {
  width: 100%;
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

  .auth-header h1 {
    font-size: 26px;
  }

  .auth-form {
    padding: 16px;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .auth-form,
  .loading-panel {
    background: var(--vtsuru-bg-elevated);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
