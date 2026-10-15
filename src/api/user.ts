import { ref } from 'vue'
import { useRoute } from 'vue-router'

import { getApiUserBasicValue, getApiUserInfo } from '@/api/generated/user/user'
import type { ResponseUserInfo } from '@/api/generated/model/responseUserInfo'

export const USERS = ref<{ [id: string]: ResponseUserInfo }>({})

export async function useUser(id: string | undefined = undefined) {
  const route = useRoute()
  id ??= route.params.id.toString()
  if (id) {
    if (!USERS.value[id]) {
      const result = await GetInfo(id)
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
    const result = await getApiUserInfo({ uId: id })
    if (result.code == 200) {
      USERS.value[id.toString()] = result.data
    }
  }
  return USERS.value[id.toString()]
}
export async function getUserBasicInfo(id: string | number | undefined) {
  if (!id) return undefined
  return (await getApiUserBasicValue(String(id))).data
}

export async function GetInfo(id: string) {
  return getApiUserInfo({ id })
}
