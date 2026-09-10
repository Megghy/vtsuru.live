export type ObsCredential = 'public-id' | 'token' | 'none'

export interface BuildObsSourceUrlOptions {
  path: string
  host: string
  credential: ObsCredential
  userId?: number | string | null
  token?: string | null
  params?: Record<string, string | number | boolean | null | undefined>
}

export function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) return firstQueryValue(value[0])
  if (value === undefined || value === null) return ''
  return String(value)
}

export function parsePositiveId(value: unknown): string {
  const raw = firstQueryValue(value).trim()
  if (!raw) return ''
  const id = Number(raw)
  return Number.isFinite(id) && id > 0 ? String(Math.trunc(id)) : ''
}

export function buildObsSourceUrl(options: BuildObsSourceUrlOptions): string {
  const params = new URLSearchParams()

  if (options.credential === 'public-id') {
    const id = parsePositiveId(options.userId)
    if (!id) return ''
    params.set('id', id)
  } else if (options.credential === 'token') {
    const token = options.token?.trim()
    if (!token) return ''
    params.set('token', token)
  }

  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value === undefined || value === null || value === '') continue
      params.set(key, String(value))
    }
  }

  const base = options.host.endsWith('/') ? options.host : `${options.host}/`
  const cleanPath = options.path.startsWith('/') ? options.path.slice(1) : options.path
  const query = params.toString()
  return query ? `${base}${cleanPath}?${query}` : `${base}${cleanPath}`
}
