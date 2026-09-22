import { invoke, isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

let timer: ReturnType<typeof setInterval> | undefined
let failed = false

async function sendHeartbeat() {
  try {
    await invoke('heartbeat')
    if (failed) console.info('[心跳] 本地通信已恢复')
    failed = false
  } catch (error) {
    if (!failed) console.error('[心跳] 本地通信失败，将继续重试', error)
    failed = true
  }
}

function resumeHeartbeat() {
  if (document.visibilityState === 'visible') void sendHeartbeat()
}

// 心跳属于主 WebView 的生命周期，不依赖登录、路由或业务初始化。
export function startHeartbeat() {
  if (timer !== undefined || !isTauri() || getCurrentWindow().label !== 'main') return
  void sendHeartbeat()
  timer = setInterval(() => void sendHeartbeat(), 2000)
  window.addEventListener('pageshow', resumeHeartbeat)
  window.addEventListener('focus', resumeHeartbeat)
  document.addEventListener('visibilitychange', resumeHeartbeat)
}

export function stopHeartbeat() {
  clearInterval(timer)
  timer = undefined
  window.removeEventListener('pageshow', resumeHeartbeat)
  window.removeEventListener('focus', resumeHeartbeat)
  document.removeEventListener('visibilitychange', resumeHeartbeat)
}

if (import.meta.hot) import.meta.hot.dispose(stopHeartbeat)
