import EasySpeech from 'easy-speech';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { InitVTsuru } from './data/Initializer';
import emitter from './mitt';
import router from './router';

const pinia = createPinia()
export const getPinia = () => pinia

const app = createApp(App)
app.use(router).use(pinia).mount('#app')

InitVTsuru();

window.$mitt = emitter

