/* eslint-disable indent */
import { useLocalStorage } from '@vueuse/core'
import { APIRoot, PaginationResponse } from './api-models'
import { apiFail } from '@/data/constants'

const cookie = useLocalStorage('JWT_Token', '')

export async function QueryPostAPI<T>(
  urlString: string,
  body?: unknown,
  headers?: [string, string][],
): Promise<APIRoot<T>> {
  return await QueryPostAPIWithParams<T>(urlString, undefined, body, 'application/json', headers)
}
export async function QueryPostAPIWithParams<T>(
  urlString: string,
  params?: any,
  body?: any,
  contentType?: string,
  headers?: [string, string][],
): Promise<APIRoot<T>> {
  return await QueryPostAPIWithParamsInternal<APIRoot<T>>(urlString, params, body, contentType, headers)
}
async function QueryPostAPIWithParamsInternal<T>(
  urlString: string,
  params?: any,
  body?: any,
  contentType: string = 'application/json',
  headers: [string, string][] = [],
) {
  const url = new URL(urlString)
  url.search = getParams(params)
  headers ??= []
  if (cookie.value) headers?.push(['Authorization', `Bearer ${cookie.value}`])

  if (contentType) headers?.push(['Content-Type', contentType])
  return await QueryAPIInternal<T>(url, {
    method: 'post',
    headers: headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}
async function QueryAPIInternal<T>(url: URL, init: RequestInit) {
  try {
    const data = await fetch(url, init)
    const result = (await data.json()) as T
    return result
  } catch (e) {
    console.error(`[${init.method}] API调用失败: ${e}`)
    if (!apiFail.value) {
      apiFail.value = true
      console.log('默认API异常, 切换至故障转移节点')
    }
    throw e
  }
}
export async function QueryGetAPI<T>(
  urlString: string,
  params?: any,
  headers?: [string, string][],
): Promise<APIRoot<T>> {
  return await QueryGetAPIInternal<APIRoot<T>>(urlString, params, headers)
}
async function QueryGetAPIInternal<T>(urlString: string, params?: any, headers?: [string, string][]) {
  const url = new URL(urlString)
  url.search = getParams(params)
  if (cookie.value) {
    headers ??= []
    if (cookie.value) headers?.push(['Authorization', `Bearer ${cookie.value}`])
  }
  return await QueryAPIInternal<T>(url, {
    method: 'get',
    headers: headers,
  })
}
function getParams(params: any) {
  const urlParams = new URLSearchParams(window.location.search)

  if (params) {
    const keys = Object.keys(params)
    if (keys.length > 0) {
      keys.forEach((k) => {
        if (params[k] == undefined) {
          delete params[k]
        }
      })
    }
  }

  const resultParams = new URLSearchParams(params)
  if (urlParams.has('as')) {
    resultParams.set('as', urlParams.get('as') || '')
  }
  if (urlParams.has('token')) {
    resultParams.set('token', urlParams.get('token') || '')
  }
  return resultParams.toString()
}
export async function QueryPostPaginationAPI<T>(url: string, body?: unknown): Promise<PaginationResponse<T>> {
  return await QueryPostAPIWithParamsInternal<PaginationResponse<T>>(url, undefined, body)
}
export async function QueryGetPaginationAPI<T>(urlString: string, params?: unknown): Promise<PaginationResponse<T>> {
  return await QueryGetAPIInternal<PaginationResponse<T>>(urlString, params)
}
export function GetHeaders(): [string, string][] {
  return [['Authorization', `Bearer ${cookie.value}`]]
}
