import { useAccount } from '@/api/account'
import { AudioFrameBuffer, pcmFrameSize } from '@/apps/client/services/transcription/audio'
import { resolveBilibiliStream } from '@/apps/client/services/transcription/bilibili'
import {
  startAudioExtraction,
  stopStaleTranscriptionJobs,
  type FfmpegAudioJob,
} from '@/apps/client/services/transcription/ffmpeg'
import { createProvider } from '@/apps/client/services/transcription/providers'
import type { ProviderTranscript, TranscriptionProviderClient } from '@/apps/client/services/transcription/types'
import { clientSupportsTranscription, TRANSCRIPTION_MIN_CLIENT_VERSION } from '@/shared/config/clientVersion'
import type { TranscriptSegment, TranscriptionProfile, TranscriptionStatus } from '@/shared/models/transcription'
import { useWebFetcher } from '@/store/useWebFetcher'

import { useTranscriptionSettings } from './useTranscriptionSettings'

const UPLOAD_INTERVAL_MS = 2_000
const UPLOAD_BATCH_SIZE = 100
const MAX_PENDING_SEGMENTS = 10_000
const MAX_VISIBLE_LINES = 200
const MAX_RECONNECTS = 3
const RECONNECT_DELAY_MS = 2_000

interface HubResult {
  Success: boolean
  Message: string
}

interface StartSessionResult extends HubResult {
  SessionId: string
}

export interface TranscriptLine {
  text: string
  startMs: number
}

function profileModel(profile: TranscriptionProfile) {
  return profile.provider === 'tencent' ? profile.engineModelType : profile.model
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const useTranscription = defineStore('transcription', () => {
  const account = useAccount()
  const settingsStore = useTranscriptionSettings()
  const webFetcher = useWebFetcher()
  const status = ref<TranscriptionStatus>({ running: false, phase: 'idle' })
  const partialText = ref('')
  const lastFinalText = ref('')
  const lines = ref<TranscriptLine[]>([])
  const archivedCount = ref(0)
  const pendingCount = ref(0)
  const sessionId = ref<string>()
  const uploadError = ref<string>()
  const runtimeError = ref<string>()
  const stderrLine = ref('')
  const archivePaused = ref(false)
  const pendingSegments: TranscriptSegment[] = []
  const finalizedIds = new Set<string>()
  let initialized = false
  let provider: TranscriptionProviderClient | undefined
  let ffmpegJob: FfmpegAudioJob | undefined
  let frameBuffer: AudioFrameBuffer | undefined
  let uploadTimer: ReturnType<typeof setInterval> | undefined
  let flushTask: Promise<void> | undefined
  let finishTask: Promise<void> | undefined
  let stopTask: Promise<void> | undefined
  let reconnectTask: Promise<void> | undefined
  let stopping = false
  let pipelineClosing = false
  let pipelineEpoch = 0
  let reconnects = 0
  let pipelineFault: unknown
  let sequence = 0
  let lastEndMs = 0

  async function init() {
    if (initialized) return
    initialized = true
    await settingsStore.init()
    if (clientSupportsTranscription()) {
      await stopStaleTranscriptionJobs().catch((error) => console.warn(`清理遗留 FFmpeg 任务失败: ${error}`))
    }
  }

  function assertStartReady() {
    if (!clientSupportsTranscription()) {
      throw new Error(`当前 Client 不支持直播转写，请升级到 ${TRANSCRIPTION_MIN_CLIENT_VERSION} 或更高版本`)
    }
    const profile = settingsStore.activeProfile
    if (!profile) throw new Error('请选择转写配置')
    if (!account.value.biliRoomId) throw new Error('当前账户未绑定 Bilibili 直播间')
    if (webFetcher.state !== 'connected' || !webFetcher.signalRClient) {
      throw new Error('EventFetcher 未连接，无法创建本站归档会话')
    }
    if (profile.provider === 'tencent' && (!profile.appId || !profile.secretId || !profile.secretKey)) {
      throw new Error('请填写完整的腾讯云凭据')
    }
    if (profile.provider === 'openai' && !profile.apiKey) throw new Error('请填写 OpenAI API Key')
    return profile
  }

  async function start() {
    if (status.value.running) return
    const profile = assertStartReady()
    if (sessionId.value) await finishSession()
    resetRuntime(profile)
    const epoch = ++pipelineEpoch

    try {
      const connection = webFetcher.signalRClient
      const startResult = await connection.invoke<StartSessionResult>(
        'StartTranscriptSession',
        profile.provider,
        profileModel(profile),
        profile.language,
      )
      if (!startResult.Success) throw new Error(startResult.Message)
      sessionId.value = startResult.SessionId
      await openPipeline(profile, epoch)
      startUploadTimer()
    } catch (error) {
      stopping = true
      pipelineEpoch++
      await closePipeline()
      await closeArchiveSession().catch(() => undefined)
      stopping = false
      status.value = { running: false, phase: 'error', message: String(error) }
      runtimeError.value = String(error)
      throw error
    }
  }

  function resetRuntime(profile: TranscriptionProfile) {
    stopping = false
    reconnects = 0
    sequence = 0
    lastEndMs = 0
    archivedCount.value = 0
    pendingSegments.length = 0
    pendingCount.value = 0
    finalizedIds.clear()
    lines.value = []
    partialText.value = ''
    lastFinalText.value = ''
    uploadError.value = undefined
    runtimeError.value = undefined
    stderrLine.value = ''
    archivePaused.value = false
    status.value = {
      running: true,
      phase: 'resolving_stream',
      provider: profile.provider,
      roomId: Number(account.value.biliRoomId),
      message: '正在创建转写归档会话',
    }
  }

  async function openPipeline(profile: TranscriptionProfile, epoch: number) {
    pipelineFault = undefined
    status.value = { ...status.value, phase: 'resolving_stream', message: '正在获取 Bilibili 播放流' }
    const source = await resolveBilibiliStream(Number(account.value.biliRoomId))
    if (stale(epoch)) return

    status.value = {
      ...status.value,
      canonicalRoomId: source.canonicalRoomId,
      sourceProtocol: source.protocol,
      sourceFormat: source.format,
      phase: 'connecting_provider',
      message: '正在连接识别服务',
    }
    const next = createProvider(profile, {
      onPartial: (result) => {
        if (epoch === pipelineEpoch) partialText.value = result.text
      },
      onFinal: (result) => {
        if (epoch === pipelineEpoch) enqueueFinal(result)
      },
      onError: (error) => pipelineLost(epoch, error),
    })
    let job: FfmpegAudioJob | undefined
    try {
      await next.connect()
      if (stale(epoch)) return
      provider = next

      status.value = { ...status.value, phase: 'starting_ffmpeg', message: '正在启动 FFmpeg 音频提取' }
      stderrLine.value = ''
      frameBuffer = new AudioFrameBuffer(pcmFrameSize(next.sampleRate), (frame) => {
        if (epoch !== pipelineEpoch) return
        try {
          provider?.sendAudio(frame)
        } catch (error) {
          pipelineLost(epoch, error)
        }
      })
      job = await startAudioExtraction(
        source,
        next.sampleRate,
        (chunk) => {
          if (epoch === pipelineEpoch) frameBuffer?.append(chunk)
        },
        (line) => {
          const text = line.trim()
          if (text) stderrLine.value = text
        },
        () => pipelineLost(epoch, new Error(stderrLine.value || 'FFmpeg 音频提取进程已结束')),
      )
      if (!stale(epoch)) {
        ffmpegJob = job
        job = undefined
      }
      if (pipelineFault) throw pipelineFault
      if (stale(epoch)) return
      status.value = { ...status.value, phase: 'running', message: undefined }
      runtimeError.value = undefined
      reconnects = 0
    } finally {
      if (job) await stopJob(job)
      if (provider === next && !stale(epoch)) return
      if (provider === next) provider = undefined
      if (ffmpegJob && stale(epoch)) {
        const owned = ffmpegJob
        ffmpegJob = undefined
        await stopJob(owned)
      }
      await next.finish().catch(() => undefined)
    }
  }

  function stale(epoch: number) {
    return epoch !== pipelineEpoch || stopping
  }

  function pipelineLost(epoch: number, error: unknown) {
    if (pipelineClosing || epoch !== pipelineEpoch || stopping || status.value.phase === 'stopping') return
    if (status.value.phase !== 'running') {
      pipelineFault = error
      return
    }
    void reconnectPipeline(error)
  }

  function reconnectPipeline(error: unknown) {
    if (reconnectTask) return reconnectTask
    const epoch = ++pipelineEpoch
    reconnectTask = runReconnect(epoch, error).finally(() => {
      reconnectTask = undefined
    })
    return reconnectTask
  }

  async function runReconnect(epoch: number, error: unknown) {
    if (stopping) return
    if (reconnects >= MAX_RECONNECTS) {
      await failRuntime(error)
      return
    }
    reconnects++
    const detail = stderrLine.value && !String(error).includes(stderrLine.value) ? `${error}（${stderrLine.value}）` : String(error)
    runtimeError.value = detail
    status.value = {
      ...status.value,
      running: true,
      phase: 'reconnecting',
      message: `连接中断，正在重试（${reconnects}/${MAX_RECONNECTS}）`,
    }
    await closePipeline()
    await delay(RECONNECT_DELAY_MS)
    if (stopping || epoch !== pipelineEpoch) return
    const profile = settingsStore.activeProfile
    if (!profile) {
      await failRuntime(new Error('转写配置已丢失'))
      return
    }
    try {
      await openPipeline(profile, epoch)
    } catch (cause) {
      if (stopping || epoch !== pipelineEpoch) return
      await runReconnect(epoch, cause)
    }
  }

  function enqueueFinal(result: ProviderTranscript) {
    const text = result.text.trim()
    if (!text || finalizedIds.has(result.id)) return
    finalizedIds.add(result.id)
    partialText.value = ''
    lastFinalText.value = text
    const startMs = result.startMs ?? lastEndMs
    const endMs = result.endMs ?? startMs
    lastEndMs = endMs
    lines.value.push({ text, startMs })
    if (lines.value.length > MAX_VISIBLE_LINES) {
      lines.value.splice(0, lines.value.length - MAX_VISIBLE_LINES)
    }
    if (pendingSegments.length >= MAX_PENDING_SEGMENTS) {
      pauseArchive('待上传字幕已满，归档暂停，转写仍在继续')
      return
    }
    pendingSegments.push({
      sequence: sequence++,
      startMs,
      endMs,
      text,
      speaker: result.speaker,
    })
    pendingCount.value = pendingSegments.length
  }

  function pauseArchive(message: string) {
    archivePaused.value = true
    uploadError.value = message
  }

  async function stop() {
    if (stopTask) return stopTask
    if (!status.value.running && !sessionId.value) return
    stopTask = runStop(false)
    return stopTask
  }

  async function failRuntime(error: unknown) {
    if (stopping) return
    runtimeError.value = String(error)
    if (stopTask) return stopTask
    stopTask = runStop(true, error)
    return stopTask
  }

  async function runStop(preserveError: boolean, error?: unknown) {
    try {
      await stopRuntime(preserveError, error)
    } finally {
      stopTask = undefined
    }
  }

  async function stopRuntime(preserveError: boolean, originalError?: unknown) {
    stopping = true
    pipelineEpoch++
    status.value = { ...status.value, phase: 'stopping', message: '正在停止直播转写' }
    let error = originalError
    try {
      await closePipeline()
    } catch (cleanupError) {
      error ??= cleanupError
    }
    try {
      await finishSession()
    } catch (archiveError) {
      error ??= archiveError
    }
    stopping = false
    if (error || preserveError) {
      const message = String(error ?? runtimeError.value)
      runtimeError.value = message
      status.value = { running: false, phase: 'error', message }
      if (!preserveError) throw error
      return
    }
    status.value = { running: false, phase: 'idle' }
  }

  async function closePipeline() {
    pipelineClosing = true
    try {
      frameBuffer?.clear()
      frameBuffer = undefined
      const job = ffmpegJob
      ffmpegJob = undefined
      if (job) await stopJob(job)
      const currentProvider = provider
      provider = undefined
      if (currentProvider) await currentProvider.finish().catch(() => undefined)
    } finally {
      pipelineClosing = false
    }
  }

  async function stopJob(job: FfmpegAudioJob) {
    job.stdout.close()
    job.stderr.close()
    await job.stop().catch(() => undefined)
  }

  function startUploadTimer() {
    stopUploadTimer()
    uploadTimer = setInterval(() => void flush(), UPLOAD_INTERVAL_MS)
  }

  function stopUploadTimer() {
    if (!uploadTimer) return
    clearInterval(uploadTimer)
    uploadTimer = undefined
  }

  async function flush(all = false) {
    if (flushTask) return flushTask
    if (!sessionId.value || pendingSegments.length === 0) return
    const connection = webFetcher.signalRClient
    if (!connection) {
      pauseArchive('EventFetcher 已断开，归档暂停，转写仍在继续')
      return
    }

    const batch = pendingSegments.slice(0, UPLOAD_BATCH_SIZE)
    let uploaded = false
    flushTask = connection
      .invoke<HubResult>('UploadTranscriptSegments', sessionId.value, batch)
      .then((result) => {
        if (!result.Success) throw new Error(result.Message)
        pendingSegments.splice(0, batch.length)
        pendingCount.value = pendingSegments.length
        archivedCount.value += batch.length
        uploadError.value = undefined
        archivePaused.value = false
        uploaded = true
      })
      .catch((error) => {
        pauseArchive(String(error))
        console.error(`上传转写字幕失败: ${error}`)
      })
      .finally(() => (flushTask = undefined))
    await flushTask
    if (all && uploaded && pendingSegments.length) await flush(true)
  }

  async function finishSession() {
    if (finishTask) return finishTask
    if (!sessionId.value) return
    finishTask = closeArchiveSession().finally(() => (finishTask = undefined))
    return finishTask
  }

  async function closeArchiveSession() {
    const currentSessionId = sessionId.value
    if (!currentSessionId) return
    stopUploadTimer()
    await flush(true)
    if (pendingSegments.length) throw new Error(uploadError.value || '仍有字幕未完成归档')
    const connection = webFetcher.signalRClient
    if (!connection) throw new Error('EventFetcher 已断开，无法结束转写归档会话')
    const result = await connection.invoke<HubResult>('EndTranscriptSession', currentSessionId)
    if (!result.Success) throw new Error(result.Message)
    sessionId.value = undefined
  }

  async function dispose() {
    stopUploadTimer()
    if (status.value.running || sessionId.value) {
      await stop().catch((error) => console.error(`停止转写失败: ${error}`))
    }
    initialized = false
  }

  return {
    status,
    partialText,
    lastFinalText,
    lines,
    archivedCount,
    pendingCount,
    sessionId,
    uploadError,
    runtimeError,
    stderrLine,
    archivePaused,
    init,
    start,
    stop,
    flush,
    dispose,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useTranscription, import.meta.hot))
