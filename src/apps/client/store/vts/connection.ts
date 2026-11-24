import { ApiClient, HotkeyType, VTubeStudioError } from 'vtubestudio'
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

export interface VtsAvailableModel {
  modelID: string
  modelName: string
  modelLoaded: boolean
  vtsModelName: string
}

export interface VtsInputParameter {
  name: string
  value: number
  min: number
  max: number
  defaultValue: number
  isCustom: boolean
}

export interface VtsPostProcessingState {
  supported: boolean
  active: boolean
  activePreset: string
  presets: string[]
  canUpdate: boolean
}

export interface VtsPhysicsGroup {
  groupID: string
  groupName: string
  strengthMultiplier: number
  windMultiplier: number
}

export interface VtsPhysicsState {
  modelHasPhysics: boolean
  physicsSwitchedOn: boolean
  usingLegacyPhysics: boolean
  physicsFPSSetting: number
  baseStrength: number
  baseWind: number
  apiPhysicsOverrideActive: boolean
  apiPhysicsOverridePluginName: string
  physicsGroups: VtsPhysicsGroup[]
}

export interface VtsNdiState {
  ndiActive: boolean
  useNDI5: boolean
  useCustomResolution: boolean
  customWidthNDI: number
  customHeightNDI: number
}

export interface VtsFolderInfo {
  models: string
  backgrounds: string
  items: string
  config: string
  logs: string
  backup: string
}

export interface VtsArtMeshInfo {
  artMeshNames: string[]
  artMeshTags: string[]
  artMeshGroups: Array<{
    groupID: string
    groupName: string
    numberOfArtMeshesInGroup: number
    artMeshNames: string[]
  }>
}

export interface VtsModelClickEvent {
  ts: number
  modelName: string
  mouseButtonID: number
  artMeshIDs: string[]
}

function formatConnectionError(err: unknown): { message: string; fatal: boolean } {
  if (err instanceof VTubeStudioError) {
    const errorID = (err.data as { errorID?: number } | undefined)?.errorID
    if (errorID === 50)
      return { message: 'VTube Studio 拒绝了插件授权，请重新点击「连接」并在 VTS 中允许', fatal: true }
    if (errorID === 51) return { message: 'VTube Studio 授权失效，请尝试「重新授权」', fatal: true }
    return { message: err.message, fatal: false }
  }
  const msg = err instanceof Error ? err.message : String(err)
  if (/not enabled/i.test(msg)) {
    return { message: 'VTube Studio 未开启「启动 API」，请先在 VTS 设置中打开插件 API', fatal: true }
  }
  if (/rejected|Authentication with VTube Studio failed/i.test(msg)) {
    return { message: `VTS 授权失败：${msg}`, fatal: true }
  }
  return { message: msg, fatal: false }
}

/**
 * ApiClient 自带断线重连 + 自动鉴权 (无 token 时向 VTS 申请并经 authTokenSetter 持久化),
 * 且重连后自动重放事件订阅; 'connect' 事件在鉴权完成后才触发。
 */
export function createVtsConnection(config: VtsConfig, { withHistory }: VtsHistory) {
  const client = shallowRef<ApiClient | null>(null)
  /** client 已创建, 正在等待 VTS 启动 / 用户在 VTS 内授权 */
  const connecting = ref(false)
  /** 会话已鉴权, 可直接调用 API */
  const connected = ref(false)
  const wsRetryCount = ref(0)
  const apiVersion = ref<string | null>(null)
  const lastRttMs = ref<number | null>(null)
  const statistics = ref<VtsStatisticsResponseData | null>(null)
  const monitorLastError = ref<string | null>(null)
  const faceFound = ref<boolean | null>(null)
  const leftHandFound = ref<boolean | null>(null)
  const rightHandFound = ref<boolean | null>(null)
  const currentModelId = ref<string | null>(null)
  const currentModelName = ref<string | null>(null)
  const currentModelTransform = ref<VtsModelMovedEventData['modelPosition'] | null>(null)
  const availableModels = ref<VtsAvailableModel[]>([])
  const hotkeys = ref<VtsHotkeyInfo[]>([])
  const expressions = ref<VtsExpression[]>([])
  const inputParameters = ref<VtsInputParameter[]>([])
  const postProcessing = ref<VtsPostProcessingState | null>(null)
  const physicsState = ref<VtsPhysicsState | null>(null)
  const ndiState = ref<VtsNdiState | null>(null)
  const folderInfo = ref<VtsFolderInfo | null>(null)
  const artMeshInfo = ref<VtsArtMeshInfo | null>(null)
  const lastModelClick = ref<VtsModelClickEvent | null>(null)
  const lastError = ref<string | null>(null)
  const itemEventWaiters = new Map<string, { resolve: (data: VtsItemEventData) => void; acceptTypes: Set<string> }>()
  const sessionReadyHooks = new Set<() => Promise<void> | void>()
  const sessionResetHooks = new Set<() => void>()
  const modelLoadedHooks = new Set<(modelId: string, modelName: string) => Promise<void> | void>()
  const modelClickedHooks = new Set<(event: VtsModelClickEvent) => Promise<void> | void>()
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
  async function call<T>(
    kind: VtsOpKind,
    detail: string | undefined,
    fn: (c: ApiClient) => Promise<T>,
    payload?: unknown,
  ) {
    return withHistory(kind, detail, async () => request(fn), payload)
  }

  async function refreshCurrentModel() {
    const data = await request(async (c) => c.currentModel())
    currentModelId.value = data.modelLoaded ? data.modelID : null
    currentModelName.value = data.modelLoaded ? data.modelName : null
    currentModelTransform.value = data.modelLoaded ? data.modelPosition : null
  }

  async function refreshAvailableModels() {
    const data = await request(async (c) => c.availableModels())
    availableModels.value = data.availableModels.map(({ modelID, modelName, modelLoaded, vtsModelName }) => ({
      modelID,
      modelName,
      modelLoaded,
      vtsModelName,
    }))
  }

  async function refreshHotkeys() {
    const data = await request(async (c) => c.hotkeysInCurrentModel({}))
    currentModelName.value = data.modelLoaded ? data.modelName : null
    if (data.modelLoaded && data.modelID) currentModelId.value = data.modelID
    hotkeys.value = data.availableHotkeys.map((h) => ({ ...h, keyCombination: h.keyCombination.map(String) }))
  }

  async function refreshExpressions() {
    const data = await request(async (c) => c.expressionState({ details: false }))
    expressions.value = data.expressions.map(({ name, file, active }) => ({ name, file, active }))
  }

  async function refreshInputParameters() {
    const data = await request(async (c) => c.inputParameterList())
    const seen = new Set<string>()
    const merged: VtsInputParameter[] = []
    for (const [list, isCustom] of [
      [data.customParameters, true],
      [data.defaultParameters, false],
    ] as const) {
      for (const p of list) {
        if (seen.has(p.name)) continue
        seen.add(p.name)
        merged.push({
          name: p.name,
          value: p.value,
          min: p.min,
          max: p.max,
          defaultValue: p.defaultValue,
          isCustom,
        })
      }
    }
    inputParameters.value = merged
  }

  async function refreshPostProcessing() {
    const data = await request(async (c) =>
      c.postProcessingList({ fillPostProcessingPresetsArray: true, fillPostProcessingEffectsArray: false }),
    )
    postProcessing.value = {
      supported: data.postProcessingSupported,
      active: data.postProcessingActive,
      activePreset: data.activePreset,
      presets: data.postProcessingPresets ?? [],
      canUpdate: data.canSendPostProcessingUpdateRequestRightNow,
    }
  }

  async function refreshPhysics() {
    const data = await request(async (c) => c.getCurrentModelPhysics())
    physicsState.value = data.modelLoaded
      ? {
          modelHasPhysics: data.modelHasPhysics,
          physicsSwitchedOn: data.physicsSwitchedOn,
          usingLegacyPhysics: data.usingLegacyPhysics,
          physicsFPSSetting: data.physicsFPSSetting,
          baseStrength: data.baseStrength,
          baseWind: data.baseWind,
          apiPhysicsOverrideActive: data.apiPhysicsOverrideActive,
          apiPhysicsOverridePluginName: data.apiPhysicsOverridePluginName,
          physicsGroups: data.physicsGroups ?? [],
        }
      : null
  }

  async function refreshNdiConfig() {
    const data = await request(async (c) =>
      c.ndiConfig({
        setNewConfig: false,
        ndiActive: false,
        useNDI5: true,
        useCustomResolution: false,
        customWidthNDI: -1,
        customHeightNDI: -1,
      }),
    )
    ndiState.value = {
      ndiActive: data.ndiActive,
      useNDI5: data.useNDI5,
      useCustomResolution: data.useCustomResolution,
      customWidthNDI: data.customWidthNDI,
      customHeightNDI: data.customHeightNDI,
    }
  }

  async function refreshFolderInfo() {
    const data = await request(async (c) => c.vtsFolderInfo())
    folderInfo.value = data
  }

  async function refreshArtMeshes() {
    const data = await request(async (c) => c.artMeshList())
    artMeshInfo.value = data.modelLoaded
      ? {
          artMeshNames: data.artMeshNames ?? [],
          artMeshTags: data.artMeshTags ?? [],
          artMeshGroups: data.artMeshGroups ?? [],
        }
      : null
  }

  async function refreshModelState() {
    await Promise.all([
      refreshCurrentModel(),
      refreshHotkeys(),
      refreshExpressions(),
      refreshInputParameters().catch(() => {}),
      refreshPhysics().catch(() => {
        physicsState.value = null
      }),
      refreshArtMeshes().catch(() => {
        artMeshInfo.value = null
      }),
    ])
  }

  async function subscribeEvents(c: ApiClient) {
    await c.events.trackingStatusChanged.subscribe((data) => {
      faceFound.value = data.faceFound
      leftHandFound.value = data.leftHandFound
      rightHandFound.value = data.rightHandFound
    })
    await c.events.modelLoaded.subscribe((data) => {
      currentModelTransform.value = null
      currentModelId.value = data.modelLoaded ? data.modelID : null
      currentModelName.value = data.modelLoaded ? data.modelName : null
      void Promise.all([refreshModelState(), refreshAvailableModels().catch(() => {})])
        .then(async () => {
          if (data.modelLoaded && data.modelID) {
            for (const hook of modelLoadedHooks) await hook(data.modelID, data.modelName)
          }
        })
        .catch(setError)
    }, {})
    await c.events.modelMoved.subscribe((data) => {
      currentModelTransform.value = data.modelPosition
    })
    await c.events.item.subscribe((data) => {
      const event = data as unknown as VtsItemEventData
      const waiter = itemEventWaiters.get(event.itemInstanceID)
      if (waiter?.acceptTypes.has(event.itemEventType)) waiter.resolve(event)
    }, {})
    await c.events.modelConfigChanged
      .subscribe(() => {
        void Promise.all([refreshHotkeys(), refreshExpressions()]).catch(setError)
      })
      .catch(() => {})
    await c.events.hotkeyTriggered
      .subscribe((data) => {
        if (
          data.hotkeyAction === HotkeyType.ToggleExpression ||
          data.hotkeyAction === HotkeyType.RemoveAllExpressions
        ) {
          void refreshExpressions().catch(setError)
        }
      }, {})
      .catch(() => {})
    await c.events.postProcessing
      .subscribe((data) => {
        if (postProcessing.value) {
          postProcessing.value = {
            ...postProcessing.value,
            active: data.currentOnState,
            activePreset: data.currentPreset,
          }
        }
      })
      .catch(() => {})
    await c.events.modelClicked
      .subscribe(
        (data) => {
          if (!data.modelWasClicked) return
          const evt: VtsModelClickEvent = {
            ts: Date.now(),
            modelName: data.loadedModelName,
            mouseButtonID: data.mouseButtonID,
            artMeshIDs: data.artMeshHits.map((h) => h.hitInfo.artMeshID),
          }
          lastModelClick.value = evt
          for (const hook of modelClickedHooks) {
            void Promise.resolve(hook(evt)).catch(() => {})
          }
        },
        { onlyClicksOnModel: true },
      )
      .catch(() => {})
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
    lastRttMs.value = null
    faceFound.value = null
    leftHandFound.value = null
    rightHandFound.value = null
    currentModelId.value = null
    currentModelName.value = null
    currentModelTransform.value = null
    availableModels.value = []
    hotkeys.value = []
    expressions.value = []
    inputParameters.value = []
    postProcessing.value = null
    physicsState.value = null
    ndiState.value = null
    folderInfo.value = null
    artMeshInfo.value = null
    lastModelClick.value = null
    itemEventWaiters.clear()
    for (const hook of sessionResetHooks) hook()
  }

  async function onSession(c: ApiClient, getSubscribed: () => boolean, markSubscribed: () => void) {
    if (client.value !== c) return
    connecting.value = false
    connected.value = true
    wsRetryCount.value = 0
    lastError.value = null
    await withHistory('connect', config.wsUrl.value, async () => {
      apiVersion.value = (await c.apiState()).vTubeStudioVersion
      if (!getSubscribed()) {
        await subscribeEvents(c)
        markSubscribed()
      }
      await Promise.all([
        refreshModelState(),
        refreshAvailableModels().catch(() => {}),
        refreshPostProcessing().catch(() => {
          postProcessing.value = null
        }),
        refreshNdiConfig().catch(() => {
          ndiState.value = null
        }),
        refreshFolderInfo().catch(() => {
          folderInfo.value = null
        }),
      ])
    })
    for (const hook of sessionReadyHooks) {
      void Promise.resolve(hook()).catch(() => {})
    }
    if (currentModelId.value) {
      for (const hook of modelLoadedHooks) {
        void Promise.resolve(hook(currentModelId.value, currentModelName.value ?? '')).catch(() => {})
      }
    }
    monitorTimer ??= window.setInterval(() => void pollMonitor(), MONITOR_INTERVAL_MS)
  }

  async function connect() {
    if (client.value || connecting.value) return
    connecting.value = true
    wsRetryCount.value = 0
    lastError.value = null
    try {
      const pluginIcon = await svgUrlToPngBase64(pluginSvgUrl, 128).catch(() => undefined)
      // 用户可能在异步生成图标期间点击了取消
      if (!connecting.value) return
      const c = new ApiClient({
        url: config.wsUrl.value,
        pluginName: PLUGIN_NAME,
        pluginDeveloper: PLUGIN_DEVELOPER,
        pluginIcon,
        authTokenGetter: () => config.authToken.value || null,
        authTokenSetter: config.saveAuthToken,
        webSocketFactory: (url) => {
          const ws = new WebSocket(url)
          ws.addEventListener('error', () => {
            if (client.value === c && !connected.value) wsRetryCount.value += 1
          })
          return ws
        },
      })
      let subscribed = false
      c.on(
        'connect',
        () =>
          void onSession(
            c,
            () => subscribed,
            () => {
              subscribed = true
            },
          ).catch(setError),
      )
      c.on('disconnect', () => {
        if (client.value !== c) return
        resetSession()
        connecting.value = true
      })
      c.on('error', (err) => {
        if (client.value !== c) return
        const { message, fatal } = formatConnectionError(err)
        lastError.value = message
        if (fatal) {
          void disconnect(false)
        }
      })
      client.value = c
    } catch (err) {
      connecting.value = false
      setError(err)
      throw err
    }
  }

  async function disconnect(recordHistory = true) {
    const c = client.value
    client.value = null
    connecting.value = false
    wsRetryCount.value = 0
    resetSession()
    if (!c) return
    if (recordHistory) {
      await withHistory('disconnect', undefined, async () => c.disconnect())
    } else {
      await c.disconnect().catch(() => {})
    }
  }

  /** 清除 token 并重连, ApiClient 会重新向 VTS 申请授权 */
  async function reauthorize() {
    await config.saveAuthToken('')
    await disconnect()
    await connect()
  }

  /** 切换 VTS 多实例并自动重连 */
  async function switchInstance(instanceId: string, autoConnect = true) {
    const wasConnected = connected.value || connecting.value
    await disconnect(false)
    await config.selectInstanceConfig(instanceId)
    if (autoConnect || wasConnected) {
      await connect()
    }
  }

  async function subscribeModelOutline(
    onOutline: (data: {
      convexHull: Array<{ x: number; y: number }>
      convexHullCenter: { x: number; y: number }
      windowSize: { x: number; y: number }
    }) => void,
  ): Promise<() => void> {
    const c = client.value
    if (!c || !connected.value) return () => {}
    let active = true
    try {
      await c.events.modelOutline.subscribe(
        (data) => {
          if (!active) return
          onOutline({
            convexHull: data.convexHull,
            convexHullCenter: data.convexHullCenter,
            windowSize: data.windowSize,
          })
        },
        { draw: false },
      )
    } catch {
      return () => {}
    }
    return () => {
      active = false
      void c.events.modelOutline.unsubscribe().catch(() => {})
    }
  }

  return {
    connecting,
    connected,
    wsRetryCount,
    apiVersion,
    lastRttMs,
    statistics,
    monitorLastError,
    faceFound,
    leftHandFound,
    rightHandFound,
    currentModelId,
    currentModelName,
    currentModelTransform,
    availableModels,
    hotkeys,
    expressions,
    inputParameters,
    postProcessing,
    physicsState,
    ndiState,
    folderInfo,
    artMeshInfo,
    lastModelClick,
    lastError,

    request,
    call,
    connect,
    disconnect,
    reauthorize,
    switchInstance,
    refreshCurrentModel,
    refreshAvailableModels,
    refreshHotkeys,
    refreshExpressions,
    refreshInputParameters,
    refreshPostProcessing,
    refreshPhysics,
    refreshNdiConfig,
    refreshFolderInfo,
    refreshArtMeshes,
    refreshModelState,
    waitForItemEvent,
    subscribeModelOutline,
    onSessionReady: (fn: () => Promise<void> | void) => {
      sessionReadyHooks.add(fn)
    },
    onSessionReset: (fn: () => void) => {
      sessionResetHooks.add(fn)
    },
    onModelLoaded: (fn: (modelId: string, modelName: string) => Promise<void> | void) => {
      modelLoadedHooks.add(fn)
    },
    onModelClicked: (fn: (event: VtsModelClickEvent) => Promise<void> | void) => {
      modelClickedHooks.add(fn)
    },
  }
}

export type VtsConnection = ReturnType<typeof createVtsConnection>
