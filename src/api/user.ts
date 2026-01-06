import type { APIRoot, UserBasicInfo, UserInfo } from './api-models'
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { QueryGetAPI } from '@/api/query'
import { USER_API_URL } from '@/shared/config'

export const USERS = ref<{ [id: string]: UserInfo }>({})

export async function useUser(id: string | undefined = undefined) {
  const route = useRoute()
  id ??= route.params.id.toString()
  if (id) {
    if (!USERS.value[id]) {
      const result: APIRoot<UserInfo> = await GetInfo(id)
      if (result.code == 200) {
        USERS.value[id] = result.data
      }
    }
    return USERS.value[id]
  } else {
    console.error(`指定id: ${id} 无效`)
  }
}
export async function useUserWithUId(id: number) {
  if (!USERS.value[id.toString()]) {
    const result = await QueryGetAPI<UserInfo>(`${USER_API_URL}info`, {
      uId: id,
    })
    if (result.code == 200) {
      USERS.value[id.toString()] = result.data
    }
  }
  return USERS.value[id.toString()]
}
export async function getUserBasicInfo(id: string | number | undefined) {
  if (!id) return undefined
  return (await QueryGetAPI<UserBasicInfo>(`${USER_API_URL}basic/${id}`)).data
}

export async function GetInfo(id: string): Promise<APIRoot<UserInfo>> {
  return QueryGetAPI<UserInfo>(`${USER_API_URL}info`, {
    id,
  })
}
