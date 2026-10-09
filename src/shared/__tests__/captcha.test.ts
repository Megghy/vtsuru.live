import { describe, expect, it, vi } from 'vitest'

import { isCaptchaDenied, parseCapExpiresAtMs, requestWithCaptchaRetry } from '../captcha'

function jwtPayload(payload: unknown) {
  const body = btoa(JSON.stringify(payload)).replace(/=+$/, '')
  return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${body}.sig`
}

describe('parseCapExpiresAtMs', () => {
  it('reads JWT exp as unix seconds', () => {
    expect(parseCapExpiresAtMs(jwtPayload({ exp: 1_790_676_822 }))).toBe(1_790_676_822_000)
  })

  it('accepts millisecond timestamps', () => {
    expect(parseCapExpiresAtMs(jwtPayload({ exp: 1_790_676_822_000 }))).toBe(1_790_676_822_000)
  })

  it('returns undefined for invalid tokens', () => {
    expect(parseCapExpiresAtMs('')).toBeUndefined()
    expect(parseCapExpiresAtMs('not-a-jwt')).toBeUndefined()
    expect(parseCapExpiresAtMs(jwtPayload({}))).toBeUndefined()
  })
})

describe('isCaptchaDenied', () => {
  it('detects backend captcha failures', () => {
    expect(isCaptchaDenied({ code: 403, message: '人机验证失败' })).toBe(true)
    expect(isCaptchaDenied(new Error('人机验证失败'))).toBe(true)
  })

  it('ignores unrelated failures', () => {
    expect(isCaptchaDenied({ code: 403, message: 'forbidden' })).toBe(false)
    expect(isCaptchaDenied({ code: 400, message: '用户名已存在' })).toBe(false)
    expect(isCaptchaDenied({ code: 200, message: 'ok' })).toBe(false)
  })
})

describe('requestWithCaptchaRetry', () => {
  it('returns the first success without refreshing', async () => {
    const refresh = vi.fn()
    const request = vi.fn().mockResolvedValue({ code: 200, data: 1 })
    await expect(
      requestWithCaptchaRetry({
        getToken: () => 't1',
        refresh,
        request,
      }),
    ).resolves.toEqual({ code: 200, data: 1 })
    expect(request).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('refreshes once after captcha 403 then succeeds', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ code: 403, message: '人机验证失败' })
      .mockResolvedValueOnce({ code: 200, data: 2 })
    const refresh = vi.fn().mockResolvedValue('t2')
    await expect(
      requestWithCaptchaRetry({
        getToken: () => 't1',
        refresh,
        request,
      }),
    ).resolves.toEqual({ code: 200, data: 2 })
    expect(request).toHaveBeenNthCalledWith(1, 't1')
    expect(request).toHaveBeenNthCalledWith(2, 't2')
  })

  it('does not retry non-captcha failures', async () => {
    const request = vi.fn().mockResolvedValue({ code: 400, message: '用户名已存在' })
    const refresh = vi.fn()
    await expect(
      requestWithCaptchaRetry({
        getToken: () => 't1',
        refresh,
        request,
      }),
    ).resolves.toEqual({ code: 400, message: '用户名已存在' })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('retries when the request throws a captcha error', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('人机验证失败')).mockResolvedValueOnce({ code: 200 })
    const refresh = vi.fn().mockResolvedValue('t2')
    await expect(
      requestWithCaptchaRetry({
        getToken: () => 't1',
        refresh,
        request,
      }),
    ).resolves.toEqual({ code: 200 })
    expect(request).toHaveBeenCalledTimes(2)
  })
})
