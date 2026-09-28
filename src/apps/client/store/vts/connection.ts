import { ApiClient } from 'vtubestudio'
import { ref, shallowRef } from 'vue'

import { svgUrlToPngBase64 } from '@/apps/client/api/vts/icon'
import type {
  VtsHotkeyInfo,
  VtsItemEventData,
  VtsModelMovedEventData,
  VtsStatisticsResponseData,
} from '@/apps/client/api/vts/messages'
import pluginSvgUrl from '@/svgs/ic_vtuber.svg?url'

import type { VtsConfig } from './config'
import type { VtsHistory, VtsOpKind } from './history'

const PLUGIN_NAME = 'vtsuru'
const PLUGIN_DEVELOPER = 'Megghy'
const MONITOR_INTERVAL_MS = 1000

export interface VtsExpression {
  name: string
  file: string
  active: boolean
}

/**
 * ApiClient 自带断线重连 + 自动鉴权 (无 token 时向 VTS 申请并经 authTokenSetter 持久化),
 * 且重连后自动重放事件订阅; 'connect' 事件在鉴权完成后才触发。
 * 因此这里只负责创建/销毁 client, 并在每次会话建立时刷新模型相关状态。
 */
export function createVtsConnection(config: VtsConfig, { withHistory }: VtsHistory) {
  const client = shallowRef<ApiClient | null>(null)
  /** client 已创建, 正在等待 VTS 启动 / 用户在 VTS 内授权 */
  const connecting = ref(false)
  /** 会话已鉴权, 可直接调用 API */
  const connected = ref(false)
  const apiVersion = ref<string | null>(null)
  const lastRttMs = ref<number | null>(null)
  const statistics = ref<VtsStatisticsResponseData | null>(null)
  const monitorLastError = ref<string | null>(null)
  const faceFound = ref<boolean | null>(null)
  const leftHandFound = ref<boolean | null>(null)
  const rightHandFound = ref<boolean | null>(null)
  const currentModelName = ref<string | null>(null)
  const currentModelTransform = ref<VtsModelMovedEventData['modelPosition'] | null>(null)
  const hotkeys = ref<VtsHotkeyInfo[]>([])
  const expressions = ref<VtsExpression[]>([])
  const lastError = ref<string | null>(null)
  const itemEventWaiters = new Map<string, { resolve: (data: VtsItemEventData) => void; acceptTypes: Set<string> }>()
  let monitorTimer: number | undefined

  const setError = (err: unknown) => {
    lastError.value = err instanceof Error ? err.message : String(err)
  }

  async function request<T>(fn: (c: ApiClient) => Promise<T>): Promise<T> {
    const c = client.value
    if (!c || !connected.value) throw new Error('VTS 未连接')
    const started = performance.now()
    const result = await fn(c)
    lastRttMs.value = Math.round(performance.now() - started)
    return result
  }

  /** 带操作历史记录的 API 调用, 用于有副作用的动作 */
  async function call<T>(kind: VtsOpKind, detail: string | undefined, fn: (c: ApiClient) => Promise<T>, payload?: unknown) {
    return withHistory(kind, detail, async () => request(fn), payload)
  }

  async function refreshHotkeys() {
    const data = await request(async (c) => c.hotkeysInCurrentModel({}))
    currentModelName.value = data.modelLoaded ? data.modelName : null
    hotkeys.value = data.availableHotkeys.map((h) => ({ ...h, keyCombination: h.keyCombination.map(String) }))
  }

  async function refreshExpressions() {
    const data = await request(async (c) => c.expressionState({ details: false }))
    expressions.value = data.expressions.map(({ name, file, active }) => ({ name, file, active }))
  }

  async function refreshModelState() {
    await Promise.all([refreshHotkeys(), refreshExpressions()])
  }

  async function subscribeEvents(c: ApiClient) {
    await c.events.trackingStatusChanged.subscribe((data) => {
      faceFound.value = data.faceFound
      leftHandFound.value = data.leftHandFound
      rightHandFound.value = data.rightHandFound
    })
    await c.events.modelLoaded.subscribe(() => {
      currentModelTransform.value = null
      void refreshModelState().catch(setError)
    }, {})
    await c.events.modelMoved.subscribe((data) => {
      currentModelTransform.value = data.modelPosition
    })
    await c.events.item.subscribe((data) => {
      const event = data as unknown as VtsItemEventData
      const waiter = itemEventWaiters.get(event.itemInstanceID)
      if (waiter?.acceptTypes.has(event.itemEventType)) waiter.resolve(event)
    }, {})
  }

  async function waitForItemEvent(itemInstanceID: string, acceptTypes: string[], timeoutMs: number) {
    return new Promise<VtsItemEventData | null>((resolve) => {
      const timer = window.setTimeout(() => {
        itemEventWaiters.delete(itemInstanceID)
        resolve(null)
      }, timeoutMs)
      itemEventWaiters.set(itemInstanceID, {
        acceptTypes: new Set(acceptTypes),
        resolve: (data) => {
          window.clearTimeout(timer)
          itemEventWaiters.delete(itemInstanceID)
          resolve(data)
        },
      })
    })
  }

  async function pollMonitor() {
    try {
      const [stats, face] = await Promise.all([
        request(async (c) => c.statistics()),
        request(async (c) => c.faceFound()),
      ])
      statistics.value = stats
      faceFound.value = face.found
      monitorLastError.value = null
    } catch (err) {
      monitorLastError.value = err instanceof Error ? err.message : String(err)
    }
  }

  function stopMonitor() {
    window.clearInterval(monitorTimer)
    monitorTimer = undefined
    statistics.value = null
    monitorLastError.value = null
  }

  function resetSession() {
    stopMonitor()
    connected.value = false
    apiVersion.value = null
    faceFound.value = null
    leftHandFound.value = null
    rightHandFound.value = null
    currentModelTransform.value = null
    expressions.value = []
    itemEventWaiters.clear()
  }

  async function onSession(c: ApiClient, firstSession: boolean) {
    connecting.value = false
    connected.value = true
    lastError.value = null
    await withHistory('connect', config.wsUrl.value, async () => {
      apiVersion.value = (await c.apiState()).vTubeStudioVersion
      if (firstSession) await subscribeEvents(c)
      await refreshModelState()
    })
    monitorTimer ??= window.setInterval(() => void pollMonitor(), MONITOR_INTERVAL_MS)
  }

  async function connect() {
    if (client.value || connecting.value) return
    connecting.value = true
    lastError.value = null
    const c = new ApiClient({
      url: config.wsUrl.value,
      pluginName: PLUGIN_NAME,
      pluginDeveloper: PLUGIN_DEVELOPER,
      pluginIcon: await svgUrlToPngBase64(pluginSvgUrl, 128),
      authTokenGetter: () => config.authToken.value || null,
      authTokenSetter: config.saveAuthToken,
    })
    let sessions = 0
    c.on('connect', () => void onSession(c, sessions++ === 0).catch(setError))
    c.on('disconnect', () => {
      resetSession()
      connecting.value = client.value === c
    })
    c.on('error', setError)
    client.value = c
  }

  async function disconnect() {
    const c = client.value
    if (!c) return
    client.value = null
    connecting.value = false
    resetSession()
    await withHistory('disconnect', undefined, async () => c.disconnect())
  }

  /** 清除 token 并重连, ApiClient 会重新向 VTS 申请授权 */
  async function reauthorize() {
    await config.saveAuthToken('')
    await disconnect()
    await connect()
  }

  return {
    connecting,
    connected,
    apiVersion,
    lastRttMs,
    statistics,
    monitorLastError,
    faceFound,
    leftHandFound,
    rightHandFound,
    currentModelName,
    currentModelTransform,
    hotkeys,
    expressions,
    lastError,

    request,
    call,
    connect,
    disconnect,
    reauthorize,
    refreshHotkeys,
    refreshExpressions,
    refreshModelState,
    waitForItemEvent,
  }
}

export type VtsConnection = ReturnType<typeof createVtsConnection>
