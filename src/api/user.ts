import { QueryGetAPI } from '@/api/query'
import { BASE_API } from '@/data/constants'
import { APIRoot, UserInfo } from './api-models'
import { ref } from 'vue'

const ACCOUNT_URL = `${BASE_API}user/`
export const USERS = ref<{ [uId: number]: UserInfo }>({})

export async function useUser(uId: number) {
  if (!USERS.value[uId]) {
    const result = await GetInfo(uId)
    if (result.code == 200) {
      USERS.value[uId] = result.data
    }
  }
  return USERS.value[uId]
}

export async function GetInfo(uId: number): Promise<APIRoot<UserInfo>> {
  return QueryGetAPI<UserInfo>(`${ACCOUNT_URL}info`, {
    uId: uId,
  })
}
