import type { EventModel } from '@/api/api-models'
import { toRaw } from 'vue'

const LOCAL_EVENT_CHANNEL = 'vtsuru.danmaku.model-events.v2'

export type DanmakuEventName = 'danmaku' | 'gift' | 'sc' | 'guard' | 'enter' | 'scDel' | 'follow' | 'like'
export type ClientType = 'openlive' | 'direct' | 'local' | 'broadcast'

export interface DanmakuSourceMeta {
  roomId?: number
  uname?: string
  avatar?: string
}

type Payload =
  | { kind: 'event', sourceId: string, scope: string, eventName: DanmakuEventName, data: EventModel }
  | { kind: 'state', sourceId: string, scope: string, state: 'connected' | 'disconnected', clientType: ClientType, meta?: DanmakuSourceMeta }
  | { kind: 'state-request', sourceId: string, scope: string }

export interface DanmakuChannel {
  publishEvent: (scope: string, eventName: DanmakuEventName, data: EventModel) => void
  publishState: (scope: string, state: 'connected' | 'disconnected', clientType: ClientType, meta?: DanmakuSourceMeta) => void
  requestState: (scope: string) => void
  onEvent: (cb: (sourceId: string, scope: string, eventName: DanmakuEventName, data: EventModel) => void) => () => void
  onState: (cb: (sourceId: string, scope: string, state: 'connected' | 'disconnected', clientType: ClientType, meta?: DanmakuSourceMeta) => void) => () => void
  onStateRequest: (cb: (scope: string) => void) => () => void
  close: () => void
}

export function createDanmakuChannel(sourceId: string): DanmakuChannel {
  const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(LOCAL_EVENT_CHANNEL)
  const eventListeners = new Set<Parameters<DanmakuChannel['onEvent']>[0]>()
  const stateListeners = new Set<Parameters<DanmakuChannel['onState']>[0]>()
  const requestListeners = new Set<Parameters<DanmakuChannel['onStateRequest']>[0]>()

  channel?.addEventListener('message', ({ data }: MessageEvent<Payload>) => {
    if (!data || data.sourceId === sourceId || !data.scope) return
    if (data.kind === 'event') {
      for (const listener of eventListeners) listener(data.sourceId, data.scope, data.eventName, data.data)
    } else if (data.kind === 'state') {
      for (const listener of stateListeners) listener(data.sourceId, data.scope, data.state, data.clientType, data.meta)
    } else if (data.kind === 'state-request') {
      for (const listener of requestListeners) listener(data.scope)
    }
  })

  const subscribe = <T>(listeners: Set<T>, listener: T) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return {
    publishEvent: (scope, eventName, data) => channel?.postMessage({ kind: 'event', sourceId, scope, eventName, data: toRaw(data) } satisfies Payload),
    publishState: (scope, state, clientType, meta) => channel?.postMessage({ kind: 'state', sourceId, scope, state, clientType, meta: meta && toRaw(meta) } satisfies Payload),
    requestState: scope => channel?.postMessage({ kind: 'state-request', sourceId, scope } satisfies Payload),
    onEvent: listener => subscribe(eventListeners, listener),
    onState: listener => subscribe(stateListeners, listener),
    onStateRequest: listener => subscribe(requestListeners, listener),
    close: () => channel?.close(),
  }
}
