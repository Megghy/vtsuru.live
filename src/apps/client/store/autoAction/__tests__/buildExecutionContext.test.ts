import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TriggerType } from '../types'
import { buildExecutionContext } from '../utils'

describe('buildExecutionContext', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })
  afterEach(() => {
    sessionStorage.clear()
  })

  it('builds basic context without event', () => {
    const ctx = buildExecutionContext(null, 12345)
    expect(ctx.roomId).toBe(12345)
    expect(ctx.event).toBeNull()
    expect(typeof ctx.timestamp).toBe('number')
    expect(ctx.variables.date).toBeDefined()
    expect(ctx.variables.date.year).toBe(new Date().getFullYear())
    expect(typeof ctx.variables.timeOfDay).toBe('function')
  })

  it('timeOfDay returns a localized string', () => {
    const ctx = buildExecutionContext(null, 0)
    const tod = ctx.variables.timeOfDay()
    expect(['凌晨', '早上', '上午', '中午', '下午', '晚上', '深夜']).toContain(tod)
  })

  it('attaches user info when event is present', () => {
    const event = {
      uname: 'TestUser',
      uid: 999,
      guard_level: 2,
      fans_medal_wearing_status: true,
      fans_medal_level: 15,
      fans_medal_name: '某主播',
      msg: 'hi',
    }
    const ctx = buildExecutionContext(event, 0, TriggerType.DANMAKU)
    expect(ctx.variables.user.name).toBe('TestUser')
    expect(ctx.variables.user.uid).toBe(999)
    expect(ctx.variables.user.guardLevel).toBe(2)
    expect(ctx.variables.user.medalLevel).toBe(15)
    expect(ctx.variables.message).toBe('hi')
  })

  it('builds gift variables with derived totalPrice', () => {
    const event = { uname: 'X', uid: 1, msg: '小心心', num: 5, price: 10 }
    const ctx = buildExecutionContext(event, 0, TriggerType.GIFT)
    expect(ctx.variables.gift.name).toBe('小心心')
    expect(ctx.variables.gift.count).toBe(5)
    expect(ctx.variables.gift.totalPrice).toBe(10)
    expect(ctx.variables.gift.price).toBe(2)
    expect(ctx.variables.gift.summary).toBe('5个小心心')
  })

  it('builds guard variables with mapped level name', () => {
    const event = { uname: 'X', uid: 1, guard_level: 1 }
    const ctx = buildExecutionContext(event, 0, TriggerType.GUARD)
    expect(ctx.variables.guard.level).toBe(1)
    expect(ctx.variables.guard.levelName).toBe('总督')
  })

  it('builds super_chat variables', () => {
    const event = { uname: 'X', uid: 1, msg: 'sc test', price: 50 }
    const ctx = buildExecutionContext(event, 0, TriggerType.SUPER_CHAT)
    expect(ctx.variables.sc.message).toBe('sc test')
    expect(ctx.variables.sc.price).toBe(50)
  })

  it('merges additionalContext into variables', () => {
    const ctx = buildExecutionContext(null, 0, undefined, { custom: 'value', n: 42 })
    expect(ctx.variables.custom).toBe('value')
    expect(ctx.variables.n).toBe(42)
  })

  it('runtime data: setData/getData round-trip via sessionStorage', () => {
    const ctx = buildExecutionContext(null, 0)
    ctx.setData('myKey', { nested: true, count: 7 })
    expect(ctx.getData('myKey')).toEqual({ nested: true, count: 7 })
    expect(ctx.containsData('myKey')).toBe(true)
  })

  it('runtime data: getData returns defaultValue for missing keys', () => {
    const ctx = buildExecutionContext(null, 0)
    expect(ctx.getData('missing', 'fallback')).toBe('fallback')
  })

  it('runtime data: setData(undefined) removes the key', () => {
    const ctx = buildExecutionContext(null, 0)
    ctx.setData('temp', 'value')
    expect(ctx.containsData('temp')).toBe(true)
    ctx.setData('temp', undefined)
    expect(ctx.containsData('temp')).toBe(false)
  })

  it('runtime data: removeData clears the key', () => {
    const ctx = buildExecutionContext(null, 0)
    ctx.setData('toRemove', 'x')
    ctx.removeData('toRemove')
    expect(ctx.containsData('toRemove')).toBe(false)
  })
})
