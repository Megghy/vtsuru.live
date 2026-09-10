import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { BiliAuthModel, ResponsePointGoodModel } from '@/api/api-models'
import type { QueryParams, QueryRequestOptions } from '@/api/query'
import { QueryGetAPI, QueryPostAPI, QueryPostAPIWithParams } from '@/api/query'
import { BILI_AUTH_API_URL, POINT_API_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'

export const useBiliAuth = defineStore('BiliAuth', () => {
  type SessionResponse = {
    token: string
    expiresAt: number | null
  }
  const biliAuth = ref<BiliAuthModel>({} as BiliAuthModel)

  const biliTokens = usePersistedStorage<
    {
      id: number
      uId: number
      name?: string
      token: string
    }[]
  >('Bili.Auth.Tokens', [])
  let resolveCurrentTokenReady!: () => void
  const currentTokenReady = new Promise<void>((resolve) => {
    resolveCurrentTokenReady = resolve
  })
  const currentToken = usePersistedStorage<string>('Bili.Auth.Selected', null, {
    onReady: resolveCurrentTokenReady,
  })

  const isLoading = ref(false)
  const isAuthed = computed(() => biliAuth.value.id > 0 || Boolean(currentToken.value))
  const isInvalid = ref(false)
  const legacyToken = ref<string | null>(null)
  const replacementToken = ref<string | null>(null)
  const requiresLegacyMigration = computed(() => Boolean(legacyToken.value || replacementToken.value))

  let pendingAuthInfoPromise: Promise<boolean> | null = null

  async function setCurrentAuth(token: string) {
    if (!token) {
      console.warn('[bili-auth] 无效的token')
      return
    }
    await currentTokenReady
    biliAuth.value = {} as BiliAuthModel
    currentToken.value = token
    legacyToken.value = null
    replacementToken.value = null
    isInvalid.value = false
    await getAuthInfo()
  }

  async function getAuthInfo(): Promise<boolean> {
    if (pendingAuthInfoPromise) {
      return pendingAuthInfoPromise
    }

    pendingAuthInfoPromise = (async () => {
      try {
        isLoading.value = true
        await currentTokenReady

        if (!currentToken.value) {
          biliAuth.value = {} as BiliAuthModel
          isInvalid.value = false
          return false
        }

        const data = await QueryBiliAuthGetAPI<BiliAuthModel>(`${BILI_AUTH_API_URL}info`)
        if (data.code == 200) {
          biliAuth.value = data.data
          console.log('[bili-auth] 已获取 Bilibili 认证信息')
          if (currentToken.value) {
            const index = biliTokens.value.findIndex((t) => t.id == biliAuth.value.id)
            const account = {
              id: biliAuth.value.id,
              token: currentToken.value,
              name: biliAuth.value.name,
              uId: biliAuth.value.userId,
            }
            if (index >= 0) {
              biliTokens.value[index] = account
            } else {
              biliTokens.value.push(account)
              console.log(`添加新的认证账户: ${biliAuth.value.userId}`)
            }
          }
          isInvalid.value = false
          return true
        } else {
          console.error(`[bili-auth] 无法获取 Bilibili 认证信息: ${data.message}`)
          isInvalid.value = true
          if (currentToken.value && data.message === '旧版认证链接需要迁移') {
            legacyToken.value = currentToken.value
          }
          return false
        }
      } catch (err) {
        console.error(`[bili-auth] 无法获取 Bilibili 认证信息: ${err}`)
        return false
      } finally {
        isLoading.value = false
        pendingAuthInfoPromise = null
      }
    })()

    return pendingAuthInfoPromise
  }

  async function migrateLegacyToken() {
    if (!legacyToken.value) return false
    const response = await QueryPostAPI<SessionResponse>(`${BILI_AUTH_API_URL}migrate`, { token: legacyToken.value })
    if (response.code !== 200) return false

    currentToken.value = response.data.token
    legacyToken.value = null
    replacementToken.value = response.data.token
    await getAuthInfo()
    return true
  }

  function finishLegacyMigration() {
    replacementToken.value = null
  }

  async function rotateSession() {
    const response = await QueryBiliAuthPostAPI<SessionResponse>(`${BILI_AUTH_API_URL}session/rotate`)
    if (response.code !== 200) return false

    currentToken.value = response.data.token
    await getAuthInfo()
    return true
  }

  async function getBiliAuthHeaders(headers?: [string, string][]) {
    await currentTokenReady
    const result = [...(headers ?? [])]
    if (currentToken.value && result.find((h) => h[0].toLowerCase() == 'bili-auth') == null) {
      result.push(['Bili-Auth', currentToken.value ?? ''])
    }
    return result
  }

  async function QueryBiliAuthGetAPI<T>(url: string, params?: any, headers?: [string, string][]) {
    const resolvedHeaders = await getBiliAuthHeaders(headers)
    return QueryGetAPI<T>(url, params, resolvedHeaders)
  }

  async function QueryBiliAuthPostAPI<T>(url: string, body?: unknown, headers?: [string, string][]) {
    const resolvedHeaders = await getBiliAuthHeaders(headers)
    return QueryPostAPI<T>(url, body, resolvedHeaders)
  }

  async function QueryBiliAuthPostAPIWithParams<T>(
    url: string,
    params?: QueryParams,
    body?: unknown,
    contentType: string = 'application/json',
    headers?: [string, string][],
    options?: QueryRequestOptions,
  ) {
    const resolvedHeaders = await getBiliAuthHeaders(headers)
    return QueryPostAPIWithParams<T>(url, params, body, contentType, resolvedHeaders, options)
  }

  async function GetSpecificPoint(id: number) {
    try {
      const data = await QueryBiliAuthGetAPI<number>(`${POINT_API_URL}user/get-point`, { id })
      if (data.code == 200) {
        return data.data
      } else {
        console.error(`[point] 无法获取在指定直播间拥有的积分: ${data.message}`)
      }
    } catch (err) {
      console.error(`[point] 无法获取在指定直播间拥有的积分: ${err}`)
    }
    return null
  }

  async function GetGoods(id: number | undefined = undefined, message?: MessageApiInjection) {
    if (!id) {
      return []
    }
    try {
      const resp = await QueryBiliAuthGetAPI<ResponsePointGoodModel[]>(`${POINT_API_URL}get-goods`, {
        id,
      })
      if (resp.code == 200) {
        return resp.data
      } else {
        message?.error(`无法获取数据: ${resp.message}`)
        console.error(`无法获取数据: ${resp.message}`)
      }
    } catch (err) {
      message?.error(`无法获取数据: ${err}`)
      console.error(`无法获取数据: ${err}`)
    }
    return []
  }

  function logout() {
    biliAuth.value = {} as BiliAuthModel
    biliTokens.value = biliTokens.value.filter((t) => t.token != currentToken.value)
    currentToken.value = ''
    legacyToken.value = null
    replacementToken.value = null
    isInvalid.value = false
    console.log('[bili-auth] 已登出 Bilibili 认证')
  }

  return {
    biliAuth,
    biliToken: currentToken,
    biliTokens,
    isLoading,
    isAuthed,
    isInvalid,
    legacyToken,
    replacementToken,
    requiresLegacyMigration,
    currentToken,
    getAuthInfo,
    QueryBiliAuthGetAPI,
    QueryBiliAuthPostAPI,
    QueryBiliAuthPostAPIWithParams,
    getBiliAuthHeaders,
    GetSpecificPoint,
    GetGoods,
    setCurrentAuth,
    migrateLegacyToken,
    finishLegacyMigration,
    rotateSession,
    logout,
  }
})
