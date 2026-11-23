<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  AlertTriangle,
  ArrowUpRight,
  AudioWaveform,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudUpload,
  Cookie,
  Home,
  LayoutDashboard,
  MessageSquare,
  Mic,
  Plug,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Smile,
  Sparkles,
  UserCog,
  Users,
  XCircle,
  Zap,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { ACCOUNT, GetSelfAccount, isLoadingAccount, isLoggedIn } from '@/api/account'
import ClientStatusBar from '@/apps/client/components/ClientStatusBar.vue'
import SpeechMiniController from '@/apps/client/components/SpeechMiniController.vue'
import WindowBar from '@/apps/client/components/WindowBar.vue'
import {
  checkUpdate,
  clientInited,
  clientInitStage,
  initAll,
  isCheckingUpdate,
  isClientVersionOutdated,
  OnClientUnmounted,
} from '@/apps/client/data/initialize'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import ThemeToggleButton from '@/shared/components/ThemeToggleButton.vue'
import { useCommandPalette } from '@/shared/composables/useCommandPalette'
import { clientVersion, CN_HOST, CURRENT_HOST, isDev, isTauri, REQUIRED_CLIENT_VERSION } from '@/shared/config'
import { buildManageTokens, getThemeCssVars } from '@/shared/config/theme'
import { provideThemeScope } from '@/shared/config/theme/scope'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Spin } from '@/shared/ui/spin'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { isDarkMode } from '@/shared/utils'
import { useFetcherRpcServer } from '@/store/useFetcherRpcServer'
import { useWebFetcher } from '@/store/useWebFetcher'

import '@/apps/client/styles/client-page.css'

const router = useRouter()
const route = useRoute()
const webfetcher = useWebFetcher()
const rpcServer = useFetcherRpcServer()
const { openPalette } = useCommandPalette()

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
  router.push({ name: 'client-account-manage' })
}

function goDiagnostics() {
  router.push({ name: 'client-settings', query: { tab: 'diagnostics' } })
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
  'client-account-manage': 'account-manage',
  'client-fetcher': 'fetcher',
  'client-live-manage': 'live-manage',
  'client-live-dashboard': 'live-dashboard',
  'client-danmaku-window-manage': 'danmaku-window-manage',
  'client-gift-window-manage': 'gift-window-manage',
  'client-auto-action-manage': 'danmaku-auto-action-manage',
  'client-vts': 'vts',
  'client-pngtuber': 'pngtuber',
  'client-pngtuber-model': 'pngtuber',
  'client-read-danmaku': 'read-danmaku',
  'client-transcription': 'transcription',
  'client-fans-viewer': 'fans-viewer',
  'client-settings': 'settings',
}
const activeMenuKey = computed(() => routeNameToMenuKey[route.name as string] ?? '')

function openManagePage() {
  const url = new URL('manage', isDev ? CURRENT_HOST : CN_HOST).toString()
  if (isTauri()) {
    void openUrl(url)
  } else {
    window.open(url, '_blank')
  }
}

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
      toast.success('登录成功')
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
  { key: 'account-manage', name: 'client-account-manage', label: '账号与凭据', icon: UserCog },
  { key: 'fetcher', name: 'client-fetcher', label: 'EventFetcher', icon: CloudUpload },
  { key: 'live-manage', name: 'client-live-manage', label: '直播管理', icon: Radio },
  { key: 'live-dashboard', name: 'client-live-dashboard', label: '中控台', icon: LayoutDashboard },
  {
    key: 'live-windows',
    label: '直播浮窗',
    icon: MessageSquare,
    isGroup: true,
    children: [
      {
        key: 'danmaku-window-manage',
        name: 'client-danmaku-window-manage',
        label: '弹幕机',
        hasIndicator: () => danmakuWindow.isDanmakuWindowOpen,
      },
      {
        key: 'gift-window-manage',
        name: 'client-gift-window-manage',
        label: '礼物与排行',
        hasIndicator: () => giftWindow.isGiftWindowOpen,
      },
    ],
  },
  { key: 'danmaku-auto-action-manage', name: 'client-auto-action-manage', label: '自动操作', icon: Zap },
  { key: 'vts', name: 'client-vts', label: 'VTS 控制', icon: Smile },
  { key: 'pngtuber', name: 'client-pngtuber', label: 'PNGtuber', icon: Sparkles },
  { key: 'read-danmaku', name: 'client-read-danmaku', label: '读弹幕', icon: Mic },
  { key: 'transcription', name: 'client-transcription', label: '语音转写', icon: AudioWaveform },
  { key: 'fans-viewer', name: 'client-fans-viewer', label: '粉丝查看', icon: Users },
  { key: 'settings', name: 'client-settings', label: '设置', icon: Settings },
]

onMounted(() => {
  window.addEventListener('beforeunload', () => {
    OnClientUnmounted()
  })
})
</script>

<template>
  <div
    class="manage-theme bg-background text-foreground h-screen flex flex-col overflow-hidden"
    :style="[manageCssVars, { '--client-titlebar-height': '36px' }]"
  >
    <WindowBar />

    <!-- 初始化遮罩 -->
    <Transition name="fade">
      <div
        v-if="isLoggedIn && !clientInited"
        class="fixed left-0 right-0 bottom-0 top-[var(--client-titlebar-height)] bg-card flex-center z-[2000]"
      >
        <div class="flex flex-col items-center gap-3">
          <Spin size="large" />
          <div class="text-muted-foreground text-xs">
            {{ clientInitStage || '初始化中...' }}
          </div>
        </div>
      </div>
    </Transition>

    <!-- 登录视图 -->
    <div
      v-if="!isLoggedIn"
      class="flex-1 min-h-0 flex-center bg-background"
    >
      <Card
        v-if="!isLoadingAccount"
        class="max-w-[90vw] w-[400px] shadow-lg"
      >
        <CardHeader class="text-center pb-4">
          <CardTitle>登录</CardTitle>
          <CardDescription>输入你的 VTsuru Token 登录客户端</CardDescription>
        </CardHeader>

        <CardContent class="space-y-4">
          <FormField
            label="Token"
            description="获取方式：登录网页端后，在「管理后台主页」的个人信息卡片下方复制 Token。"
          >
            <template #extra>
              <Button
                variant="link"
                size="xs"
                class="h-auto p-0 gap-0.5"
                @click="openManagePage"
              >
                <span>前往管理后台获取</span>
                <ArrowUpRight class="size-3" />
              </Button>
            </template>
            <Input
              v-model="token"
              type="password"
              placeholder="请输入 Token"
              @keyup.enter="login"
            />
          </FormField>

          <Button
            class="w-full"
            :disabled="isLoadingAccount"
            @click="login"
          >
            登录
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
      @vue:mounted="initAll()"
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
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="rounded-full"
                    aria-label="EventFetcher 状态"
                  >
                    <CheckCircle2
                      v-if="webfetcher.state === 'connected'"
                      class="size-4 text-emerald-500"
                    />
                    <XCircle
                      v-else
                      class="size-4 text-destructive"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <div>EventFetcher 状态</div>
                  <div class="text-[11px] text-muted-foreground">
                    {{ webfetcher.state === 'connected' ? '运行中' : '未运行 / 连接断开' }}
                  </div>
                </TooltipContent>
              </Tooltip>

              <template v-if="!siderCollapsed">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="命令面板 (Ctrl+K)"
                      @click="openPalette"
                    >
                      <Search class="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>快捷跳转与命令面板 (Ctrl+K)</TooltipContent>
                </Tooltip>

                <ThemeToggleButton variant="ghost" />

                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="折叠边栏"
                      @click="siderCollapsed = true"
                    >
                      <ChevronLeft class="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>折叠边栏</TooltipContent>
                </Tooltip>
              </template>
            </div>

            <Tooltip v-if="siderCollapsed">
              <TooltipTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="展开边栏"
                  @click="siderCollapsed = false"
                >
                  <ChevronRight class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>展开边栏</TooltipContent>
            </Tooltip>
          </div>

          <!-- 导航菜单 -->
          <div class="sider-menu flex-1 overflow-y-auto scrollbar-thin px-2 py-3 space-y-1">
            <template
              v-for="item in menuItems"
              :key="item.key"
            >
              <!-- 分组项 (直播浮窗) -->
              <div
                v-if="item.isGroup"
                class="space-y-1"
              >
                <Button
                  variant="ghost"
                  class="w-full justify-start gap-2.5 text-muted-foreground"
                  :class="{ 'justify-center !px-0': siderCollapsed }"
                  @click="liveWindowsOpen = !liveWindowsOpen"
                >
                  <component
                    :is="item.icon"
                    class="size-4 shrink-0"
                  />
                  <span
                    v-if="!siderCollapsed"
                    class="flex-1 text-left"
                    >{{ item.label }}</span
                  >
                  <ChevronDown
                    v-if="!siderCollapsed"
                    class="size-3 transition-transform duration-150"
                    :class="{ '-rotate-90': !liveWindowsOpen }"
                  />
                </Button>

                <div
                  v-if="liveWindowsOpen && !siderCollapsed"
                  class="pl-4 space-y-1 border-l ml-3.5 border-border/60"
                >
                  <RouterLink
                    v-for="sub in item.children"
                    :key="sub.key"
                    :to="{ name: sub.name }"
                    class="flex-between px-2.5 py-1.5 rounded-md text-xs transition-colors"
                    :class="
                      activeMenuKey === sub.key
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                    "
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
                class="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
                :class="[
                  activeMenuKey === item.key
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  siderCollapsed && 'justify-center !px-0',
                ]"
                :title="siderCollapsed ? item.label : undefined"
              >
                <component
                  :is="item.icon"
                  class="size-4 shrink-0"
                />
                <span v-if="!siderCollapsed">{{ item.label }}</span>
              </RouterLink>
            </template>
          </div>

          <!-- 底部状态区 (仅展开时显示) -->
          <div
            v-if="!siderCollapsed && (rpcServer.running || rpcServer.lastError)"
            class="sider-status-list p-2 mx-2 mb-2 rounded border bg-muted/20"
          >
            <div
              v-if="rpcServer.lastError"
              class="flex-between gap-1.5 text-xs text-destructive cursor-pointer"
              @click="goDiagnostics"
            >
              <div class="flex items-center gap-1.5 min-w-0">
                <AlertTriangle class="size-3.5 shrink-0" />
                <span class="truncate text-[11px]">本地接口异常</span>
              </div>
              <Badge
                variant="destructive"
                size="xs"
              >
                查看
              </Badge>
            </div>
            <Popover v-else>
              <PopoverTrigger as-child>
                <div class="status-row status-row--hoverable flex-between text-xs cursor-pointer select-none">
                  <div class="status-row-label flex items-center gap-1.5 min-w-0">
                    <Plug
                      class="size-3.5 shrink-0"
                      :class="rpcServer.connectionCount > 0 ? 'text-emerald-500' : 'text-muted-foreground'"
                    />
                    <span class="text-muted-foreground text-[11px]">本地接口</span>
                  </div>
                  <Badge
                    variant="outline"
                    size="xs"
                    :class="
                      rpcServer.connectionCount > 0 ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : ''
                    "
                  >
                    {{ rpcServer.connectionCount }} 连接
                  </Badge>
                </div>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                class="w-64 space-y-2"
              >
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
                  <div class="flex-between gap-2">
                    <span class="font-medium text-foreground truncate">{{ formatOrigin(conn.origin) }}</span>
                    <Badge
                      :variant="conn.subscribed ? 'success' : 'secondary'"
                      size="xs"
                    >
                      {{ conn.subscribed ? '已订阅' : '未订阅' }}
                    </Badge>
                  </div>
                  <div class="text-[10px] text-muted-foreground">接入于 {{ formatSince(conn.connectedAt) }}</div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <!-- Cookie 状态卡片 -->
          <div
            v-if="!siderCollapsed"
            class="cookie-status-card m-2 p-2.5 rounded border bg-muted/20 space-y-2"
          >
            <div class="cookie-status-header flex-between text-xs">
              <div class="status-row-label flex items-center gap-1.5 min-w-0">
                <Cookie
                  class="size-3.5 shrink-0"
                  :class="
                    cookieStatusType === 'success'
                      ? 'text-emerald-500'
                      : cookieStatusType === 'error'
                        ? 'text-destructive'
                        : 'text-amber-500'
                  "
                />
                <span class="font-medium text-foreground text-[11px]">B站 Cookie</span>
              </div>
              <Badge
                :variant="cookieStatusType === 'success' ? 'success' : cookieStatusType === 'error' ? 'destructive' : 'warning'"
                size="xs"
              >
                {{ cookieStatusText }}
              </Badge>
            </div>
            <Button
              v-if="cookieStatusType !== 'success'"
              size="xs"
              variant="outline"
              class="w-full"
              @click="goCookieManagement"
            >
              前往处理
            </Button>
          </div>
        </div>
      </aside>

      <!-- 右侧主内容 -->
      <main class="main-layout-content flex-1 min-w-0 flex flex-col overflow-hidden bg-background">
        <!-- 客户端壳版本过旧常驻提示条 -->
        <div
          v-if="isClientVersionOutdated"
          class="flex-between gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs shrink-0"
        >
          <div class="flex items-center gap-2 min-w-0">
            <AlertTriangle class="size-3.5 shrink-0" />
            <span class="truncate">
              当前桌面客户端版本 (v{{ clientVersion }}) 低于推荐版本 (v{{ REQUIRED_CLIENT_VERSION }})，部分新功能（如诊断/语音转写/本地 RPC）可能受限。
            </span>
          </div>
          <Button
            size="xs"
            variant="outline"
            class="shrink-0 gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15"
            :disabled="isCheckingUpdate"
            @click="void checkUpdate(true)"
          >
            <RefreshCw
              class="size-3"
              :class="{ 'animate-spin': isCheckingUpdate }"
            />
            <span>立即更新</span>
          </Button>
        </div>

        <div class="client-page flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <RouterView v-slot="{ Component, route: viewRoute }">
            <KeepAlive>
              <div
                v-if="viewRoute.meta.pageContainer !== 'none'"
                :class="[
                  'client-page-inner',
                  viewRoute.meta.pageWidth === 'md' && 'client-page-inner--md',
                  viewRoute.meta.pageWidth === 'xl' && 'client-page-inner--xl',
                  viewRoute.meta.pageWidth === 'full' && 'client-page-inner--full',
                ]"
              >
                <component
                  :is="Component"
                  :key="viewRoute.fullPath.split('#')[0]"
                />
              </div>
              <component
                :is="Component"
                v-else
                :key="viewRoute.fullPath.split('#')[0]"
              />
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
