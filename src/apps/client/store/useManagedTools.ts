import { invoke } from '@tauri-apps/api/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { checkClientFeature } from '@/shared/config/clientVersion'

import { useOBSStore } from './useOBSStore'
import { useTauriStore } from './useTauriStore'
import { useVtsStore } from './useVtsStore'

export interface PortProbeResult {
  host: string
  port: number
  open: boolean
  latencyMs: number | null
  error: string | null
}

export interface ObsWebsocketConfigInfo {
  configPath: string
  exists: boolean
  serverEnabled: boolean
  serverPort: number
  authRequired: boolean
  serverPassword: string | null
  requiresRestart: boolean
}

export interface ObsToolInfo {
  installed: boolean
  running: boolean
  pids: number[]
  executablePath: string | null
  configDir: string | null
  websocketConfig: ObsWebsocketConfigInfo | null
  spout2PluginInstalled: boolean
  ndiPluginInstalled: boolean
  portOpen: boolean
}

export interface VtsToolInfo {
  installed: boolean
  running: boolean
  pids: number[]
  executablePath: string | null
  steamInstalled: boolean
  installDir: string | null
  streamingAssetsDir: string | null
  modelsDir: string | null
  itemsDir: string | null
  configDir: string | null
  apiEnabled: boolean | null
  apiPort: number
  portOpen: boolean
}

export interface ManagedToolsSnapshot {
  obs: ObsToolInfo
  vts: VtsToolInfo
  scannedAt: number
}

export interface LaunchToolResult {
  tool: string
  launched: boolean
  alreadyRunning: boolean
  method: string
  commandTarget: string
}

export type ManagedToolDirTarget =
  | 'obs_config'
  | 'obs_plugins'
  | 'vts_root'
  | 'vts_models'
  | 'vts_items'
  | 'vts_config'
  | 'vts_backgrounds'

export interface ManagedToolsConfig {
  customObsPath: string
  customVtsPath: string
  obsLaunch: {
    minimizeToTray: boolean
    startReplayBuffer: boolean
    disableShutdownCheck: boolean
    profile: string
    collection: string
    scene: string
  }
  vtsLaunch: {
    mode: 'steam' | 'direct'
    noSteam: boolean
  }
}

const DEFAULT_CONFIG: ManagedToolsConfig = {
  customObsPath: '',
  customVtsPath: '',
  obsLaunch: {
    minimizeToTray: false,
    startReplayBuffer: false,
    disableShutdownCheck: true,
    profile: '',
    collection: '',
    scene: '',
  },
  vtsLaunch: {
    mode: 'steam',
    noSteam: false,
  },
}

const CONFIG_KEY = 'tools.managedConfig'

export const useManagedTools = defineStore('managedTools', () => {
  const tauriStore = useTauriStore()
  const config = ref<ManagedToolsConfig>(structuredClone(DEFAULT_CONFIG))
  const snapshot = ref<ManagedToolsSnapshot | null>(null)
  const loading = ref(false)
  const launchingTool = ref<'obs' | 'vts' | null>(null)
  const lastError = ref<string | null>(null)
  const initialized = ref(false)

  const featureCheck = computed(() => checkClientFeature('tool-manager'))
  const obsConfigCheck = computed(() => checkClientFeature('obs-config'))
  const vtsConfigCheck = computed(() => checkClientFeature('vts-config'))
  const portProbeCheck = computed(() => checkClientFeature('port-probe'))

  async function init() {
    if (initialized.value) return
    initialized.value = true
    const saved = await tauriStore.get<Partial<ManagedToolsConfig>>(CONFIG_KEY)
    if (saved) {
      config.value = {
        ...structuredClone(DEFAULT_CONFIG),
        ...saved,
        obsLaunch: { ...DEFAULT_CONFIG.obsLaunch, ...(saved.obsLaunch ?? {}) },
        vtsLaunch: { ...DEFAULT_CONFIG.vtsLaunch, ...(saved.vtsLaunch ?? {}) },
      }
    }
    if (featureCheck.value.supported) {
      void refresh(true)
    }
  }

  async function saveConfig() {
    await tauriStore.set(CONFIG_KEY, config.value)
  }

  async function refresh(silent = false): Promise<ManagedToolsSnapshot | null> {
    const check = checkClientFeature('tool-manager')
    if (!check.supported) {
      if (!silent) toast.warning(check.message ?? '当前客户端版本不支持自动探测')
      return null
    }

    loading.value = true
    lastError.value = null
    try {
      const result = await invoke<ManagedToolsSnapshot>('get_managed_tools_status', {
        customObsPath: config.value.customObsPath.trim() || null,
        customVtsPath: config.value.customVtsPath.trim() || null,
      })
      snapshot.value = result
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      lastError.value = msg
      if (!silent) toast.error(`扫描本地工具失败: ${msg}`)
      return null
    } finally {
      loading.value = false
    }
  }

  async function probePort(port: number, host = '127.0.0.1'): Promise<PortProbeResult | null> {
    const check = checkClientFeature('port-probe')
    if (!check.supported) {
      toast.warning(check.message ?? '当前客户端版本不支持端口探测')
      return null
    }
    try {
      return await invoke<PortProbeResult>('probe_local_port', { host, port, timeoutMs: 800 })
    } catch (err) {
      toast.error(`端口探测失败: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }

  function buildObsArgs(overrideArgs?: string[]): string[] {
    if (overrideArgs) return overrideArgs
    const args: string[] = []
    const o = config.value.obsLaunch
    if (o.minimizeToTray) args.push('--minimize-to-tray')
    if (o.startReplayBuffer) args.push('--startreplaybuffer')
    if (o.disableShutdownCheck) args.push('--disable-shutdown-check')
    if (o.profile.trim()) args.push('--profile', o.profile.trim())
    if (o.collection.trim()) args.push('--collection', o.collection.trim())
    if (o.scene.trim()) args.push('--scene', o.scene.trim())
    return args
  }

  async function launchObs(overrideArgs?: string[]): Promise<LaunchToolResult | null> {
    const check = checkClientFeature('tool-manager')
    if (!check.supported) {
      toast.warning(check.message ?? '需要更新客户端才能一键启动 OBS')
      return null
    }
    launchingTool.value = 'obs'
    try {
      const res = await invoke<LaunchToolResult>('launch_managed_tool', {
        request: {
          tool: 'obs',
          launchMode: 'direct',
          customPath: config.value.customObsPath.trim() || null,
          args: buildObsArgs(overrideArgs),
        },
      })
      if (res.alreadyRunning) {
        toast.info('OBS Studio 已在运行中')
      } else {
        toast.success('已启动 OBS Studio')
      }
      setTimeout(() => void refresh(true), 1500)
      return res
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      launchingTool.value = null
    }
  }

  async function launchVts(): Promise<LaunchToolResult | null> {
    const check = checkClientFeature('tool-manager')
    if (!check.supported) {
      toast.warning(check.message ?? '需要更新客户端才能一键启动 VTube Studio')
      return null
    }
    launchingTool.value = 'vts'
    try {
      const args: string[] = []
      if (config.value.vtsLaunch.mode === 'direct' && config.value.vtsLaunch.noSteam) {
        args.push('-nosteam')
      }
      const res = await invoke<LaunchToolResult>('launch_managed_tool', {
        request: {
          tool: 'vts',
          launchMode: config.value.vtsLaunch.mode,
          customPath: config.value.customVtsPath.trim() || null,
          args,
        },
      })
      if (res.alreadyRunning) {
        toast.info('VTube Studio 已在运行中')
      } else {
        toast.success(res.method === 'steam' ? '已通过 Steam 启动 VTube Studio' : '已启动 VTube Studio')
      }
      setTimeout(() => void refresh(true), 2000)
      return res
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      launchingTool.value = null
    }
  }

  async function stopTool(tool: 'obs' | 'vts'): Promise<boolean> {
    const check = checkClientFeature('tool-manager')
    if (!check.supported) {
      toast.warning(check.message ?? '需要更新客户端才能停止外部工具')
      return false
    }
    try {
      const count = await invoke<number>('stop_managed_tool', { tool })
      if (count > 0) {
        toast.success(`已结束 ${tool === 'obs' ? 'OBS Studio' : 'VTube Studio'} 进程 (${count})`)
      } else {
        toast.info(`${tool === 'obs' ? 'OBS Studio' : 'VTube Studio'} 当前未运行`)
      }
      setTimeout(() => void refresh(true), 800)
      return count > 0
    } catch (err) {
      toast.error(`停止失败: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  }

  async function openToolDir(target: ManagedToolDirTarget): Promise<boolean> {
    const feature = target.startsWith('vts_') ? 'vts-config' : 'obs-config'
    const check = checkClientFeature(feature)
    if (!check.supported) {
      toast.warning(check.message ?? '需要更新客户端才能打开工具目录')
      return false
    }
    try {
      const customPath = target.startsWith('vts_')
        ? config.value.customVtsPath.trim() || null
        : config.value.customObsPath.trim() || null
      await invoke<string>('open_managed_tool_dir', { target, customPath })
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
      return false
    }
  }

  /** 从本机 OBS WebSocket 配置文件自动读取端口与密码，写入 OBS Store 并可选立即连接 */
  async function syncObsWebsocketFromDisk(autoConnect = true): Promise<boolean> {
    const check = checkClientFeature('obs-config')
    if (!check.supported) {
      toast.warning(check.message ?? '需要更新客户端才能读取 OBS 配置')
      return false
    }
    const latest = (await refresh(true)) ?? snapshot.value
    const wsCfg = latest?.obs.websocketConfig
    if (!wsCfg || !wsCfg.exists) {
      toast.warning('未找到 OBS WebSocket 配置文件，请先在 OBS 中打开过一次或点击「一键开启」')
      return false
    }

    const obsStore = useOBSStore()
    obsStore.obsAddress = `ws://127.0.0.1:${wsCfg.serverPort}`
    obsStore.obsPassword = wsCfg.authRequired ? (wsCfg.serverPassword ?? '') : ''
    await obsStore.saveObsConfig()

    if (!wsCfg.serverEnabled) {
      toast.warning(`已同步端口 (${wsCfg.serverPort})，但 OBS WebSocket 尚未启用，可点击「一键开启」`)
      return false
    }

    if (autoConnect && latest?.obs.running) {
      await obsStore.connectObs()
      if (obsStore.obsConnected) {
        toast.success(`已自动同步配置并连接 OBS (端口 ${wsCfg.serverPort})`)
        return true
      }
    } else {
      toast.success(`已从本机 OBS 配置同步端口 ${wsCfg.serverPort}${wsCfg.authRequired ? ' 与密码' : ''}`)
    }
    return true
  }

  /** 写入 OBS WebSocket 配置（一键开启/修改端口与密码），并同步到客户端 OBS Store */
  async function configureObsWebsocket(options: {
    enabled: boolean
    port?: number
    authRequired?: boolean
    password?: string
  }): Promise<ObsWebsocketConfigInfo | null> {
    const check = checkClientFeature('obs-config')
    if (!check.supported) {
      toast.warning(check.message ?? '需要更新客户端才能修改 OBS 配置')
      return null
    }
    try {
      const updated = await invoke<ObsWebsocketConfigInfo>('configure_obs_websocket', {
        request: {
          enabled: options.enabled,
          port: options.port ?? null,
          authRequired: options.authRequired ?? null,
          password: options.password ?? null,
        },
      })
      const obsStore = useOBSStore()
      obsStore.obsAddress = `ws://127.0.0.1:${updated.serverPort}`
      obsStore.obsPassword = updated.authRequired ? (updated.serverPassword ?? '') : ''
      await obsStore.saveObsConfig()
      await refresh(true)

      if (updated.requiresRestart) {
        toast.warning('已写入 OBS WebSocket 配置，请重启 OBS Studio 后生效')
      } else {
        toast.success('已更新 OBS WebSocket 配置并同步到客户端')
      }
      return updated
    } catch (err) {
      toast.error(`写入 OBS 配置失败: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }

  /** 将探测到的 VTS 端口一键同步到 VTS Store 并尝试连接 */
  async function syncVtsPortAndConnect(): Promise<boolean> {
    const latest = (await refresh(true)) ?? snapshot.value
    const port = latest?.vts.apiPort ?? 8001
    const vtsStore = useVtsStore()
    await vtsStore.setWsUrl(`ws://127.0.0.1:${port}`)
    if (latest?.vts.running) {
      await vtsStore.connect()
      toast.success(`已同步 VTS 端口 ${port} 并发起连接`)
      return true
    }
    toast.info(`已同步 VTS 端口 ${port}，请先启动 VTube Studio`)
    return true
  }

  return {
    config,
    snapshot,
    loading,
    launchingTool,
    lastError,
    initialized,
    featureCheck,
    obsConfigCheck,
    vtsConfigCheck,
    portProbeCheck,
    init,
    saveConfig,
    refresh,
    probePort,
    launchObs,
    launchVts,
    stopTool,
    openToolDir,
    syncObsWebsocketFromDisk,
    configureObsWebsocket,
    syncVtsPortAndConnect,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useManagedTools, import.meta.hot))
