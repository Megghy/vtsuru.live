import { QueryGetAPI } from '@/api/query'
import { apiFail, BASE_API_URL } from '@/data/constants'
import HyperDX from '@hyperdx/browser'
import EasySpeech from 'easy-speech'
import { createDiscreteApi, NButton, NFlex, NText } from 'naive-ui'
import { createPinia } from 'pinia'
import { createApp, h } from 'vue'
import { GetSelfAccount, UpdateAccountLoop, useAccount } from './api/account'
import App from './App.vue'
import { GetNotifactions } from './data/notifactions'
import emitter from './mitt'
import router from './router'
import { useAuthStore } from './store/useAuthStore'
import { useNotificationStore } from './store/useNotificationStore'

const pinia = createPinia()
export const getPinia = () => pinia

QueryGetAPI<string>(`${BASE_API_URL}vtsuru/version`)
  .then((version) => {
    if (version.code == 200) {
      currentVersion = version.data
      const savedVersion = localStorage.getItem('Version')
      localStorage.setItem('Version', currentVersion)

      if (currentVersion && savedVersion && savedVersion !== currentVersion) {
        setTimeout(() => {
          location.reload()
        }, 1000)
        // alert('发现新的版本更新, 请按 Ctrl+F5 强制刷新页面')
        notification.info({
          title: '发现新的版本更新',
          content: '将自动刷新页面',
          duration: 5000,
          meta: () => h(NText, { depth: 3 }, () => currentVersion),
        })
      }
      else {
        setInterval(() => {
          if (isHaveNewVersion) {
            return
          }
          QueryGetAPI<string>(`${BASE_API_URL}vtsuru/version`).then(
            (keepCheckData) => {
              if (
                keepCheckData.code == 200
                && keepCheckData.data != currentVersion
              ) {
                isHaveNewVersion = true
                currentVersion = keepCheckData.data
                localStorage.setItem('Version', currentVersion)
                console.log(`[vtsuru] 发现新版本: ${currentVersion}`)

                const url = new URL(window.location.href)
                const path = url.pathname

                if (!path.startsWith('/obs')) {
                  const n = notification.info({
                    title: '发现新的版本更新',
                    content: '是否现在刷新?',
                    meta: () => h(NText, { depth: 3 }, () => currentVersion),
                    action: () =>
                      h(NFlex, null, () => [
                        h(
                          NButton,
                          {
                            text: true,
                            type: 'primary',
                            onClick: () => location.reload(),
                            size: 'small',
                          },
                          { default: () => '刷新' },
                        ),
                        h(
                          NButton,
                          {
                            text: true,
                            onClick: () => n.destroy(),
                            size: 'small',
                          },
                          { default: () => '稍后' },
                        ),
                      ]),
                  })
                }
              }
            },
          )
        }, 60 * 1000)
      }
    }
  })
  .catch(() => {
    apiFail.value = true
    console.log('默认API调用失败, 切换至故障转移节点')
  })
  .finally(async () => {
    if (process.env.NODE_ENV !== 'development') {
      HyperDX.init({
        apiKey: '7d1eb66c-24b8-445e-a406-dc2329fa9423',
        service: 'vtsuru.live',
        tracePropagationTargets: [/vtsuru.suki.club/i], // Set to link traces from frontend to backend requests
        consoleCapture: true, // Capture console logs (default false)
        advancedNetworkCapture: true, // Capture full HTTP request/response headers and bodies (default false)
      })
    }
    // 加载其他数据
    InitTTS()
    await GetSelfAccount()
    const account = useAccount()
    const useAuth = useAuthStore()
    if (account.value.id) {
      if (account.value.biliUserAuthInfo && !useAuth.currentToken) {
        useAuth.currentToken = account.value.biliUserAuthInfo.token
      }
      HyperDX.setGlobalAttributes({
        userId: account.value.id.toString(),
        userName: account.value.name,
      })
    }
    useAuth.getAuthInfo()
    GetNotifactions()
    UpdateAccountLoop()
  })

const app = createApp(App)
app.use(router).use(pinia).mount('#app')

let currentVersion: string
let isHaveNewVersion = false

const { notification } = createDiscreteApi(['notification'])

useNotificationStore().init()

window.$mitt = emitter

function InitTTS() {
  try {
    const result = EasySpeech.detect()
    if (result.speechSynthesis) {
      EasySpeech.init({ maxTimeout: 5000, interval: 250 })
        .then(() => console.log('[SpeechSynthesis] 已加载tts服务'))
        .catch(e => console.error(e))
    }
    else {
      console.log('[SpeechSynthesis] 当前浏览器不支持tts服务')
    }
  }
  catch (e) {
    console.log('[SpeechSynthesis] 当前浏览器不支持tts服务')
  }
}
