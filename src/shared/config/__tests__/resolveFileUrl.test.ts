import { describe, expect, it } from 'vitest'

import { getCurrentAPIUrl, resolveFileUrl, signFileUrl } from '../api'

describe('resolveFileUrl', () => {
  it('把 /f/{id} 拼到当前 API 源站', () => {
    const resolved = resolveFileUrl('/f/10')
    expect(resolved).toBe(new URL('/f/10', getCurrentAPIUrl()).href)
  })

  it('带 query 的预览地址同样拼接', () => {
    const resolved = resolveFileUrl('/f/10?token=abc')
    expect(resolved).toBe(new URL('/f/10?token=abc', getCurrentAPIUrl()).href)
  })

  it('绝对地址与无关路径原样返回', () => {
    expect(resolveFileUrl('https://files.vtsuru.suki.club/imgur/a.png')).toBe(
      'https://files.vtsuru.suki.club/imgur/a.png',
    )
    expect(resolveFileUrl('/file/old.png')).toBe('/file/old.png')
    expect(resolveFileUrl('')).toBe('')
  })
})

describe('signFileUrl', () => {
  it('给 /f/{id} 附加 sig', () => {
    const signed = signFileUrl('/f/10', 'jwt')
    expect(signed).toBe(`${new URL('/f/10', getCurrentAPIUrl()).href}?sig=jwt`)
  })

  it('没有 sig 时只做绝对化', () => {
    expect(signFileUrl('/f/10')).toBe(new URL('/f/10', getCurrentAPIUrl()).href)
  })

  it('已有 token 的预览地址不再加 sig', () => {
    expect(signFileUrl('/f/10?token=abc', 'jwt')).toBe(new URL('/f/10?token=abc', getCurrentAPIUrl()).href)
  })
})
