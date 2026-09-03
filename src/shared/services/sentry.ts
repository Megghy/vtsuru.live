import type { App } from 'vue'
import { load as loadFingerprint } from '@fingerprintjs/fingerprintjs'
import * as Sentry from '@sentry/vue'

export const BUGSINK_DSN = 'https://cc64380340634181a0dc73f6c453b60d@bugsink.suki.club/1'

const FINGERPRINT_CACHE_KEY = 'vtsuru:device:fingerprint'

let cachedFingerprint = typeof window !== 'undefined' ? localStorage.getItem(FINGERPRINT_CACHE_KEY) || '' : ''
let fpPromise: ReturnType<typeof loadFingerprint> | null = null

function getFpAgent() {
  if (!fpPromise && typeof window !== 'undefined') {
    fpPromise = loadFingerprint({ monitoring: false })
  }
  return fpPromise
}

export async function getDeviceFingerprint(): Promise<string> {
  if (cachedFingerprint) return cachedFingerprint
  try {
    const agent = await getFpAgent()
    if (agent) {
      const result = await agent.get()
      if (result.visitorId) {
        cachedFingerprint = result.visitorId
        localStorage.setItem(FINGERPRINT_CACHE_KEY, cachedFingerprint)
        return cachedFingerprint
      }
    }
  } catch (e) {
    console.warn('[sentry] 获取设备指纹失败:', e)
  }
  return 'anonymous'
}

let currentAccount: { id?: number | string; name?: string } | null = null

export function initSentry(app?: App) {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/obs')) {
    return
  }

  Sentry.init({
    app,
    dsn: BUGSINK_DSN,
    environment: import.meta.env.MODE || 'production',
    initialScope: {
      tags: {
        app: 'vtsuru.live',
      },
      user: {
        id: cachedFingerprint || 'anonymous',
      },
    },
  })

  void getDeviceFingerprint().then((fp) => {
    Sentry.setTag('device_fingerprint', fp)
    if (!currentAccount?.id) {
      Sentry.setUser({ id: fp })
    }
  })
}

export function setSentryUser(user: { id?: number | string; name?: string } | null) {
  currentAccount = user
  if (user?.id) {
    Sentry.setUser({
      id: String(user.id),
      username: user.name,
    })
  } else {
    Sentry.setUser({
      id: cachedFingerprint || 'anonymous',
    })
  }
}
