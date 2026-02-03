import { StorageSerializers } from '@vueuse/core'
import { usePersistedStorage } from '@/shared/storage/persist'

export interface AuthCookie {
  cookie: string
  refreshDate: number
}

// 允许在登出/失效时清空
export const cookie = usePersistedStorage<AuthCookie | undefined>(
  'Cookie',
  { cookie: '', refreshDate: 0 },
  { serializer: StorageSerializers.object },
)
