<script setup lang="ts">
import { provideThemeScope } from '@/shared/config/theme/scope'
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  Board24Filled,
  Chat24Filled,
  ChevronDown16Regular,
  ChevronLeft16Regular,
  ChevronRight16Regular,
  CloudArchive24Filled,
  Cookies24Filled,
  FlashAuto24Filled,
  Live24Filled,
  Mic24Filled,
  PlugConnected24Filled,
  Record24Filled,
  Settings24Filled,
  VideoPerson24Filled,
} from '@vicons/fluent'
import { CheckmarkCircle, CloseCircle, Home } from '@vicons/ionicons5'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { ACCOUNT, GetSelfAccount, isLoadingAccount, isLoggedIn } from '@/api/account'
import ClientStatusBar from '@/apps/client/components/ClientStatusBar.vue'
import SpeechMiniController from '@/apps/client/components/SpeechMiniController.vue'
import WindowBar from '@/apps/client/components/WindowBar.vue'
import { clientInited, clientInitStage, initAll, OnClientUnmounted } from '@/apps/client/data/initialize'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { BASE_URL } from '@/shared/config'
import { buildManageTokens, getThemeCssVars } from '@/shared/config/theme'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Spin } from '@/shared/ui/spin'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { isDarkMode } from '@/shared/utils'
import { useFetcherRpcServer } from '@/store/useFetcherRpcServer'
import { useWebFetcher } from '@/store/useWebFetcher'

import '@/apps/client/styles/client-page.css'

const router = useRouter()
const route = useRoute()
const webfetcher = useWebFetcher()
const rpcServer = useFetcherRpcServer()

const manageTokens = computed(() => buildManageTokens(isDarkMode.value))
const manageCssVars = computed(() => getThemeCssVars(manageTokens.value))
provideThemeScope(manageCssVars)

const danmakuWindow = useDanmakuWindow()
const giftWindow = useGiftWindow()
const biliCookie = useBiliCookie()

const token = ref('')
const siderCollapsed = ref(false)
const liveWindowsOpen = ref(true)

const cookieStatusType = computed(() => {
  if (!biliCookie.hasBiliCookie) return 'warning'
  return biliCookie.isCookieValid ? 'success' : 'error'
})

const cookieStatusText = computed(() => {
  if (!biliCookie.hasBiliCookie) return '未同步'
  return biliCookie.isCookieValid ? '正常' : '已失效'
})

function goCookieManagement() {
  router.push({ name: 'client-fetcher' })
}

function formatOrigin(origin: string) {
  if (!origin) return '未知来源'
  try {
    return new URL(origin).host
  } catch {
    return origin
  }
}

function formatSince(connectedAt: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - connectedAt) / 1000))
  if (seconds < 60) return `${seconds} 秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  return `${hours} 小时前`
}

const routeNameToMenuKey: Record<string, string> = {
  'client-index': 'go-back-home',
  'client-fetcher': 'fetcher',
  'client-live-manage': 'live-manage',
  'client-live-dashboard': 'live-dashboard',
  'client-danmaku-window-manage': 'danmaku-window-manage',
  'client-gift-window-manage': 'gift-window-manage',
  'client-auto-action-manage': 'danmaku-auto-action-manage',
  'client-vts': 'vts',
  'client-read-danmaku': 'read-danmaku',
  'client-transcription': 'transcription',
  'client-settings': 'settings',
}
const activeMenuKey = computed(() => routeNameToMenuKey[route.name as string] ?? '')

async function login() {
  if (!token.value.trim()) {
    toast.error('请输入 Token')
    return
  }

  isLoadingAccount.value = true
  try {
    const result = await GetSelfAccount(token.value.trim())
    if (!result) {
      toast.error('无效的 Token')
    } else if (!result.isBiliAuthed) {
      toast.error('B站主播码未绑定, 请先在网站管理页进行绑定')
    } else {
      toast.success('登陆成功')
      ACCOUNT.value = result
    }
  } catch (error) {
    console.error('Login failed:', error)
    toast.error('发生未知错误，请稍后再试或联系管理员。')
  } finally {
    isLoadingAccount.value = false
  }
}

const menuItems = [
  { key: 'go-back-home', name: 'client-index', label: '主页', icon: Home },
  { key: 'fetcher', name: 'client-fetcher', label: 'EventFetcher', icon: CloudArchive24Filled },
  { key: 'live-manage', name: 'client-live-manage', label: '直播管理', icon: Live24Filled },
  { key: 'live-dashboard', name: 'client-live-dashboard', label: '中控台', icon: Board24Filled },
  {
    key: 'live-windows',
    label: '直播浮窗',
    icon: Chat24Filled,
    isGroup: true,
    children: [
      {
        key: 'danmaku-window-manage',
        name: 'client-danmaku-window-manage',
        label: '弹幕机',
        hasIndicator: () => danmakuWindow.danmakuWindow != null,
      },
      {
        key: 'gift-window-manage',
        name: 'client-gift-window-manage',
        label: '礼物与排行',
        hasIndicator: () => giftWindow.giftWindow != null,
      },
    ],
  },
  { key: 'danmaku-auto-action-manage', name: 'client-auto-action-manage', label: '自动操作', icon: FlashAuto24Filled },
  { key: 'vts', name: 'client-vts', label: 'VTS 控制', icon: VideoPerson24Filled },
  { key: 'read-danmaku', name: 'client-read-danmaku', label: '读弹幕', icon: Mic24Filled },
  { key: 'transcription', name: 'client-transcription', label: '语音转写', icon: Record24Filled },
  { key: 'settings', name: 'client-settings', label: '设置', icon: Settings24Filled },
]

onMounted(() => {
  window.addEventListener('beforeunload', () => {
    OnClientUnmounted()
  })
})
</script>

<template>
  <div
    class="client-layout-root manage-theme bg-background text-foreground"
    :style="manageCssVars"
  >
    <WindowBar />

    <!-- 初始化遮罩 -->
    <Transition name="fade">
      <div
        v-if="isLoggedIn && !clientInited"
        class="init-overlay"
      >
        <div class="init-overlay-content">
          <Spin size="large" />
          <div class="init-stage">
            {{ clientInitStage || '初始化中...' }}
          </div>
        </div>
      </div>
    </Transition>

    <!-- 登录视图 -->
    <div
      v-if="!isLoggedIn"
      class="login-container"
    >
      <Card
        v-if="!isLoadingAccount"
        class="login-card border bg-card shadow-lg"
      >
        <CardHeader class="login-header text-center pb-4">
          <CardTitle class="login-title">登陆</CardTitle>
          <CardDescription class="login-subtitle">输入你的 VTsuru Token</CardDescription>
        </CardHeader>

        <CardContent class="space-y-4">
          <div class="space-y-1.5">
            <div class="token-label-container flex items-center justify-between">
              <span class="token-label text-xs font-medium text-foreground">Token</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      class="token-get-link text-xs text-primary hover:underline cursor-pointer"
                      @click="openUrl(`https://${BASE_URL}/manage`)"
                    >
                      前往获取
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>登录后在管理面板主页的个人信息下方</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input v-model="token" type="password" placeholder="请输入Token" class="h-9" @keyup.enter="login" />
          </div>

          <Button class="w-full h-9 font-medium" :disabled="isLoadingAccount" @click="login">
            登陆
          </Button>
        </CardContent>
      </Card>

      <Spin
        v-else
        size="large"
      />
    </div>

    <!-- 客户端主框架 -->
    <div
      v-else
      class="main-layout flex flex-1 min-h-0 overflow-hidden"
      @vue:mounted="initAll(true)"
    >
      <!-- 左侧边栏 -->
      <aside
        class="main-layout-sider border-r border-border bg-card flex flex-col shrink-0 transition-[width] duration-200 select-none overflow-hidden"
        :class="siderCollapsed ? 'w-16' : 'w-[200px]'"
      >
        <div class="sider-content flex flex-col h-full">
          <!-- 侧边栏头部 -->
          <div
            class="sider-header flex items-center h-[54px] px-3.5 border-b border-border shrink-0"
            :class="siderCollapsed ? 'justify-center !px-0' : 'justify-between'"
          >
            <div
              v-if="!siderCollapsed"
              class="app-title flex items-center gap-2 font-semibold text-sm text-foreground tracking-tight"
            >
              <span>VTsuru.Client</span>
            </div>

            <div class="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      type="button"
                      class="fetcher-status-button size-7 rounded-full flex items-center justify-center transition-colors hover:bg-muted"
                    >
                      <CheckmarkCircle
                        v-if="webfetcher.state === 'connected'"
                        class="size-4 text-emerald-500"
                      />
                      <CloseCircle
                        v-else
                        class="size-4 text-destructive"
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent class="text-xs">
                    <div>EventFetcher 状态</div>
                    <div class="text-[11px] text-muted-foreground">
                      {{ webfetcher.state === 'connected' ? '运行中' : '未运行 / 连接断开' }}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <button
                v-if="!siderCollapsed"
                type="button"
                class="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition"
                title="折叠边栏"
                @click="siderCollapsed = true"
              >
                <ChevronLeft16Regular class="size-3.5" />
              </button>
            </div>

            <button
              v-if="siderCollapsed"
              type="button"
              class="size-6 mt-1 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition"
              title="展开边栏"
              @click="siderCollapsed = false"
            >
              <ChevronRight16Regular class="size-3.5" />
            </button>
          </div>

          <!-- 导航菜单 -->
          <div class="sider-menu flex-1 overflow-y-auto px-2 py-3 space-y-1">
            <template
              v-for="item in menuItems"
              :key="item.key"
            >
              <!-- 分组项 (直播浮窗) -->
              <div
                v-if="item.isGroup"
                class="space-y-1"
              >
                <button
                  type="button"
                  class="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                  :class="{ 'justify-center !px-0': siderCollapsed }"
                  @click="liveWindowsOpen = !liveWindowsOpen"
                >
                  <component :is="item.icon" class="size-4 shrink-0" />
                  <span
                    v-if="!siderCollapsed"
                    class="flex-1 text-left"
                  >{{ item.label }}</span>
                  <ChevronDown16Regular
                    v-if="!siderCollapsed"
                    class="size-3 transition-transform"
                    :class="{ '-rotate-90': !liveWindowsOpen }"
                  />
                </button>

                <div
                  v-if="liveWindowsOpen && !siderCollapsed"
                  class="pl-4 space-y-1 border-l ml-3.5 border-border/60"
                >
                  <RouterLink
                    v-for="sub in item.children"
                    :key="sub.key"
                    :to="{ name: sub.name }"
                    class="flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition"
                    :class="activeMenuKey === sub.key ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'"
                  >
                    <span>{{ sub.label }}</span>
                    <span
                      v-if="sub.hasIndicator?.()"
                      class="size-1.5 rounded-full bg-emerald-500"
                    />
                  </RouterLink>
                </div>
              </div>

              <!-- 普通路由项 -->
              <RouterLink
                v-else
                :to="{ name: item.name }"
                class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition"
                :class="[
                  activeMenuKey === item.key ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  siderCollapsed && 'justify-center !px-0',
                ]"
                :title="siderCollapsed ? item.label : undefined"
              >
                <component :is="item.icon" class="size-4 shrink-0" />
                <span v-if="!siderCollapsed">{{ item.label }}</span>
              </RouterLink>
            </template>
          </div>

          <!-- 底部状态区 (仅展开时显示) -->
          <div
            v-if="!siderCollapsed && rpcServer.running"
            class="sider-status-list p-2 mx-2 mb-2 rounded border bg-muted/20"
          >
            <Popover>
              <PopoverTrigger as-child>
                <div class="status-row status-row--hoverable flex items-center justify-between text-xs cursor-pointer select-none">
                  <div class="status-row-label flex items-center gap-1.5 min-w-0">
                    <PlugConnected24Filled
                      class="size-3.5 shrink-0"
                      :class="rpcServer.connectionCount > 0 ? 'text-emerald-500' : 'text-muted-foreground'"
                    />
                    <span class="text-muted-foreground text-[11px]">本地接口</span>
                  </div>
                  <Badge
                    variant="outline"
                    class="text-[10px] h-4 px-1.5"
                    :class="rpcServer.connectionCount > 0 ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : ''"
                  >
                    {{ rpcServer.connectionCount }} 连接
                  </Badge>
                </div>
              </PopoverTrigger>
              <PopoverContent side="right" class="w-64 p-3 text-xs space-y-2">
                <div class="font-semibold text-foreground text-xs">外部接入连接</div>
                <Empty
                  v-if="rpcServer.connectionCount === 0"
                  description="暂无外部连接"
                  class="py-3"
                />
                <div
                  v-for="conn in rpcServer.connections"
                  v-else
                  :key="conn.connId"
                  class="p-2 rounded bg-muted/40 space-y-1"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="font-medium text-foreground truncate">{{ formatOrigin(conn.origin) }}</span>
                    <Badge
                      variant="outline"
                      class="text-[9px] h-3.5 px-1"
                      :class="conn.subscribed ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : ''"
                    >
                      {{ conn.subscribed ? '已订阅' : '未订阅' }}
                    </Badge>
                  </div>
                  <div class="text-[10px] text-muted-foreground">
                    接入于 {{ formatSince(conn.connectedAt) }}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <!-- Cookie 状态卡片 -->
          <div
            v-if="!siderCollapsed"
            class="cookie-status-card m-2 p-2.5 rounded border bg-muted/20 space-y-2"
          >
            <div class="cookie-status-header flex items-center justify-between text-xs">
              <div class="status-row-label flex items-center gap-1.5 min-w-0">
                <Cookies24Filled
                  class="size-3.5 shrink-0"
                  :class="cookieStatusType === 'success' ? 'text-emerald-500' : cookieStatusType === 'error' ? 'text-destructive' : 'text-amber-500'"
                />
                <span class="font-medium text-foreground text-[11px]">B站 Cookie</span>
              </div>
              <Badge
                variant="outline"
                class="text-[10px] h-4 px-1.5"
                :class="cookieStatusType === 'success' ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : cookieStatusType === 'error' ? 'border-destructive/40 text-destructive bg-destructive/10' : 'border-amber-500/40 text-amber-600 bg-amber-500/10'"
              >
                {{ cookieStatusText }}
              </Badge>
            </div>
            <Button v-if="cookieStatusType !== 'success'" size="xs" variant="outline" class="w-full h-6 text-[10px]" @click="goCookieManagement">
              前往处理
            </Button>
          </div>
        </div>
      </aside>

      <!-- 右侧主内容 -->
      <main class="main-layout-content flex-1 min-w-0 overflow-y-auto bg-background">
        <div class="client-page h-full">
          <RouterView v-slot="{ Component, route: viewRoute }">
            <KeepAlive>
              <div
                :class="viewRoute.meta.pageContainer !== 'none' ? [
                  'client-page-inner',
                  viewRoute.meta.pageWidth === 'md' && 'client-page-inner--md',
                  viewRoute.meta.pageWidth === 'xl' && 'client-page-inner--xl',
                  viewRoute.meta.pageWidth === 'full' && 'client-page-inner--full',
                ] : undefined"
              >
                <component
                  :is="Component"
                  :key="viewRoute.fullPath.split('#')[0]"
                />
              </div>
            </KeepAlive>
          </RouterView>
        </div>
      </main>

      <SpeechMiniController />
    </div>

    <!-- 底部全局状态栏 -->
    <ClientStatusBar v-if="isLoggedIn && clientInited" />
  </div>
</template>

<style scoped>
.client-layout-root {
  --client-titlebar-height: 30px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--background);
}

.login-container {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--card);
}

.login-card {
  max-width: 90vw;
  width: 400px;
}

.init-overlay {
  position: fixed;
  top: var(--client-titlebar-height);
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--card);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.init-overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.init-stage {
  color: var(--muted-foreground);
  font-size: 13px;
}
</style>
