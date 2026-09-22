export const FETCHER_VERSION = '1.0.8.0'

export const ErrorCodes = {
  ACCOUNT_NOT_BIND: 'Account.NotBind',
  ACCOUNT_UNABLE_GET_INFO: 'Account.UnableGet',
  OPEN_LIVE_UNABLE_START_GAME: 'OpenLive.UnableStart',
  COOKIE_CLIENT_UNABLE_GET_COOKIE: 'CookieClient.GetCookie',
  COOKIE_CLIENT_UNABLE_GET_USER_INFO: 'CookieClient.UnableGetInfo',
  NEW_VERSION: 'NewVersion',
  CLIENT_DISCONNECTED: 'Client.Disconnected',
  UNABLE_UPLOAD_EVENT: 'UnableUploadEvent',
  UNABLE_CONNECTTOHUB: 'UnableConnectToHub',
} as const

export function isNewerVersion(remote: string, local: string) {
  const left = remote.split('.').map((part) => Number(part) || 0)
  const right = local.split('.').map((part) => Number(part) || 0)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index++) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0)
    if (delta !== 0) return delta > 0
  }
  return false
}
