import { describe, expect, it } from 'vitest'

import { shouldIgnoreSentryMessage } from '../sentry'

describe('shouldIgnoreSentryMessage', () => {
  const noise = [
    '尚未完成邮箱验证',
    '未登录',
    "Cannot read properties of undefined (reading 'takeRecords')",
    'Non-Error promise rejection captured with value: Command register_listener not found',
    'ResizeObserver loop limit exceeded',
    'Failed to fetch dynamically imported module: https://vtsuru.suki.club/assets/bootstrap-TZMM4tfK.js',
    'Unable to preload CSS for https://vtsuru.suki.club/assets/CaptchaWidget-0dVzkBpc.css',
    'Importing a module script failed.',
    "'text/html' is not a valid JavaScript MIME type for module script 'https://vtsuru.suki.club/assets/bootstrap-TZMM4tfK.js'.",
    "undefined is not an object (evaluating 'window.weixinPostMessageHandlers.weixinDispatchMessage.postMessage')",
    'Failed to load Turnstile.',
    '[Cloudflare Turnstile] Nothing to reset found for provided container.',
    'Non-Error promise rejection captured with value: runtime error: failed to receive message from webview',
    '网络请求失败',
    'Failed to fetch (failover-api.vtsuru.suki.club)',
    'Non-Error promise rejection captured with value: Command plugin:window|set_focus not allowed by ACL',
    "Cannot send data if the connection is not in the 'Connected' State.",
    "Cannot read properties of null (reading 'contains')",
  ]

  it('过滤已知噪音', () => {
    for (const message of noise) {
      expect(shouldIgnoreSentryMessage(message), message).toBe(true)
    }
  })

  it('不误伤真实业务错误', () => {
    expect(shouldIgnoreSentryMessage("Cannot read properties of undefined (reading 'close')")).toBe(false)
    expect(shouldIgnoreSentryMessage("Cannot read properties of null (reading 'scrollHeight')")).toBe(false)
    expect(shouldIgnoreSentryMessage("Cannot read properties of undefined (reading 'style')")).toBe(false)
    expect(shouldIgnoreSentryMessage('Unterminated string in JSON at position 2186')).toBe(false)
  })
})
