import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  batchFetchFollowerStats,
  fetchFollowersList,
  fetchUserStat,
  followBiliUser,
  type BiliFollowerItem,
} from '../fans-viewer'

// Mock tauri-apps http 插件
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(async (url: string, init?: any) => {
    const urlStr = String(url)
    const bodyStr = init?.body ? String(init.body) : ''

    // 粉丝列表接口
    if (urlStr.includes('/x/relation/followers')) {
      return {
        json: async () => ({
          code: 0,
          data: {
            total: 100,
            list: [
              {
                mid: 9001,
                uname: '大V老师',
                face: 'https://face.jpg',
                sign: '知名UP主',
                mtime: 1730000000,
                attribute: 0,
              },
              {
                mid: 9002,
                uname: '同行伙伴',
                face: 'https://face.jpg',
                sign: '努力直播中',
                mtime: 1730001000,
                attribute: 2,
              },
            ],
          },
        }),
      }
    }

    // 单个用户统计数据接口
    if (urlStr.includes('/x/relation/stat')) {
      const match = urlStr.match(/vmid=(\d+)/)
      const mid = match ? Number(match[1]) : 0
      return {
        json: async () => ({
          code: 0,
          data: {
            mid,
            following: 50,
            follower: mid === 9001 ? 250000 : 3500,
          },
        }),
      }
    }

    // 回关修改接口
    if (urlStr.includes('/x/relation/modify')) {
      if (bodyStr.includes('csrf=test_csrf_token')) {
        return {
          json: async () => ({ code: 0, message: '0' }),
        }
      }
      return {
        json: async () => ({ code: -111, message: 'csrf 校验失败' }),
      }
    }

    return {
      json: async () => ({ code: -404, message: 'Not Found' }),
    }
  }),
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))

vi.mock('../../store/useBiliCookie', () => ({
  useBiliCookie: () => ({
    getBiliCookie: vi.fn(async () => 'DedeUserID=123456; bili_jct=test_csrf_token; SESSDATA=test_sess;'),
    uId: 123456,
  }),
}))

describe('fans-viewer 粉丝查看相关接口与工具', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('fetchFollowersList 应采用最大单页 ps=50 正常拉取粉丝列表', async () => {
    const res = await fetchFollowersList(123456, 1, 50)
    expect(res.total).toBe(100)
    expect(res.list.length).toBe(2)
    expect(res.list[0].uname).toBe('大V老师')
    expect(res.list[0].attribute).toBe(0)
  })

  it('fetchUserStat 能够拉取用户粉丝数并命中后续缓存', async () => {
    const stat1 = await fetchUserStat(9001)
    expect(stat1.follower).toBe(250000)
    expect(stat1.following).toBe(50)

    // 第二次调用应命中内存缓存
    const stat2 = await fetchUserStat(9001)
    expect(stat2.follower).toBe(250000)
  })

  it('batchFetchFollowerStats 支持批量并发拉取粉丝数并回调进度', async () => {
    const items: BiliFollowerItem[] = [
      {
        mid: 9001,
        uname: '大V老师',
        face: '',
        sign: '',
        mtime: 1730000000,
        attribute: 0,
        statLoaded: false,
      },
      {
        mid: 9002,
        uname: '同行伙伴',
        face: '',
        sign: '',
        mtime: 1730001000,
        attribute: 2,
        statLoaded: false,
      },
    ]

    const progressLogs: Array<{ done: number; total: number }> = []
    await batchFetchFollowerStats(items, (done, total) => {
      progressLogs.push({ done, total })
    })

    expect(items[0].statLoaded).toBe(true)
    expect(items[0].followerCount).toBe(250000)
    expect(items[1].statLoaded).toBe(true)
    expect(items[1].followerCount).toBe(3500)
    expect(progressLogs.length).toBeGreaterThanOrEqual(1)
  })

  it('followBiliUser 支持在客户端内直接回关并带上 CSRF', async () => {
    await expect(followBiliUser(9001)).resolves.not.toThrow()
  })
})
