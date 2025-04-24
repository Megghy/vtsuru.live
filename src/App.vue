<script setup lang="ts">
  import ManageLayout from '@/views/ManageLayout.vue';
  import ViewerLayout from '@/views/ViewerLayout.vue';
  import {
    dateZhCN,
    NConfigProvider,
    NDialogProvider,
    NElement,
    NLayoutContent,
    NLoadingBarProvider,
    NMessageProvider,
    NModalProvider,
    NNotificationProvider,
    NSpin,
    zhCN,
  } from 'naive-ui';
  import { computed } from 'vue';
  import { useRoute } from 'vue-router';
  import TempComponent from './components/TempComponent.vue';
  import { isDarkMode, theme } from './Utils';
  import OBSLayout from './views/OBSLayout.vue';
  import OpenLiveLayout from './views/OpenLiveLayout.vue';
  import ClientLayout from './client/ClientLayout.vue';
  import { ThemeType } from './api/api-models';

  const route = useRoute();
  const themeType = useStorage('Settings.Theme', ThemeType.Auto);

  const layout = computed(() => {
    if (route.path.startsWith('/user') || route.name == 'user' || route.path.startsWith('/@')) {
      document.title = `${route.meta.title} · ${route.params.id} · VTsuru`;
      return 'viewer';
    }
    else if (route.path.startsWith('/manage')) {
      document.title = `${route.meta.title} · 管理 · VTsuru`;
      return 'manage';
    }
    else if (route.path.startsWith('/open-live')) {
      document.title = `${route.meta.title} · 开放平台 · VTsuru`;
      return 'open-live';
    }
    else if (route.path.startsWith('/obs')) {
      document.title = `${route.meta.title} · OBS · VTsuru`;
      return 'obs';
    }
    else if (route.path.startsWith('/client')) {
      document.title = `${route.meta.title} · 客户端 · VTsuru`;
      return 'client';
    }
    else {
      document.title = `${route.meta.title} · VTsuru`;
      return '';
    }
  });
  watchEffect(() => {
    if (isDarkMode.value) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  const themeOverrides = {
    common: {
      // primaryColor: '#9ddddc',
      fontFamily:
        'Inter ,"Noto Sans SC",-apple-system,blinkmacsystemfont,"Segoe UI",roboto,"Helvetica Neue",arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"!important',
    },
    // ...
  };

  onMounted(() => {
    if (isDarkMode.value) {
      document.documentElement.classList.add('dark');
      console.log('Added dark class to HTML'); // For debugging
    }
  });
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
                    <NElement style="height: 100vh;">
                      <ViewerLayout v-if="layout == 'viewer'" />
                      <ManageLayout v-else-if="layout == 'manage'" />
                      <OpenLiveLayout v-else-if="layout == 'open-live'" />
                      <OBSLayout v-else-if="layout == 'obs'" />
                      <ClientLayout v-else-if="layout == 'client'" />
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
