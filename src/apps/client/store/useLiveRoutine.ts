import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { toast } from 'vue-sonner'

import { checkClientFeature } from '@/shared/config/clientVersion'

import { useDanmakuWindow } from './useDanmakuWindow'
import { useGiftWindow } from './useGiftWindow'
import { useManagedTools } from './useManagedTools'
import { useOBSStore } from './useOBSStore'
import { useTauriStore } from './useTauriStore'
import { useTranscription } from './useTranscription'
import { useVtsStore } from './useVtsStore'

export interface StartLiveRoutineConfig {
  launchVts: boolean
  launchObs: boolean
  syncObsConfigFromDisk: boolean
  connectObs: boolean
  connectVts: boolean
  obsProfile: string
  obsSceneCollection: string
  obsTargetScene: string
  useWaitingSceneFallback: boolean
  obsSceneProjectId: number | null
  obsSubSceneId: string
  syncObsSceneLayout: boolean
  enableReplayBuffer: boolean
  vtsModelId: string
  vtsPresetId: string
  vtsPostProcessingPreset: string
  openDanmakuWindow: boolean
  openGiftWindow: boolean
  startTranscription: boolean
}

export interface StopLiveRoutineConfig {
  switchObsStopScene: boolean
  stopObsStream: boolean
  stopReplayBuffer: boolean
  vtsClearExpressions: boolean
  vtsResetTint: boolean
  vtsPresetId: string
  closeDanmakuWindow: boolean
  closeGiftWindow: boolean
  stopTranscription: boolean
}

export interface LiveRoutineConfig {
  start: StartLiveRoutineConfig
  stop: StopLiveRoutineConfig
}

export interface RoutineStepLog {
  id: string
  title: string
  status: 'running' | 'ok' | 'skipped' | 'error'
  detail: string
}

const DEFAULT_ROUTINE_CONFIG: LiveRoutineConfig = {
  start: {
    launchVts: true,
    launchObs: true,
    syncObsConfigFromDisk: true,
    connectObs: true,
    connectVts: true,
    obsProfile: '',
    obsSceneCollection: '',
    obsTargetScene: '',
    useWaitingSceneFallback: true,
    obsSceneProjectId: null,
    obsSubSceneId: '',
    syncObsSceneLayout: false,
    enableReplayBuffer: false,
    vtsModelId: '',
    vtsPresetId: '',
    vtsPostProcessingPreset: '',
    openDanmakuWindow: true,
    openGiftWindow: false,
    startTranscription: false,
  },
  stop: {
    switchObsStopScene: true,
    stopObsStream: true,
    stopReplayBuffer: false,
    vtsClearExpressions: true,
    vtsResetTint: true,
    vtsPresetId: '',
    closeDanmakuWindow: false,
    closeGiftWindow: false,
    stopTranscription: true,
  },
}

const STORAGE_KEY = 'client.liveRoutineConfig'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const useLiveRoutine = defineStore('liveRoutine', () => {
  const tauriStore = useTauriStore()
  const config = ref<LiveRoutineConfig>(structuredClone(DEFAULT_ROUTINE_CONFIG))
  const runningMode = ref<'start' | 'stop' | null>(null)
  const stepLogs = ref<RoutineStepLog[]>([])
  const initialized = ref(false)

  async function init() {
    if (initialized.value) return
    initialized.value = true
    const saved = await tauriStore.get<Partial<LiveRoutineConfig>>(STORAGE_KEY)
    if (saved) {
      config.value = {
        start: { ...DEFAULT_ROUTINE_CONFIG.start, ...(saved.start ?? {}) },
        stop: { ...DEFAULT_ROUTINE_CONFIG.stop, ...(saved.stop ?? {}) },
      }
    }
  }

  async function save() {
    await tauriStore.set(STORAGE_KEY, config.value)
  }

  async function runStep(id: string, title: string, executor: () => Promise<{ skipped?: boolean; detail: string }>) {
    const entry: RoutineStepLog = { id, title, status: 'running', detail: '执行中...' }
    stepLogs.value = [...stepLogs.value, entry]
    try {
      const res = await executor()
      entry.status = res.skipped ? 'skipped' : 'ok'
      entry.detail = res.detail
    } catch (err) {
      entry.status = 'error'
      entry.detail = err instanceof Error ? err.message : String(err)
    }
    stepLogs.value = [...stepLogs.value]
  }

  async function executeStartRoutine() {
    if (runningMode.value) return
    runningMode.value = 'start'
    stepLogs.value = []

    const s = config.value.start
    const managedTools = useManagedTools()
    const obs = useOBSStore()
    const vts = useVtsStore()
    const danmakuWindow = useDanmakuWindow()
    const giftWindow = useGiftWindow()
    const transcription = useTranscription()
    const hasNativeTools = checkClientFeature('tool-manager').supported

    try {
      if (s.launchVts) {
        await runStep('launch-vts', '启动 VTube Studio', async () => {
          if (!hasNativeTools) return { skipped: true, detail: '需要客户端 ≥ v0.1.14，已跳过自动启动' }
          const res = await managedTools.launchVts()
          if (!res) throw new Error('启动 VTS 失败')
          return { detail: res.alreadyRunning ? '已在运行中' : `已启动 (${res.method})` }
        })
      }

      if (s.launchObs) {
        await runStep('launch-obs', '启动 OBS Studio', async () => {
          if (!hasNativeTools) return { skipped: true, detail: '需要客户端 ≥ v0.1.14，已跳过自动启动' }
          const res = await managedTools.launchObs()
          if (!res) throw new Error('启动 OBS 失败')
          return { detail: res.alreadyRunning ? '已在运行中' : '已启动 OBS' }
        })
      }

      if ((s.launchObs || s.launchVts) && hasNativeTools) {
        await delay(1200)
      }

      if (s.syncObsConfigFromDisk) {
        await runStep('sync-obs-cfg', '读取本机 OBS WebSocket 配置', async () => {
          if (!checkClientFeature('obs-config').supported) {
            return { skipped: true, detail: '需要客户端 ≥ v0.1.14，沿用已保存连接参数' }
          }
          const ok = await managedTools.syncObsWebsocketFromDisk(false)
          return ok ? { detail: `已同步 ${obs.obsAddress}` } : { skipped: true, detail: '未找到本机配置，沿用当前参数' }
        })
      }

      if (s.connectObs) {
        await runStep('connect-obs', '连接 OBS WebSocket', async () => {
          if (obs.obsConnected) return { detail: 'OBS 已连接' }
          await obs.handleObsConnect()
          if (!obs.obsConnected) throw new Error(obs.obsError || 'OBS 连接未成功')
          return { detail: `已连接 (${obs.obsAddress})` }
        })
      }

      if (s.obsProfile.trim()) {
        await runStep('obs-profile', `切换 OBS 配置文件 (${s.obsProfile})`, async () => {
          if (!obs.obsConnected) return { skipped: true, detail: 'OBS 未连接' }
          await obs.switchObsProfile(s.obsProfile.trim())
          return { detail: `已切至 ${s.obsProfile}` }
        })
      }

      if (s.obsSceneCollection.trim()) {
        await runStep('obs-collection', `切换 OBS 场景集合 (${s.obsSceneCollection})`, async () => {
          if (!obs.obsConnected) return { skipped: true, detail: 'OBS 未连接' }
          await obs.switchObsSceneCollection(s.obsSceneCollection.trim())
          return { detail: `已切至 ${s.obsSceneCollection}` }
        })
      }

      const targetScene =
        s.obsTargetScene.trim() ||
        (s.useWaitingSceneFallback ? obs.obsSceneConfig.waitingScene || obs.obsSceneConfig.startScene || '' : '')
      if (targetScene) {
        await runStep('obs-scene', `切换 OBS 场景 (${targetScene})`, async () => {
          if (!obs.obsConnected) return { skipped: true, detail: 'OBS 未连接' }
          const ok = await obs.switchToScene(targetScene)
          if (!ok) throw new Error(`切换场景「${targetScene}」失败`)
          return { detail: `当前场景：${targetScene}` }
        })
      }

      if (s.obsSceneProjectId && s.obsSubSceneId) {
        await runStep('obs-vtsuru-subscene', '切换 VTsuru 场景子场景', async () => {
          const { useObsSceneControl } = await import('./useObsSceneControl')
          const sceneCtrl = useObsSceneControl()
          await sceneCtrl.switchSubScene(s.obsSceneProjectId!, s.obsSubSceneId, {
            syncLocalObsScene: !targetScene,
            silent: true,
          })
          if (s.syncObsSceneLayout && obs.obsConnected) {
            await sceneCtrl.syncCurrentLayoutToObs(s.obsSceneProjectId!, s.obsSubSceneId)
            return { detail: '已切换子场景并推送布局到 OBS' }
          }
          return { detail: '已切换云端 VTsuru 子场景' }
        })
      }

      if (s.enableReplayBuffer) {
        await runStep('obs-replay', '开启 OBS 回放缓存', async () => {
          if (!obs.obsConnected) return { skipped: true, detail: 'OBS 未连接' }
          if (obs.obsReplayBufferActive) return { detail: '回放缓存已开启' }
          await obs.toggleReplayBuffer()
          return { detail: '已开启回放缓存' }
        })
      }

      if (s.connectVts) {
        await runStep('connect-vts', '连接 VTube Studio', async () => {
          if (vts.connected) return { detail: `已连接 (${vts.currentModelName || '已就绪'})` }
          await vts.connect()
          await delay(800)
          return vts.connected
            ? { detail: `已连接 (${vts.currentModelName || '已就绪'})` }
            : { skipped: true, detail: '已发起连接，等待 VTS 响应/授权' }
        })
      }

      if (s.vtsModelId) {
        await runStep('vts-model', '切换 VTS 模型', async () => {
          if (!vts.connected) return { skipped: true, detail: 'VTS 未连接' }
          if (vts.currentModelId === s.vtsModelId) return { detail: '已是目标模型' }
          await vts.loadModel(s.vtsModelId)
          return { detail: `已切换模型 (${vts.currentModelName || s.vtsModelId})` }
        })
      }

      if (s.vtsPresetId) {
        await runStep('vts-preset', '应用 VTS 开播机位预设', async () => {
          if (!vts.connected) return { skipped: true, detail: 'VTS 未连接' }
          await vts.applyPreset(s.vtsPresetId)
          return { detail: '已应用机位预设' }
        })
      }

      if (s.vtsPostProcessingPreset) {
        await runStep('vts-pp', '开启 VTS 后处理滤镜', async () => {
          if (!vts.connected) return { skipped: true, detail: 'VTS 未连接' }
          await vts.updatePostProcessing({ enabled: true, preset: s.vtsPostProcessingPreset })
          return { detail: `已启用滤镜：${s.vtsPostProcessingPreset}` }
        })
      }

      if (s.openDanmakuWindow) {
        await runStep('open-danmaku', '打开弹幕浮窗', async () => {
          if (danmakuWindow.isDanmakuWindowOpen) return { detail: '弹幕浮窗已打开' }
          danmakuWindow.openWindow()
          return { detail: '已打开弹幕浮窗' }
        })
      }

      if (s.openGiftWindow) {
        await runStep('open-gift', '打开礼物排行浮窗', async () => {
          if (giftWindow.isGiftWindowOpen) return { detail: '礼物排行浮窗已打开' }
          giftWindow.openWindow()
          return { detail: '已打开礼物排行浮窗' }
        })
      }

      if (s.startTranscription) {
        await runStep('start-transcription', '启动语音转写', async () => {
          if (transcription.status.running) return { detail: '语音转写已在运行' }
          await transcription.start()
          return { detail: '已启动语音转写' }
        })
      }

      toast.success('开播准备流程已执行完成')
    } finally {
      runningMode.value = null
    }
  }

  async function executeStopRoutine() {
    if (runningMode.value) return
    runningMode.value = 'stop'
    stepLogs.value = []

    const s = config.value.stop
    const obs = useOBSStore()
    const vts = useVtsStore()
    const danmakuWindow = useDanmakuWindow()
    const giftWindow = useGiftWindow()
    const transcription = useTranscription()

    try {
      if (s.switchObsStopScene && obs.obsSceneConfig.stopScene) {
        await runStep('obs-stop-scene', `切换 OBS 下播场景 (${obs.obsSceneConfig.stopScene})`, async () => {
          if (!obs.obsConnected) return { skipped: true, detail: 'OBS 未连接' }
          await obs.switchToScene(obs.obsSceneConfig.stopScene!)
          return { detail: `已切至 ${obs.obsSceneConfig.stopScene}` }
        })
      }

      if (s.stopObsStream) {
        await runStep('obs-stop-stream', '停止 OBS 推流', async () => {
          if (!obs.obsConnected) return { skipped: true, detail: 'OBS 未连接' }
          if (!obs.obsStreamActive) return { detail: 'OBS 当前未在推流' }
          await obs.stopObsStream()
          return { detail: '已停止推流' }
        })
      }

      if (s.stopReplayBuffer) {
        await runStep('obs-stop-replay', '关闭 OBS 回放缓存', async () => {
          if (!obs.obsConnected) return { skipped: true, detail: 'OBS 未连接' }
          if (!obs.obsReplayBufferActive) return { detail: '回放缓存未开启' }
          await obs.toggleReplayBuffer()
          return { detail: '已关闭回放缓存' }
        })
      }

      if (s.vtsClearExpressions) {
        await runStep('vts-clear-exp', '清除 VTS 表情', async () => {
          if (!vts.connected) return { skipped: true, detail: 'VTS 未连接' }
          await vts.clearExpressions()
          return { detail: '已清除所有激活表情' }
        })
      }

      if (s.vtsResetTint) {
        await runStep('vts-reset-tint', '恢复 VTS 模型原色', async () => {
          if (!vts.connected) return { skipped: true, detail: 'VTS 未连接' }
          await vts.tintModel({ reset: true })
          return { detail: '已恢复模型原色' }
        })
      }

      if (s.vtsPresetId) {
        await runStep('vts-stop-preset', '应用 VTS 下播机位预设', async () => {
          if (!vts.connected) return { skipped: true, detail: 'VTS 未连接' }
          await vts.applyPreset(s.vtsPresetId)
          return { detail: '已应用下播机位' }
        })
      }

      if (s.closeDanmakuWindow) {
        await runStep('close-danmaku', '关闭弹幕浮窗', async () => {
          if (!danmakuWindow.isDanmakuWindowOpen) return { detail: '未打开' }
          danmakuWindow.closeWindow()
          return { detail: '已关闭弹幕浮窗' }
        })
      }

      if (s.closeGiftWindow) {
        await runStep('close-gift', '关闭礼物排行浮窗', async () => {
          if (!giftWindow.isGiftWindowOpen) return { detail: '未打开' }
          giftWindow.closeWindow()
          return { detail: '已关闭礼物排行浮窗' }
        })
      }

      if (s.stopTranscription) {
        await runStep('stop-transcription', '停止语音转写', async () => {
          if (!transcription.status.running) return { detail: '转写未运行' }
          await transcription.stop()
          return { detail: '已停止语音转写' }
        })
      }

      toast.success('下播收尾流程已执行完成')
    } finally {
      runningMode.value = null
    }
  }

  return {
    config,
    runningMode,
    stepLogs,
    initialized,
    init,
    save,
    executeStartRoutine,
    executeStopRoutine,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useLiveRoutine, import.meta.hot))
