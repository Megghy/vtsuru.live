import { QueryGetAPI } from '@/api/query'
import { BASE_API, USER_API_URL } from '@/data/constants'
import { APIRoot, UserInfo } from './api-models'
import { ref } from 'vue'
import { useRouteParams } from '@vueuse/router'

export const USERS = ref<{ [uId: number]: UserInfo }>({})

export async function useUser() {
  const uId = useRouteParams('id', '-1', { transform: Number }).value
  if (uId) {
    if (!USERS.value[uId]) {
      const result = await GetInfo(uId)
      if (result.code == 200) {
        USERS.value[uId] = result.data
      }
    }
    return USERS.value[uId]
  }
  else {
    console.error('指定uId: ' + uId + ' 无效');
  }
}
export async function useUserWithUId(id: number) {
  if (!USERS.value[id]) {
    const result = await GetInfo(id)
    if (result.code == 200) {
      USERS.value[id] = result.data
    }
  }
  return USERS.value[id]
}

export async function GetInfo(id: number): Promise<APIRoot<UserInfo>> {
  return QueryGetAPI<UserInfo>(`${USER_API_URL}info`, {
    id: id,
  })
}
