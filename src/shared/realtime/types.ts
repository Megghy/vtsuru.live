export type RealtimeEventHandler<T = any> = (payload: T) => void

export interface RealtimeBusStatus {
  connected: boolean
  connecting: boolean
  error: string
}

export interface RealtimeTopicOptions {
  key?: string
  immediate?: boolean
}
