export interface CookieCloudCookie {
  name: string
  value: string
}

export function cookieHeader(cookies: CookieCloudCookie[]) {
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
}

export async function fetchCookieCloud(input: {
  host: string
  key: string
  password: string
  fetch?: typeof fetch
}) {
  const fetchImpl = input.fetch ?? fetch
  const response = await fetchImpl(new URL(`/get/${input.key}`, input.host), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ password: input.password }),
  })
  if (!response.ok) throw new Error(`无法获取 Cookie: ${response.status}`)
  const json = (await response.json()) as {
    cookie_data?: { 'bilibili.com'?: CookieCloudCookie[] }
  }
  const cookies = json.cookie_data?.['bilibili.com']
  if (!cookies?.length) throw new Error('已从 CookieCloud 中获取数据, 但其中不存在 BiliBili 的 Cookie')
  return cookieHeader(cookies)
}
