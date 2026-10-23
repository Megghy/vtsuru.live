import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { ACCOUNT } from '@/api/account'
import { cookie } from '@/api/auth'
import type { ResponsePointGoodModel } from '@/api/client-types'
import {
  getApiBiliAuthInfo,
  postApiBiliAuthMigrate,
  postApiBiliAuthSessionRotate,
} from '@/api/generated/bili-auth-v2/bili-auth-v2'
import type { ResponseBiliAuthModel } from '@/api/generated/model'
import { getApiPointGetGoods, getApiPointUserGetPoint } from '@/api/generated/point/point'
import { usePersistedStorage } from '@/shared/storage/persist'

export const useBiliAuth = defineStore('BiliAuth', () => {
  type SessionResponse = {
    token: string
    expiresAt: number | null
  }
  const sessionAuth = ref<ResponseBiliAuthModel>({} as ResponseBiliAuthModel)
  const usesAccountIdentity = computed(() => Boolean(cookie.value?.cookie))
  const biliAuth = computed(() =>
    usesAccountIdentity.value ? (ACCOUNT.value.biliUserAuthInfo ?? ({} as ResponseBiliAuthModel)) : sessionAuth.value,
  )

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
  const sessionLoaded = ref(false)
  const sessionReady = currentTokenReady.then(() => {
    sessionLoaded.value = true
  })

  const isLoading = ref(false)
  const isAuthed = computed(() => biliAuth.value.id > 0 || (!usesAccountIdentity.value && Boolean(currentToken.value)))
  const isInvalid = ref(false)
  const legacyToken = ref<string | null>(null)
  const replacementToken = ref<string | null>(null)
  const requiresLegacyMigration = computed(() => Boolean(legacyToken.value || replacementToken.value))

  const identity = computed(() =>
    cookie.value?.cookie ? `account:${cookie.value.cookie}` : `session:${currentToken.value ?? ''}`,
  )
  let pendingAuthInfo: { identity: string; promise: Promise<boolean> } | undefined
  watch(
    identity,
    () => {
      sessionAuth.value = {} as ResponseBiliAuthModel
      isLoading.value = false
      isInvalid.value = false
      legacyToken.value = null
      replacementToken.value = null
    },
    { flush: 'sync' },
  )

  async function setCurrentAuth(token: string) {
    if (usesAccountIdentity.value) throw new Error('请先退出站内账号，再切换独立认证账号')
    if (!token) throw new Error('认证凭据不能为空')
    await currentTokenReady
    sessionAuth.value = {} as ResponseBiliAuthModel
    currentToken.value = token
    legacyToken.value = null
    replacementToken.value = null
    isInvalid.value = false
    await getAuthInfo()
  }

  async function getAuthInfo(): Promise<boolean> {
    await currentTokenReady
    const requestIdentity = identity.value
    if (!usesAccountIdentity.value && !currentToken.value) return false
    if (usesAccountIdentity.value && ACCOUNT.value.id && !ACCOUNT.value.biliUserAuthInfo) return false
    if (pendingAuthInfo?.identity === requestIdentity) return pendingAuthInfo.promise
    const promise = (async () => {
      try {
        isLoading.value = true
        const data = (await getApiBiliAuthInfo({
          headers: Object.fromEntries(await getBiliAuthHeaders()),
        })) as unknown as { code: number; message: string; data: ResponseBiliAuthModel }
        // 切换账号后到达的旧响应不能覆盖当前身份。
        if (identity.value !== requestIdentity) return false
        if (data.code == 200) {
          if (usesAccountIdentity.value) ACCOUNT.value.biliUserAuthInfo = data.data
          else sessionAuth.value = data.data
          console.log('[bili-auth] 已获取 Bilibili 认证信息')
          if (!usesAccountIdentity.value && currentToken.value) {
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
          if (usesAccountIdentity.value) ACCOUNT.value.biliUserAuthInfo = undefined
          else sessionAuth.value = {} as ResponseBiliAuthModel
          isInvalid.value = true
          if (!usesAccountIdentity.value && currentToken.value && data.message === '旧版认证链接需要迁移') {
            legacyToken.value = currentToken.value
          }
          return false
        }
      } finally {
        if (identity.value === requestIdentity) isLoading.value = false
        if (pendingAuthInfo?.identity === requestIdentity) pendingAuthInfo = undefined
      }
    })()
    pendingAuthInfo = { identity: requestIdentity, promise }
    return promise
  }

  async function migrateLegacyToken() {
    if (!legacyToken.value) return false
    const response = (await postApiBiliAuthMigrate({
      token: legacyToken.value,
    })) as unknown as {
      code: number
      data: SessionResponse
    }
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
    const response = (await postApiBiliAuthSessionRotate({
      headers: Object.fromEntries(await getBiliAuthHeaders()),
    })) as unknown as { code: number; data: SessionResponse }
    if (response.code !== 200) return false

    currentToken.value = response.data.token
    await getAuthInfo()
    return true
  }

  async function getBiliAuthHeaders(headers?: [string, string][]) {
    await currentTokenReady
    const result = (headers ?? []).filter(([name]) => !usesAccountIdentity.value || name.toLowerCase() !== 'bili-auth')
    if (
      !usesAccountIdentity.value &&
      currentToken.value &&
      result.find((h) => h[0].toLowerCase() == 'bili-auth') == null
    ) {
      result.push(['Bili-Auth', currentToken.value ?? ''])
    }
    return result
  }

  async function GetSpecificPoint(id: number) {
    try {
      const data = await getApiPointUserGetPoint({ id }, { headers: Object.fromEntries(await getBiliAuthHeaders()) })
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

  async function GetGoods(id: number | undefined = undefined, message?: any) {
    if (!id) {
      return []
    }
    try {
      const resp = (await getApiPointGetGoods(
        { id: String(id) },
        { headers: Object.fromEntries(await getBiliAuthHeaders()) },
      )) as unknown as { code: number; message: string; data: ResponsePointGoodModel[] }
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
    sessionAuth.value = {} as ResponseBiliAuthModel
    biliTokens.value = biliTokens.value.filter((t) => t.token != currentToken.value)
    currentToken.value = ''
    legacyToken.value = null
    replacementToken.value = null
    isInvalid.value = false
    console.log('[bili-auth] 已登出 Bilibili 认证')
  }

  return {
    biliAuth,
    usesAccountIdentity,
    biliToken: currentToken,
    biliTokens,
    isLoading,
    sessionLoaded,
    sessionReady,
    isAuthed,
    isInvalid,
    legacyToken,
    replacementToken,
    requiresLegacyMigration,
    currentToken,
    getAuthInfo,
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
