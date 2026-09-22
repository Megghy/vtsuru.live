import { describe, expect, it } from 'vitest'

import { formatCountdown, remainingMs } from '../countdown'

describe('vote countdown', () => {
  const now = 1_790_000_000_000 // 毫秒时间戳

  it('treats endTime as milliseconds', () => {
    expect(remainingMs(now + 10_000, now)).toBe(10_000)
    expect(formatCountdown(remainingMs(now + 10_000, now)!)).toBe('00:10')
  })

  it('keeps long countdowns in mm:ss', () => {
    expect(formatCountdown(remainingMs(now + 45_000, now)!)).toBe('00:45')
    expect(formatCountdown(remainingMs(now + 305_000, now)!)).toBe('05:05')
  })

  it('rounds up sub-second remainders and clamps expired votes to zero', () => {
    expect(formatCountdown(remainingMs(now + 1, now)!)).toBe('00:01')
    expect(remainingMs(now - 5_000, now)).toBe(0)
  })

  it('returns null when endTime is missing', () => {
    expect(remainingMs(undefined, now)).toBeNull()
    expect(remainingMs(0, now)).toBeNull()
  })
})
