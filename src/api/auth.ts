import { StorageSerializers } from '@vueuse/core'

import { usePersistedStorage } from '@/shared/storage/persist'

export interface AuthCookie {
  cookie: string
  refreshDate: number
}

export type AuthSyncMessage =
  | { type: 'logout' }
  | { type: 'cookie-updated'; cookie: AuthCookie }

const AUTH_BROADCAST_CHANNEL = 'vtsuru:auth'
const authChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(AUTH_BROADCAST_CHANNEL) : null

export function broadcastAuthSync(event: AuthSyncMessage) {
  authChannel?.postMessage(event)
}

export function onAuthSync(handler: (event: AuthSyncMessage) => void) {
  if (!authChannel) return () => {}
  const listener = (event: MessageEvent<AuthSyncMessage>) => {
    if (event.data && typeof event.data === 'object' && 'type' in event.data) {
      handler(event.data)
    }
  }
  authChannel.addEventListener('message', listener)
  return () => authChannel.removeEventListener('message', listener)
}

// 允许在登出/失效时清空
export const cookie = usePersistedStorage<AuthCookie | undefined>(
  'Cookie',
  { cookie: '', refreshDate: 0 },
  { serializer: StorageSerializers.object },
)
