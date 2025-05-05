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

const themeOverrides = computed(() => {
  return {
    common: {
      // 主色调 (中蓝色基调，调整对比度)
      primaryColor: '#5A7A9E',
      primaryColorHover: '#7390B1',      // 略微提亮悬浮色
      primaryColorPressed: '#4F7094',     // 调整按下色，避免在暗色模式下过暗
      primaryColorSuppl: '#8CA6C1',     // 调整补充色，使其与背景有区分

      // 信息色 (浅蓝色基调，调整对比度)
      infoColor: '#8CB1C7',              // 稍微加深基础信息色
      infoColorHover: '#A6C3D6',        // 提亮悬浮色
      infoColorPressed: '#7DA0B5',       // 调整按下色
      infoColorSuppl: '#D0DDE8',        // 调整补充色

      // 成功色 (柔和青绿)
      successColor: '#4DB6AC',
      successColorHover: '#6BC4B9',      // 调整悬浮色
      successColorPressed: '#3E9A90',     // 调整按下色
      successColorSuppl: '#C1E7E2',      // 调整补充色

      // 警告色 (柔和橙色)
      warningColor: '#FFB74D',
      warningColorHover: '#FFC870',      // 调整悬浮色
      warningColorPressed: '#F8A830',     // 调整按下色
      warningColorSuppl: '#FFE9C7',      // 调整补充色

      // 错误色 (柔和红色)
      errorColor: '#E57373',
      errorColorHover: '#EC8F8F',       // 调整悬浮色
      errorColorPressed: '#D96060',      // 调整按下色
      errorColorSuppl: '#F5C7C7',       // 调整补充色


      // 保持字体设置
      fontFamily:
        'Inter ,"Noto Sans SC",-apple-system,blinkmacsystemfont,"Segoe UI",roboto,"Helvetica Neue",arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"!important',
    },
    Tooltip: {
      color: isDarkMode.value ? '#101014' : '#FFFFFF',
    }
  };
})
const body = document.body;

onMounted(() => {
  if (isDarkMode.value) {
    document.documentElement.classList.add('dark');
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
    inline-theme-disabled
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
