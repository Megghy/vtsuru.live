import type { MaybeRefOrGetter } from 'vue'
export interface ObsBridgeOptions<TState> {
  componentId: string
  channelId?: MaybeRefOrGetter<string>
  userId?: MaybeRefOrGetter<number>
  defaultState: TState
  role?: 'controller' | 'viewer' | 'auto'
  persist?: boolean
  storageKeyPrefix?: string
}
export interface ObsSyncMessage<TState = unknown, TAction = unknown> {
  id: string
  componentId: string
  channelId: string
  type: 'STATE_UPDATE' | 'ACTION'
  timestamp: number
  state?: TState
  action?: TAction
}
