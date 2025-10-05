import EasySpeech from 'easy-speech'
import { createDiscreteApi, NButton, NFlex, NText } from 'naive-ui'
import { h } from 'vue'
import { GetSelfAccount, UpdateAccountLoop, useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import { useBiliAuth } from '@/store/useBiliAuth'
import { useNotificationStore } from '@/store/useNotificationStore'
import { apiFail, BASE_API_URL, isTauri } from './constants'
import { GetNotifactions } from './notifactions'

let currentVersion: string
let isHaveNewVersion = false

const { notification } = createDiscreteApi(['notification'])

export function InitVTsuru() {
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
        } else {
          InitVersionCheck()
        }
      }
      InitOther()
    })
    .catch(() => {
      apiFail.value = true
      console.log('默认API调用失败, 切换至故障转移节点')
    })
    .finally(async () => {

    })
}

async function InitOther() {
  if (process.env.NODE_ENV !== 'development' && !window.$route.path.startsWith('/obs')) {
    const mod = await import('@hyperdx/browser')
    const HyperDX = (mod as any).default ?? mod
    HyperDX.init({
      apiKey: '7d1eb66c-24b8-445e-a406-dc2329fa9423',
      service: 'vtsuru.live',
      tracePropagationTargets: [/vtsuru.suki.club/i], // Set to link traces from frontend to backend requests
      // consoleCapture: true, // Capture console logs (default false)
      advancedNetworkCapture: true, // Capture full HTTP request/response headers and bodies (default false)
      ignoreUrls: [/localhost/i],
    })
    // 将实例挂到窗口，便于后续设置全局属性（可选）
    ;(window as any).__HyperDX__ = HyperDX
  }
  // 加载其他数据
  InitTTS()
  await GetSelfAccount()
  const account = useAccount()
  const useAuth = useBiliAuth()
  if (account.value.id) {
    if (account.value.biliUserAuthInfo && !useAuth.currentToken) {
      useAuth.currentToken = account.value.biliUserAuthInfo.token
    }
    const HyperDX = (window as any).__HyperDX__
    HyperDX?.setGlobalAttributes({
      userId: account.value.id.toString(),
      userName: account.value.name,
    })
  }
  useAuth.getAuthInfo()
  GetNotifactions()
  UpdateAccountLoop()

  useNotificationStore().init()
}
function InitVersionCheck() {
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

          if (window.$route.meta.forceReload || isTauri()) {
            location.reload()
          } else {
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
function InitTTS() {
  try {
    const result = EasySpeech.detect()
    if (result.speechSynthesis) {
      EasySpeech.init({ maxTimeout: 5000, interval: 250 })
        .then(() => console.log('[SpeechSynthesis] 已加载tts服务'))
        .catch(e => console.error(e))
    } else {
      console.log('[SpeechSynthesis] 当前浏览器不支持tts服务')
    }
  } catch {
    console.log('[SpeechSynthesis] 当前浏览器不支持tts服务')
  }
}
