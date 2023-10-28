import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { GetSelfAccount } from './api/account'
import { GetNotifactions } from './data/notifactions'

createApp(App).use(router).mount('#app')

GetSelfAccount()
GetNotifactions()


