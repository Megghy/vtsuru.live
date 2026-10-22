<script setup lang="ts">
import { computed, defineAsyncComponent, watchEffect } from 'vue'
import { useRoute } from 'vue-router'

import TempComponent from '@/app/components/TempComponent.vue'
import { applyThemeCssVars, buildSiteTokens, getThemeCssVars } from '@/shared/config/theme'
import { provideThemeScope } from '@/shared/config/theme/scope'
import { Toaster } from '@/shared/ui/sonner'
import { isDarkMode } from '@/shared/utils'

// 将大型布局组件改为异步组件，避免打入入口包
const ManageLayout = defineAsyncComponent(() => import('@/apps/layouts/ManageLayout.vue'))
const UserLayout = defineAsyncComponent(() => import('@/apps/layouts/UserLayout.vue'))
const ClientLayout = defineAsyncComponent(() => import('@/apps/layouts/ClientLayout.vue'))
const OBSLayout = defineAsyncComponent(() => import('@/apps/layouts/OBSLayout.vue'))
const OpenLiveLayout = defineAsyncComponent(() => import('@/apps/layouts/OpenLiveLayout.vue'))

const route = useRoute()

const layout = computed(() => {
  if (route.path.startsWith('/user') || route.name === 'user' || route.path.startsWith('/@')) {
    document.title = `${route.meta.title} · ${route.params.id} · VTsuru`
    return 'user'
  } else if (route.path.startsWith('/manage')) {
    document.title = `${route.meta.title} · 管理 · VTsuru`
    return 'manage'
  } else if (route.path.startsWith('/open-live')) {
    document.title = `${route.meta.title} · 开放平台 · VTsuru`
    return 'open-live'
  } else if (route.path.startsWith('/obs') && !route.path.endsWith('-manage')) {
    document.title = `${route.meta.title} · OBS · VTsuru`
    return 'obs'
  } else if (route.path.startsWith('/client')) {
    document.title = `${route.meta.title} · 客户端 · VTsuru`
    return 'client'
  } else {
    document.title = `${route.meta.title} · VTsuru`
    return ''
  }
})

const siteTokens = computed(() => buildSiteTokens(isDarkMode.value))
provideThemeScope(computed(() => getThemeCssVars(siteTokens.value)))
const shellStyle = computed(() =>
  layout.value === 'user' || layout.value === '' ? { minHeight: '100dvh' } : { height: '100dvh' },
)

watchEffect(() => {
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  applyThemeCssVars(siteTokens.value)
})
</script>

<template>
  <div
    :style="shellStyle"
    class="app-root text-foreground bg-background antialiased"
  >
    <Suspense>
      <TempComponent>
        <div
          :style="shellStyle"
          class="app-shell w-full h-full"
        >
          <UserLayout v-if="layout === 'user'" />
          <ManageLayout v-else-if="layout === 'manage'" />
          <OpenLiveLayout v-else-if="layout === 'open-live'" />
          <OBSLayout v-else-if="layout === 'obs'" />
          <ClientLayout v-else-if="layout === 'client'" />
          <template v-else>
            <RouterView />
          </template>
        </div>
      </TempComponent>
      <template #fallback>
        <div class="flex items-center justify-center min-h-screen">
          <div class="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </template>
    </Suspense>
    <Toaster
      richColors
      position="top-right"
      :theme="isDarkMode ? 'dark' : 'light'"
    />
  </div>
</template>

<style>
/* 重置浏览器默认 body margin: 否则满高(100vh)布局会被顶下 8px, 形成一圈白边 + 仅能滚几像素的页面级滚动条 */
html,
body {
  margin: 0;
  color: var(--foreground);
  background-color: var(--background);
}

:root {
  font-feature-settings:
    'liga' 1,
    'calt' 1;
  --vtsuru-header-height: 50px;
  --vtsuru-content-padding: 12px;
}

* {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--foreground) 22%, transparent) transparent;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-button {
  display: none;
  width: 0;
  height: 0;
}

::-webkit-scrollbar-track,
::-webkit-scrollbar-corner {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: color-mix(in srgb, var(--foreground) 22%, transparent);
  border-radius: 999px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: color-mix(in srgb, var(--foreground) 40%, transparent);
}

/* 全局选区与文本链接：使用品牌色作低饱和度 tint */
::selection {
  background: var(--brand-tint);
  color: var(--foreground);
}

a {
  color: var(--brand);
  text-decoration: none;
  transition: color 0.15s ease;
}
a:hover {
  color: var(--brand);
}

@supports (font-variation-settings: normal) {
  :root {
    font-family: InterVariable, 'Noto Sans SC', sans-serif;
  }
}

/* 进入和离开过渡的样式 */
.v-enter-from,
.v-leave-to {
  opacity: 0;
}
.v-enter-active,
.v-leave-active {
  transition: opacity 0.5s ease;
}
.v-enter-to,
.v-leave-from {
  opacity: 1;
}

.bounce-enter-active {
  animation: bounce 0.3s;
}
.bounce-leave-active {
  animation: bounce 0.3s reverse;
}

@keyframes bounce {
  0% {
    transform: scale(1);
    opacity: 0;
  }
  60% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scale-enter-active,
.scale-leave-active {
  transition: all 0.3s ease;
}
.scale-enter-from,
.scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.5s ease-out;
}
.slide-enter-to {
  position: absolute;
  right: 0;
}
.slide-enter-from {
  position: absolute;
  right: -100%;
}
.slide-leave-to {
  position: absolute;
  left: -100%;
}
.slide-leave-from {
  position: absolute;
  left: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.5s ease-out;
}
.slide-up-enter-to {
  position: absolute;
  top: 0;
}
.slide-up-enter-from {
  position: absolute;
  top: -100%;
}
.slide-up-leave-to {
  position: absolute;
  bottom: -100%;
}
.slide-up-leave-from {
  position: absolute;
  bottom: 0;
}
</style>
