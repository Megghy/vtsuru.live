const tauriWindow = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : undefined
const isTauriEnv =
  tauriWindow !== undefined &&
  (tauriWindow.__TAURI__ !== undefined || tauriWindow.__TAURI_INTERNAL__ !== undefined || '__TAURI__' in window)

// 仅在 Tauri 桌面环境中按需加载本地保活，避免将 @tauri-apps/api 打入 Web 首屏入口。
if (isTauriEnv) {
  void import('@/apps/client/services/heartbeat').then((m) => m.startHeartbeat())
}

void import('./main')
