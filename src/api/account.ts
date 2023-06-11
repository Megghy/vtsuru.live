import { ACCOUNT_API_URL, BASE_API } from '@/data/constants'
import { APIRoot, AccountInfo } from './api-models'
import { QueryPostAPI } from '@/api/query'
import { ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import { createDiscreteApi } from 'naive-ui'

export const ACCOUNT = ref<AccountInfo>()

const { message } = createDiscreteApi(['message'])
const cookie = useLocalStorage('JWT_Token', '')

export async function GetSelfAccount() {
  if (cookie.value) {
    const result = await Self()
    if (result.code == 200) {
      ACCOUNT.value = result.data
      console.log('[vtsuru] 已获取账户信息')
      return result.data
    } else if (result.code == 403) {
      cookie.value = ''
      console.warn('[vtsuru] Cookie 已失效, 需要重新登陆')
      message.error('Cookie 已失效, 需要重新登陆')
    }
    else {
      console.warn('[vtsuru] '+ result.message)
      message.error(result.message)
    }
  }
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
