import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { EventDataTypes, GuardLevel } from '@/api/api-models'
import { useDanmakuWindow } from '../useDanmakuWindow'

vi.mock('@tauri-apps/api/dpi', () => ({
  PhysicalPosition: vi.fn(),
  PhysicalSize: vi.fn(),
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getAllWebviewWindows: vi.fn(async () => []),
}))

vi.mock('@/shared/storage/persist', () => ({
  usePersistedStorage: vi.fn((_key: string, defaultValue: any) => {
    return ref(defaultValue)
  }),
}))

vi.mock('@/shared/utils/broadcastChannel', () => ({
  postBroadcastMessage: vi.fn(),
}))

vi.mock('@/store/useDanmakuClient', () => ({
  useDanmakuClient: vi.fn(() => ({
    onEvent: vi.fn(),
  })),
}))

describe('useDanmakuWindow 弹幕机浮窗与实时数据状态栏', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('状态栏各配置项具有合理的默认值', () => {
    const store = useDanmakuWindow()
    expect(store.danmakuWindowSetting.showStatusBar).toBe(true)
    expect(store.danmakuWindowSetting.showWatchedCount).toBe(true)
    expect(store.danmakuWindowSetting.showLikeCount).toBe(true)
    expect(store.danmakuWindowSetting.showIncome).toBe(true)
    expect(store.danmakuWindowSetting.hideIncomeAmount).toBe(false)
    expect(store.danmakuWindowSetting.showOnlineCount).toBe(true)
    expect(store.danmakuWindowSetting.contentProtected).toBe(false)
  })

  it('能够正确重置实时数据统计', () => {
    const store = useDanmakuWindow()
    store.liveStats.watchedCount = 100
    store.liveStats.likeCount = 50
    store.liveStats.totalIncome = 328
    store.liveStats.onlineCount = 12

    store.resetLiveStats()

    expect(store.liveStats.watchedCount).toBe(0)
    expect(store.liveStats.likeCount).toBe(0)
    expect(store.liveStats.totalIncome).toBe(0)
    expect(store.liveStats.onlineCount).toBe(0)
  })
})
