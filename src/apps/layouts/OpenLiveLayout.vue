<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { computed, onMounted, ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { ThemeType } from '@/api/api-models'
import type { AuthInfo } from '@/shared/services/DanmakuClients/OpenLiveClient'
import { usePersistedStorage } from '@/shared/storage/persist'
import { isDarkMode } from '@/shared/utils'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import '@/apps/open-live/styles/open-live-page.css'
import logoUrl from '@/svgs/ic_vtuber.svg?url'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const themeType = usePersistedStorage('Settings.Theme', ThemeType.Auto)
const danmakuClient = useDanmakuClient()
const authInfo = ref<AuthInfo>()
const danmakuClientError = ref<string>()
const siderCollapsed = ref(true)
const content = ref<HTMLElement>()

const menuItems = computed<NavigationMenuItem[][]>(() => [
  [
    { label: '弹幕抽奖', icon: 'i-lucide-trophy', to: { name: 'open-live-lottery', query: route.query } },
    { label: '弹幕点歌', icon: 'i-lucide-music-2', to: { name: 'open-live-live-request', query: route.query } },
    { label: '弹幕排队', icon: 'i-lucide-list-ordered', to: { name: 'open-live-queue', query: route.query } },
    { label: '弹幕朗读', icon: 'i-lucide-audio-lines', to: { name: 'open-live-speech', query: route.query } },
  ],
])

const isDarkValue = computed({
  get: () => themeType.value === ThemeType.Dark || (themeType.value === ThemeType.Auto && isDarkMode.value),
  set: (value) => {
    themeType.value = value ? ThemeType.Dark : ThemeType.Light
  },
})

const connectionColor = computed(() =>
  danmakuClient.phase === 'error' ? 'error' : danmakuClient.connected ? 'success' : 'warning',
)

function scrollToTop() {
  content.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(async () => {
  authInfo.value = route.query as unknown as AuthInfo
  if (!authInfo.value?.Code) {
    toast.add({ title: '无效访问', description: '缺少必要的认证参数 Code。请通过幻星平台获取链接。', color: 'error' })
    authInfo.value = undefined
    return
  }

  try {
    await danmakuClient.initOpenlive(authInfo.value)
  } catch (error) {
    console.error('Danmaku client initialization failed:', error)
    danmakuClientError.value = `弹幕客户端初始化失败: ${error instanceof Error ? error.message : '未知错误'}`
    toast.add({ title: danmakuClientError.value, color: 'error' })
  }
})
</script>

<template>
  <main
    v-if="!authInfo?.Code"
    class="open-live-invalid"
  >
    <UEmpty
      title="无效访问"
      description="请确保您是通过正确的幻星平台 H5 插件链接访问此页面。"
    >
      <template #actions>
        <UButton
          to="https://play-live.bilibili.com/details/1698742711771"
          target="_blank"
          >幻星平台 | VTsuru</UButton
        >
      </template>
    </UEmpty>
  </main>

  <div
    v-else
    class="open-live-shell"
  >
    <header class="open-live-header">
      <UButton
        color="neutral"
        variant="ghost"
        class="open-live-brand"
        @click="router.push({ name: 'open-live-index', query: route.query })"
      >
        <img
          :src="logoUrl"
          alt="VTsuru Logo"
          class="brand-logo"
        />
        <span>VTsuru 开放平台</span>
      </UButton>
      <span class="open-live-title">{{ ($route.meta.title as string) ?? '功能模块' }}</span>
      <div class="open-live-actions">
        <UBadge
          :label="danmakuClient.connectionStatus"
          :color="connectionColor"
          variant="subtle"
        />
        <USwitch
          v-model="isDarkValue"
          checked-icon="i-lucide-moon"
          unchecked-icon="i-lucide-sun"
          aria-label="切换主题"
        />
      </div>
    </header>

    <div class="open-live-body">
      <aside
        class="open-live-sidebar"
        :class="{ 'open-live-sidebar--collapsed': siderCollapsed }"
      >
        <div
          v-if="danmakuClient.authInfo"
          class="anchor-profile"
        >
          <UAvatar
            :src="danmakuClient.authInfo.anchor_info?.uface"
            :alt="danmakuClient.authInfo.anchor_info?.uname"
            size="lg"
          />
          <strong
            v-if="!siderCollapsed"
            class="anchor-name"
            >{{ danmakuClient.authInfo.anchor_info?.uname }}</strong
          >
        </div>
        <UNavigationMenu
          :items="menuItems"
          orientation="vertical"
          :collapsed="siderCollapsed"
        />
        <div
          v-if="!siderCollapsed"
          class="feedback-link"
        >
          有更多功能建议请
          <UButton
            color="primary"
            variant="link"
            size="xs"
            @click="router.push({ name: 'about' })"
            >反馈</UButton
          >
        </div>
        <UButton
          :icon="siderCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
          color="neutral"
          variant="ghost"
          square
          class="sidebar-toggle"
          @click="siderCollapsed = !siderCollapsed"
        />
      </aside>

      <section
        ref="content"
        class="open-live-content"
      >
        <UAlert
          v-if="danmakuClientError"
          title="弹幕客户端错误"
          :description="danmakuClientError"
          color="error"
          close
          @update:open="danmakuClientError = undefined"
        />

        <RouterView v-slot="{ Component, route: viewRoute }">
          <div
            v-if="!danmakuClient.authInfo && !danmakuClientError"
            class="connection-pending"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-7 animate-spin"
            />
            <span>正在加载主播信息并连接服务...</span>
          </div>
          <KeepAlive v-else-if="Component && danmakuClient.authInfo">
            <component
              :is="Component"
              v-if="viewRoute.meta.pageContainer === 'none'"
              :key="viewRoute.fullPath.split('#')[0]"
              :room-info="danmakuClient.authInfo"
              :code="authInfo.Code"
            />
            <div
              v-else
              class="open-live-page-inner"
              :class="{
                'open-live-page-inner--md': viewRoute.meta.pageWidth === 'md',
                'open-live-page-inner--xl': viewRoute.meta.pageWidth === 'xl',
                'open-live-page-inner--full': viewRoute.meta.pageWidth === 'full',
              }"
            >
              <component
                :is="Component"
                :key="viewRoute.fullPath.split('#')[0]"
                :room-info="danmakuClient.authInfo"
                :code="authInfo.Code"
              />
            </div>
          </KeepAlive>
          <UEmpty
            v-else-if="!danmakuClientError"
            title="页面加载失败"
            description="无法加载当前功能模块，请尝试刷新或联系开发者。"
          />
        </RouterView>

        <UButton
          icon="i-lucide-arrow-up"
          color="neutral"
          variant="outline"
          square
          class="back-top"
          aria-label="返回顶部"
          @click="scrollToTop"
        />
      </section>
    </div>

    <footer class="open-live-footer">
      © {{ new Date().getFullYear() }}
      <a
        href="https://vtsuru.live"
        target="_blank"
        >vtsuru.live</a
      >
      - 由 VTsuru 提供支持
    </footer>
  </div>
</template>

<style scoped>
.open-live-invalid,
.connection-pending {
  display: grid;
  min-height: 100vh;
  place-items: center;
}
.open-live-shell {
  display: grid;
  height: 100vh;
  grid-template-rows: 60px minmax(0, 1fr) 40px;
  background: var(--vtsuru-bg);
}
.open-live-header,
.open-live-actions,
.open-live-brand,
.anchor-profile {
  display: flex;
  align-items: center;
}
.open-live-header {
  justify-content: space-between;
  gap: 16px;
  padding: 0 16px;
  border-bottom: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-elevated);
}
.open-live-brand {
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 700;
}
.brand-logo {
  width: 24px;
  height: 24px;
}
.open-live-title {
  min-width: 0;
  overflow: hidden;
  color: var(--vtsuru-fg-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.open-live-actions {
  gap: 12px;
}
.open-live-body {
  display: flex;
  min-height: 0;
}
.open-live-sidebar {
  display: flex;
  width: 180px;
  flex: 0 0 180px;
  flex-direction: column;
  border-right: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-elevated);
  transition:
    width 0.2s,
    flex-basis 0.2s;
}
.open-live-sidebar--collapsed {
  width: 56px;
  flex-basis: 56px;
}
.anchor-profile {
  flex-direction: column;
  gap: 8px;
  padding: 12px 8px;
}
.anchor-name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.feedback-link {
  padding: 12px;
  color: var(--vtsuru-fg-muted);
  font-size: 0.8rem;
  text-align: center;
}
.sidebar-toggle {
  margin: auto 8px 8px;
}
.open-live-content {
  position: relative;
  min-width: 0;
  flex: 1;
  overflow: auto;
}
.connection-pending {
  min-height: 60%;
  gap: 10px;
  color: var(--vtsuru-fg-muted);
}
.back-top {
  position: fixed;
  right: 24px;
  bottom: 56px;
}
.open-live-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border-top: 1px solid var(--vtsuru-border);
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
@media (max-width: 640px) {
  .open-live-shell {
    grid-template-rows: auto minmax(0, 1fr) 34px;
  }
  .open-live-header {
    padding: 8px;
  }
  .open-live-title {
    display: none;
  }
  .open-live-sidebar {
    width: 56px;
    flex-basis: 56px;
  }
  .open-live-sidebar:not(.open-live-sidebar--collapsed) {
    width: 180px;
    flex-basis: 180px;
  }
}
</style>
