<template>
  <NMessageProvider>
    <NNotificationProvider>
      <NConfigProvider :theme-overrides="themeOverrides" :theme="theme" style="height: 100vh" :locale="zhCN" :date-locale="dateZhCN">
        <ViewerLayout v-if="layout == 'viewer'" />
        <ManageLayout v-else-if="layout == 'manage'" />
        <template v-else>
          <RouterView />
        </template>
      </NConfigProvider>
    </NNotificationProvider>
  </NMessageProvider>
</template>

<script setup lang="ts">
import ViewerLayout from '@/views/ViewerLayout.vue'
import ManageLayout from '@/views/ManageLayout.vue'
import { useRoute } from 'vue-router'
import { NConfigProvider, NMessageProvider, NNotificationProvider, zhCN, dateZhCN, useOsTheme, darkTheme } from 'naive-ui'
import { computed } from 'vue'
import { useStorage } from '@vueuse/core'
import { ThemeType } from './api/api-models'

const route = useRoute()
const layout = computed(() => {
  if (route.path.startsWith('/user')) {
    return 'viewer'
  } else if (route.path.startsWith('/manage')) {
    return 'manage'
  } else {
    return ''
  }
})

const themeType = useStorage('Settings.Theme', ThemeType.Auto);
const theme = computed(() => {
  if (themeType.value == ThemeType.Auto) {
    var osThemeRef = useOsTheme(); //获取当前系统主题
    return osThemeRef.value === "dark" ? darkTheme : null;
  } else {
    return themeType.value == ThemeType.Dark ? darkTheme : null;
  }
});

const themeOverrides = {
  common: {
    //primaryColor: '#9ddddc',
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
