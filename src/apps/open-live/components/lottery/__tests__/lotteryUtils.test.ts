import type { OpenLiveLotteryUserInfo } from '@/api/api-models'
import type { LotteryOption } from '../lotteryTypes'
import { describe, expect, it } from 'vitest'
import { getAvatarUrl, getRandomInt, isUserValid, shuffleArray } from '../lotteryUtils'

function makeUser(overrides: Partial<OpenLiveLotteryUserInfo> = {}): OpenLiveLotteryUserInfo {
  return {
    uId: 1,
    openId: 'user_1',
    name: 'TestUser',
    avatar: 'https://i2.hdslb.com/bfs/face/abc.jpg',
    fans_medal_level: 10,
    fans_medal_name: '测试',
    fans_medal_wearing_status: true,
    guard_level: 0,
    ...overrides,
  }
}

function makeOption(overrides: Partial<LotteryOption> = {}): LotteryOption {
  return {
    resultCount: 1,
    type: 'danmaku',
    lotteryType: 'single',
    danmakuFilterType: 'all',
    danmakuKeyword: '',
    needFanMedal: false,
    needWearFanMedal: false,
    needGuard: false,
    animationSpeed: 1000,
    ...overrides,
  }
}

describe('getRandomInt', () => {
  it('returns values within [0, max)', () => {
    for (let i = 0; i < 200; i++) {
      const val = getRandomInt(10)
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(10)
    }
  })

  it('returns 0 for max=1', () => {
    for (let i = 0; i < 20; i++) {
      expect(getRandomInt(1)).toBe(0)
    }
  })
})

describe('shuffleArray', () => {
  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const result = shuffleArray(arr)
    expect(result.sort()).toEqual(arr.sort())
  })

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3, 4, 5]
    const copy = [...arr]
    shuffleArray(arr)
    expect(arr).toEqual(copy)
  })

  it('produces different orderings (statistical)', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8]
    const results = new Set<string>()
    for (let i = 0; i < 50; i++) {
      results.add(JSON.stringify(shuffleArray(arr)))
    }
    expect(results.size).toBeGreaterThan(1)
  })

  it('handles single-element array', () => {
    expect(shuffleArray([42])).toEqual([42])
  })

  it('handles empty array', () => {
    expect(shuffleArray([])).toEqual([])
  })
})

describe('isUserValid', () => {
  const dmCmd = { cmd: 'LIVE_OPEN_PLATFORM_DM', data: { msg: '抽奖' } }
  const giftCmd = { cmd: 'LIVE_OPEN_PLATFORM_SEND_GIFT', data: { price: 1000, gift_num: 2, gift_name: '小花花' } }

  it('passes when no filters are set', () => {
    expect(isUserValid(makeUser(), dmCmd, makeOption())).toBe(true)
  })

  it('rejects user without fan medal when needFanMedal is true', () => {
    const user = makeUser({ fans_medal_level: 0 })
    expect(isUserValid(user, dmCmd, makeOption({ needFanMedal: true }))).toBe(false)
  })

  it('passes user with fan medal when needFanMedal is true', () => {
    const user = makeUser({ fans_medal_level: 5 })
    expect(isUserValid(user, dmCmd, makeOption({ needFanMedal: true }))).toBe(true)
  })

  it('rejects user not wearing fan medal when needWearFanMedal is true', () => {
    const user = makeUser({ fans_medal_wearing_status: false })
    expect(isUserValid(user, dmCmd, makeOption({ needWearFanMedal: true }))).toBe(false)
  })

  it('rejects non-guard user when needGuard is true', () => {
    const user = makeUser({ guard_level: 0 })
    expect(isUserValid(user, dmCmd, makeOption({ needGuard: true }))).toBe(false)
  })

  it('passes guard user when needGuard is true', () => {
    const user = makeUser({ guard_level: 3 })
    expect(isUserValid(user, dmCmd, makeOption({ needGuard: true }))).toBe(true)
  })

  it('filters by danmaku keyword (contains)', () => {
    const option = makeOption({ danmakuKeyword: '抽奖', danmakuFilterType: 'contains' })
    expect(isUserValid(makeUser(), { cmd: 'LIVE_OPEN_PLATFORM_DM', data: { msg: '我要抽奖啊' } }, option)).toBe(true)
    expect(isUserValid(makeUser(), { cmd: 'LIVE_OPEN_PLATFORM_DM', data: { msg: '你好' } }, option)).toBe(false)
  })

  it('filters by danmaku keyword (regex)', () => {
    const option = makeOption({ danmakuKeyword: '^抽奖\\d+$', danmakuFilterType: 'regex' })
    expect(isUserValid(makeUser(), { cmd: 'LIVE_OPEN_PLATFORM_DM', data: { msg: '抽奖123' } }, option)).toBe(true)
    expect(isUserValid(makeUser(), { cmd: 'LIVE_OPEN_PLATFORM_DM', data: { msg: '抽奖abc' } }, option)).toBe(false)
  })

  it('filters by exact danmaku keyword (all)', () => {
    const option = makeOption({ danmakuKeyword: '抽奖', danmakuFilterType: 'all' })
    expect(isUserValid(makeUser(), { cmd: 'LIVE_OPEN_PLATFORM_DM', data: { msg: '抽奖' } }, option)).toBe(true)
    expect(isUserValid(makeUser(), { cmd: 'LIVE_OPEN_PLATFORM_DM', data: { msg: '抽奖啊' } }, option)).toBe(false)
  })

  it('filters by gift min price', () => {
    const option = makeOption({ giftMinPrice: 3 })
    expect(isUserValid(makeUser(), giftCmd, option)).toBe(false)
    const expensiveGift = { cmd: 'LIVE_OPEN_PLATFORM_SEND_GIFT', data: { price: 5000, gift_num: 1, gift_name: '大花' } }
    expect(isUserValid(makeUser(), expensiveGift, option)).toBe(true)
  })

  it('filters by gift name', () => {
    const option = makeOption({ giftName: '小花花' })
    expect(isUserValid(makeUser(), giftCmd, option)).toBe(true)
    const wrongGift = { cmd: 'LIVE_OPEN_PLATFORM_SEND_GIFT', data: { price: 1000, gift_num: 1, gift_name: '大火箭' } }
    expect(isUserValid(makeUser(), wrongGift, option)).toBe(false)
  })
})

describe('getAvatarUrl', () => {
  it('returns noface for empty string', () => {
    expect(getAvatarUrl('')).toBe('https://i2.hdslb.com/bfs/face/member/noface.jpg')
  })

  it('returns noface for default noface url', () => {
    expect(getAvatarUrl('https://i2.hdslb.com/bfs/face/member/noface.jpg'))
      .toBe('https://i2.hdslb.com/bfs/face/member/noface.jpg')
  })

  it('replaces existing size parameter', () => {
    expect(getAvatarUrl('https://i2.hdslb.com/bfs/face/abc.jpg@48w_48h'))
      .toBe('https://i2.hdslb.com/bfs/face/abc.jpg@96w_96h')
  })

  it('appends size parameter when missing', () => {
    expect(getAvatarUrl('https://i2.hdslb.com/bfs/face/abc.jpg'))
      .toBe('https://i2.hdslb.com/bfs/face/abc.jpg@96w_96h')
  })
})
