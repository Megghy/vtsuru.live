const AUTH_PATTERN = /(?:^|[#&])auth=([^&#\s]*)/

export function createBiliAuthUrl(host: string, token: string) {
  return `${host}bili-user/points#auth=${encodeURIComponent(token)}`
}

export function hasBiliAuthInUrl(value: string) {
  return AUTH_PATTERN.test(value)
}

export function readBiliAuthFromUrl(value: string) {
  const match = value.match(AUTH_PATTERN)
  if (!match) return undefined
  if (!match[1]) throw new Error('认证链接中没有凭据')

  try {
    return decodeURIComponent(match[1])
  } catch {
    throw new Error('认证链接格式无效')
  }
}

export function parseBiliAuthCredential(value: string) {
  const input = value.trim()
  if (!input) throw new Error('认证凭据不能为空')

  const token = readBiliAuthFromUrl(input)
  if (token) return token
  if (input.includes('://')) throw new Error('认证链接中没有找到凭据')
  return input
}
