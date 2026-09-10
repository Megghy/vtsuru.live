import { describe, expect, it } from 'vitest'

import { buildObsSourceUrl, firstQueryValue, parsePositiveId } from '../obsUrl'

describe('parsePositiveId', () => {
  it('accepts positive numeric ids', () => {
    expect(parsePositiveId(12)).toBe('12')
    expect(parsePositiveId('12')).toBe('12')
    expect(parsePositiveId(['12'])).toBe('12')
  })

  it('rejects empty or non-positive values', () => {
    expect(parsePositiveId(undefined)).toBe('')
    expect(parsePositiveId(null)).toBe('')
    expect(parsePositiveId('')).toBe('')
    expect(parsePositiveId(0)).toBe('')
    expect(parsePositiveId(-1)).toBe('')
    expect(parsePositiveId('abc')).toBe('')
  })
})

describe('firstQueryValue', () => {
  it('unwraps array query values', () => {
    expect(firstQueryValue(['a', 'b'])).toBe('a')
    expect(firstQueryValue(undefined)).toBe('')
  })
})

describe('buildObsSourceUrl', () => {
  it('builds public-id urls without token', () => {
    expect(
      buildObsSourceUrl({
        path: 'obs/queue',
        host: 'https://vtsuru.live/',
        credential: 'public-id',
        userId: 42,
        params: { style: 'classic', speed: 1 },
      }),
    ).toBe('https://vtsuru.live/obs/queue?id=42&style=classic&speed=1')
  })

  it('returns empty public-id urls when user id is missing', () => {
    expect(
      buildObsSourceUrl({
        path: 'obs/queue',
        host: 'https://vtsuru.live/',
        credential: 'public-id',
        userId: 0,
      }),
    ).toBe('')
  })

  it('builds token urls for connection sources', () => {
    expect(
      buildObsSourceUrl({
        path: 'obs/danmuji',
        host: 'https://vtsuru.live',
        credential: 'token',
        token: 'abc',
      }),
    ).toBe('https://vtsuru.live/obs/danmuji?token=abc')
  })

  it('returns empty token urls when token is missing', () => {
    expect(
      buildObsSourceUrl({
        path: 'obs/danmuji',
        host: 'https://vtsuru.live/',
        credential: 'token',
        token: '  ',
      }),
    ).toBe('')
  })

  it('allows extra params without identity for none credential', () => {
    expect(
      buildObsSourceUrl({
        path: 'obs/live-lottery',
        host: 'https://vtsuru.live/',
        credential: 'none',
        params: { code: 'h5-code' },
      }),
    ).toBe('https://vtsuru.live/obs/live-lottery?code=h5-code')
  })
})
