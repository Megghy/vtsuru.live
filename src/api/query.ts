/* eslint-disable indent */
import { APIRoot, PaginationResponse } from './api-models'

export async function QueryPostAPI<T>(url: string, body?: unknown): Promise<APIRoot<T>> {
  const data = await fetch(url, {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }) // 不处理异常, 在页面处理
  return (await data.json()) as APIRoot<T>
}
export async function QueryGetAPI<T>(urlString: string, params?: any): Promise<APIRoot<T>> {
  const url = new URL(urlString)
  url.search = new URLSearchParams(params).toString()
  const data = await fetch(url.toString()) // 不处理异常, 在页面处理
  return (await data.json()) as APIRoot<T>
}
export async function QueryPostPaginationAPI<T>(url: string, body?: unknown): Promise<APIRoot<PaginationResponse<T>>> {
  return await QueryPostAPI<PaginationResponse<T>>(url, body)
}
export async function QueryGetPaginationAPI<T>(urlString: string, params?: any): Promise<APIRoot<PaginationResponse<T>>> {
  return await QueryGetAPI<PaginationResponse<T>>(urlString, params)
}
