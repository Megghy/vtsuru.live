import { useStorage } from '@vueuse/core'
import OBSWebSocket from 'obs-websocket-js'
import { computed, onUnmounted, ref } from 'vue'

import {
  fetchObsSceneItems,
  fetchObsVideoCanvasSize,
  upsertObsBrowserSource,
} from '@/shared/obs/obsWebsocketScene'
import type { RpcClient } from '@/shared/rpc/client'
import { connectLocalFetcher, probeLocalFetcher } from '@/shared/rpc/client'
import type {
  RpcObsSceneItemRef,
  RpcObsUpsertBrowserSourceParams,
  RpcObsUpsertBrowserSourceResult,
} from '@/shared/rpc/contract'

export type ObsBridgeTransport = 'disconnected' | 'client-rpc' | 'direct-ws'

/**
 * 统一本地 OBS 双向桥接：
 * 1. 优先复用桌面端 vtsuru-fetcher-client 的本地 RPC (ws://127.0.0.1:29304/rpc)，免二次配密码
 * 2. 未开客户端时支持网页直接通过 obs-websocket-js 连接本地 ws://127.0.0.1:4455
 */
export function useObsLocalBridge() {
  const transport = ref<ObsBridgeTransport>('disconnected')
  const connected = ref(false)
  const connecting = ref(false)
  const error = ref('')

  const directAddress = useStorage('vtsuru:obs-scene:direct-address', 'ws://127.0.0.1:4455')
  const directPassword = useStorage('vtsuru:obs-scene:direct-password', '')
  const autoSyncScene = useStorage('vtsuru:obs-scene:auto-sync-scene', true)
  const showReferenceOverlay = useStorage('vtsuru:obs-scene:show-reference-overlay', true)

  const scenes = ref<string[]>([])
  const currentScene = ref('')
  const baseWidth = ref(1920)
  const baseHeight = ref(1080)
  const referenceSceneName = ref('')
  const referenceItems = ref<RpcObsSceneItemRef[]>([])
  const loadingReferences = ref(false)

  let rpcClient: RpcClient | null = null
  let directObs: OBSWebSocket | null = null
  const sceneChangeListeners = new Set<(sceneName: string) => void>()

  function emitSceneChange(sceneName: string) {
    if (!sceneName) return
    currentScene.value = sceneName
    for (const listener of sceneChangeListeners) {
      listener(sceneName)
    }
  }

  function onObsSceneChanged(cb: (sceneName: string) => void) {
    sceneChangeListeners.add(cb)
    return () => {
      sceneChangeListeners.delete(cb)
    }
  }

  function resetState() {
    connected.value = false
    transport.value = 'disconnected'
    scenes.value = []
    currentScene.value = ''
  }

  async function disconnect() {
    if (rpcClient) {
      try {
        await rpcClient.rpc.obsUnsubscribeEvents().catch(() => {})
      } finally {
        rpcClient.close()
        rpcClient = null
      }
    }
    if (directObs) {
      await directObs.disconnect().catch(() => {})
      directObs = null
    }
    error.value = ''
    resetState()
  }

  /** 尝试通过桌面客户端本地 RPC 接入 */
  async function connectViaClientRpc(): Promise<boolean> {
    connecting.value = true
    error.value = ''
    try {
      const health = await probeLocalFetcher(800)
      if (!health) {
        return false
      }
      await disconnect()
      const client = await connectLocalFetcher(
        {
          onObsSceneChanged: (sceneName) => {
            emitSceneChange(sceneName)
          },
          onObsStatusChanged: (status) => {
            connected.value = status.connected
            scenes.value = status.scenes
            currentScene.value = status.currentScene
            baseWidth.value = status.baseWidth
            baseHeight.value = status.baseHeight
          },
        },
        () => {
          rpcClient = null
          resetState()
        },
      )

      rpcClient = client
      transport.value = 'client-rpc'
      await client.rpc.obsSubscribeEvents()
      const status = await client.rpc.obsGetStatus()
      connected.value = status.connected
      scenes.value = status.scenes
      currentScene.value = status.currentScene
      baseWidth.value = status.baseWidth
      baseHeight.value = status.baseHeight
      if (!status.connected) {
        error.value = '已连上桌面客户端，但客户端尚未连接 OBS WebSocket'
      }
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '连接客户端 RPC 失败'
      return false
    } finally {
      connecting.value = false
    }
  }

  /** 网页端直连本地 OBS WebSocket */
  async function connectDirect(address?: string, password?: string): Promise<boolean> {
    if (address !== undefined) directAddress.value = address.trim()
    if (password !== undefined) directPassword.value = password

    const addr = directAddress.value.trim()
    if (!addr) {
      error.value = '请输入 OBS WebSocket 地址（例如 ws://127.0.0.1:4455）'
      return false
    }

    connecting.value = true
    error.value = ''
    try {
      await disconnect()
      const obs = new OBSWebSocket()
      obs.on('CurrentProgramSceneChanged', (event) => {
        if (event?.sceneName) emitSceneChange(event.sceneName)
      })
      obs.on('SceneListChanged', () => {
        void refreshDirectScenes()
      })
      obs.on('ConnectionClosed', () => {
        if (directObs === obs) {
          directObs = null
          resetState()
        }
      })

      await obs.connect(addr, directPassword.value || undefined)
      directObs = obs
      transport.value = 'direct-ws'
      connected.value = true

      const [size] = await Promise.all([fetchObsVideoCanvasSize(obs), refreshDirectScenes()])
      baseWidth.value = size.baseWidth
      baseHeight.value = size.baseHeight
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '直连 OBS WebSocket 失败'
      resetState()
      return false
    } finally {
      connecting.value = false
    }
  }

  async function refreshDirectScenes() {
    if (!directObs) return
    const res = await directObs.call('GetSceneList')
    scenes.value = (res.scenes ?? [])
      .map((s) => String((s as Record<string, unknown>).sceneName ?? ''))
      .filter(Boolean)
    if (typeof res.currentProgramSceneName === 'string') {
      currentScene.value = res.currentProgramSceneName
    }
  }

  /** 优先连客户端 RPC，未检测到客户端时尝试用保存的地址直连 */
  async function connectAuto(): Promise<boolean> {
    const viaRpc = await connectViaClientRpc()
    if (viaRpc) return connected.value
    if (directAddress.value) {
      return connectDirect()
    }
    return false
  }

  async function refreshStatus() {
    if (transport.value === 'client-rpc' && rpcClient) {
      const status = await rpcClient.rpc.obsGetStatus()
      connected.value = status.connected
      scenes.value = status.scenes
      currentScene.value = status.currentScene
      baseWidth.value = status.baseWidth
      baseHeight.value = status.baseHeight
    } else if (transport.value === 'direct-ws' && directObs) {
      await refreshDirectScenes()
    }
  }

  async function switchObsScene(sceneName: string): Promise<{ ok: boolean; message?: string }> {
    if (!connected.value) return { ok: false, message: 'OBS 未连接' }
    if (transport.value === 'client-rpc' && rpcClient) {
      return rpcClient.rpc.obsSwitchScene(sceneName)
    }
    if (transport.value === 'direct-ws' && directObs) {
      await directObs.call('SetCurrentProgramScene', { sceneName })
      currentScene.value = sceneName
      return { ok: true }
    }
    return { ok: false, message: '未建立有效连接' }
  }

  async function refreshSceneItems(sceneName?: string): Promise<RpcObsSceneItemRef[]> {
    if (!connected.value) throw new Error('OBS 未连接')
    loadingReferences.value = true
    try {
      const target = sceneName || currentScene.value || scenes.value[0]
      if (!target) throw new Error('当前 OBS 中没有可用场景')

      const result =
        transport.value === 'client-rpc' && rpcClient
          ? await rpcClient.rpc.obsGetSceneItems(target)
          : directObs
            ? await fetchObsSceneItems(directObs, target)
            : null

      if (!result) throw new Error('未建立有效连接')
      referenceSceneName.value = result.sceneName
      baseWidth.value = result.baseWidth
      baseHeight.value = result.baseHeight
      referenceItems.value = result.items
      return result.items
    } finally {
      loadingReferences.value = false
    }
  }

  function clearReferenceItems() {
    referenceItems.value = []
    referenceSceneName.value = ''
  }

  async function pushOverlayToObs(
    params: RpcObsUpsertBrowserSourceParams,
  ): Promise<RpcObsUpsertBrowserSourceResult> {
    if (!connected.value) return { ok: false, message: 'OBS 未连接' }
    if (transport.value === 'client-rpc' && rpcClient) {
      return rpcClient.rpc.obsUpsertBrowserSource(params)
    }
    if (transport.value === 'direct-ws' && directObs) {
      return upsertObsBrowserSource(directObs, params)
    }
    return { ok: false, message: '未建立有效连接' }
  }

  const transportLabel = computed(() => {
    if (transport.value === 'client-rpc') return connected.value ? '客户端 RPC 已连接' : '客户端未连 OBS'
    if (transport.value === 'direct-ws') return connected.value ? '浏览器直连 OBS' : '直连已断开'
    return '未连接 OBS'
  })

  onUnmounted(() => {
    void disconnect()
  })

  return {
    transport,
    transportLabel,
    connected,
    connecting,
    error,
    directAddress,
    directPassword,
    autoSyncScene,
    showReferenceOverlay,
    scenes,
    currentScene,
    baseWidth,
    baseHeight,
    referenceSceneName,
    referenceItems,
    loadingReferences,
    connectViaClientRpc,
    connectDirect,
    connectAuto,
    disconnect,
    refreshStatus,
    switchObsScene,
    refreshSceneItems,
    clearReferenceItems,
    pushOverlayToObs,
    onObsSceneChanged,
  }
}
