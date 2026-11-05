import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  extractCookieFromUrl,
  mergeCookies,
} from '../biliLogin'
import {
  buildCookie,
  checkNeedRefresh,
  extractRefreshCsrf,
  getCorrespondPath,
  parseCookie,
  refreshBiliCookieAsync,
} from '../cookieRefresh'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
}))

vi.mock('../utils', () => ({
  QueryBiliAPI: vi.fn(async (url: string, method = 'GET', _cookie = '', _useCookie = true, body?: any) => {
    // 检查刷新状态
    if (url.includes('/web/cookie/info')) {
      return {
        json: async () => ({
          code: 0,
          data: {
            refresh: true,
            timestamp: 1730000000000,
          },
        }),
      }
    }

    // 获取 refresh_csrf 页面
    if (url.includes('/correspond/1/')) {
      return {
        text: async () => '<html><body><div id="1-name">0123456789abcdef0123456789abcdef</div></body></html>',
      }
    }

    // 换票接口
    if (url.includes('/web/cookie/refresh')) {
      const headers = new Map<string, string>()
      headers.set(
        'set-cookie',
        'SESSDATA=new_sess_token; Path=/; Domain=.bilibili.com, bili_jct=new_csrf_token; Path=/',
      )
      return {
        headers: {
          get: (key: string) => (key.toLowerCase() === 'set-cookie' ? headers.get('set-cookie') : null),
        },
        json: async () => ({
          code: 0,
          data: {
            refresh_token: 'new_refresh_token_123',
          },
        }),
      }
    }

    // 确认换票接口
    if (url.includes('/web/confirm/refresh')) {
      return {
        json: async () => ({ code: 0 }),
      }
    }

    return {
      json: async () => ({ code: -404 }),
    }
  }),
}))

describe('cookieRefresh 与扫码登录 Cookie 提取工具', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('extractCookieFromUrl 能够从 crossDomain URL 提取所有核心凭据', () => {
    const url =
      'https://passport.biligame.com/crossDomain?DedeUserID=12345&DedeUserID__ckMd5=abc&Expires=1750000000&SESSDATA=sess_xyz&bili_jct=csrf_123&gourl=https%3A%2F%2Fwww.bilibili.com'
    const map = extractCookieFromUrl(url)
    expect(map.get('DedeUserID')).toBe('12345')
    expect(map.get('DedeUserID__ckMd5')).toBe('abc')
    expect(map.get('SESSDATA')).toBe('sess_xyz')
    expect(map.get('bili_jct')).toBe('csrf_123')
  })

  it('mergeCookies 能够融合 URL query 与响应头中的 Cookie 并去除多余属性', () => {
    const url = 'https://passport.biligame.com/crossDomain?DedeUserID=12345&SESSDATA=sess_xyz&bili_jct=csrf_123'
    const map = extractCookieFromUrl(url)
    const headerStr = 'sid=sid_abc; Path=/; Domain=.bilibili.com; HttpOnly'
    const merged = mergeCookies(map, headerStr)

    expect(merged).toContain('DedeUserID=12345')
    expect(merged).toContain('SESSDATA=sess_xyz')
    expect(merged).toContain('bili_jct=csrf_123')
    expect(merged).toContain('sid=sid_abc')
    expect(merged).not.toContain('Path=/')
    expect(merged).not.toContain('HttpOnly')
  })

  it('getCorrespondPath 原生 WebCrypto 能计算出 256 位十六进制 Hash', async () => {
    const hash = await getCorrespondPath(1730000000000)
    expect(typeof hash).toBe('string')
    expect(hash.length).toBe(256)
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true)
  })

  it('parseCookie 与 buildCookie 保持双向契约', () => {
    const raw = 'DedeUserID=12345; SESSDATA=abc; bili_jct=csrf'
    const map = parseCookie(raw)
    expect(map.get('DedeUserID')).toBe('12345')
    expect(map.get('SESSDATA')).toBe('abc')
    expect(map.get('bili_jct')).toBe('csrf')

    const rebuilt = buildCookie(map)
    expect(rebuilt).toContain('DedeUserID=12345')
    expect(rebuilt).toContain('SESSDATA=abc')
    expect(rebuilt).toContain('bili_jct=csrf')
  })

  it('extractRefreshCsrf 能从 HTML 标签中精准提取 32 位 hex', () => {
    const html = '<div><div id="1-name">0123456789abcdef0123456789abcdef</div></div>'
    const csrf = extractRefreshCsrf(html)
    expect(csrf).toBe('0123456789abcdef0123456789abcdef')
  })

  it('checkNeedRefresh 能正确解析刷新状态', async () => {
    const cookie = 'bili_jct=old_csrf;'
    const res = await checkNeedRefresh(cookie)
    expect(res.needRefresh).toBe(true)
    expect(res.timestamp).toBe(1730000000000)
  })

  it('refreshBiliCookieAsync 能完成自动换票全流程并返回新凭据', async () => {
    const cookie = 'DedeUserID=12345; bili_jct=old_csrf; SESSDATA=old_sess;'
    const refreshToken = 'old_refresh_token'

    const result = await refreshBiliCookieAsync(cookie, refreshToken, true)
    expect(result.success).toBe(true)
    expect(result.refreshed).toBe(true)
    expect(result.newRefreshToken).toBe('new_refresh_token_123')
    expect(result.newCookie).toContain('SESSDATA=new_sess_token')
    expect(result.newCookie).toContain('bili_jct=new_csrf_token')
    expect(result.newCookie).toContain('DedeUserID=12345')
  })
})
