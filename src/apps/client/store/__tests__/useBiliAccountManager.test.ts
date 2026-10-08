import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useBiliAccountManager } from '../useBiliAccountManager'

// Mock 外部依赖
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))

vi.mock('@/shared/storage/persist', () => ({
  usePersistedStorage: vi.fn((_key: string, defaultValue: any) => {
    return ref(defaultValue)
  }),
}))

vi.mock('../../data/utils', () => ({
  QueryBiliAPI: vi.fn(async (_url: string, _method: string, cookie: string) => {
    if (cookie.includes('invalid')) {
      return {
        json: async () => ({ code: -101, message: '账号未登录' }),
      }
    }
    const match = cookie.match(/DedeUserID=(\d+)/)
    const mid = match ? Number(match[1]) : 12345
    return {
      json: async () => ({
        code: 0,
        data: {
          mid,
          name: `测试用户_${mid}`,
          face: `https://avatar.example.com/${mid}.jpg`,
        },
      }),
    }
  }),
}))

describe('useBiliAccountManager 多账号管理池', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('初始状态应为空账号列表并默认跟随主账号', async () => {
    const store = useBiliAccountManager()
    await store.init()
    expect(store.accounts).toEqual([])
    expect(store.routing.danmakuAccountId).toBe('main')
    expect(store.routing.fallbackToMain).toBe(true)
  })

  it('添加第一个账号应自动设置为主管直播的主账号', async () => {
    const store = useBiliAccountManager()
    await store.init()

    const item = await store.addOrUpdateAccount('DedeUserID=10001; bili_jct=csrf1;', undefined, '主播大号')
    expect(item.mid).toBe(10001)
    expect(item.name).toBe('测试用户_10001')
    expect(item.alias).toBe('主播大号')
    expect(store.accounts.length).toBe(1)
    expect(store.mainAccount?.mid).toBe(10001)
    expect(store.danmakuAccount?.mid).toBe(10001)
  })

  it('可以添加任意多个账号并支持自由指定发弹幕账号', async () => {
    const store = useBiliAccountManager()
    await store.init()

    // 添加大号
    await store.addOrUpdateAccount('DedeUserID=10001; bili_jct=csrf1;', undefined, '主播大号')
    // 添加机器人1号
    await store.addOrUpdateAccount('DedeUserID=20002; bili_jct=csrf2;', undefined, '房管机器人A')
    // 添加机器人2号
    await store.addOrUpdateAccount('DedeUserID=30003; bili_jct=csrf3;', undefined, '感谢小号B')

    expect(store.accounts.length).toBe(3)

    // 默认发弹幕跟随主账号
    expect(store.danmakuAccount?.mid).toBe(10001)

    // 切换发弹幕账号为机器人2号
    await store.setDanmakuAccount('30003')
    expect(store.danmakuAccount?.mid).toBe(30003)
    expect(store.activeDanmakuCsrf).toBe('csrf3')

    // 切换主账号为机器人1号
    await store.setMainAccount('20002')
    expect(store.mainAccount?.mid).toBe(20002)
    // 发弹幕依然保持为机器人2号
    expect(store.danmakuAccount?.mid).toBe(30003)
  })

  it('发弹幕小号失效时根据 fallbackToMain 正确回退主账号', async () => {
    const store = useBiliAccountManager()
    await store.init()

    await store.addOrUpdateAccount('DedeUserID=10001; bili_jct=csrf1;', undefined, '主播大号')
    await store.addOrUpdateAccount('DedeUserID=20002; bili_jct=csrf2;', undefined, '机器人A')

    await store.setDanmakuAccount('20002')
    expect(store.danmakuAccount?.mid).toBe(20002)

    // 模拟小号 Cookie 失效
    const targetBot = store.accounts.find((a) => a.id === '20002')!
    targetBot.isValid = false

    // 当 fallbackToMain 为 true 时，自动回退大号
    expect(store.routing.fallbackToMain).toBe(true)
    expect(store.danmakuAccount?.mid).toBe(10001)

    // 当关闭 fallbackToMain 时，保持返回小号（以便触发阻断告警）
    await store.setFallbackToMain(false)
    expect(store.danmakuAccount?.mid).toBe(20002)
  })

  it('支持修改账号别名与移除账号', async () => {
    const store = useBiliAccountManager()
    await store.init()

    await store.addOrUpdateAccount('DedeUserID=10001; bili_jct=csrf1;')
    await store.updateAccountAlias('10001', '修改后的别名')
    expect(store.accounts[0].alias).toBe('修改后的别名')

    await store.removeAccount('10001')
    expect(store.accounts.length).toBe(0)
  })
})
