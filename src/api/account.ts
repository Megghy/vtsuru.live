import { ACCOUNT_API_URL, BASE_API } from '@/data/constants'
import { APIRoot } from './api-models'
import { QueryPostAPI } from '@/api/query'
import { UserInfo } from '@/api/api-models'
import { ref } from 'vue'
import { useCookies } from '@vueuse/integrations/useCookies'

export const ACCOUNT = ref<UserInfo>()

const cookies = useCookies()

export async function GetSelfAccount() {
  const cookie = cookies.get('VTSURU_SESSION')
  if (cookie) {
    const result = await Self()
    if (result.code == 200) {
      ACCOUNT.value = result.data
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
export async function Self(): Promise<APIRoot<UserInfo>> {
  return QueryPostAPI<UserInfo>(`${ACCOUNT_API_URL}self`)
}
