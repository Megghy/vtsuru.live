import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { EventDataTypes, GuardLevel } from '@/api/api-models'
import { useGiftWindow } from '../useGiftWindow'

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getAllWebviewWindows: vi.fn(async () => []),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    startResizeDragging: vi.fn(),
  })),
}))

vi.mock('@/shared/storage/persist', () => ({
  usePersistedStorage: vi.fn((_key: string, defaultValue: any) => {
    return ref(defaultValue)
  }),
}))

vi.mock('@/api/query', () => ({
  QueryGetAPI: vi.fn(async () => ({ code: 200, data: { live: null } })),
}))

vi.mock('@/shared/utils/broadcastChannel', () => ({
  postBroadcastMessage: vi.fn(),
}))

vi.mock('@/store/useDanmakuClient', () => ({
  useDanmakuClient: vi.fn(() => ({
    onEvent: vi.fn(),
  })),
}))

describe('useGiftWindow 礼物与高能榜 / 下播感谢', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('默认配置项包含防 OBS 捕捉属性', () => {
    const store = useGiftWindow()
    expect(store.settings.contentProtected).toBe(false)
  })

  it('正确统计并计算打赏榜 Top 排名与金额', () => {
    const store = useGiftWindow()

    // 模拟 currentLive
    store.currentLive = {
      liveId: 'live_1',
      title: '测试直播',
      cover: '',
      isFinish: false,
      startAt: Date.now(),
    }

    // 模拟添加打赏数据到 rankMap
    store.rankMap.set('user_1', {
      id: 'user_1',
      uid: 1001,
      uname: '大航海舰长A',
      uface: '',
      totalPaid: 198,
      score: 198,
      guardLevel: GuardLevel.Jianzhang,
      isOnline: true,
      lastActiveTime: Date.now(),
    })

    store.rankMap.set('user_2', {
      id: 'user_2',
      uid: 1002,
      uname: '榜一大哥B',
      uface: '',
      totalPaid: 1000,
      score: 1000,
      guardLevel: GuardLevel.None,
      isOnline: true,
      lastActiveTime: Date.now(),
    })

    const ranked = store.getRankedList()
    expect(ranked).toHaveLength(2)
    expect(ranked[0].uname).toBe('榜一大哥B')
    expect(ranked[0].score).toBe(1000)
    expect(ranked[1].uname).toBe('大航海舰长A')
    expect(ranked[1].score).toBe(198)
  })

  it('正确过滤与排序在场舰长名单（总督 > 提督 > 舰长）', () => {
    const store = useGiftWindow()
    const now = Date.now()

    // 活跃用户
    store.userActivityMap.set('user_tidu', {
      id: 'user_tidu',
      uid: 2001,
      uname: '提督大人',
      uface: '',
      guardLevel: GuardLevel.Tidu,
      lastActiveTime: now - 1000,
      lastAction: '发弹幕',
    })

    store.userActivityMap.set('user_zongdu', {
      id: 'user_zongdu',
      uid: 2002,
      uname: '总督大哥',
      uface: '',
      guardLevel: GuardLevel.Zongdu,
      lastActiveTime: now - 2000,
      lastAction: '进入直播间',
    })

    store.userActivityMap.set('user_jianzhang', {
      id: 'user_jianzhang',
      uid: 2003,
      uname: '普通舰长',
      uface: '',
      guardLevel: GuardLevel.Jianzhang,
      lastActiveTime: now - 500,
      lastAction: '点赞',
    })

    // 非舰长普通用户
    store.userActivityMap.set('user_normal', {
      id: 'user_normal',
      uid: 2004,
      uname: '普通观众',
      uface: '',
      guardLevel: GuardLevel.None,
      lastActiveTime: now,
      lastAction: '发弹幕',
    })

    const onlineGuards = store.getOnlineGuardList()
    expect(onlineGuards).toHaveLength(3)
    // 排序：总督 (1) -> 提督 (2) -> 舰长 (3)
    expect(onlineGuards[0].uname).toBe('总督大哥')
    expect(onlineGuards[1].uname).toBe('提督大人')
    expect(onlineGuards[2].uname).toBe('普通舰长')
  })

  it('正确聚合「下播感谢合集」：包含 Top 打赏榜 ➕ 不在 Top 中的在场舰长', () => {
    const store = useGiftWindow()
    const now = Date.now()

    store.currentLive = {
      liveId: 'live_1',
      title: '测试直播',
      cover: '',
      isFinish: false,
      startAt: now,
    }

    // user_1: 贡献 1000（非舰长，打赏榜第 1 名）
    store.rankMap.set('user_1', {
      id: 'user_1',
      uid: 3001,
      uname: '榜一大哥',
      uface: '',
      totalPaid: 1000,
      score: 1000,
      guardLevel: GuardLevel.None,
      isOnline: true,
      lastActiveTime: now,
    })

    // user_2: 贡献 198（舰长，打赏榜第 2 名且在场）
    store.rankMap.set('user_2', {
      id: 'user_2',
      uid: 3002,
      uname: '在场打赏舰长',
      uface: '',
      totalPaid: 198,
      score: 198,
      guardLevel: GuardLevel.Jianzhang,
      isOnline: true,
      lastActiveTime: now,
    })
    store.userActivityMap.set('user_2', {
      id: 'user_2',
      uid: 3002,
      uname: '在场打赏舰长',
      uface: '',
      guardLevel: GuardLevel.Jianzhang,
      lastActiveTime: now,
      lastAction: '送礼',
    })

    // user_3: 纯陪伴在场舰长（本场打赏为 0，不在打赏榜中，但在场）
    store.userActivityMap.set('user_3', {
      id: 'user_3',
      uid: 3003,
      uname: '陪伴在场舰长',
      uface: '',
      guardLevel: GuardLevel.Jianzhang,
      lastActiveTime: now,
      lastAction: '发弹幕',
    })

    const summary = store.getThankSummaryList()
    expect(summary).toHaveLength(3)

    // 前两位来自打赏 Top 榜
    expect(summary[0].uname).toBe('榜一大哥')
    expect(summary[0].isTopRank).toBe(true)
    expect(summary[0].rankIndex).toBe(1)

    expect(summary[1].uname).toBe('在场打赏舰长')
    expect(summary[1].isTopRank).toBe(true)
    expect(summary[1].rankIndex).toBe(2)

    // 第三位是未进打赏榜但在场的舰长
    expect(summary[2].uname).toBe('陪伴在场舰长')
    expect(summary[2].isTopRank).toBe(false)
    expect(summary[2].isGuardOnly).toBe(true)
  })

  it('超过在线活跃阈值的用户判定为离线', () => {
    const store = useGiftWindow()
    const now = Date.now()
    store.settings.onlineThresholdMinutes = 10 // 10分钟

    // 5分钟前活跃 -> 在线
    store.userActivityMap.set('user_active', {
      id: 'user_active',
      uid: 4001,
      uname: '活跃舰长',
      uface: '',
      guardLevel: GuardLevel.Jianzhang,
      lastActiveTime: now - 5 * 60 * 1000,
      lastAction: '发弹幕',
    })

    // 15分钟前活跃 -> 离线
    store.userActivityMap.set('user_idle', {
      id: 'user_idle',
      uid: 4002,
      uname: '挂机离线舰长',
      uface: '',
      guardLevel: GuardLevel.Jianzhang,
      lastActiveTime: now - 15 * 60 * 1000,
      lastAction: '发弹幕',
    })

    const onlineGuards = store.getOnlineGuardList()
    expect(onlineGuards).toHaveLength(1)
    expect(onlineGuards[0].uname).toBe('活跃舰长')
  })
})
