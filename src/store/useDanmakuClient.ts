import type { EventModel, OpenLiveInfo } from '@/api/api-models'
import type DanmakuEventEmitter from '@/shared/services/DanmakuClients/DanmakuEventEmitter'
import type { ModelEventListeners, RawEventListeners } from '@/shared/services/DanmakuClients/DanmakuEventEmitter'
import type { DirectClientAuthInfo } from '@/shared/services/DanmakuClients/DirectClient'
import type { AuthInfo } from '@/shared/services/DanmakuClients/OpenLiveClient'
import type { ClientType, DanmakuSourceMeta } from '@/shared/services/danmakuChannel'
import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, shallowRef } from 'vue'
import { useAccount } from '@/api/account'
import { isTauri } from '@/shared/config'
import BroadcastChannelClient from '@/shared/services/DanmakuClients/BroadcastChannelClient'
import DirectClient from '@/shared/services/DanmakuClients/DirectClient'
import LocalRpcClient from '@/shared/services/DanmakuClients/LocalRpcClient'
import OpenLiveClient from '@/shared/services/DanmakuClients/OpenLiveClient'
import { createDanmakuChannel } from '@/shared/services/danmakuChannel'
import { probeLocalFetcher } from '@/shared/rpc/client'

const MODEL_EVENT_NAMES = ['danmaku', 'gift', 'sc', 'guard', 'enter', 'scDel', 'follow', 'like'] as const
const REMOTE_SOURCE_TTL_MS = 15_000
const SOURCE_HEARTBEAT_MS = 3_000
const FALLBACK_ELECTION_MS = 600
const CONNECT_RETRY_MS = 5_000
const CONNECT_ATTEMPTS = 5

type EventName = typeof MODEL_EVENT_NAMES[number]
type EventNameWithAll = EventName | 'all'
type Listener = (arg1: any, arg2?: any) => void
type AllEventListener = (arg1: any) => void
type GenericListener = Listener | AllEventListener
type ConnectionPhase = 'idle' | 'electing' | 'connecting' | 'connected' | 'reconnecting' | 'error'

interface SourceIntent {
  scope: string
  type: Exclude<ClientType, 'broadcast'>
  allowLocal: boolean
  build: () => DanmakuEventEmitter
  meta?: DanmakuSourceMeta
}

interface RemoteSource {
  scope: string
  clientType: ClientType
  receivedAt: number
  meta?: DanmakuSourceMeta
}

function createSourceId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function hashScope(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function createModelListeners(): ModelEventListeners {
  return { danmaku: [], gift: [], sc: [], guard: [], enter: [], scDel: [], all: [], follow: [], like: [] }
}

function createRawListeners(): RawEventListeners {
  return { danmaku: [], gift: [], sc: [], guard: [], enter: [], scDel: [], all: [], follow: [], like: [] }
}

export const useDanmakuClient = defineStore('DanmakuClient', () => {
  const accountInfo = useAccount()
  const sourceId = createSourceId()
  const channel = createDanmakuChannel(sourceId)

  const danmakuClient = shallowRef<DanmakuEventEmitter>()
  const state = ref<'waiting' | 'connecting' | 'connected'>('waiting')
  const phase = ref<ConnectionPhase>('idle')
  const authInfo = ref<OpenLiveInfo>()
  const sourceMeta = ref<DanmakuSourceMeta>()
  const lastEventAt = ref<number>()
  const lastError = ref('')
  const reconnectCount = ref(0)
  const remoteSourceTick = ref(0)

  const modelListeners = createModelListeners()
  const rawListeners = createRawListeners()
  const remoteSources = new Map<string, RemoteSource>()

  let currentIntent: SourceIntent | undefined
  let activeScope = ''
  let generation = 0
  let connectTask: Promise<void> | undefined
  let connectTaskScope = ''
  let restartTask: Promise<void> | undefined
  let sourceHeartbeatTimer: ReturnType<typeof setInterval> | undefined
  let readerWatchdogTimer: ReturnType<typeof setInterval> | undefined
  let releaseLeaderLock: (() => void) | undefined
  let leaderLockTask: Promise<void> | undefined

  const connected = computed(() => state.value === 'connected')
  const hasRemoteSource = computed(() => {
    void remoteSourceTick.value
    return Boolean(currentIntent && getBestRemoteSource(currentIntent.scope))
  })
  const hasAnySource = computed(() => connected.value || hasRemoteSource.value)
  const connectionStatus = computed(() => {
    if (phase.value === 'connected') return sourceMeta.value?.uname ? `已连接: ${sourceMeta.value.uname}` : '已连接'
    if (phase.value === 'electing') return '正在选择弹幕源'
    if (phase.value === 'connecting') return '正在连接弹幕源'
    if (phase.value === 'reconnecting') return '弹幕源已断开，正在重连'
    if (phase.value === 'error') return lastError.value || '弹幕源连接失败'
    return '尚未连接'
  })

  const unsubscribeState = channel.onState((remoteId, scope, remoteState, clientType, meta) => {
    if (remoteState === 'connected') {
      remoteSources.set(remoteId, { scope, clientType, meta, receivedAt: Date.now() })
      remoteSourceTick.value++
      convergeFallbackLeader(remoteId, scope)
      if (danmakuClient.value?.type === 'broadcast' && scope === activeScope && meta) sourceMeta.value = meta
      return
    }

    remoteSources.delete(remoteId)
    remoteSourceTick.value++
    if (danmakuClient.value?.type === 'broadcast' && scope === activeScope && !getBestRemoteSource(scope)) {
      void restartConnection('上游标签页已断开')
    }
  })
  const unsubscribeStateRequest = channel.onStateRequest((scope) => {
    if (connected.value && isUpstreamClient() && scope === activeScope) publishState('connected')
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
    if (index >= 0) listeners.splice(index, 1)
  }

  function on(eventName: 'all', listener: AllEventListener): void
  function on(eventName: EventName, listener: Listener): void
  function on(eventName: EventNameWithAll, listener: GenericListener): void {
    const listeners = rawListeners[eventName] as GenericListener[]
    if (!listeners.includes(listener)) listeners.push(listener)
  }

  function off(eventName: 'all', listener: AllEventListener): void
  function off(eventName: EventName, listener: Listener): void
  function off(eventName: EventNameWithAll, listener: GenericListener): void {
    const listeners = rawListeners[eventName] as GenericListener[]
    const index = listeners.indexOf(listener)
    if (index >= 0) listeners.splice(index, 1)
  }

  function createOpenLiveIntent(auth?: AuthInfo): SourceIntent {
    const accountKey = accountInfo.value?.id ? `account:${accountInfo.value.id}` : `tab:${sourceId}`
    const authKey = auth?.Code ? `external:${hashScope(`${auth.Code}:${auth.Mid}:${auth.Caller}`)}` : accountKey
    return {
      scope: `openlive:${authKey}`,
      type: 'openlive',
      allowLocal: true,
      build: () => new OpenLiveClient(auth),
    }
  }

  async function initOpenlive(auth?: AuthInfo) {
    return activateIntent(createOpenLiveIntent(auth))
  }

  async function ensureOpenlive(options: { connect?: boolean } = {}) {
    if (connected.value) return useDanmakuClient()
    const intent = currentIntent ?? createOpenLiveIntent()
    return activateIntent(intent, false, options.connect !== false)
  }

  async function initDirect(auth: DirectClientAuthInfo) {
    return activateIntent({
      scope: `direct:${auth.roomId}:${auth.tokenUserId}`,
      type: 'direct',
      allowLocal: true,
      build: () => new DirectClient(auth),
      meta: { roomId: auth.roomId },
    })
  }

  async function initLocal() {
    return activateIntent({
      scope: `local:${accountInfo.value?.id ?? sourceId}`,
      type: 'local',
      allowLocal: false,
      build: () => new LocalRpcClient(),
    })
  }

  async function activateIntent(intent: SourceIntent, reconnecting = false, allowUpstream = true) {
    if (connected.value && currentIntent?.scope === intent.scope) return useDanmakuClient()
    if (connectTask && connectTaskScope === intent.scope) {
      await connectTask
      return useDanmakuClient()
    }

    currentIntent = intent
    const taskGeneration = ++generation
    await stopActiveConnection(true)
    state.value = 'connecting'
    phase.value = reconnecting ? 'reconnecting' : 'electing'
    lastError.value = ''
    activeScope = intent.scope

    const task = connectGeneration(intent, taskGeneration, reconnecting, allowUpstream)
    connectTask = task
    connectTaskScope = intent.scope
    try {
      await task
    } finally {
      if (connectTask === task) {
        connectTask = undefined
        connectTaskScope = ''
      }
    }
    return useDanmakuClient()
  }

  async function connectGeneration(intent: SourceIntent, taskGeneration: number, reconnecting: boolean, allowUpstream: boolean) {
    channel.requestState(intent.scope)
    const leader = await acquireLeadership(intent.scope, taskGeneration)
    if (!isCurrent(taskGeneration, intent)) return

    if (!leader) {
      await connectBroadcast(intent, taskGeneration)
      return
    }

    if (!allowUpstream) {
      releaseLeadership()
      state.value = 'waiting'
      phase.value = 'idle'
      return
    }

    phase.value = reconnecting ? 'reconnecting' : 'connecting'
    let allowLocal = intent.allowLocal
    for (let attempt = 1; attempt <= CONNECT_ATTEMPTS && isCurrent(taskGeneration, intent); attempt++) {
      const client = await buildLeaderClient(intent, allowLocal)
      if (!isCurrent(taskGeneration, intent)) {
        client.Stop()
        return
      }

      const result = await startClient(client, intent, taskGeneration)
      if (result) return
      if (client.type === 'local') allowLocal = false
      if (attempt < CONNECT_ATTEMPTS) await wait(CONNECT_RETRY_MS)
    }

    if (!isCurrent(taskGeneration, intent)) return
    await stopActiveConnection(false)
    state.value = 'waiting'
    phase.value = 'error'
    lastError.value ||= '无法连接弹幕源'
  }

  async function buildLeaderClient(intent: SourceIntent, allowLocal: boolean) {
    if (allowLocal && !isTauri() && await probeLocalFetcher()) return new LocalRpcClient()
    return intent.build()
  }

  async function startClient(client: DanmakuEventEmitter, intent: SourceIntent, taskGeneration: number) {
    danmakuClient.value = client
    client.eventsRaw = rawListeners
    client.onConnectionLost = () => {
      if (danmakuClient.value === client && isCurrent(taskGeneration, intent)) void restartConnection(`${client.type} 弹幕源意外断开`)
    }
    attachModelEventBridge(client, intent.scope)

    try {
      const result = await client.Start()
      if (!isCurrent(taskGeneration, intent) || danmakuClient.value !== client) {
        client.onConnectionLost = undefined
        client.Stop()
        return false
      }
      if (!result.success) {
        lastError.value = result.message || '弹幕源连接失败'
        client.onConnectionLost = undefined
        client.Stop()
        return false
      }

      authInfo.value = client instanceof OpenLiveClient ? client.roomAuthInfo : undefined
      sourceMeta.value = client instanceof OpenLiveClient && client.roomAuthInfo
        ? {
            roomId: client.roomAuthInfo.anchor_info.room_id,
            uname: client.roomAuthInfo.anchor_info.uname,
            avatar: client.roomAuthInfo.anchor_info.uface,
          }
        : intent.meta
      state.value = 'connected'
      phase.value = 'connected'
      startSourceHeartbeat()
      publishState('connected')
      console.log(`[DanmakuClient] 已连接 ${client.type} 弹幕源`)
      return true
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error)
      client.onConnectionLost = undefined
      client.Stop()
      return false
    }
  }

  async function connectBroadcast(intent: SourceIntent, taskGeneration: number) {
    const owner = getBestRemoteSource(intent.scope)
    const client = new BroadcastChannelClient(channel, intent.scope, owner?.id)
    danmakuClient.value = client
    client.eventsRaw = rawListeners
    attachModelEventBridge(client, intent.scope)
    const result = await client.Start()
    if (!result.success || !isCurrent(taskGeneration, intent)) {
      client.Stop()
      return
    }

    sourceMeta.value = owner?.source.meta
    state.value = 'connected'
    phase.value = 'connected'
    startReaderWatchdog()
    console.log('[DanmakuClient] 已接入同浏览器主弹幕源')
  }

  function attachModelEventBridge(client: DanmakuEventEmitter, scope: string) {
    client.eventsAsModel = client.createEmptyEventModelListeners()
    const upstream = client.type !== 'broadcast'
    for (const eventName of MODEL_EVENT_NAMES) {
      client.eventsAsModel[eventName].push((data, command) => {
        lastEventAt.value = Date.now()
        emitLocalEvent(eventName, data, command)
        if (upstream) channel.publishEvent(scope, eventName, data)
      })
    }
  }

  function emitLocalEvent(eventName: EventName, data: EventModel, command?: any) {
    for (const listener of modelListeners[eventName]) listener(data, command)
    for (const listener of modelListeners.all) listener(data)
  }

  async function restartConnection(reason: string) {
    if (!currentIntent || restartTask) return restartTask
    const intent = currentIntent
    reconnectCount.value++
    console.warn(`[DanmakuClient] ${reason}`)
    const task = activateIntent(intent, true).then(() => undefined)
    restartTask = task
    try {
      await task
    } finally {
      if (restartTask === task) restartTask = undefined
    }
  }

  async function stopActiveConnection(announce: boolean) {
    stopSourceHeartbeat()
    stopReaderWatchdog()
    const client = danmakuClient.value
    if (announce && client && client.type !== 'broadcast' && activeScope) publishState('disconnected')
    if (client) {
      client.onConnectionLost = undefined
      client.Stop()
    }
    danmakuClient.value = undefined
    authInfo.value = undefined
    sourceMeta.value = undefined
    releaseLeadership()
  }

  async function dispose() {
    currentIntent = undefined
    activeScope = ''
    ++generation
    await stopActiveConnection(true)
    state.value = 'waiting'
    phase.value = 'idle'
  }

  function isCurrent(taskGeneration: number, intent: SourceIntent) {
    return generation === taskGeneration && currentIntent === intent
  }

  function isUpstreamClient() {
    return danmakuClient.value !== undefined && danmakuClient.value.type !== 'broadcast'
  }

  function publishState(nextState: 'connected' | 'disconnected') {
    if (!danmakuClient.value || !activeScope) return
    channel.publishState(activeScope, nextState, danmakuClient.value.type, sourceMeta.value)
  }

  function startSourceHeartbeat() {
    stopSourceHeartbeat()
    sourceHeartbeatTimer = setInterval(() => {
      if (connected.value && isUpstreamClient()) publishState('connected')
    }, SOURCE_HEARTBEAT_MS)
  }

  function stopSourceHeartbeat() {
    if (!sourceHeartbeatTimer) return
    clearInterval(sourceHeartbeatTimer)
    sourceHeartbeatTimer = undefined
  }

  function startReaderWatchdog() {
    stopReaderWatchdog()
    readerWatchdogTimer = setInterval(() => { void verifyLeaderLock() }, SOURCE_HEARTBEAT_MS)
  }

  function stopReaderWatchdog() {
    if (!readerWatchdogTimer) return
    clearInterval(readerWatchdogTimer)
    readerWatchdogTimer = undefined
  }

  async function verifyLeaderLock() {
    if (danmakuClient.value?.type !== 'broadcast' || !currentIntent || restartTask) return
    if (navigator.locks) {
      const scope = currentIntent.scope
      const snapshot = await navigator.locks.query()
      if (!snapshot.held?.some(lock => lock.name === getLockName(scope))) {
        await restartConnection('主弹幕源已退出')
      }
      return
    }
    if (!getBestRemoteSource(currentIntent.scope)) await restartConnection('主弹幕源心跳已过期')
  }

  function getLockName(scope: string) {
    return `vtsuru.danmaku.source.${scope}`
  }

  async function acquireLeadership(scope: string, taskGeneration: number) {
    if (!navigator.locks) return fallbackElection(scope, taskGeneration)
    return new Promise<boolean>((resolve) => {
      let decided = false
      const decide = (leader: boolean) => {
        if (decided) return
        decided = true
        resolve(leader)
      }

      const task = navigator.locks.request(getLockName(scope), { ifAvailable: true }, async (lock) => {
        if (!lock || generation !== taskGeneration) {
          decide(false)
          return
        }
        decide(true)
        await new Promise<void>((release) => { releaseLeaderLock = release })
      }).catch((error) => {
        console.warn('[DanmakuClient] Web Locks 获取失败:', error)
        decide(false)
      }).finally(() => {
        if (leaderLockTask === task) leaderLockTask = undefined
      })
      leaderLockTask = task
    })
  }

  async function fallbackElection(scope: string, taskGeneration: number) {
    channel.requestState(scope)
    await wait(FALLBACK_ELECTION_MS)
    if (generation !== taskGeneration) return false
    return !getBestRemoteSource(scope)
  }

  function releaseLeadership() {
    releaseLeaderLock?.()
    releaseLeaderLock = undefined
  }

  function convergeFallbackLeader(remoteId: string, scope: string) {
    if (navigator.locks || !connected.value || !isUpstreamClient() || scope !== activeScope) return
    if (remoteId.localeCompare(sourceId) < 0) void restartConnection('检测到优先级更高的同浏览器弹幕源')
  }

  function getBestRemoteSource(scope: string) {
    pruneRemoteSources()
    const candidates = [...remoteSources.entries()]
      .filter(([, source]) => source.scope === scope)
      .toSorted(([left], [right]) => left.localeCompare(right))
    if (!candidates.length) return undefined
    const [id, source] = candidates[0]
    return { id, source }
  }

  function pruneRemoteSources() {
    const expiredAt = Date.now() - REMOTE_SOURCE_TTL_MS
    let changed = false
    for (const [id, source] of remoteSources) {
      if (source.receivedAt < expiredAt) {
        remoteSources.delete(id)
        changed = true
      }
    }
    if (changed) remoteSourceTick.value++
  }

  async function wait(duration: number) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        clearTimeout(timer)
        resolve()
      }, duration)
    })
  }

  const pruneTimer = setInterval(pruneRemoteSources, SOURCE_HEARTBEAT_MS)
  onScopeDispose(() => {
    void dispose()
    unsubscribeState()
    unsubscribeStateRequest()
    channel.close()
    clearInterval(pruneTimer)
  })

  return {
    danmakuClient,
    state,
    phase,
    authInfo,
    sourceMeta,
    lastEventAt,
    lastError,
    reconnectCount,
    connectionStatus,
    connected,
    hasRemoteSource,
    hasAnySource,
    onEvent,
    offEvent,
    on,
    off,
    initOpenlive,
    initDirect,
    initLocal,
    ensureOpenlive,
    dispose,
  }
})
