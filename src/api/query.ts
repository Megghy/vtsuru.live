import type { APIRoot, PaginationResponse } from './api-models'
import { apiFail, mapToCurrentAPI } from '@/shared/config'
import { cookie } from './auth'

export function unwrapOk<T>(resp: { code: number, message?: string, data: T }, failMessage: string): T {
  if (resp.code !== 200) throw new Error(resp.message || failMessage)
  return resp.data
}

export type QueryRequestOptions = {
  signal?: AbortSignal
  timeoutMs?: number
  retryOnFailover?: boolean
}

export class QueryRequestError extends Error {
  constructor(
    public kind: 'timeout' | 'aborted' | 'network',
    message: string,
    public cause?: unknown,
  ) {
    super(message)
    this.name = 'QueryRequestError'
  }
}

function createRequestSignal(signal?: AbortSignal, timeoutMs?: number) {
  const controller = new AbortController()
  let didTimeout = false
  let timeoutId: number | undefined

  const abortFromParent = () => {
    controller.abort()
  }

  if (signal) {
    if (signal.aborted) {
      abortFromParent()
    } else {
      signal.addEventListener('abort', abortFromParent, { once: true })
    }
  }

  if (timeoutMs && timeoutMs > 0) {
    timeoutId = window.setTimeout(() => {
      didTimeout = true
      controller.abort()
    }, timeoutMs)
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }
      signal?.removeEventListener('abort', abortFromParent)
    },
    didTimeout: () => didTimeout,
  }
}

function toQueryRequestError(error: unknown, didTimeout: boolean) {
  if (error instanceof QueryRequestError) return error
  if (didTimeout) return new QueryRequestError('timeout', '请求超时', error)
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new QueryRequestError('aborted', '请求已取消', error)
  }
  return new QueryRequestError('network', '网络请求失败', error)
}

function buildAuthHeaders(headers?: [string, string][]) {
  const h: Record<string, string> = {}
  ;(headers ?? []).forEach((header) => {
    h[header[0]] = header[1]
  })
  if (cookie.value?.cookie) h.Authorization = `Bearer ${cookie.value.cookie}`
  return h
}

export type QueryParams =
  | Record<string, string | number | boolean | null | undefined>
  | URLSearchParams

function serializeBody(body: unknown) {
  if (body instanceof FormData) return body
  if (typeof body === 'string') return body
  return JSON.stringify(body)
}

export async function QueryPostAPI<T>(
  urlString: string,
  body?: unknown,
  headers?: [string, string][],
  contentType?: string,
  options?: QueryRequestOptions,
): Promise<APIRoot<T>> {
  return QueryPostAPIWithParams<T>(urlString, undefined, body, contentType, headers, options)
}

export async function QueryPostAPIWithParams<T>(
  urlString: string,
  params?: QueryParams,
  body?: unknown,
  contentType: string = 'application/json',
  headers?: [string, string][],
  options?: QueryRequestOptions,
): Promise<APIRoot<T>> {
  return QueryPostAPIWithParamsInternal<APIRoot<T>>(
    urlString,
    params,
    body,
    contentType,
    headers,
    options,
  )
}

async function QueryPostAPIWithParamsInternal<T>(
  urlString: string,
  params: QueryParams | undefined,
  body: unknown,
  contentType: string,
  headers: [string, string][] = [],
  options?: QueryRequestOptions,
): Promise<T> {
  let url: URL
  try {
    url = new URL(urlString.toString())
  } catch {
    throw new Error(`无效的API地址: ${urlString}`)
  }
  url.search = getParams(params)
  const h = buildAuthHeaders(headers)

  // 当使用FormData时，不手动设置Content-Type，让浏览器自动添加boundary
  if (!(body instanceof FormData)) {
    h['Content-Type'] = contentType
  }

  return QueryAPIInternal<T>(url, {
    method: 'post',
    headers: h,
    body: serializeBody(body),
  }, options)
}
async function QueryAPIInternal<T>(url: URL, init: RequestInit, options?: QueryRequestOptions) {
  const rawUrl = url.toString()
  const request = async () => {
    const mappedUrl = mapToCurrentAPI(rawUrl)
    const { signal, cleanup, didTimeout } = createRequestSignal(options?.signal, options?.timeoutMs)
    try {
      const data = await fetch(mappedUrl, { ...init, signal })
      return (await data.json()) as T
    } catch (error) {
      throw toQueryRequestError(error, didTimeout())
    } finally {
      cleanup()
    }
  }

  try {
    return await request()
  } catch (e) {
    console.error(`[${init.method}] API调用失败: ${e}`)
    const queryError = toQueryRequestError(e, false)
    if (queryError.kind !== 'aborted' && !apiFail.value) {
      apiFail.value = true
      console.log('默认API异常, 切换至故障转移节点')
      if (options?.retryOnFailover ?? true) {
        return request()
      }
    }
    throw queryError
  }
}
export async function QueryGetAPI<T>(
  urlString: string,
  params?: QueryParams,
  headers?: [string, string][],
  options?: QueryRequestOptions,
): Promise<APIRoot<T>> {
  return QueryGetAPIInternal<APIRoot<T>>(urlString, params, headers, options)
}
async function QueryGetAPIInternal<T>(
  urlString: string,
  params?: QueryParams,
  headers?: [string, string][],
  options?: QueryRequestOptions,
) {
  try {
    let url: URL
    try {
      url = new URL(urlString.toString())
    } catch {
      throw new Error(`无效的API地址: ${urlString}`)
    }
    url.search = getParams(params)
    const h = buildAuthHeaders(headers)
    return await QueryAPIInternal<T>(url, { method: 'get', headers: h }, options)
  } catch (err) {
    console.log(`url:${urlString}, error:${err}`)
    throw err
  }
}
function getParams(params?: QueryParams) {
  const urlParams = new URLSearchParams(window.location.search)

  // 避免修改调用方传入的 params，并过滤掉 undefined（URLSearchParams 会把它序列化成字符串 "undefined"）
  const resultParams = (() => {
    if (!params) return new URLSearchParams()
    if (params instanceof URLSearchParams) return new URLSearchParams(params.toString())

    const cleanedParams: Record<string, any> = {}
    Object.keys(params).forEach((k) => {
      if (params[k] !== undefined) cleanedParams[k] = params[k]
    })
    return new URLSearchParams(cleanedParams)
  })()

  // 全站透传 `as`（管理员模拟登录用），不覆盖调用方显式传入的参数
  if (urlParams.has('as') && !resultParams.has('as')) {
    resultParams.set('as', urlParams.get('as') || '')
  }

  // `token` 更敏感：仅在特定页面透传，避免普通页面意外把 token 带到所有请求中
  const pathname = window.location.pathname
  const allowTokenPassthrough = pathname.startsWith('/obs') || pathname === '/join'
  if (allowTokenPassthrough && urlParams.has('token') && !resultParams.has('token')) {
    resultParams.set('token', urlParams.get('token') || '')
  }

  return resultParams.toString()
}
export async function QueryPostPaginationAPI<T>(
  url: string,
  body?: unknown,
): Promise<PaginationResponse<T>> {
  return QueryPostAPIWithParamsInternal<PaginationResponse<T>>(
    url,
    undefined,
    body,
    'application/json',
  )
}
export async function QueryGetPaginationAPI<T>(
  urlString: string,
  params?: QueryParams,
): Promise<PaginationResponse<T>> {
  return QueryGetAPIInternal<PaginationResponse<T>>(urlString, params)
}
export function GetHeaders(): [string, string][] {
  if (!cookie.value?.cookie) return []
  return [['Authorization', `Bearer ${cookie.value.cookie}`]]
}
