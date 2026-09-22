export const DEFAULT_API_BASE = 'https://api.vtsuru.suki.club/'
export const FAILOVER_API_BASE = 'https://failover-api.vtsuru.suki.club/'

export function createApiSelector(primary = DEFAULT_API_BASE, failover = FAILOVER_API_BASE) {
  let failUseCount = 0
  return {
    current() {
      if (failUseCount > 0) {
        failUseCount -= 1
        return failover
      }
      return primary
    },
    fail() {
      failUseCount = 3
    },
    get remaining() {
      return failUseCount
    },
  }
}

export function withToken(url: string, token: string) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}token=${encodeURIComponent(token)}`
}
