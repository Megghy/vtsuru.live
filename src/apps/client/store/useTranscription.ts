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

interface HubResult {
  Success: boolean
  Message: string
}

interface StartSessionResult extends HubResult {
  SessionId: string
}

function profileModel(profile: TranscriptionProfile) {
  return profile.provider === 'tencent' ? profile.engineModelType : profile.model
}

export const useTranscription = defineStore('transcription', () => {
  const account = useAccount()
  const settingsStore = useTranscriptionSettings()
  const webFetcher = useWebFetcher()
  const status = ref<TranscriptionStatus>({ running: false, phase: 'idle' })
  const partialText = ref('')
  const lastFinalText = ref('')
  const archivedCount = ref(0)
  const pendingCount = ref(0)
  const sessionId = ref<string>()
  const uploadError = ref<string>()
  const runtimeError = ref<string>()
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
  let stopping = false
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

      status.value.message = '正在获取 Bilibili 播放流'
      const source = await resolveBilibiliStream(Number(account.value.biliRoomId))
      status.value = {
        ...status.value,
        canonicalRoomId: source.canonicalRoomId,
        sourceProtocol: source.protocol,
        sourceFormat: source.format,
        phase: 'connecting_provider',
        message: '正在连接转写 Provider',
      }

      provider = createProvider(profile, {
        onPartial: (result) => (partialText.value = result.text),
        onFinal: enqueueFinal,
        onError: (error) => void failRuntime(error),
      })
      await provider.connect()

      status.value = { ...status.value, phase: 'starting_ffmpeg', message: '正在启动 FFmpeg 音频提取' }
      frameBuffer = new AudioFrameBuffer(pcmFrameSize(provider.sampleRate), (frame) => {
        try {
          provider?.sendAudio(frame)
        } catch (error) {
          void failRuntime(error)
        }
      })
      ffmpegJob = await startAudioExtraction(
        source,
        provider.sampleRate,
        (chunk) => frameBuffer?.append(chunk),
        () => undefined,
        () => {
          if (!stopping) void failRuntime(new Error('FFmpeg 音频提取进程已结束'))
        },
      )
      status.value = {
        ...status.value,
        phase: 'running',
        startedAt: Math.floor(Date.now() / 1000),
        message: undefined,
      }
      startUploadTimer()
    } catch (error) {
      stopping = true
      await cleanupRuntime().catch(() => undefined)
      await closeArchiveSession().catch(() => undefined)
      stopping = false
      status.value = { running: false, phase: 'error', message: String(error) }
      runtimeError.value = String(error)
      throw error
    }
  }

  function resetRuntime(profile: TranscriptionProfile) {
    stopping = false
    sequence = 0
    lastEndMs = 0
    archivedCount.value = 0
    pendingSegments.length = 0
    pendingCount.value = 0
    finalizedIds.clear()
    partialText.value = ''
    lastFinalText.value = ''
    uploadError.value = undefined
    runtimeError.value = undefined
    status.value = {
      running: true,
      phase: 'resolving_stream',
      provider: profile.provider,
      roomId: Number(account.value.biliRoomId),
      message: '正在创建转写归档会话',
    }
  }

  function enqueueFinal(result: ProviderTranscript) {
    const text = result.text.trim()
    if (!text || finalizedIds.has(result.id)) return
    finalizedIds.add(result.id)
    partialText.value = ''
    lastFinalText.value = text
    if (pendingSegments.length >= MAX_PENDING_SEGMENTS) {
      void failRuntime(new Error('待归档字幕过多，转写已停止，请恢复 EventFetcher 连接后重试上传'))
      return
    }
    const startMs = result.startMs ?? lastEndMs
    const endMs = result.endMs ?? startMs
    lastEndMs = endMs
    pendingSegments.push({
      sequence: sequence++,
      startMs,
      endMs,
      text,
      speaker: result.speaker,
    })
    pendingCount.value = pendingSegments.length
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
    status.value = { ...status.value, phase: 'stopping', message: '正在停止直播转写' }
    let error = originalError
    try {
      await cleanupRuntime()
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

  async function cleanupRuntime() {
    frameBuffer?.clear()
    frameBuffer = undefined
    const job = ffmpegJob
    ffmpegJob = undefined
    if (job) {
      job.stdout.close()
      job.stderr.close()
      await job.stop()
    }
    const currentProvider = provider
    provider = undefined
    if (currentProvider) await currentProvider.finish()
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
      uploadError.value = 'EventFetcher 已断开，字幕将在连接恢复后继续上传'
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
        uploaded = true
      })
      .catch((error) => {
        uploadError.value = String(error)
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
    archivedCount,
    pendingCount,
    sessionId,
    uploadError,
    runtimeError,
    init,
    start,
    stop,
    flush,
    dispose,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useTranscription, import.meta.hot))
