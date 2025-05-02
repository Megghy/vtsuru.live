/* eslint-disable indent */
import { apiFail } from '@/data/constants'
import { useLocalStorage } from '@vueuse/core'
import { APIRoot, PaginationResponse } from './api-models'
import { cookie } from './account';

export async function QueryPostAPI<T>(
  urlString: string,
  body?: unknown,
  headers?: [string, string][],
  contentType?: string
): Promise<APIRoot<T>> {
  return await QueryPostAPIWithParams<T>(
    urlString,
    undefined,
    body,
    contentType || 'application/json',
    headers
  )
}
export async function QueryPostAPIWithParams<T>(
  urlString: string,
  params?: any,
  body?: any,
  contentType?: string,
  headers?: [string, string][]
): Promise<APIRoot<T>> {
  // @ts-expect-error 忽略
  return await QueryPostAPIWithParamsInternal<APIRoot<T>>(
    urlString,
    params,
    body,
    contentType,
    headers
  )
}
async function QueryPostAPIWithParamsInternal<T>(
  urlString: string,
  params?: any,
  body?: any,
  contentType: string = 'application/json',
  headers: [string, string][] = []
) {
  let url: URL
  try {
    url = new URL(urlString.toString())
  } catch (e) {
    console.error('尝试解析API地址失败: ' + urlString, e)
    return {
      code: 400,
      message: '无效的API地址: ' + urlString,
      data: {} as T
    }
  }
  url.search = getParams(params)
  headers ??= []
  let h = {} as { [key: string]: string }
  headers.forEach((header) => {
    h[header[0]] = header[1]
  })
  if (cookie.value.cookie) h['Authorization'] = `Bearer ${cookie.value.cookie}`

  // 当使用FormData时，不手动设置Content-Type，让浏览器自动添加boundary
  if (!(body instanceof FormData)) {
    h['Content-Type'] = contentType
  }

  return await QueryAPIInternal<T>(url, {
    method: 'post',
    headers: h,
    body: body instanceof FormData ? body : typeof body === 'string' ? body : JSON.stringify(body)
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
  headers?: [string, string][]
): Promise<APIRoot<T>> {
  // @ts-expect-error 忽略
  return await QueryGetAPIInternal<APIRoot<T>>(urlString, params, headers)
}
async function QueryGetAPIInternal<T>(
  urlString: string,
  params?: any,
  headers?: [string, string][]
) {
  try {
    let url: URL
    try {
      url = new URL(urlString.toString())
    } catch (e) {
      console.error('尝试解析API地址失败: ' + urlString, e)
      return {
        code: 400,
        message: '无效的API地址: ' + urlString,
        data: {} as T
      }
    }
    url.search = getParams(params)
    headers ??= []
    let h = {} as { [key: string]: string }
    headers.forEach((header) => {
      h[header[0]] = header[1]
    })
    if (cookie.value.cookie) {
      h['Authorization'] = `Bearer ${cookie.value.cookie}`
    }
    return await QueryAPIInternal<T>(url, { method: 'get', headers: h })
  } catch (err) {
    console.log(`url:${urlString}, error:${err}`)
    throw err
  }
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
export async function QueryPostPaginationAPI<T>(
  url: string,
  body?: unknown
): Promise<PaginationResponse<T>> {
  // @ts-expect-error 忽略
  return await QueryPostAPIWithParamsInternal<PaginationResponse<T>>(
    url,
    undefined,
    body
  )
}
export async function QueryGetPaginationAPI<T>(
  urlString: string,
  params?: unknown
): Promise<PaginationResponse<T>> {
  // @ts-expect-error 忽略
  return await QueryGetAPIInternal<PaginationResponse<T>>(urlString, params)
}
export function GetHeaders(): [string, string][] {
  return [['Authorization', `Bearer ${cookie.value?.cookie}`]]
}
