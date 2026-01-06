import { StorageSerializers, useLocalStorage } from '@vueuse/core'

export interface AuthCookie {
  cookie: string
  refreshDate: number
}

// 允许在登出/失效时清空
export const cookie = useLocalStorage<AuthCookie | undefined>(
  'Cookie',
  { cookie: '', refreshDate: 0 },
  { serializer: StorageSerializers.object },
)

