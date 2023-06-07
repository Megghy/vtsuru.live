import { QueryGetAPI } from '@/api/query'
import { BASE_API, USER_API_URL } from '@/data/constants'
import { APIRoot, UserInfo } from './api-models'
import { ref } from 'vue'

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
  return QueryGetAPI<UserInfo>(`${USER_API_URL}info`, {
    uId: uId,
  })
}
