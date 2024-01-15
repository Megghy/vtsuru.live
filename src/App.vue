<template>
  <NMessageProvider>
    <NNotificationProvider>
      <NConfigProvider :theme-overrides="themeOverrides" :theme="theme" style="height: 100vh" :locale="zhCN" :date-locale="dateZhCN">
        <NLoadingBarProvider>
          <Suspense>
            <TempComponent>
              <NLayoutContent style="height: 100%" v-if="layout != 'obs'">
                <ViewerLayout v-if="layout == 'viewer'" />
                <ManageLayout v-else-if="layout == 'manage'" />
                <OpenLiveLayout v-else-if="layout == 'open-live'" />
                <template v-else-if="layout == ''">
                  <RouterView />
                </template>
              </NLayoutContent>
              <RouterView v-else />
            </TempComponent>
            <template #fallback>
              <NSpin size="large" show />
            </template>
          </Suspense>
        </NLoadingBarProvider>
      </NConfigProvider>
    </NNotificationProvider>
  </NMessageProvider>
</template>

<script setup lang="ts">
import { useProviderStore } from '@/store/useProviderStore'
import ManageLayout from '@/views/ManageLayout.vue'
import ViewerLayout from '@/views/ViewerLayout.vue'
import { useStorage } from '@vueuse/core'
import { NConfigProvider, NElement, NLayoutContent, NLoadingBarProvider, NMessageProvider, NNotificationProvider, NSpin, darkTheme, dateZhCN, useLoadingBar, useOsTheme, zhCN } from 'naive-ui'
import { computed, defineComponent, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ThemeType } from './api/api-models'
import OpenLiveLayout from './views/OpenLiveLayout.vue'
import TempComponent from './components/TempComponent.vue'

const route = useRoute()

const layout = computed(() => {
  if (route.path.startsWith('/user')) {
    document.title = route.meta.title + ' · ' + route.params.id + ' · VTsuru'
    return 'viewer'
  } else if (route.path.startsWith('/manage')) {
    document.title = route.meta.title + ' · 管理 · VTsuru'
    return 'manage'
  } else if (route.path.startsWith('/open-live')) {
    document.title = route.meta.title + ' · 开放平台 · VTsuru'
    return 'open-live'
  } else if (route.path.startsWith('/obs')) {
    document.title = route.meta.title + ' · OBS · VTsuru'
    return 'obs'
  } else {
    document.title = route.meta.title + ' · VTsuru'
    return ''
  }
})

const themeType = useStorage('Settings.Theme', ThemeType.Auto)
const theme = computed(() => {
  if (themeType.value == ThemeType.Auto) {
    var osThemeRef = useOsTheme() //获取当前系统主题
    return osThemeRef.value === 'dark' ? darkTheme : null
  } else {
    return themeType.value == ThemeType.Dark ? darkTheme : null
  }
})

const themeOverrides = {
  common: {
    //primaryColor: '#9ddddc',
    fontFamily:
      '"Noto Sans SC",-apple-system,blinkmacsystemfont,"Segoe UI",roboto,"Helvetica Neue",arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"!important',
  },
  // ...
}
</script>

<style lang="stylus">
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
</style>
