import '@unocss/reset/tailwind.css'
import 'virtual:uno.css'
import 'vue-sonner/style.css'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import { initializeAPISelection } from '@/shared/config'
import { installStaleChunkReload } from '@/shared/services/staleChunkReload'
import { initPersistedStorage } from '@/shared/storage/persist'

import App from './App.vue'
import emitter from './mitt'
import router from './router'

// Monaco 的 worker 在编辑器组件中懒加载配置
// VueKonva 在 CanvasEditor 中按需注册，Sentry 在首屏挂载后异步初始化

const pinia = createPinia()
export const getPinia = () => pinia

installStaleChunkReload()

async function bootstrapApp() {
  await initPersistedStorage()
  await initializeAPISelection()

  const app = createApp(App)
  window.$mitt = emitter
  app.use(router).use(pinia).mount('#app')

  // 首屏挂载后异步加载错误监控与后台初始化逻辑，避免将重型依赖打入主入口
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/obs')) {
    void import('@/shared/services/sentry').then((m) => m.initSentry(app))
  }
  void import('@/app/bootstrap').then((m) => m.InitVTsuru())
  // 本地化 isTauri，避免在入口引入大量常量与模板映射
  const isTauri = () => {
    const win = window as unknown as Record<string, unknown>
    return win.__TAURI__ !== undefined || win.__TAURI_INTERNAL__ !== undefined || '__TAURI__' in window
  }
  if (isTauri()) {
    void import('@/apps/client/data/initialize').then((m) => {
      void import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        if (getCurrentWindow().label === 'main') {
          m.checkUpdate()
        }
      })
    })
  }
}

void bootstrapApp()
