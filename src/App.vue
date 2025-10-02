<script setup lang="ts">
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
} from 'naive-ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ManageLayout from '@/views/ManageLayout.vue'
import ViewerLayout from '@/views/ViewerLayout.vue'
import { ThemeType } from './api/api-models'
import ClientLayout from './client/ClientLayout.vue'
import TempComponent from './components/TempComponent.vue'
import { isDarkMode, theme } from './Utils'
import OBSLayout from './views/OBSLayout.vue'
import OpenLiveLayout from './views/OpenLiveLayout.vue'

const route = useRoute()
const themeType = useStorage('Settings.Theme', ThemeType.Auto)

const layout = computed(() => {
  if (route.path.startsWith('/user') || route.name == 'user' || route.path.startsWith('/@')) {
    document.title = `${route.meta.title} · ${route.params.id} · VTsuru`
    return 'viewer'
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

const themeOverrides = computed(() => {
  return {
    common: {
      // 主色调 (中蓝色基调，提升可读性并增强对比)
      primaryColor: '#4D6E9C',
      primaryColorHover: '#6483A9', // 略微提亮悬浮色
      primaryColorPressed: '#365A7D', // 调整按下色，避免在暗色模式下过暗
      primaryColorSuppl: '#809BC1', // 调整补充色，使其与背景有区分

      // 信息色 (浅蓝色基调，提升对比度)
      infoColorHover: '#79AFDE', // 提亮悬浮色
      infoColorPressed: '#4B8AC3', // 调整按下色

      // 成功色 (柔和青绿, 增强对比)
      successColor: '#3AA89C',
      successColorHover: '#5AB9AE', // 调整悬浮色
      successColorPressed: '#2C8C82', // 调整按下色
      successColorSuppl: '#B4E4DF', // 调整补充色

      // 警告色 (柔和橙色, 微调对比)
      warningColor: '#FFA64D',
      warningColorHover: '#FFBA70', // 调整悬浮色
      warningColorPressed: '#E89530', // 调整按下色
      warningColorSuppl: '#FFE2C2', // 调整补充色

      // 错误色 (柔和红色, 微调对比)
      errorColor: '#E16565',
      errorColorHover: '#EA8282', // 调整悬浮色
      errorColorPressed: '#D44848', // 调整按下色
      errorColorSuppl: '#F3C0C0', // 调整补充色

      // 保持字体设置
      fontFamily:
        'Inter ,"Noto Sans SC",-apple-system,blinkmacsystemfont,"Segoe UI",roboto,"Helvetica Neue",arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"!important',

      // 文本颜色 (提升可读性, 但不过度突兀)
      textColorBase: isDarkMode.value ? '#ECECEC' : '#333333',
      textColor1: isDarkMode.value ? '#E6E6E6' : '#333333',
      textColor2: isDarkMode.value ? '#CCCCCC' : '#4F4F4F',
      textColor3: isDarkMode.value ? '#AAAAAA' : '#656565',
    },
    Tooltip: {
      color: isDarkMode.value ? '#48484e' : '#FFFFFF',
      textColor: isDarkMode.value ? '#FFFFFF' : '#333333',
    },
  }
})
const body = document.body

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
