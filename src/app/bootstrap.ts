import { GetSelfAccount, UpdateAccountLoop, useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import router from '@/app/router'
import { apiFail, BASE_API_URL, isTauri } from '@/shared/config'
import { showToast } from '@/shared/services/toast'
import { persistedGetItemRaw, persistedSetItemRaw } from '@/shared/storage/persist'
import { useBiliAuth } from '@/store/useBiliAuth'
import { useNotificationStore } from '@/store/useNotificationStore'

let currentVersion: string
let isHaveNewVersion = false

export function InitVTsuru() {
  QueryGetAPI<string>(`${BASE_API_URL}vtsuru/version`)
    .then(async (version) => {
      if (version.code == 200) {
        currentVersion = version.data
        const savedVersion = await persistedGetItemRaw('Version')
        await persistedSetItemRaw('Version', currentVersion)

        if (currentVersion && savedVersion && savedVersion !== currentVersion) {
          setTimeout(() => {
            location.reload()
          }, 1000)
          showToast({
            title: '发现新的版本更新',
            description: currentVersion,
            color: 'info',
            icon: 'i-lucide-refresh-cw',
            duration: 5000,
          })
        } else {
          InitVersionCheck()
        }
      }
      await InitOther()
    })
    .catch(() => {
      apiFail.value = true
      console.log('默认API调用失败, 切换至故障转移节点')
    })
}

async function InitOther() {
  if (import.meta.env.MODE !== 'development' && !location.pathname.startsWith('/obs')) {
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
    // 将实例挂到窗口,便于后续设置全局属性(可选)
    ;(window as any).__HyperDX__ = HyperDX
  }
  // 加载其他数据
  void InitTTS()
  const routeToken = new URLSearchParams(window.location.search).get('token')?.trim() || undefined
  await GetSelfAccount(routeToken)
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
  UpdateAccountLoop()

  useNotificationStore().init()
}
function InitVersionCheck() {
  setInterval(() => {
    if (isHaveNewVersion) {
      return
    }
    QueryGetAPI<string>(`${BASE_API_URL}vtsuru/version`).then((keepCheckData) => {
      if (keepCheckData.code == 200 && keepCheckData.data != currentVersion) {
        isHaveNewVersion = true
        currentVersion = keepCheckData.data
        void persistedSetItemRaw('Version', currentVersion)
        console.log(`[vtsuru] 发现新版本: ${currentVersion}`)

        if (router.currentRoute.value.meta.forceReload || isTauri()) {
          location.reload()
        } else {
          showToast({
            title: '发现新的版本更新',
            description: currentVersion,
            color: 'info',
            icon: 'i-lucide-refresh-cw',
            duration: 0,
            actions: [{ label: '刷新', color: 'primary', onClick: () => location.reload() }],
          })
        }
      }
    })
  }, 60 * 1000)
}
async function InitTTS() {
  try {
    const mod = await import('easy-speech')
    const EasySpeech = (mod as any).default ?? mod
    const result = EasySpeech.detect()
    if (result.speechSynthesis) {
      EasySpeech.init({ maxTimeout: 5000, interval: 250 })
        .then(() => console.log('[SpeechSynthesis] 已加载tts服务'))
        .catch((e) => console.error(e))
    } else {
      console.log('[SpeechSynthesis] 当前浏览器不支持tts服务')
    }
  } catch {
    console.log('[SpeechSynthesis] 当前浏览器不支持tts服务')
  }
}
