import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { GetSelfAccount } from './api/account'
import { GetNotifactions } from './data/notifactions'

let currentVersion
import('@/version.js').then((versionModule) => {
  currentVersion = versionModule.version
  const savedVersion = localStorage.getItem('Version')

  if (currentVersion && savedVersion && savedVersion !== currentVersion) {
    alert('新的版本更新, 请按 Ctrl+F5 强制刷新页面')
  }

  localStorage.setItem('Version', currentVersion)
})

createApp(App).use(router).mount('#app')

GetSelfAccount()
GetNotifactions()
