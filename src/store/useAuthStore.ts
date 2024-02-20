import { defineStore } from 'pinia'
import { useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import { AddressInfo, BiliAuthModel, ResponsePointGoodModel } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { useStorage } from '@vueuse/core'
import { BILI_AUTH_API_URL, POINT_API_URL } from '@/data/constants'
import { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider'

export const useAuthStore = defineStore('BiliAuth', () => {
  const biliAuth = ref<BiliAuthModel>({} as BiliAuthModel)

  const biliTokens = useStorage<
    {
      id: number
      uId: number
      name?: string
      token: string
    }[]
  >('Bili.Auth.Tokens', [])
  const biliToken = useStorage<string>('Bili.Auth.Selected', null)

  const isLoading = ref(false)
  const isAuthed = computed(() => biliToken.value != null && biliToken.value.length > 0)

  async function setCurrentAuth(token: string) {
    if (!token) {
      console.warn('[bili-auth] 无效的token')
      return
    }
    biliAuth.value = {} as BiliAuthModel
    biliToken.value = token
    await getAuthInfo()
  }

  async function getAuthInfo() {
    try {
      isLoading.value = true
      await QueryBiliAuthGetAPI<BiliAuthModel>(BILI_AUTH_API_URL + 'info').then((data) => {
        if (data.code == 200) {
          biliAuth.value = data.data
          console.log('[bili-auth] 已获取 Bilibili 认证信息')
          // 将token加入到biliTokens
          const index = biliTokens.value.findIndex((t) => t.id == biliAuth.value.id)
          if (index >= 0) {
            biliTokens.value[index] = {
              id: biliAuth.value.id,
              token: biliToken.value,
              name: biliAuth.value.name,
              uId: biliAuth.value.userId,
            }
            //console.log('更新已存在的认证账户: ' + biliAuth.value.userId)
          } else {
            biliTokens.value.push({
              id: biliAuth.value.id,
              token: biliToken.value,
              name: biliAuth.value.name,
              uId: biliAuth.value.userId,
            })
            console.log('添加新的认证账户: ' + biliAuth.value.userId)
          }
          return true
        } else {
          console.error('[bili-auth] 无法获取 Bilibili 认证信息: ' + data.message)
          //message.error('无法获取 Bilibili 认证信息: ' + data.message)
        }
      })
    } catch (err) {
      console.error('[bili-auth] 无法获取 Bilibili 认证信息: ' + err)
      //message.error('无法获取 Bilibili 认证信息: ' + err)
    } finally {
      isLoading.value = false
    }
    return false
  }
  function QueryBiliAuthGetAPI<T>(url: string, params?: any, headers?: [string, string][]) {
    headers ??= []
    if (headers.find((h) => h[0] == 'Bili-Auth') == null) {
      headers.push(['Bili-Auth', biliToken.value ?? ''])
    }
    return QueryGetAPI<T>(url, params, headers)
  }
  function QueryBiliAuthPostAPI<T>(url: string, body?: unknown, headers?: [string, string][]) {
    headers ??= []
    if (headers.find((h) => h[0] == 'Bili-Auth') == null) {
      headers.push(['Bili-Auth', biliToken.value ?? ''])
    }
    return QueryPostAPI<T>(url, body, headers)
  }

  async function GetSpecificPoint(id: number) {
    try {
      const data = await QueryBiliAuthGetAPI<number>(POINT_API_URL + 'user/get-point', { id: id })
      if (data.code == 200) {
        return data.data
      } else {
        console.error('[point] 无法获取在指定直播间拥有的积分: ' + data.message)
      }
    } catch (err) {
      console.error('[point] 无法获取在指定直播间拥有的积分: ' + err)
    }
    return null
  }
  async function GetGoods(id: number | undefined = undefined, message?: MessageApiInjection) {
    if (!id) {
      return []
    }
    try {
      const resp = await QueryGetAPI<ResponsePointGoodModel[]>(POINT_API_URL + 'get-goods', {
        id: id,
      })
      if (resp.code == 200) {
        return resp.data
      } else {
        message?.error('无法获取数据: ' + resp.message)
        console.error('无法获取数据: ' + resp.message)
      }
    } catch (err) {
      message?.error('无法获取数据: ' + err)
      console.error('无法获取数据: ' + err)
    }
    return []
  }

  return {
    biliAuth,
    biliToken,
    biliTokens,
    isLoading,
    isAuthed,
    getAuthInfo,
    QueryBiliAuthGetAPI,
    QueryBiliAuthPostAPI,
    GetSpecificPoint,
    GetGoods,
    setCurrentAuth,
  }
})
