<script setup lang="ts">
import { zh_cn } from '@nuxt/ui/locale'
import { useToast } from '@nuxt/ui/composables'
import { useEventBus } from '@vueuse/core'
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'

import { cookie } from '@/api/auth'
import { useAccount } from '@/api/account'
import { toastEventKey } from '@/app/events'
import { applyThemeCssVars, buildSiteTokens } from '@/shared/config/theme'
import { dismissUpdateNote, isUpdateNoteOpen } from '@/shared/services/UpdateNote'
import { isDarkMode } from '@/shared/utils'
import { useLoadingBarStore } from '@/store/useLoadingBarStore'

// 将大型布局组件改为异步组件，避免打入入口包
const ManageLayout = defineAsyncComponent(() => import('@/apps/layouts/ManageLayout.vue'))
const UserLayout = defineAsyncComponent(() => import('@/apps/layouts/UserLayout.vue'))
const ClientLayout = defineAsyncComponent(() => import('@/apps/layouts/ClientLayout.vue'))
const OBSLayout = defineAsyncComponent(() => import('@/apps/layouts/OBSLayout.vue'))
const OpenLiveLayout = defineAsyncComponent(() => import('@/apps/layouts/OpenLiveLayout.vue'))
const UpdateNoteContainer = defineAsyncComponent(() => import('@/apps/web/components/UpdateNoteContainer.vue'))

const route = useRoute()
const account = useAccount()
const loading = useLoadingBarStore()
const toast = useToast()
const toastBus = useEventBus(toastEventKey)

const handleToast = (options: Parameters<typeof toast.add>[0]) => toast.add(options)
toastBus.on(handleToast)

const layout = computed(() => {
  if (route.path.startsWith('/user') || route.name == 'user' || route.path.startsWith('/@')) {
    document.title = `${route.meta.title} · ${route.params.id} · VTsuru`
    return 'user'
  } else if (route.path.startsWith('/manage')) {
    document.title = `${route.meta.title} · 管理 · VTsuru`
    return 'manage'
  } else if (route.path.startsWith('/open-live')) {
    document.title = `${route.meta.title} · 开放平台 · VTsuru`
    return 'open-live'
  } else if (route.path.startsWith('/obs')) {
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
const waitingForAccount = computed(() => Boolean(route.query.token || cookie.value) && account.value.id < 1)

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
  <UApp :locale="zh_cn">
    <UProgress
      v-if="loading.active"
      class="route-progress"
      animation="carousel"
      size="xs"
    />
    <main class="app-shell">
      <div
        v-if="waitingForAccount"
        class="app-loading"
        role="status"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-6 animate-spin"
        />
      </div>
      <Suspense v-else>
        <UserLayout v-if="layout === 'user'" />
        <ManageLayout v-else-if="layout === 'manage'" />
        <OpenLiveLayout v-else-if="layout === 'open-live'" />
        <OBSLayout v-else-if="layout === 'obs'" />
        <ClientLayout v-else-if="layout === 'client'" />
        <RouterView v-else />
        <template #fallback>
          <div
            class="app-loading"
            role="status"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-6 animate-spin"
            />
          </div>
        </template>
      </Suspense>
    </main>
    <UModal
      v-model:open="isUpdateNoteOpen"
      title="更新日志"
      :ui="{ content: 'sm:max-w-3xl' }"
      @update:open="(open) => !open && dismissUpdateNote()"
    >
      <template #body>
        <UpdateNoteContainer />
      </template>
      <template #footer>
        <div class="update-note-actions">
          <UButton @click="dismissUpdateNote"> 知道了 </UButton>
        </div>
      </template>
    </UModal>
  </UApp>
</template>

<style>
/* 重置浏览器默认 body margin: 否则满高(100vh)布局会被顶下 8px, 形成一圈白边 + 仅能滚几像素的页面级滚动条 */
html,
body {
  margin: 0;
}

#app,
.app-shell {
  min-height: 100vh;
}

.route-progress {
  position: fixed;
  z-index: 10000;
  top: 0;
  right: 0;
  left: 0;
}

.app-loading {
  display: grid;
  min-height: 100vh;
  place-items: center;
  color: var(--vtsuru-fg-muted);
}

.update-note-actions {
  display: flex;
  width: 100%;
  justify-content: flex-end;
}

:root {
  font-feature-settings:
    'liga' 1,
    'calt' 1;
  --vtsuru-header-height: 50px;
  --vtsuru-content-padding: 12px;
}

/* 全局选区与文本链接：使用品牌色作低饱和度 tint */
::selection {
  background: var(--vtsuru-brand-tint);
  color: var(--vtsuru-fg);
}

a {
  color: var(--vtsuru-brand);
  text-decoration: none;
  transition: color 0.15s ease;
}
a:hover {
  color: var(--vtsuru-brand-hover);
}

@supports (font-variation-settings: normal) {
  :root {
    font-family: InterVariable, sans-serif;
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
