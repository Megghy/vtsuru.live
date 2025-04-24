import EasySpeech from 'easy-speech';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { InitVTsuru } from './data/Initializer';
import emitter from './mitt';
import router from './router';
import { loader } from '@guolao/vue-monaco-editor'

loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor/min/vs'
  },
  'vs/nls': {
    availableLanguages: {
      '*': 'zh-cn'
    }
  }
})

const pinia = createPinia()
export const getPinia = () => pinia

const app = createApp(App)
app.use(router).use(pinia).mount('#app')

InitVTsuru();

window.$mitt = emitter

