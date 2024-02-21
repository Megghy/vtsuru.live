/* eslint-disable indent */
import { useLocalStorage } from '@vueuse/core'
import { APIRoot, PaginationResponse } from './api-models'
import { apiFail } from '@/data/constants'

const cookie = useLocalStorage('JWT_Token', '')
let failCount = 0

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
  const url = new URL(urlString)
  url.search = getParams(params)
  headers ??= []
  headers?.push(['Authorization', `Bearer ${cookie.value}`])

  if (contentType) headers?.push(['Content-Type', contentType])

  try {
    const data = await fetch(url, {
      method: 'post',
      headers: headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
    const result = (await data.json()) as APIRoot<T>
    failCount = 0
    return result
  } catch (e) {
    console.error(`[POST] API调用失败: ${e}`)
    failCount++
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
  const url = new URL(urlString)
  url.search = getParams(params)
  if (cookie.value) {
    headers ??= []
    headers?.push(['Authorization', `Bearer ${cookie.value}`])
  }
  try {
    const data = await fetch(url.toString(), {
      method: 'get',
      headers: headers,
    })
    const result = (await data.json()) as APIRoot<T>
    failCount = 0
    return result
  } catch (e) {
    console.error(`[GET] API调用失败: ${e}`)
    failCount++
    if (!apiFail.value) {
      apiFail.value = true
      console.log('默认API异常, 切换至故障转移节点')
    }
    throw e
  }
}
function getParams(params?: [string, string][]) {
  const urlParams = new URLSearchParams(window.location.search)
  const resultParams = new URLSearchParams(params)
  if (urlParams.has('as')) {
    resultParams.set('as', urlParams.get('as') || '')
  }
  return resultParams.toString()
}
export async function QueryPostPaginationAPI<T>(url: string, body?: unknown): Promise<APIRoot<PaginationResponse<T>>> {
  return await QueryPostAPI<PaginationResponse<T>>(url, body)
}
export async function QueryGetPaginationAPI<T>(
  urlString: string,
  params?: unknown,
): Promise<APIRoot<PaginationResponse<T>>> {
  return await QueryGetAPI<PaginationResponse<T>>(urlString, params)
}
