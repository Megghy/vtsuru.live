import { QueryGetAPI } from '@/api/query'
import { BASE_API, apiFail } from '@/data/constants'
import { createApp, h } from 'vue'
import App from './App.vue'
import router from './router'
import { GetSelfAccount, UpdateAccountLoop } from './api/account'
import { GetNotifactions } from './data/notifactions'
import { NText, createDiscreteApi } from 'naive-ui'

createApp(App).use(router).mount('#app')

let currentVersion: string
const { notification } = createDiscreteApi(['notification'])
QueryGetAPI<string>(BASE_API() + 'vtsuru/version')
  .then((version) => {
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
  .catch(() => {
    apiFail.value = true
    console.log('默认API调用失败, 切换至故障转移节点')
  })
  .finally(() => {
    //加载其他数据
    GetSelfAccount()
    GetNotifactions()
    UpdateAccountLoop()
  })
