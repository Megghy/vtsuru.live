import { loader } from '@guolao/vue-monaco-editor'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { InitVTsuru } from './data/Initializer'
import emitter from './mitt'
import router from './router'

loader.config({
  'paths': {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor/min/vs',
  },
  'vs/nls': {
    availableLanguages: {
      '*': 'zh-cn',
    },
  },
})

const pinia = createPinia()
export const getPinia = () => pinia

const app = createApp(App)
app.use(router).use(pinia).mount('#app')

InitVTsuru()

window.$mitt = emitter
