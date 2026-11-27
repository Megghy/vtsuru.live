import type { RouteLocationRaw } from 'vue-router'

export const DEFAULT_USER_HOME = '/manage/user/points'

/**
 * 校验并净化站内回跳路径，仅允许以单个 `/` 开头的相对路径，防止开放重定向或回到认证页死循环。
 */
export function sanitizeRedirectPath(raw: unknown, fallback = DEFAULT_USER_HOME): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback
  }
  if (trimmed === '/bili-auth' || trimmed.startsWith('/bili-auth?') || trimmed.startsWith('/bili-auth#')) {
    return fallback
  }
  return trimmed
}

export function buildBiliAuthRoute(redirect?: string | null): RouteLocationRaw {
  const safe = sanitizeRedirectPath(redirect, '')
  return safe
    ? { name: 'bili-auth', query: { redirect: safe } }
    : { name: 'bili-auth' }
}
