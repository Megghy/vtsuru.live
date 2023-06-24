import { QueryGetAPI } from '@/api/query'
import { BASE_API, USER_API_URL } from '@/data/constants'
import { APIRoot, UserInfo } from './api-models'
import { ref } from 'vue'
import { useRoute } from 'vue-router'

export const USERS = ref<{ [uId: number]: UserInfo }>({})

export async function useUserByUId(uId: number) {
  if (!USERS.value[uId]) {
    const result = await QueryGetAPI<UserInfo>(`${USER_API_URL}info`, {
      uId: uId,
    })
    if (result.code == 200) {
      USERS.value[uId] = result.data
    }
  }
  return USERS.value[uId]
}
export async function useUser(id?: number) {
  try {
    if (!id) {
      id = Number(useRoute().params.id)
    }
  } catch { }
  if (id) {
    if (!USERS.value[id]) {
      const result = await QueryGetAPI<UserInfo>(`${USER_API_URL}info`, {
        id: id,
      })
      if (result.code == 200) {
        USERS.value[id] = result.data
      }
    }
    return USERS.value[id]
  }
  
}
