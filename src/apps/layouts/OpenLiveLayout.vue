<script setup lang="ts">
import {
  ChevronLeft16Regular,
  ChevronRight16Regular,
  Lottery24Filled,
  PeopleQueue24Filled,
  TabletSpeaker24Filled,
} from '@vicons/fluent'
import { ChatbubblesOutline, GridOutline, Moon, MusicalNote, Sunny } from '@vicons/ionicons5'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { ThemeType } from '@/api/api-models'
import type { AuthInfo } from '@/shared/services/DanmakuClients/OpenLiveClient'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Spin } from '@/shared/ui/spin'
import { Switch } from '@/shared/ui/switch'
import { isDarkMode } from '@/shared/utils'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import '@/apps/open-live/styles/open-live-page.css'
import logoUrl from '@/svgs/ic_vtuber.svg?url'

const route = useRoute()
const router = useRouter()
const themeType = usePersistedStorage('Settings.Theme', ThemeType.Auto)
const danmakuClient = useDanmakuClient()

const siderCollapsed = ref(false)

const authInfo = ref<AuthInfo>()
const danmakuClientError = ref<string>()
const needsOpenLiveAuth = computed(() => route.meta.openLiveAuth !== false)
const routeComponentProps = computed(() =>
  needsOpenLiveAuth.value
    ? {
        roomInfo: danmakuClient.authInfo,
        code: authInfo.value?.Code,
        openLiveAuth: authInfo.value,
      }
    : {},
)

const navItems = computed(() => {
  const items = [
    { key: 'open-live-lottery', name: 'open-live-lottery', label: '弹幕抽奖', icon: Lottery24Filled },
    { key: 'open-live-live-request', name: 'open-live-live-request', label: '弹幕点歌', icon: MusicalNote },
    { key: 'open-live-queue', name: 'open-live-queue', label: '弹幕排队', icon: PeopleQueue24Filled },
    { key: 'open-live-speech', name: 'open-live-speech', label: '弹幕朗读', icon: TabletSpeaker24Filled },
    { key: 'open-live-danmuji', name: 'open-live-danmuji', label: '弹幕姬', icon: ChatbubblesOutline },
    { key: 'open-live-tools', name: 'open-live-tools', label: '直播工具箱', icon: GridOutline },
  ]
  return items.filter((item) => authInfo.value?.Code || item.key === 'open-live-tools')
})

const activeMenuKey = computed(() => (route.meta.parent ?? route.name)?.toString())

const isDarkValue = computed({
  get: () => themeType.value === ThemeType.Dark || (themeType.value === ThemeType.Auto && isDarkMode.value),
  set: (value) => {
    themeType.value = value ? ThemeType.Dark : ThemeType.Light
  },
})

watch(
  [needsOpenLiveAuth, () => route.query.Code, () => route.query.Mid, () => route.query.Caller],
  async () => {
    authInfo.value = route.query as unknown as AuthInfo
    danmakuClientError.value = undefined

    if (!needsOpenLiveAuth.value) return
    if (!authInfo.value.Code) {
      authInfo.value = undefined
      toast.error('无效访问: 缺少必要的认证参数 (Code)。请通过幻星平台获取链接。')
      return
    }

    try {
      await danmakuClient.initOpenlive(authInfo.value)
    } catch (error) {
      console.error('Danmaku client initialization failed:', error)
      danmakuClientError.value = `弹幕客户端初始化失败: ${error instanceof Error ? error.message : '未知错误'}`
      toast.error(danmakuClientError.value)
    }
  },
  { immediate: true },
)
</script>

<template>
  <!-- 情况一: 缺少认证信息, 显示错误提示页 -->
  <div
    v-if="needsOpenLiveAuth && !authInfo?.Code"
    class="h-screen w-full flex items-center justify-center p-6 bg-background text-foreground"
  >
    <div class="max-w-md w-full text-center space-y-4 p-8 rounded-lg border bg-card">
      <div class="text-destructive font-bold text-xl">无效访问</div>
      <p class="text-sm text-muted-foreground">
        请确保您是通过正确的幻星平台 H5 插件链接访问此页面。
      </p>
      <div class="pt-2 text-xs text-muted-foreground">
        请前往
        <a
          href="https://play-live.bilibili.com/details/1698742711771"
          target="_blank"
          class="text-primary underline ml-1"
        >
          幻星平台 | VTsuru
        </a>
        获取 H5 插件链接。
      </div>
    </div>
  </div>

  <!-- 情况二: 存在认证信息, 显示主布局 -->
  <div
    v-else
    class="h-screen w-full flex flex-col overflow-hidden bg-background text-foreground"
  >
    <!-- 顶部导航栏 -->
    <header class="h-[60px] border-b border-border flex items-center justify-between px-5 shrink-0 bg-card">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="flex items-center gap-2 text-left cursor-pointer select-none"
          @click="router.push({ name: authInfo?.Code ? 'open-live-index' : 'open-live-tools', query: route.query })"
        >
          <img
            :src="logoUrl"
            alt="VTsuru Logo"
            class="h-6 w-auto"
          />
          <span class="font-bold text-lg text-primary">VTsuru 开放平台</span>
        </button>
        <span class="text-muted-foreground text-xs border-l pl-3 ml-1">
          {{ ($route.meta.title as string) ?? '功能模块' }}
        </span>
      </div>

      <div class="flex items-center gap-4">
        <Badge
          v-if="needsOpenLiveAuth"
          variant="outline"
          class="text-xs h-6 px-2 gap-1.5"
          :class="danmakuClient.phase === 'error' ? 'border-destructive/40 text-destructive bg-destructive/10' : danmakuClient.connected ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'border-amber-500/40 text-amber-600 bg-amber-500/10'"
        >
          <Sunny v-if="danmakuClient.connected" class="size-3.5" />
          <Moon v-else class="size-3.5" />
          {{ danmakuClient.connectionStatus }}
        </Badge>

        <div class="flex items-center gap-2">
          <Switch :checked="isDarkValue" @update:checked="isDarkValue = $event" />
          <component :is="isDarkValue ? Moon : Sunny" class="size-4 text-muted-foreground" />
        </div>
      </div>
    </header>

    <!-- 主体内容区域 -->
    <div class="flex-1 min-h-0 flex overflow-hidden">
      <!-- 左侧侧边栏 -->
      <aside
        class="border-r border-border bg-card flex flex-col shrink-0 transition-[width] duration-200 select-none overflow-hidden"
        :class="siderCollapsed ? 'w-16' : 'w-[180px]'"
      >
        <div class="flex items-center justify-end p-2 border-b">
          <button
            type="button"
            class="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            :title="siderCollapsed ? '展开边栏' : '折叠边栏'"
            @click="siderCollapsed = !siderCollapsed"
          >
            <ChevronRight16Regular v-if="siderCollapsed" class="size-3.5" />
            <ChevronLeft16Regular v-else class="size-3.5" />
          </button>
        </div>

        <div
          v-if="danmakuClient.authInfo"
          class="p-3 flex flex-col items-center gap-1.5 border-b"
        >
          <Avatar class="size-10 border">
            <AvatarImage
              :src="danmakuClient.authInfo?.anchor_info?.uface"
              referrerpolicy="no-referrer"
            />
            <AvatarFallback class="text-xs">主播</AvatarFallback>
          </Avatar>
          <span
            v-if="!siderCollapsed"
            class="text-xs font-semibold text-foreground truncate max-w-full"
          >
            {{ danmakuClient.authInfo?.anchor_info?.uname }}
          </span>
        </div>

        <nav class="flex-1 overflow-y-auto p-2 space-y-1">
          <RouterLink
            v-for="item in navItems"
            :key="item.key"
            :to="{ name: item.name, query: route.query }"
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
        </nav>

        <div
          v-if="!siderCollapsed"
          class="p-2 border-t text-[11px] text-center text-muted-foreground"
        >
          有建议请
          <button
            type="button"
            class="text-primary hover:underline ml-0.5 cursor-pointer"
            @click="$router.push({ name: 'about' })"
          >
            反馈
          </button>
        </div>
      </aside>

      <!-- 右侧主内容区域 -->
      <main class="flex-1 min-w-0 overflow-y-auto open-live-page bg-background">
        <div
          v-if="danmakuClientError"
          class="m-3 p-3 rounded-md border border-destructive/40 bg-destructive/10 text-destructive text-xs flex items-center justify-between"
        >
          <span>{{ danmakuClientError }}</span>
          <button
            type="button"
            class="text-xs underline ml-2 cursor-pointer"
            @click="danmakuClientError = undefined"
          >
            关闭
          </button>
        </div>

        <RouterView v-slot="{ Component, route: viewRoute }">
          <div
            v-if="Component && (!needsOpenLiveAuth || danmakuClient.authInfo)"
            :class="viewRoute.meta.pageContainer !== 'none' ? [
              'open-live-page-inner',
              viewRoute.meta.pageWidth === 'md' && 'open-live-page-inner--md',
              viewRoute.meta.pageWidth === 'xl' && 'open-live-page-inner--xl',
              viewRoute.meta.pageWidth === 'full' && 'open-live-page-inner--full',
            ] : undefined"
          >
            <KeepAlive>
              <component
                :is="Component"
                :key="viewRoute.fullPath.split('#')[0]"
                v-bind="routeComponentProps"
              />
            </KeepAlive>
          </div>
          <div
            v-else-if="needsOpenLiveAuth && !danmakuClient.authInfo && !danmakuClientError"
            class="flex flex-col items-center justify-center h-4/5 gap-3"
          >
            <Spin size="large" />
            <span class="text-xs text-muted-foreground">正在加载主播信息并连接服务...</span>
          </div>
          <div
            v-else-if="!danmakuClientError"
            class="flex flex-col items-center justify-center h-4/5 gap-2 text-center"
          >
            <div class="text-amber-500 font-semibold text-sm">页面加载失败</div>
            <div class="text-xs text-muted-foreground">无法加载当前功能模块，请尝试刷新或联系开发者。</div>
          </div>
        </RouterView>
      </main>
    </div>

    <!-- 底部信息栏 -->
    <footer class="h-10 border-t border-border flex items-center justify-center px-5 shrink-0 bg-card text-xs text-muted-foreground">
      <span>
        © {{ new Date().getFullYear() }}
        <a
          href="https://vtsuru.live"
          target="_blank"
          class="text-primary hover:underline ml-1"
        >
          vtsuru.live
        </a>
        - 由 VTsuru 提供支持
      </span>
    </footer>
  </div>
</template>

<style scoped>
.open-live-page {
  height: 100%;
}
</style>
