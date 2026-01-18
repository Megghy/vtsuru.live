<script setup lang="ts">
import { dateZhCN, NConfigProvider, NDialogProvider, NElement, NLayoutContent, NLoadingBarProvider, NMessageProvider, NModalProvider, NNotificationProvider, NSpin, zhCN } from 'naive-ui';
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import TempComponent from '@/app/components/TempComponent.vue'
import { getThemeOverrides } from '@/shared/config'
import { isDarkMode, theme } from '@/shared/utils'

// 将大型布局组件改为异步组件，避免打入入口包
const ManageLayout = defineAsyncComponent(() => import('@/apps/layouts/ManageLayout.vue'))
const UserLayout = defineAsyncComponent(() => import('@/apps/layouts/UserLayout.vue'))
const ClientLayout = defineAsyncComponent(() => import('@/apps/layouts/ClientLayout.vue'))
const OBSLayout = defineAsyncComponent(() => import('@/apps/layouts/OBSLayout.vue'))
const OpenLiveLayout = defineAsyncComponent(() => import('@/apps/layouts/OpenLiveLayout.vue'))

const route = useRoute()

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
watchEffect(() => {
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
})

const themeOverrides = computed(() => getThemeOverrides(isDarkMode.value))

onMounted(() => {
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark')
  }
})
</script>

<template>
  <NConfigProvider
    :theme-overrides="themeOverrides"
    :theme="theme"
    style="height: 100vh"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <NMessageProvider>
      <NNotificationProvider>
        <NDialogProvider>
          <NLoadingBarProvider>
            <NModalProvider>
              <Suspense>
                <TempComponent>
                  <NLayoutContent>
                    <NElement
                      style="height: 100vh;"
                      :theme-overrides="themeOverrides"
                    >
                      <UserLayout v-if="layout === 'user'" />
                      <ManageLayout v-else-if="layout === 'manage'" />
                      <OpenLiveLayout v-else-if="layout === 'open-live'" />
                      <OBSLayout v-else-if="layout === 'obs'" />
                      <ClientLayout v-else-if="layout === 'client'" />
                      <template v-else>
                        <RouterView />
                      </template>
                    </NElement>
                  </NLayoutContent>
                </TempComponent>
                <template #fallback>
                  <NSpin
                    size="large"
                    show
                  />
                </template>
              </Suspense>
            </NModalProvider>
          </NLoadingBarProvider>
        </NDialogProvider>
      </NNotificationProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
:root {
  font-feature-settings: 'liga' 1, 'calt' 1;
  --vtsuru-header-height: 50px;
  --vtsuru-content-padding: 12px;
}

/* Workaround: tooltip is popover-based, force readable contrast */
:root:not(.dark) .n-popover.n-tooltip:not(.n-popover--raw) {
  background-color: rgba(9, 9, 11, 0.92) !important;
  color: #fafafa !important;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:root.dark .n-popover.n-tooltip:not(.n-popover--raw) {
  background-color: rgba(24, 24, 27, 0.92) !important;
  color: #fafafa !important;
  border: 1px solid rgba(255, 255, 255, 0.12);
}

:root:not(.dark) .n-popover.n-tooltip:not(.n-popover--raw) .n-popover-arrow {
  background-color: rgba(9, 9, 11, 0.92) !important;
}

:root.dark .n-popover.n-tooltip:not(.n-popover--raw) .n-popover-arrow {
  background-color: rgba(24, 24, 27, 0.92) !important;
}

:root .n-notification {
  border: 1px solid var(--n-border-color);
}

:root.dark .n-tabs.n-tabs--segment-type .n-tabs-capsule {
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

:root.dark .n-tabs.n-tabs--card-type .n-tabs-tab.n-tabs-tab--active {
  background-color: var(--n-color-segment);
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

/* 离开和进入过程中的样式 */
.v-enter-active,
.v-leave-active {
  /* 添加过渡动画 */
  transition: opacity 0.5s ease;
}

/* 进入之后和离开之前的样式 */
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
