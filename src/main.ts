import { QueryGetAPI } from '@/api/query'
import { BASE_API } from '@/data/constants'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { GetSelfAccount } from './api/account'
import { GetNotifactions } from './data/notifactions'

let currentVersion
QueryGetAPI(BASE_API + 'vtsuru/version').then((version) => {
  if (version.code == 200) {
    currentVersion = version.data
    const savedVersion = localStorage.getItem('Version')

    if (currentVersion && savedVersion && savedVersion !== currentVersion) {
      alert('发现新的版本更新, 请按 Ctrl+F5 强制刷新页面')
    }

    localStorage.setItem('Version', currentVersion)
  }
})

createApp(App).use(router).mount('#app')

GetSelfAccount()
GetNotifactions()
