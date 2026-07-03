import type { EventModel, OpenLiveInfo } from '@/api/api-models'
import type DanmakuEventEmitter from '@/shared/services/DanmakuClients/DanmakuEventEmitter'
import type { DirectClientAuthInfo } from '@/shared/services/DanmakuClients/DirectClient'
import type { AuthInfo } from '@/shared/services/DanmakuClients/OpenLiveClient'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { useAccount } from '@/api/account'
import { isTauri } from '@/shared/config'
import BroadcastChannelClient from '@/shared/services/DanmakuClients/BroadcastChannelClient'
import DirectClient from '@/shared/services/DanmakuClients/DirectClient'
import LocalRpcClient from '@/shared/services/DanmakuClients/LocalRpcClient'
import OpenLiveClient from '@/shared/services/DanmakuClients/OpenLiveClient'
import { createDanmakuChannel } from '@/shared/services/danmakuChannel'
import { probeLocalFetcher } from '@/shared/rpc/client'

const MODEL_EVENT_NAMES = ['danmaku', 'gift', 'sc', 'guard', 'enter', 'scDel', 'follow', 'like'] as const
const REMOTE_SOURCE_TTL_MS = 10_000
const DEFAULT_REMOTE_WAIT_MS = 600

type EventName = typeof MODEL_EVENT_NAMES[number]
type EventNameWithAll = EventName | 'all'
type Listener = (arg1: any, arg2?: any) => void
type AllEventListener = (arg1: any) => void
type GenericListener = Listener | AllEventListener
type ModelListeners = DanmakuEventEmitter['eventsAsModel']

function createSourceId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function createModelListeners(client: DanmakuEventEmitter): ModelListeners {
  return client.createEmptyEventModelListeners()
}

export const useDanmakuClient = defineStore('DanmakuClient', () => {
  const danmakuClient = shallowRef<DanmakuEventEmitter | undefined>(new OpenLiveClient())
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
  const channel = createDanmakuChannel(sourceId, currentAccountId, isSameAccount)

  let isInitializing = false
  let initFinished: Promise<void> | undefined
  let resolveInitFinished: (() => void) | undefined
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined
  let readerWatchdogTimer: ReturnType<typeof setInterval> | undefined

  // 事件的接收由 BroadcastChannelClient 承担; store 只关心「谁在当上游」这个决策信号。
  channel.onState((remoteId, remoteState, at) => {
    if (remoteState === 'connected') {
      markRemoteSource(remoteId, at)
    } else {
      remoteSources.delete(remoteId)
      remoteSourceTick.value = Date.now()
      onRemoteSourceLost()
    }
  })
  channel.onStateRequest(() => {
    // 仅上游 client 应答在场查询; broadcast reader 自己也是消费者, 不冒充源
    if (connected.value && danmakuClient.value?.type !== 'broadcast') publishState('connected')
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
    return ensureSource(() => new OpenLiveClient(auth))
  }

  async function initDirect(auth: DirectClientAuthInfo) {
    return ensureSource(() => new DirectClient(auth))
  }

  async function initLocal() {
    return initClient(new LocalRpcClient())
  }

  // 尝试接入本地 eventfetcher (仅网页环境; Tauri webview 是 fetcher 自身, 不连自己)
  // 先用轻量 /health 探测, 未安装则立即回退, 不进入 initClient 的重试循环 (避免拖延)。
  async function tryLocalFetcher() {
    if (isTauri()) return false
    if (!await probeLocalFetcher()) return false
    await initLocal()
    return connected.value
  }

  // 统一的弹幕源选择链: 同浏览器已有上游 → broadcast 消费; 否则本地 fetcher; 都没有才由调用方指定的上游 (openlive/direct) 建连。
  // 所有「我需要弹幕」的入口 (页面直连 initOpenlive/initDirect, 或 ensureOpenlive) 都走这里, 保证跨标签页复用。
  async function ensureSource(
    buildUpstream: () => DanmakuEventEmitter,
    options: { connect?: boolean, remoteWaitMs?: number } = {},
  ) {
    if (connected.value) return useDanmakuClient()
    if (isInitializing) {
      if (initFinished) await initFinished
      return useDanmakuClient()
    }

    await waitForRemoteSource(options.remoteWaitMs ?? DEFAULT_REMOTE_WAIT_MS)

    // 同浏览器已有其他标签页在当上游 → 作为消费者接入, 不重复建上游连接
    if (hasFreshRemoteSource()) {
      await initClient(new BroadcastChannelClient(channel))
      return useDanmakuClient()
    }
    if (options.connect === false) return useDanmakuClient()

    // 优先接入本地 eventfetcher, 未安装则回退到调用方指定的上游
    if (await tryLocalFetcher()) return useDanmakuClient()

    await initClient(buildUpstream())
    return useDanmakuClient()
  }

  async function ensureOpenlive(options: { connect?: boolean, remoteWaitMs?: number } = {}) {
    return ensureSource(() => new OpenLiveClient(), options)
  }

  // 上游标签页断开时: 若本 tab 只是 broadcast 消费者且已无其他源, 则重新选主 (通常升级为自建)
  function onRemoteSourceLost() {
    if (danmakuClient.value?.type !== 'broadcast') return
    if (hasFreshRemoteSource()) return
    console.log('[DanmakuClient] 上游标签页已断开, 重新选择弹幕源')
    void reselectSource()
  }

  // 当前活跃源 (本 tab 自建的 openlive/direct/local) 意外断开时重新走选择链。
  // 用 client 身份校验防止已被替换的旧实例误触发。
  function onActiveSourceLost(client: DanmakuEventEmitter) {
    if (danmakuClient.value !== client) return
    console.warn(`[DanmakuClient] 弹幕源 (${client.type}) 意外断开, 重新选择弹幕源`)
    void reselectSource()
  }

  async function reselectSource() {
    await dispose()
    await ensureOpenlive()
  }

  async function initClient(client: DanmakuEventEmitter) {
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
      danmakuClient.value.onConnectionLost = () => onActiveSourceLost(client)
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
      // 仅上游 client 对外宣告自己是弹幕源 (broadcast reader 只是消费者)
      if (isUpstreamClient()) {
        startHeartbeat()
        publishState('connected')
      } else {
        // broadcast reader: 上游可能崩溃/直接关闭标签页 (无干净 disconnected 消息),
        // 心跳会随之消失。用看门狗轮询远端源新鲜度, 过期即重新选源。
        startReaderWatchdog()
      }
      console.log('[DanmakuClient] 初始化成功')
      return true
    } catch (error) {
      console.error('[DanmakuClient] 连接尝试期间发生异常:', error)
      return false
    }
  }

  function attachModelEventBridge(client: DanmakuEventEmitter) {
    client.eventsAsModel = client.createEmptyEventModelListeners()
    // broadcast reader 消费的正是别人广播的事件, 若再广播出去会形成回声, 故只有上游 client 才 sink
    const isUpstream = client.type !== 'broadcast'

    for (const eventName of MODEL_EVENT_NAMES) {
      const listeners = client.eventsAsModel[eventName] as Array<(data: EventModel, command?: any) => void>
      listeners.push((data, command) => {
        emitLocalEvent(eventName, data, command)
        if (isUpstream) publishEvent(eventName, data)
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
    channel.publishEvent(eventName, data)
  }

  function publishState(nextState: 'connected' | 'disconnected') {
    channel.publishState(nextState, danmakuClient.value?.type)
  }

  async function waitForRemoteSource(waitMs: number) {
    if (hasFreshRemoteSource()) return
    channel.requestState()
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

  // broadcast reader 专用: 定期检查上游是否还在。上游崩溃时不会发 disconnected,
  // 只能靠源过期 (REMOTE_SOURCE_TTL_MS) 判定并重新选源。
  function startReaderWatchdog() {
    if (readerWatchdogTimer) return
    readerWatchdogTimer = setInterval(() => {
      if (danmakuClient.value?.type !== 'broadcast') return
      if (!hasFreshRemoteSource()) onRemoteSourceLost()
    }, 3000)
  }

  function stopReaderWatchdog() {
    if (!readerWatchdogTimer) return
    clearInterval(readerWatchdogTimer)
    readerWatchdogTimer = undefined
  }

  async function disposeClientInstance(client: DanmakuEventEmitter) {
    try {
      client.Stop()
    } catch (error) {
      console.error('[DanmakuClient] 停止客户端时出错:', error)
    }
  }

  function isUpstreamClient() {
    return danmakuClient.value !== undefined && danmakuClient.value.type !== 'broadcast'
  }

  async function dispose() {
    isInitializing = false

    const wasUpstream = isUpstreamClient()
    if (danmakuClient.value) await disposeClientInstance(danmakuClient.value)
    state.value = 'waiting'
    authInfo.value = undefined
    stopHeartbeat()
    stopReaderWatchdog()
    if (wasUpstream) publishState('disconnected')
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
    initLocal,
    ensureOpenlive,
    dispose,
  }
})
