export type CaptchaHandle = {
  reset: () => void
  remove?: () => void
  refresh: () => Promise<string>
}

const CAPTCHA_FAIL_HINT = '人机验证'

export function parseCapExpiresAtMs(token: string): number | undefined {
  if (!token) return undefined
  const parts = token.split('.')
  if (parts.length < 2) return undefined
  try {
    const payload = JSON.parse(atob(padBase64(parts[1]))) as { exp?: number; expires?: number }
    const expiresAt = payload.exp ?? payload.expires
    if (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || expiresAt <= 0) return undefined
    return expiresAt < 1e12 ? expiresAt * 1000 : expiresAt
  } catch {
    return undefined
  }
}

export function isCaptchaDenied(value: unknown): boolean {
  if (!value) return false
  if (value instanceof Error) return value.message.includes(CAPTCHA_FAIL_HINT)
  if (typeof value === 'object') {
    const record = value as { code?: number; message?: string }
    if (typeof record.message === 'string' && record.message.includes(CAPTCHA_FAIL_HINT)) return true
  }
  return false
}

export function refreshCaptcha(handle: CaptchaHandle | null | undefined): Promise<string> {
  if (!handle?.refresh) throw new Error('请先完成人机验证')
  return handle.refresh()
}

export async function requestWithCaptchaRetry<T>(options: {
  getToken: () => string
  refresh?: () => Promise<string>
  request: (token: string) => Promise<T>
  isDenied?: (result: T) => boolean
}): Promise<T> {
  const isDenied = options.isDenied ?? isCaptchaDenied
  const run = (token: string) => options.request(token)
  const refresh = options.refresh

  try {
    const first = await run(options.getToken())
    if (!isDenied(first) || !refresh) return first
  } catch (error) {
    if (!refresh || !isCaptchaDenied(error)) throw error
    return run(await refresh())
  }

  return run(await refresh())
}

function padBase64(value: string) {
  const normalized = value.trim().replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4
  return pad ? `${normalized}${'='.repeat(4 - pad)}` : normalized
}
