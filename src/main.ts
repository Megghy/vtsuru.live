import { QueryGetAPI } from '@/api/query'
import { BASE_API } from '@/data/constants'
import { createApp, h } from 'vue'
import App from './App.vue'
import router from './router'
import { GetSelfAccount } from './api/account'
import { GetNotifactions } from './data/notifactions'
import { NText, createDiscreteApi } from 'naive-ui'

createApp(App).use(router).mount('#app')

GetSelfAccount()
GetNotifactions()
let currentVersion: string
const { notification } = createDiscreteApi(['notification'])
QueryGetAPI<string>(BASE_API + 'vtsuru/version').then((version) => {
  if (version.code == 200) {
    currentVersion = version.data
    const savedVersion = localStorage.getItem('Version')

    if (currentVersion && savedVersion && savedVersion !== currentVersion) {
      //alert('发现新的版本更新, 请按 Ctrl+F5 强制刷新页面')
      notification.info({
        title: '发现新的版本更新',
        content: '请按 Ctrl+F5 强制刷新页面',
        duration: 5000,
        meta: () => h(NText, { depth: 3 }, () => currentVersion),
      })
    }

    localStorage.setItem('Version', currentVersion)
  }
})
