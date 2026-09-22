import { readFileSync } from 'node:fs'

export interface FetcherFileConfig {
  Token?: string
  CookieCloudKey?: string
  CookieCloudPassword?: string
  CookieCloudHost?: string
  Cookie?: string
}

export interface CookieCloudConfig {
  key: string
  password: string
  host: string
}

export interface FetcherSettings {
  tokens: string[]
  cookie?: string
  cookieCloud?: CookieCloudConfig
  apiBaseUrl?: string
  failoverBaseUrl?: string
}

export function parseCookieCloud(value: string): CookieCloudConfig {
  const parts = value.split('@')
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('COOKIE_CLOUD 格式错误，应为 KEY@PASSWORD')
  }
  return { key: parts[0], password: parts[1], host: 'https://cookie.suki.club/' }
}

export function loadFetcherSettings(env: NodeJS.ProcessEnv, file: FetcherFileConfig = {}): FetcherSettings {
  const token = env.VTSURU_TOKEN || file.Token || ''
  const tokens = token
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (tokens.length === 0) throw new Error('未设置 VTSURU_TOKEN')

  const cookie = env.BILI_COOKIE || file.Cookie || undefined
  let cookieCloud: CookieCloudConfig | undefined
  if (env.COOKIE_CLOUD) {
    cookieCloud = parseCookieCloud(env.COOKIE_CLOUD)
  } else if (file.CookieCloudKey && file.CookieCloudPassword) {
    cookieCloud = {
      key: file.CookieCloudKey,
      password: file.CookieCloudPassword,
      host: 'https://cookie.suki.club/',
    }
  }
  if (cookieCloud) cookieCloud.host = env.COOKIE_CLOUD_HOST || file.CookieCloudHost || cookieCloud.host

  return {
    tokens,
    cookie,
    cookieCloud,
    apiBaseUrl: env.VTSURU_DEFAULT_URL,
    failoverBaseUrl: env.VTSURU_FAILOVER_URL,
  }
}

export function readConfigFile(path: string | undefined): FetcherFileConfig {
  if (!path) return {}
  return JSON.parse(readFileSync(path, 'utf8')) as FetcherFileConfig
}
