import { ACCOUNT_API_URL, BASE_API } from '@/data/constants'
import { APIRoot, AccountInfo, FunctionTypes } from './api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { createDiscreteApi } from 'naive-ui'
import { isSameDay } from 'date-fns'

export const ACCOUNT = ref<AccountInfo>()
export const isLoadingAccount = ref(true)

const { message } = createDiscreteApi(['message'])
const cookie = useLocalStorage('JWT_Token', '')
const cookieRefreshDate = useLocalStorage('JWT_Token_Last_Refresh', Date.now())

export async function GetSelfAccount() {
  if (cookie.value) {
    const result = await Self()
    if (result.code == 200) {
      ACCOUNT.value = result.data
      isLoadingAccount.value = false
      //console.log('[vtsuru] 已获取账户信息')
      if (!isSameDay(new Date(), cookieRefreshDate.value)) {
        refreshCookie()
      }
      return result.data
    } else if (result.code == 401) {
      localStorage.removeItem('JWT_Token')
      console.warn('[vtsuru] Cookie 已失效, 需要重新登陆')
      message.error('Cookie 已失效, 需要重新登陆')
      setTimeout(() => {
        location.reload()
      }, 1500)
    } else {
      console.warn('[vtsuru] ' + result.message)
      message.error(result.message)
    }
  }
  isLoadingAccount.value = false
}
export function UpdateAccountLoop() {
  setInterval(() => {
    if (ACCOUNT.value) {
      GetSelfAccount()
    }
  }, 60 * 1000)
}
function refreshCookie() {
  QueryPostAPI<string>(`${ACCOUNT_API_URL}refresh-token`).then((data) => {
    if (data.code == 200) {
      cookie.value = data.data
      cookieRefreshDate.value = Date.now()
      console.log('[vtsuru] 已刷新Cookie')
    }
  })
}
export async function SaveAccountSettings() {
  return await QueryPostAPI(ACCOUNT_API_URL + 'update-setting', ACCOUNT.value?.settings)
}
export async function SaveEnableFunctions(functions: FunctionTypes[]) {
  return await QueryPostAPI(ACCOUNT_API_URL + 'update-enable-functions', functions)
}
export function useAccount() {
  return ACCOUNT
}

export async function Register(name: string, email: string, password: string, token: string): Promise<APIRoot<string>> {
  return QueryPostAPI<string>(`${ACCOUNT_API_URL}register`, {
    name,
    email,
    password,
    token,
  })
}

export async function Login(nameOrEmail: string, password: string): Promise<APIRoot<string>> {
  return QueryPostAPI<string>(`${ACCOUNT_API_URL}login`, {
    nameOrEmail,
    password,
  })
}
export async function Self(): Promise<APIRoot<AccountInfo>> {
  return QueryPostAPI<AccountInfo>(`${ACCOUNT_API_URL}self`)
}
export async function AddBiliBlackList(id: number, name: string): Promise<APIRoot<unknown>> {
  return QueryGetAPI<AccountInfo>(`${ACCOUNT_API_URL}black-list/add-bili`, {
    id: id,
    name: name,
  })
}
export async function DelBiliBlackList(id: number): Promise<APIRoot<unknown>> {
  return QueryGetAPI<AccountInfo>(`${ACCOUNT_API_URL}black-list/del-bili`, {
    id: id,
  })
}
