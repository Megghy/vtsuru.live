import { QueryGetAPI } from '@/api/query'
import { BASE_API, USER_API_URL } from '@/data/constants'
import { APIRoot, UserInfo } from './api-models'
import { ref } from 'vue'
import { useRouteParams } from '@vueuse/router'
import { useRoute } from 'vue-router'

export const USERS = ref<{ [uId: number]: UserInfo }>({})

export async function useUser(id: number | undefined = undefined) {
  const route = useRoute()
  id ??= Number(route.params.id)
  if (id) {
    if (!USERS.value[id]) {
      const result = await GetInfo(id)
      if (result.code == 200) {
        USERS.value[id] = result.data
      }
    }
    return USERS.value[id]
  } else {
    console.error('指定id: ' + id + ' 无效')
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
