<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { openUrl } from '@tauri-apps/plugin-opener'
import { computed, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { ACCOUNT, GetSelfAccount, isLoadingAccount, isLoggedIn } from '@/api/account'
import SpeechMiniController from '@/apps/client/components/SpeechMiniController.vue'
import WindowBar from '@/apps/client/components/WindowBar.vue'
import { clientInited, clientInitStage, initAll, OnClientUnmounted } from '@/apps/client/data/initialize'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { BASE_URL } from '@/shared/config'
import { useFetcherRpcServer } from '@/store/useFetcherRpcServer'
import { useWebFetcher } from '@/store/useWebFetcher'

import '@/apps/client/styles/client-page.css'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const webfetcher = useWebFetcher()
const rpcServer = useFetcherRpcServer()
const danmakuWindow = useDanmakuWindow()
const giftWindow = useGiftWindow()
const biliCookie = useBiliCookie()
const token = ref('')
const siderCollapsed = ref(false)

const cookieStatus = computed(() => {
  if (!biliCookie.hasBiliCookie) return { color: 'warning' as const, text: '未同步' }
  return biliCookie.isCookieValid
    ? { color: 'success' as const, text: '正常' }
    : { color: 'error' as const, text: '已失效' }
})

const activeMenuKey = computed(
  () =>
    ({
      'client-index': 'home',
      'client-fetcher': 'fetcher',
      'client-live-manage': 'live-manage',
      'client-danmaku-window-manage': 'danmaku-window-manage',
      'client-gift-window-manage': 'gift-window-manage',
      'client-auto-action-manage': 'auto-action',
      'client-vts': 'vts',
      'client-read-danmaku': 'read-danmaku',
      'client-settings': 'settings',
    })[route.name as string] ?? '',
)

const menuItems = computed<NavigationMenuItem[][]>(() => [
  [
    { label: '主页', icon: 'i-lucide-house', to: { name: 'client-index' }, value: 'home' },
    { label: 'EventFetcher', icon: 'i-lucide-radio-tower', to: { name: 'client-fetcher' }, value: 'fetcher' },
    { label: '直播管理', icon: 'i-lucide-video', to: { name: 'client-live-manage' }, value: 'live-manage' },
    ...(danmakuWindow.danmakuWindow || giftWindow.giftWindow
      ? [
          {
            label: '直播浮窗',
            icon: 'i-lucide-panels-top-left',
            children: [
              ...(danmakuWindow.danmakuWindow
                ? [{ label: '弹幕机', to: { name: 'client-danmaku-window-manage' }, value: 'danmaku-window-manage' }]
                : []),
              ...(giftWindow.giftWindow
                ? [{ label: '礼物与排行', to: { name: 'client-gift-window-manage' }, value: 'gift-window-manage' }]
                : []),
            ],
          } satisfies NavigationMenuItem,
        ]
      : []),
    { label: '自动操作', icon: 'i-lucide-zap', to: { name: 'client-auto-action-manage' }, value: 'auto-action' },
    { label: 'VTS 控制', icon: 'i-lucide-gamepad-2', to: { name: 'client-vts' }, value: 'vts' },
    { label: '读弹幕', icon: 'i-lucide-audio-lines', to: { name: 'client-read-danmaku' }, value: 'read-danmaku' },
    { label: '设置', icon: 'i-lucide-settings', to: { name: 'client-settings' }, value: 'settings' },
  ],
])

function formatOrigin(origin: string) {
  try {
    return new URL(origin).host
  } catch {
    return origin || '未知来源'
  }
}

function formatSince(connectedAt: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - connectedAt) / 1000))
  if (seconds < 60) return `${seconds} 秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  return `${Math.floor(minutes / 60)} 小时前`
}

async function login() {
  if (!token.value.trim()) {
    toast.add({ title: '请输入 Token', color: 'error' })
    return
  }

  isLoadingAccount.value = true
  try {
    const account = await GetSelfAccount(token.value.trim())
    if (!account) {
      toast.add({ title: '登录失败', description: '无效的 Token', color: 'error' })
      return
    }
    if (!account.isBiliAuthed) {
      toast.add({ title: '登录失败', description: '请先在网站管理页绑定 B站主播码', color: 'error' })
      return
    }
    ACCOUNT.value = account
    toast.add({ title: '登录成功', color: 'success' })
  } catch (error) {
    console.error('Login failed:', error)
    toast.add({ title: '登录出错', description: '发生未知错误，请稍后再试或联系管理员。', color: 'error' })
  } finally {
    isLoadingAccount.value = false
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', OnClientUnmounted)
})
</script>

<template>
  <WindowBar />

  <Transition name="fade">
    <div
      v-if="isLoggedIn && !clientInited"
      class="init-overlay"
    >
      <div class="init-overlay-content">
        <UIcon
          name="i-lucide-loader-circle"
          class="size-7 animate-spin"
        />
        <span class="init-stage">{{ clientInitStage || '初始化中...' }}</span>
      </div>
    </div>
  </Transition>

  <main
    v-if="!isLoggedIn"
    class="login-container"
  >
    <UCard
      v-if="!isLoadingAccount"
      class="login-card"
    >
      <template #header>
        <header class="login-header">
          <h1 class="login-title">登录</h1>
          <p class="login-subtitle">输入你的 VTsuru Token</p>
        </header>
      </template>

      <div class="login-form">
        <label
          class="token-label-container"
          for="client-token"
        >
          <span class="token-label">Token</span>
          <UTooltip text="登录后在管理面板主页的个人信息下方">
            <button
              type="button"
              class="token-get-link"
              @click="openUrl(`https://${BASE_URL}/manage`)"
            >
              前往获取
            </button>
          </UTooltip>
        </label>
        <UInput
          id="client-token"
          v-model="token"
          type="password"
          placeholder="请输入 Token"
          @keyup.enter="login"
        />
        <UButton
          block
          :loading="isLoadingAccount"
          @click="login"
          >登录</UButton
        >
      </div>
    </UCard>
    <UIcon
      v-else
      name="i-lucide-loader-circle"
      class="size-7 animate-spin"
    />
  </main>

  <div
    v-else
    class="client-shell"
    @vue:mounted="initAll(true)"
  >
    <aside
      class="client-sidebar"
      :class="{ 'client-sidebar--collapsed': siderCollapsed }"
    >
      <header class="sidebar-header">
        <strong
          v-if="!siderCollapsed"
          class="app-title"
          >VTsuru.Client</strong
        >
        <UTooltip :text="webfetcher.state === 'connected' ? 'EventFetcher 运行中' : 'EventFetcher 未运行或连接断开'">
          <UButton
            :icon="webfetcher.state === 'connected' ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
            :color="webfetcher.state === 'connected' ? 'success' : 'error'"
            variant="ghost"
            square
            @click="router.push({ name: 'client-fetcher' })"
          />
        </UTooltip>
      </header>

      <UNavigationMenu
        :items="menuItems"
        :value="activeMenuKey"
        orientation="vertical"
        :collapsed="siderCollapsed"
        class="flex-1"
      />

      <div
        v-if="!siderCollapsed"
        class="sidebar-status"
      >
        <UPopover v-if="rpcServer.running">
          <button
            type="button"
            class="status-row"
          >
            <span class="status-row-label"><UIcon name="i-lucide-plug" />本地接口</span>
            <UBadge
              :label="`${rpcServer.connectionCount} 连接`"
              :color="rpcServer.connectionCount ? 'success' : 'neutral'"
              variant="subtle"
            />
          </button>
          <template #content>
            <section class="rpc-detail">
              <strong class="rpc-detail-title">外部接入连接</strong>
              <UEmpty
                v-if="!rpcServer.connectionCount"
                title="暂无外部连接"
              />
              <article
                v-for="conn in rpcServer.connections"
                v-else
                :key="conn.connId"
                class="rpc-detail-item"
              >
                <div class="rpc-detail-origin">
                  <strong>{{ formatOrigin(conn.origin) }}</strong>
                  <UBadge
                    :label="conn.subscribed ? '已订阅弹幕' : '未订阅'"
                    :color="conn.subscribed ? 'success' : 'neutral'"
                    variant="subtle"
                  />
                </div>
                <span class="rpc-detail-time">接入于 {{ formatSince(conn.connectedAt) }}</span>
              </article>
            </section>
          </template>
        </UPopover>

        <section class="cookie-status-card">
          <div class="cookie-status-header">
            <span class="status-row-label"><UIcon name="i-lucide-cookie" />B站 Cookie</span>
            <UBadge
              :label="cookieStatus.text"
              :color="cookieStatus.color"
              variant="subtle"
            />
          </div>
          <UButton
            v-if="cookieStatus.color !== 'success'"
            block
            size="xs"
            @click="router.push({ name: 'client-fetcher' })"
            >前往处理</UButton
          >
        </section>
      </div>

      <UButton
        :icon="siderCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
        color="neutral"
        variant="ghost"
        square
        class="sidebar-collapse"
        @click="siderCollapsed = !siderCollapsed"
      />
    </aside>

    <section class="main-layout-content">
      <div class="client-page">
        <RouterView v-slot="{ Component, route: viewRoute }">
          <KeepAlive>
            <Transition
              name="fade-slide"
              mode="out-in"
              appear
            >
              <Suspense>
                <component
                  :is="Component"
                  v-if="viewRoute.meta.pageContainer === 'none'"
                />
                <div
                  v-else
                  class="client-page-inner"
                  :class="{
                    'client-page-inner--md': viewRoute.meta.pageWidth === 'md',
                    'client-page-inner--xl': viewRoute.meta.pageWidth === 'xl',
                    'client-page-inner--full': viewRoute.meta.pageWidth === 'full',
                  }"
                >
                  <component :is="Component" />
                </div>
                <template #fallback><div class="suspense-fallback">加载中...</div></template>
              </Suspense>
            </Transition>
          </KeepAlive>
        </RouterView>
      </div>
    </section>

    <SpeechMiniController />
  </div>
</template>

<style scoped>
.login-container {
  display: grid;
  min-height: calc(100vh - var(--client-titlebar-height));
  place-items: center;
  background: var(--vtsuru-bg);
}
.login-card {
  width: min(400px, 90vw);
}
.login-header {
  text-align: center;
}
.login-title {
  margin: 0 0 6px;
  font-size: 1.35rem;
}
.login-subtitle,
.init-stage,
.rpc-detail-time {
  color: var(--vtsuru-fg-muted);
}
.login-form {
  display: grid;
  gap: 14px;
}
.token-label-container,
.sidebar-header,
.status-row,
.status-row-label,
.cookie-status-header,
.rpc-detail-origin {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.token-get-link {
  padding: 0;
  color: var(--vtsuru-brand);
  background: none;
  border: 0;
  cursor: pointer;
}
.client-shell {
  display: flex;
  height: calc(100vh - var(--client-titlebar-height));
  background: var(--vtsuru-bg);
}
.client-sidebar {
  display: flex;
  width: 208px;
  flex: 0 0 208px;
  flex-direction: column;
  border-right: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-elevated);
  transition:
    width 0.2s,
    flex-basis 0.2s;
}
.client-sidebar--collapsed {
  width: 56px;
  flex-basis: 56px;
}
.sidebar-header {
  min-height: 56px;
  padding: 0 10px;
  border-bottom: 1px solid var(--vtsuru-border);
}
.app-title {
  overflow: hidden;
  white-space: nowrap;
}
.sidebar-status {
  display: grid;
  gap: 10px;
  padding: 10px;
}
.status-row {
  width: 100%;
  padding: 6px;
  color: var(--vtsuru-fg);
  background: transparent;
  border: 0;
  border-radius: var(--vtsuru-radius);
  cursor: pointer;
}
.status-row:hover {
  background: var(--vtsuru-bg-muted);
}
.rpc-detail {
  display: grid;
  min-width: 240px;
  gap: 8px;
}
.rpc-detail-item,
.cookie-status-card {
  display: grid;
  gap: 6px;
  padding: 8px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-muted);
}
.sidebar-collapse {
  margin: auto 8px 8px;
}
.main-layout-content {
  min-width: 0;
  flex: 1;
  overflow: auto;
}
.client-page {
  min-height: 100%;
}
.suspense-fallback,
.init-overlay {
  display: grid;
  place-items: center;
}
.suspense-fallback {
  min-height: 50vh;
  color: var(--vtsuru-fg-muted);
}
.init-overlay {
  position: fixed;
  inset: var(--client-titlebar-height) 0 0;
  z-index: 50;
  background: var(--vtsuru-bg);
}
.init-overlay-content {
  display: grid;
  justify-items: center;
  gap: 12px;
}
</style>
