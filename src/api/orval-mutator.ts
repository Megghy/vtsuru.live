import { BASE_URL } from '@/shared/config/api'

import type { APIRoot } from './api-models'
import {
  QueryDeleteAPI,
  QueryGetAPI,
  QueryPatchAPI,
  QueryPostAPIWithParams,
  type QueryParams,
  type QueryRequestOptions,
} from './query'

export type VtsuruMutatorInit = RequestInit & Pick<QueryRequestOptions, 'timeoutMs' | 'retryOnFailover'>

function toFullUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url
  const path = url.startsWith('/') ? url.slice(1) : url
  return `${BASE_URL}${path}`
}

function headerTuples(headers?: HeadersInit): [string, string][] | undefined {
  if (!headers) return undefined
  let entries: [string, string][]
  if (headers instanceof Headers) entries = [...headers.entries()]
  else if (Array.isArray(headers)) entries = headers.map(([k, v]) => [k, String(v)])
  else
    entries = Object.entries(headers)
      .filter(([, v]) => v != null)
      .map(([k, v]) => [k, String(v)])
  return entries.length ? entries : undefined
}

function splitUrl(url: string): { endpoint: string; params: QueryParams } {
  const parsed = new URL(toFullUrl(url))
  const params: Record<string, string> = {}
  parsed.searchParams.forEach((value, key) => {
    params[key] = value
  })
  return { endpoint: `${parsed.origin}${parsed.pathname}`, params }
}

function parseBody(init?: RequestInit): unknown {
  const body = init?.body
  if (body == null || body instanceof FormData) return body ?? undefined
  if (typeof body !== 'string') return body
  const contentType = headerTuples(init?.headers)?.find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? ''
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(body)
    } catch {
      return body
    }
  }
  return body
}

/** orval fetch mutator：`(url, init)`，走 Query*，返回信封不 unwrap。 */
export async function vtsuruMutator<T = APIRoot<unknown>>(url: string, init?: VtsuruMutatorInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const { endpoint, params } = splitUrl(url)
  const body = parseBody(init)
  const headers =
    body instanceof FormData
      ? headerTuples(init?.headers)?.filter(([key]) => key.toLowerCase() !== 'content-type')
      : headerTuples(init?.headers)
  const options: QueryRequestOptions = {
    signal: init?.signal ?? undefined,
    timeoutMs: init?.timeoutMs,
    retryOnFailover: init?.retryOnFailover,
  }

  if (method === 'GET') return (await QueryGetAPI(endpoint, params, headers, options)) as T
  if (method === 'DELETE') return (await QueryDeleteAPI(endpoint, params, headers, options)) as T
  if (method === 'PATCH') return (await QueryPatchAPI(endpoint, body, headers, options)) as T
  return (await QueryPostAPIWithParams(endpoint, params, body, 'application/json', headers, options)) as T
}

export default vtsuruMutator
