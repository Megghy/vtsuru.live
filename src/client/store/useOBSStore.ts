import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import OBSWebSocket from 'obs-websocket-js'
import { useTauriStore } from './useTauriStore'

// OBS配置接口
export interface ObsConfigState {
  address: string
  password?: string
}

// 场景配置接口
export interface ObsSceneConfig {
  startScene?: string  // 开播场景
  stopScene?: string   // 下播场景
  waitingScene?: string // 等待场景
  autoSwitchEnabled: boolean // 是否启用自动切换
  autoToggleStream: boolean // 是否在开播下播后自动切换OBS推流状态
}

// OBS统计信息接口
export interface ObsStats {
  cpuUsage: number | null
  memoryUsage: number | null
  fps: number | null
  averageRenderTimeMs: number | null
  renderSkippedFrames: number | null
  renderTotalFrames: number | null
  outputSkippedFrames: number | null
  outputTotalFrames: number | null
  bitrateKbps: number | null
}

export const useOBSStore = defineStore('obs', () => {
  // 基础配置
  const OBS_CONFIG_KEY = 'webfetcher.obsConfig'
  const OBS_SCENE_CONFIG_KEY = 'webfetcher.obsSceneConfig'
  const tauriStore = useTauriStore()

  // 连接状态
  const obsAddress = ref('ws://127.0.0.1:4455')
  const obsPassword = ref('')
  const obsConnected = ref(false)
  const obsConnecting = ref(false)
  const obsError = ref('')
  const obsAutoReconnect = ref(false)

  // 推流状态
  const obsStreamActive = ref(false)
  const obsStreamReconnecting = ref(false)
  const isTogglingObsStream = ref(false)

  // 统计信息
  const obsStats = ref<ObsStats>({
    cpuUsage: null,
    memoryUsage: null,
    fps: null,
    averageRenderTimeMs: null,
    renderSkippedFrames: null,
    renderTotalFrames: null,
    outputSkippedFrames: null,
    outputTotalFrames: null,
    bitrateKbps: null,
  })

  // 场景控制
  const obsScenes = ref<string[]>([])
  const currentObsScene = ref('')
  const isSwitchingScene = ref(false)
  const obsSceneError = ref('')
  const obsSceneConfig = ref<ObsSceneConfig>({
    autoSwitchEnabled: false,
    autoToggleStream: true // 默认开启
  })

  // OBS实例和定时器
  let obs: OBSWebSocket | null = null
  let obsStatsTimer: number | null = null
  let obsReconnectTimer: number | null = null
  let lastObsBytes = 0
  let lastObsBytesTimestamp = 0

  // 初始化OBS实例
  function ensureObsInstance() {
    if (!obs) {
      obs = new OBSWebSocket()
      obs.on('ConnectionClosed', () => {
        obsConnected.value = false
        obsStreamActive.value = false
        stopObsStatsLoop()
      })
    }
  }

  // 更新OBS统计信息
  async function updateObsStats() {
    if (!obs || !obsConnected.value) return

    try {
      const stats: any = await obs.call('GetStats')
      obsStats.value.cpuUsage = typeof stats.cpuUsage === 'number' ? stats.cpuUsage : null
      obsStats.value.memoryUsage = typeof stats.memoryUsage === 'number' ? stats.memoryUsage : null
      obsStats.value.fps = typeof stats.activeFps === 'number' ? stats.activeFps : null
      obsStats.value.averageRenderTimeMs = typeof stats.averageFrameRenderTime === 'number' ? stats.averageFrameRenderTime : null
      obsStats.value.renderSkippedFrames = typeof stats.renderSkippedFrames === 'number' ? stats.renderSkippedFrames : null
      obsStats.value.renderTotalFrames = typeof stats.renderTotalFrames === 'number' ? stats.renderTotalFrames : null
      obsStats.value.outputSkippedFrames = typeof stats.outputSkippedFrames === 'number' ? stats.outputSkippedFrames : null
      obsStats.value.outputTotalFrames = typeof stats.outputTotalFrames === 'number' ? stats.outputTotalFrames : null

      const streamStatus: any = await obs.call('GetStreamStatus')
      obsStreamActive.value = !!streamStatus.outputActive
      obsStreamReconnecting.value = !!streamStatus.outputReconnecting

      // 计算码率
      const now = Date.now()
      const bytes = typeof streamStatus.outputBytes === 'number' ? streamStatus.outputBytes : 0
      if (lastObsBytesTimestamp && now > lastObsBytesTimestamp && bytes >= lastObsBytes) {
        const deltaBytes = bytes - lastObsBytes
        const deltaSeconds = (now - lastObsBytesTimestamp) / 1000
        if (deltaSeconds > 0) {
          const kbps = (deltaBytes * 8) / 1000 / deltaSeconds
          obsStats.value.bitrateKbps = Number.isFinite(kbps) ? kbps : null
        }
      }
      lastObsBytes = bytes
      lastObsBytesTimestamp = now

      // 获取当前场景
      await updateCurrentScene()
    }
    catch (err) {
      console.error('获取 OBS 统计失败:', err)
    }
  }

  // 启动统计循环
  function startObsStatsLoop() {
    if (obsStatsTimer !== null) return
    obsStatsTimer = window.setInterval(() => {
      void updateObsStats()
    }, 1000)
  }

  // 停止统计循环
  function stopObsStatsLoop() {
    if (obsStatsTimer !== null) {
      clearInterval(obsStatsTimer)
      obsStatsTimer = null
    }
  }

  // 启动自动重连循环
  function startObsAutoReconnectLoop() {
    if (obsReconnectTimer !== null) return
    
    // 如果当前条件满足，立即尝试连接一次
    if (obsAutoReconnect.value && 
        obsAddress.value && 
        obsPassword.value && 
        !obsConnected.value && 
        !obsConnecting.value) {
      void handleObsConnect()
    }
    
    // 启动定时重连循环
    obsReconnectTimer = window.setInterval(() => {
      if (!obsAutoReconnect.value) return
      if (!obsAddress.value) return
      if (obsConnected.value || obsConnecting.value) return
      // 确保地址和密码都已设置才尝试连接
      if (!obsPassword.value) return
      void handleObsConnect()
    }, 10000)
  }

  // 停止自动重连循环
  function stopObsAutoReconnectLoop() {
    if (obsReconnectTimer !== null) {
      clearInterval(obsReconnectTimer)
      obsReconnectTimer = null
    }
  }

  // 连接OBS
  async function handleObsConnect() {
    console.log('handleObsConnect called')
    console.log('obsConnected:', obsConnected.value, 'obsConnecting:', obsConnecting.value)
    
    if (obsConnected.value || obsConnecting.value) {
      console.log('Early return: already connected or connecting')
      return
    }

    console.log('Starting OBS connection process...')
    obsError.value = ''
    obsConnecting.value = true

    try {
      ensureObsInstance()
      if (!obs) {
        throw new Error('OBS 实例未初始化')
      }

      const address = obsAddress.value || 'ws://127.0.0.1:4455'
      const password = obsPassword.value || undefined

      await obs.connect(address, password, {
        rpcVersion: 1,
      })

      obsConnected.value = true
      obsConnecting.value = false
      obsAutoReconnect.value = true
      startObsAutoReconnectLoop()

      // 保存配置
      try {
        await tauriStore.set(OBS_CONFIG_KEY, {
          address,
          password: obsPassword.value || undefined,
        } as ObsConfigState)
      }
      catch (err) {
        console.error('保存 OBS 配置失败:', err)
      }

      startObsStatsLoop()
      void updateObsStats()
      
      // 连接成功后获取场景列表
      void fetchObsScenes()
    }
    catch (err: any) {
      console.error('连接 OBS 失败:', err)
      obsError.value = err?.message || String(err)
      obsConnected.value = false
      obsConnecting.value = false
    }
  }

  // 断开OBS连接
  async function handleObsDisconnect() {
    obsError.value = ''
    obsAutoReconnect.value = false
    stopObsStatsLoop()
    stopObsAutoReconnectLoop()

    try {
      if (obs) {
        await obs.disconnect()
      }
    }
    catch (err) {
      console.error('断开 OBS 失败:', err)
    }
    finally {
      obsConnected.value = false
      obsStreamActive.value = false
    }
  }

  // 切换推流状态
  async function handleObsToggleStream() {
    if (!obs || !obsConnected.value) {
      window.$message.error('请先连接 OBS')
      return
    }

    try {
      isTogglingObsStream.value = true
      const result: any = await obs.call('ToggleStream')
      if (typeof result?.outputActive === 'boolean') {
        obsStreamActive.value = result.outputActive
      }
      window.$message.success(obsStreamActive.value ? '已开始 OBS 推流' : '已停止 OBS 推流')
      void updateObsStats()
    }
    catch (err: any) {
      console.error('切换 OBS 推流状态失败:', err)
      window.$message.error(`切换 OBS 推流状态失败: ${err?.message || err}`)
    }
    finally {
      isTogglingObsStream.value = false
    }
  }

  // 开始推流
  async function startObsStream() {
    if (!obs || !obsConnected.value) {
      console.warn('OBS 未连接，无法开始推流')
      return false
    }

    if (obsStreamActive.value) {
      console.log('OBS 已在推流中')
      return true
    }

    try {
      isTogglingObsStream.value = true
      await obs.call('StartStream')
      obsStreamActive.value = true
      window.$message.success('已开始 OBS 推流')
      void updateObsStats()
      return true
    }
    catch (err: any) {
      console.error('开始 OBS 推流失败:', err)
      window.$message.error(`开始 OBS 推流失败: ${err?.message || err}`)
      return false
    }
    finally {
      isTogglingObsStream.value = false
    }
  }

  // 停止推流
  async function stopObsStream() {
    if (!obs || !obsConnected.value) {
      console.warn('OBS 未连接，无法停止推流')
      return false
    }

    if (!obsStreamActive.value) {
      console.log('OBS 未在推流中')
      return true
    }

    try {
      isTogglingObsStream.value = true
      await obs.call('StopStream')
      obsStreamActive.value = false
      window.$message.success('已停止 OBS 推流')
      void updateObsStats()
      return true
    }
    catch (err: any) {
      console.error('停止 OBS 推流失败:', err)
      window.$message.error(`停止 OBS 推流失败: ${err?.message || err}`)
      return false
    }
    finally {
      isTogglingObsStream.value = false
    }
  }

  // 同步推流码到 OBS
  async function syncStreamKeyToObs(server: string, key: string) {
    if (!obs || !obsConnected.value) {
      window.$message.error('请先连接 OBS')
      return false
    }

    try {
      // 获取当前的流设置
      const streamSettings: any = await obs.call('GetStreamServiceSettings')
      
      // 更新服务器和推流码
      await obs.call('SetStreamServiceSettings', {
        streamServiceType: streamSettings.streamServiceType || 'rtmp_custom',
        streamServiceSettings: {
          ...streamSettings.streamServiceSettings,
          server: server,
          key: key
        }
      })

      window.$message.success('推流码已同步到 OBS')
      return true
    }
    catch (err: any) {
      console.error('同步推流码到 OBS 失败:', err)
      window.$message.error(`同步推流码失败: ${err?.message || err}`)
      return false
    }
  }

  // 获取OBS场景列表
  async function fetchObsScenes() {
    if (!obs || !obsConnected.value) return

    try {
      const sceneList: any = await obs.call('GetSceneList')
      obsScenes.value = sceneList.scenes.map((scene: any) => scene.sceneName as string)
      console.log('获取到OBS场景列表:', obsScenes.value)
    }
    catch (err: any) {
      console.error('获取OBS场景列表失败:', err)
      obsSceneError.value = err?.message || '获取场景列表失败'
    }
  }

  // 更新当前场景
  async function updateCurrentScene() {
    if (!obs || !obsConnected.value) return

    try {
      const currentScene: any = await obs.call('GetCurrentProgramScene')
      currentObsScene.value = currentScene.currentProgramSceneName || ''
    }
    catch (err: any) {
      console.error('获取当前场景失败:', err)
    }
  }

  // 切换到指定场景
  async function switchToScene(sceneName: string): Promise<boolean> {
    if (!obs || !obsConnected.value) {
      window.$message.error('OBS未连接')
      return false
    }

    if (!sceneName || !obsScenes.value.includes(sceneName)) {
      window.$message.error('无效的场景名称')
      return false
    }

    // 防止重复切换到相同场景
    if (currentObsScene.value === sceneName) {
      console.log(`已在场景: ${sceneName}，无需切换`)
      return true
    }

    try {
      isSwitchingScene.value = true
      obsSceneError.value = ''
      
      await obs.call('SetCurrentProgramScene', {
        sceneName: sceneName
      })
      
      currentObsScene.value = sceneName
      console.log(`已切换到场景: ${sceneName}`)
      window.$message.success(`已切换到场景: ${sceneName}`)
      return true
    }
    catch (err: any) {
      console.error('切换场景失败:', err)
      obsSceneError.value = err?.message || '切换场景失败'
      window.$message.error(`切换场景失败: ${err?.message || err}`)
      return false
    }
    finally {
      isSwitchingScene.value = false
    }
  }

  // 保存场景配置
  async function saveSceneConfig() {
    try {
      await tauriStore.set(OBS_SCENE_CONFIG_KEY, obsSceneConfig.value)
      console.log('场景配置已保存')
    }
    catch (err) {
      console.error('保存场景配置失败:', err)
    }
  }

  // 加载场景配置
  async function loadSceneConfig() {
    try {
      const saved = await tauriStore.get<ObsSceneConfig | null>(OBS_SCENE_CONFIG_KEY)
      if (saved) {
        obsSceneConfig.value = saved
        console.log('已加载场景配置:', saved)
      }
    }
    catch (err) {
      console.error('加载场景配置失败:', err)
    }
  }

  // 加载OBS配置
  async function loadObsConfig() {
    try {
      const saved = await tauriStore.get<ObsConfigState | null>(OBS_CONFIG_KEY)
      if (saved?.address) {
        obsAddress.value = saved.address
        // 只有在设置了地址和密码时才启用自动重连
        if (saved?.password !== undefined) {
          obsPassword.value = saved.password || ''
          obsAutoReconnect.value = true
        }
      }
    }
    catch (err) {
      console.error('加载OBS配置失败:', err)
    }
  }

  // 初始化
  async function init() {
    await loadObsConfig()
    await loadSceneConfig()
    
    // 只有在设置了地址和密码后才启动自动重连
    if (obsAutoReconnect.value && obsAddress.value) {
      startObsAutoReconnectLoop()
    }
  }

  // 清理资源
  function cleanup() {
    stopObsAutoReconnectLoop()
    stopObsStatsLoop()
    if (obs) {
      void obs.disconnect().catch(() => {})
      obs = null
    }
  }

  return {
    // 状态
    obsAddress,
    obsPassword,
    obsConnected,
    obsConnecting,
    obsError,
    obsAutoReconnect,
    obsStreamActive,
    obsStreamReconnecting,
    isTogglingObsStream,
    obsStats,
    obsScenes,
    currentObsScene,
    isSwitchingScene,
    obsSceneError,
    obsSceneConfig,

    // 方法
    handleObsConnect,
    handleObsDisconnect,
    handleObsToggleStream,
    startObsStream,
    stopObsStream,
    syncStreamKeyToObs,
    fetchObsScenes,
    updateCurrentScene,
    switchToScene,
    saveSceneConfig,
    loadSceneConfig,
    loadObsConfig,
    init,
    cleanup,
  }
})

// 热模块替换支持
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useOBSStore, import.meta.hot))
}
