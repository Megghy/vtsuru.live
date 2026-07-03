import type { EventModel, OpenLiveInfo } from '@/api/api-models'
import type BaseDanmakuClient from '@/shared/services/DanmakuClients/BaseDanmakuClient'
import type { DirectClientAuthInfo } from '@/shared/services/DanmakuClients/DirectClient'
import type { AuthInfo } from '@/shared/services/DanmakuClients/OpenLiveClient'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { useAccount } from '@/api/account'
import DirectClient from '@/shared/services/DanmakuClients/DirectClient'
import OpenLiveClient from '@/shared/services/DanmakuClients/OpenLiveClient'

const MODEL_EVENT_NAMES = ['danmaku', 'gift', 'sc', 'guard', 'enter', 'scDel', 'follow', 'like'] as const
const LOCAL_EVENT_CHANNEL = 'vtsuru.danmaku.model-events.v1'
const REMOTE_SOURCE_TTL_MS = 10_000
const DEFAULT_REMOTE_WAIT_MS = 600

type EventName = typeof MODEL_EVENT_NAMES[number]
type EventNameWithAll = EventName | 'all'
type Listener = (arg1: any, arg2?: any) => void
type AllEventListener = (arg1: any) => void
type GenericListener = Listener | AllEventListener
type ModelListeners = BaseDanmakuClient['eventsAsModel']

type LocalEventPayload =
  | {
    kind: 'event'
    sourceId: string
    accountId?: number
    eventName: EventName
    data: EventModel
  }
  | {
    kind: 'state'
    sourceId: string
    accountId?: number
    state: 'connected' | 'disconnected'
    clientType?: 'openlive' | 'direct'
    at: number
  }
  | {
    kind: 'state-request'
    sourceId: string
    accountId?: number
  }

function createSourceId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createModelListeners(client: BaseDanmakuClient): ModelListeners {
  return client.createEmptyEventModelListeners()
}

export const useDanmakuClient = defineStore('DanmakuClient', () => {
  const danmakuClient = shallowRef<BaseDanmakuClient | undefined>(new OpenLiveClient())
  const state = ref<'waiting' | 'connecting' | 'connected'>('waiting')
  const connected = computed(() => state.value === 'connected')
  const hasRemoteSource = computed(() => {
    remoteSourceTick.value
    return hasFreshRemoteSource()
  })
  const hasAnySource = computed(() => connected.value || hasRemoteSource.value)
  const authInfo = ref<OpenLiveInfo>()
  const accountInfo = useAccount()

  const sourceId = createSourceId()
  const modelListeners = createModelListeners(danmakuClient.value)
  const remoteSources = new Map<string, number>()
  const remoteSourceTick = ref(0)
  const channel = typeof BroadcastChannel === 'undefined'
    ? undefined
    : new BroadcastChannel(LOCAL_EVENT_CHANNEL)

  let isInitializing = false
  let initFinished: Promise<void> | undefined
  let resolveInitFinished: (() => void) | undefined
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined

  channel?.addEventListener('message', (event: MessageEvent<LocalEventPayload>) => {
    const payload = event.data
    if (!payload || payload.sourceId === sourceId) return
    if (!isSameAccount(payload.accountId)) return

    switch (payload.kind) {
      case 'event':
        markRemoteSource(payload.sourceId)
        emitLocalEvent(payload.eventName, payload.data)
        break
      case 'state':
        if (payload.state === 'connected') {
          markRemoteSource(payload.sourceId, payload.at)
        } else {
          remoteSources.delete(payload.sourceId)
          remoteSourceTick.value = Date.now()
        }
        break
      case 'state-request':
        if (connected.value) publishState('connected')
        break
    }
  })

  function onEvent(eventName: 'all', listener: AllEventListener): void
  function onEvent(eventName: EventName, listener: Listener): void
  function onEvent(eventName: EventNameWithAll, listener: GenericListener): void {
    const listeners = modelListeners[eventName] as GenericListener[]
    if (!listeners.includes(listener)) listeners.push(listener)
  }

  function offEvent(eventName: 'all', listener: AllEventListener): void
  function offEvent(eventName: EventName, listener: Listener): void
  function offEvent(eventName: EventNameWithAll, listener: GenericListener): void {
    const listeners = modelListeners[eventName] as GenericListener[]
    const index = listeners.indexOf(listener)
    if (index > -1) listeners.splice(index, 1)
  }

  function on(eventName: 'all', listener: AllEventListener): void
  function on(eventName: EventName, listener: Listener): void
  function on(eventName: EventNameWithAll, listener: GenericListener): void {
    const listeners = danmakuClient.value?.eventsRaw[eventName] as GenericListener[] | undefined
    if (listeners && !listeners.includes(listener)) listeners.push(listener)
  }

  function off(eventName: 'all', listener: AllEventListener): void
  function off(eventName: EventName, listener: Listener): void
  function off(eventName: EventNameWithAll, listener: GenericListener): void {
    const listeners = danmakuClient.value?.eventsRaw[eventName] as GenericListener[] | undefined
    const index = listeners?.indexOf(listener) ?? -1
    if (listeners && index > -1) listeners.splice(index, 1)
  }

  async function initOpenlive(auth?: AuthInfo) {
    return initClient(new OpenLiveClient(auth))
  }

  async function initDirect(auth: DirectClientAuthInfo) {
    return initClient(new DirectClient(auth))
  }

  async function ensureOpenlive(options: { connect?: boolean, remoteWaitMs?: number } = {}) {
    if (connected.value) return useDanmakuClient()
    if (isInitializing) {
      if (initFinished) await initFinished
      return useDanmakuClient()
    }

    await waitForRemoteSource(options.remoteWaitMs ?? DEFAULT_REMOTE_WAIT_MS)
    if (hasFreshRemoteSource() || options.connect === false) return useDanmakuClient()

    await initOpenlive()
    return useDanmakuClient()
  }

  async function initClient(client: BaseDanmakuClient) {
    if (isInitializing) {
      if (initFinished) await initFinished
      return useDanmakuClient()
    }
    if (connected.value) return useDanmakuClient()

    isInitializing = true
    initFinished = new Promise((resolve) => {
      resolveInitFinished = resolve
    })
    state.value = 'connecting'

    try {
      const oldRawEvents = danmakuClient.value?.eventsRaw ?? client.createEmptyRawEventlisteners()
      if (danmakuClient.value?.state === 'connected') await disposeClientInstance(danmakuClient.value)

      danmakuClient.value = client
      danmakuClient.value.eventsRaw = oldRawEvents
      attachModelEventBridge(danmakuClient.value)

      for (let retryCount = 0; retryCount < 5; retryCount++) {
        if (state.value !== 'connecting') break
        if (await attemptConnect(retryCount + 1)) break

        const isLast = retryCount === 4
        if (isLast) {
          await dispose()
        } else {
          await new Promise(resolve => setTimeout(resolve, 5000))
        }
      }

      return useDanmakuClient()
    } finally {
      isInitializing = false
      resolveInitFinished?.()
      resolveInitFinished = undefined
      initFinished = undefined
    }
  }

  async function attemptConnect(attempt: number) {
    if (!danmakuClient.value) return false

    console.log(`[DanmakuClient] 尝试连接 (第 ${attempt} 次)...`)
    try {
      const result = await danmakuClient.value.Start()
      if (!result.success) {
        console.error(`[DanmakuClient] 连接尝试失败: ${result.message}`)
        return false
      }

      authInfo.value = danmakuClient.value instanceof OpenLiveClient ? danmakuClient.value.roomAuthInfo : undefined
      state.value = 'connected'
      startHeartbeat()
      publishState('connected')
      console.log('[DanmakuClient] 初始化成功')
      return true
    } catch (error) {
      console.error('[DanmakuClient] 连接尝试期间发生异常:', error)
      return false
    }
  }

  function attachModelEventBridge(client: BaseDanmakuClient) {
    client.eventsAsModel = client.createEmptyEventModelListeners()

    for (const eventName of MODEL_EVENT_NAMES) {
      const listeners = client.eventsAsModel[eventName] as Array<(data: EventModel, command?: any) => void>
      listeners.push((data, command) => {
        emitLocalEvent(eventName, data, command)
        publishEvent(eventName, data)
      })
    }
  }

  function emitLocalEvent(eventName: EventName, data: EventModel, command?: any) {
    for (const listener of modelListeners[eventName] as Listener[]) {
      listener(data, command)
    }
    for (const listener of modelListeners.all as AllEventListener[]) {
      listener(data)
    }
  }

  function publishEvent(eventName: EventName, data: EventModel) {
    channel?.postMessage({
      kind: 'event',
      sourceId,
      accountId: currentAccountId(),
      eventName,
      data,
    } satisfies LocalEventPayload)
  }

  function publishState(nextState: 'connected' | 'disconnected') {
    channel?.postMessage({
      kind: 'state',
      sourceId,
      accountId: currentAccountId(),
      state: nextState,
      clientType: danmakuClient.value?.type,
      at: Date.now(),
    } satisfies LocalEventPayload)
  }

  async function waitForRemoteSource(waitMs: number) {
    if (hasFreshRemoteSource()) return

    channel?.postMessage({
      kind: 'state-request',
      sourceId,
      accountId: currentAccountId(),
    } satisfies LocalEventPayload)
    await new Promise(resolve => setTimeout(resolve, waitMs))
  }

  function currentAccountId() {
    return accountInfo.value?.id
  }

  function isSameAccount(accountId?: number) {
    const localAccountId = currentAccountId()
    return !accountId || !localAccountId || accountId === localAccountId
  }

  function markRemoteSource(id: string, at = Date.now()) {
    remoteSources.set(id, at)
    pruneRemoteSources()
    remoteSourceTick.value = Date.now()
  }

  function hasFreshRemoteSource() {
    pruneRemoteSources()
    return remoteSources.size > 0
  }

  function pruneRemoteSources() {
    const expiredAt = Date.now() - REMOTE_SOURCE_TTL_MS
    for (const [id, at] of remoteSources) {
      if (at < expiredAt) remoteSources.delete(id)
    }
  }

  function startHeartbeat() {
    if (heartbeatTimer) return
    heartbeatTimer = setInterval(() => {
      if (connected.value) publishState('connected')
    }, 3000)
  }

  function stopHeartbeat() {
    if (!heartbeatTimer) return
    clearInterval(heartbeatTimer)
    heartbeatTimer = undefined
  }

  async function disposeClientInstance(client: BaseDanmakuClient) {
    try {
      client.Stop()
    } catch (error) {
      console.error('[DanmakuClient] 停止客户端时出错:', error)
    }
  }

  async function dispose() {
    isInitializing = false

    if (danmakuClient.value) await disposeClientInstance(danmakuClient.value)
    state.value = 'waiting'
    authInfo.value = undefined
    stopHeartbeat()
    publishState('disconnected')
  }

  attachModelEventBridge(danmakuClient.value)

  return {
    danmakuClient,
    state,
    authInfo,
    connected,
    hasRemoteSource,
    hasAnySource,
    onEvent,
    offEvent,
    on,
    off,
    initOpenlive,
    initDirect,
    ensureOpenlive,
    dispose,
  }
})
