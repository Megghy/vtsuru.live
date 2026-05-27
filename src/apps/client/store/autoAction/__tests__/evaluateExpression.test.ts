import type { ExecutionContext } from '../types'
import type { EventModel } from '@/api/api-models'
import { describe, expect, it } from 'vitest'
import { evaluateExpression } from '../utils'

function makeContext(event: Partial<EventModel> | null = null): ExecutionContext {
  return {
    event: event as EventModel | null,
    roomId: 0,
    timestamp: Date.now(),
    variables: {},
    getData: () => undefined,
    setData: () => {},
    containsData: () => false,
    removeData: () => {},
    getStorageData: async () => undefined,
    setStorageData: async () => {},
    hasStorageData: async () => false,
    removeStorageData: async () => {},
    clearStorageData: async () => {},
  }
}

describe('evaluateExpression', () => {
  it('returns true for empty expression', () => {
    expect(evaluateExpression('', makeContext())).toBe(true)
    expect(evaluateExpression('   ', makeContext())).toBe(true)
  })

  it('evaluates simple boolean expressions', () => {
    expect(evaluateExpression('1 + 1 === 2', makeContext())).toBe(true)
    expect(evaluateExpression('1 > 2', makeContext())).toBe(false)
  })

  it('exposes inDanmaku helper', () => {
    const ctx = makeContext({ msg: 'hello world' })
    expect(evaluateExpression('inDanmaku("hello")', ctx)).toBe(true)
    expect(evaluateExpression('inDanmaku("nope")', ctx)).toBe(false)
  })

  it('returns false for inDanmaku when no message', () => {
    expect(evaluateExpression('inDanmaku("anything")', makeContext())).toBe(false)
  })

  it('exposes giftValue/giftCount/giftName helpers', () => {
    const ctx = makeContext({ price: -100, num: 3, msg: '小心心' })
    expect(evaluateExpression('giftValue() === 100', ctx)).toBe(true)
    expect(evaluateExpression('giftCount() === 3', ctx)).toBe(true)
    expect(evaluateExpression('giftName() === "小心心"', ctx)).toBe(true)
  })

  it('exposes hasMedal/medalLevel/isCaptain helpers', () => {
    const ctx = makeContext({
      fans_medal_wearing_status: true,
      fans_medal_level: 20,
      guard_level: 3,
    })
    expect(evaluateExpression('hasMedal()', ctx)).toBe(true)
    expect(evaluateExpression('medalLevel() >= 10', ctx)).toBe(true)
    expect(evaluateExpression('isCaptain()', ctx)).toBe(true)
  })

  it('returns false for isCaptain when guard_level is 0', () => {
    const ctx = makeContext({ guard_level: 0 })
    expect(evaluateExpression('isCaptain()', ctx)).toBe(false)
  })

  it('exposes time helpers', () => {
    const result = evaluateExpression('time.hour >= 0 && time.hour < 24', makeContext())
    expect(result).toBe(true)
  })

  it('exposes string helpers', () => {
    const ctx = makeContext()
    expect(evaluateExpression('str.includes("foobar", "oob")', ctx)).toBe(true)
    expect(evaluateExpression('str.startsWith("hello", "he")', ctx)).toBe(true)
    expect(evaluateExpression('str.endsWith("world", "ld")', ctx)).toBe(true)
  })

  it('returns false on syntax errors instead of throwing', () => {
    expect(evaluateExpression('this is not valid js', makeContext())).toBe(false)
  })

  it('returns false on runtime errors inside expression', () => {
    expect(evaluateExpression('null.foo', makeContext())).toBe(false)
  })

  it('combines event and helpers in compound expression', () => {
    const ctx = makeContext({
      msg: '老板大气',
      fans_medal_wearing_status: true,
      guard_level: 3,
    })
    expect(evaluateExpression('inDanmaku("老板") && hasMedal() && isCaptain()', ctx))
      .toBe(true)
  })
})
