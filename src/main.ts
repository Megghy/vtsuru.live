import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import emitter from './mitt'
import router from './router'

// Monaco 的 worker 在编辑器组件中懒加载配置

const pinia = createPinia()
export const getPinia = () => pinia

const app = createApp(App)
app.use(router).use(pinia).mount('#app')

// 将初始化逻辑改为异步按需加载，避免把其依赖打入入口
void import('./data/Initializer').then(m => m.InitVTsuru())
// 本地化 isTauri，避免在入口引入大量常量与模板映射
const isTauri = () => (window as any).__TAURI__ !== undefined || (window as any).__TAURI_INTERNAL__ !== undefined || '__TAURI__' in window
if (isTauri()) {
  // 仅在 Tauri 环境下才动态加载相关初始化，避免把 @tauri-apps/* 打入入口
  void import('./client/data/initialize').then(m => {
    m.startHeartbeat();
    m.checkUpdate();
  })
}

window.$mitt = emitter
