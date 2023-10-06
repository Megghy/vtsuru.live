import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import { GetSelfAccount } from './api/account'
import { GetNotifactions } from './data/notifactions'

createApp(App).use(store).use(router).mount('#app')

GetSelfAccount()
GetNotifactions()


