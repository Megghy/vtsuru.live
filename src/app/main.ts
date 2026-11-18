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
// VueKonva 在 CanvasEditor 中按需注册，Sentry 按非 OBS 路由按需加载并在 mount 前初始化

const pinia = createPinia()
export const getPinia = () => pinia

installStaleChunkReload()

async function bootstrapApp() {
  // 与存储/API 初始化并行拉取 Sentry，既避免进入 /obs 包体又保证在 app.mount() 前完成初始化
  const sentryModulePromise =
    typeof window !== 'undefined' && !window.location.pathname.startsWith('/obs')
      ? import('@/shared/services/sentry')
      : null

  await initPersistedStorage()
  await initializeAPISelection()

  const app = createApp(App)
  window.$mitt = emitter
  app.use(router).use(pinia)

  if (sentryModulePromise) {
    const { initSentry } = await sentryModulePromise
    initSentry(app)
  }

  app.mount('#app')

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
