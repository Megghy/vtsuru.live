const BILI_HOST = 'bilibili.com'

export interface ClientRequestResult {
  Success: boolean
  Message: string
  Data: string
}

export function isBilibiliUrl(url: string) {
  const host = new URL(url).hostname.toLowerCase()
  return host === BILI_HOST || host.endsWith(`.${BILI_HOST}`)
}

export async function requestBilibili(input: {
  url: string
  method?: string
  body?: string | null
  useCookie: boolean
  cookieEnabled: boolean
  cookie?: string
  fetch?: typeof fetch
}): Promise<ClientRequestResult> {
  if (!isBilibiliUrl(input.url)) return { Success: false, Message: '请求失败: 非bilibili域名', Data: '' }
  if (input.useCookie && !input.cookieEnabled) return { Success: false, Message: '未启用cookie', Data: '' }

  const headers: Record<string, string> = {}
  if (input.useCookie && input.cookie) headers.Cookie = input.cookie
  if (input.body) headers['Content-Type'] = 'application/json'

  try {
    const response = await (input.fetch ?? fetch)(input.url, {
      method: input.method || 'GET',
      headers,
      body: input.body || undefined,
    })
    if (!response.ok) {
      return { Success: false, Message: `请求失败: ${response.status}, ${response.statusText}`, Data: '' }
    }
    return { Success: true, Message: '', Data: await response.text() }
  } catch (error) {
    return { Success: false, Message: `请求失败: ${error instanceof Error ? error.message : String(error)}`, Data: '' }
  }
}
