/* eslint-disable indent */
import { useLocalStorage } from '@vueuse/core'
import { APIRoot, PaginationResponse } from './api-models'

const cookie = useLocalStorage('JWT_Token', '')

export async function QueryPostAPI<T>(url: string, body?: unknown, headers?: [string, string][]): Promise<APIRoot<T>> {
  headers ??= []
  headers?.push(['Authorization', `Bearer ${cookie.value}`])
  headers?.push(['Content-Type', 'application/json'])

  const data = await fetch(url, {
    method: 'post',
    headers: headers,
    body: JSON.stringify(body),
  }) // 不处理异常, 在页面处理
  return (await data.json()) as APIRoot<T>
}
export async function QueryPostAPIWithParams<T>(urlString: string, params?: any, body?: any, contentType?: string, headers?: [string, string][]): Promise<APIRoot<T>> {
  const url = new URL(urlString)
  url.search = new URLSearchParams(params).toString()
  headers ??= []
  headers?.push(['Authorization', `Bearer ${cookie.value}`])
  if (contentType) headers?.push(['Content-Type', contentType])

  const data = await fetch(url, {
    method: 'post',
    headers: headers,
    body: body,
  }) // 不处理异常, 在页面处理
  return (await data.json()) as APIRoot<T>
}
export async function QueryGetAPI<T>(urlString: string, params?: any, headers?: [string, string][]): Promise<APIRoot<T>> {
  const url = new URL(urlString)
  url.search = new URLSearchParams(params).toString()
  if (cookie.value) {
    headers ??= []
    headers?.push(['Authorization', `Bearer ${cookie.value}`])
  }
  const data = await fetch(url.toString(), {
    method: 'get',
    headers: headers,
  }) // 不处理异常, 在页面处理
  return (await data.json()) as APIRoot<T>
}
export async function QueryPostPaginationAPI<T>(url: string, body?: unknown): Promise<APIRoot<PaginationResponse<T>>> {
  return await QueryPostAPI<PaginationResponse<T>>(url, body)
}
export async function QueryGetPaginationAPI<T>(urlString: string, params?: unknown): Promise<APIRoot<PaginationResponse<T>>> {
  return await QueryGetAPI<PaginationResponse<T>>(urlString, params)
}
