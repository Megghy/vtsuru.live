import { invoke } from '@tauri-apps/api/core'
import { appLocalDataDir, downloadDir, join, videoDir } from '@tauri-apps/api/path'
import { exists, mkdir, readDir, remove, stat, writeTextFile } from '@tauri-apps/plugin-fs'
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { type BilibiliStreamSource, resolveBilibiliStream } from '@/apps/client/services/transcription/bilibili'
import type { FfmpegJobStatus } from '@/apps/client/services/transcription/ffmpeg'
import { isTauri } from '@/shared/config'

export interface StreamClipConfig {
  bufferSeconds: number
  segmentSeconds: number
  defaultClipSeconds: number
  outputDir: string
  autoTriggerOnBurst: boolean
  burstWindowSeconds: number
  burstThreshold: number
  burstCooldownSeconds: number
}

export interface SavedStreamClip {
  id: string
  label: string
  filePath: string
  durationSeconds: number
  createdAt: number
  sizeBytes?: number
}

interface SpawnFfmpegJobResponse {
  job: FfmpegJobStatus
  token: string
  wsBaseUrl: string
}

const CONFIG_KEY = 'vtsuru-stream-clip-config-v1'
const CLIPS_KEY = 'vtsuru-stream-clip-history-v1'

const DEFAULT_CONFIG: StreamClipConfig = {
  bufferSeconds: 300,
  segmentSeconds: 15,
  defaultClipSeconds: 120,
  outputDir: '',
  autoTriggerOnBurst: false,
  burstWindowSeconds: 15,
  burstThreshold: 25,
  burstCooldownSeconds: 90,
}

function loadConfig(): StreamClipConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<StreamClipConfig>) }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

function loadClips(): SavedStreamClip[] {
  try {
    const raw = localStorage.getItem(CLIPS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedStreamClip[]).slice(0, 50) : []
  } catch {
    return []
  }
}

function sanitizeFileName(input: string): string {
  return (
    input
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 40) || 'clip'
  )
}

function toFfmpegConcatPath(fullPath: string): string {
  return fullPath.replace(/\\/g, '/').replace(/'/g, "'\\''")
}

export const useStreamClipRecorder = defineStore('client-stream-clip-recorder', () => {
  const account = useAccount()
  const config = ref<StreamClipConfig>(loadConfig())
  const recentClips = ref<SavedStreamClip[]>(loadClips())

  const isBuffering = ref(false)
  const isStarting = ref(false)
  const isSavingClip = ref(false)
  const activeJobId = ref<string | null>(null)
  const activeBufferDir = ref<string | null>(null)
  const activeSource = ref<BilibiliStreamSource | null>(null)
  const startedAt = ref<number>(0)
  const lastError = ref<string | null>(null)
  const bufferedSegmentCount = ref(0)

  let statusTimer: ReturnType<typeof setInterval> | null = null
  const recentDanmakuTs: number[] = []
  let lastAutoBurstAt = 0
  let pendingBurstTimer: ReturnType<typeof setTimeout> | null = null

  const bufferedSecondsEstimate = computed(() =>
    Math.min(config.value.bufferSeconds, bufferedSegmentCount.value * config.value.segmentSeconds),
  )

  function persistConfig() {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config.value))
  }

  function persistClips() {
    localStorage.setItem(CLIPS_KEY, JSON.stringify(recentClips.value.slice(0, 50)))
  }

  function updateConfig(patch: Partial<StreamClipConfig>) {
    config.value = { ...config.value, ...patch }
    persistConfig()
  }

  async function resolveOutputDir(): Promise<string> {
    if (config.value.outputDir.trim()) {
      await mkdir(config.value.outputDir.trim(), { recursive: true })
      return config.value.outputDir.trim()
    }
    let base: string
    try {
      base = await videoDir()
    } catch {
      base = await downloadDir()
    }
    const target = await join(base, 'VTsuruClips')
    await mkdir(target, { recursive: true })
    return target
  }

  async function cleanupStaleJobs() {
    const jobs = await invoke<FfmpegJobStatus[]>('list_ffmpeg_jobs')
    for (const job of jobs) {
      if (job.label === 'stream-clip-buffer' && job.state === 'running') {
        await invoke('stop_ffmpeg_job', { id: job.id }).catch(() => undefined)
      }
    }
  }

  async function refreshBufferStatus() {
    if (!activeJobId.value || !activeBufferDir.value) return
    try {
      const status = await invoke<FfmpegJobStatus>('get_ffmpeg_job', { id: activeJobId.value })
      if (status.state !== 'running') {
        isBuffering.value = false
        lastError.value = status.message || 'FFmpeg 缓冲拉流已中断'
        stopPolling()
        return
      }
      const entries = await readDir(activeBufferDir.value)
      bufferedSegmentCount.value = entries.filter((e) => e.name.endsWith('.ts')).length
    } catch {
      // ignore transient poll error
    }
  }

  function stopPolling() {
    if (statusTimer) {
      clearInterval(statusTimer)
      statusTimer = null
    }
    if (pendingBurstTimer) {
      clearTimeout(pendingBurstTimer)
      pendingBurstTimer = null
    }
  }

  async function startBuffer(roomIdOverride?: number) {
    if (!isTauri()) throw new Error('本地高光切片录制仅在桌面客户端中可用')
    if (isBuffering.value || isStarting.value) return

    const roomId = roomIdOverride && roomIdOverride > 0 ? roomIdOverride : account.value.biliRoomId
    if (!roomId || roomId <= 0) {
      throw new Error('尚未绑定 B 站直播间，无法启动回溯缓冲')
    }

    isStarting.value = true
    lastError.value = null
    try {
      await cleanupStaleJobs()
      const source = await resolveBilibiliStream(roomId)
      const dataDir = await appLocalDataDir()
      const bufferDir = await join(dataDir, 'stream-clip-buffer', `room_${source.canonicalRoomId}_${Date.now()}`)
      await mkdir(bufferDir, { recursive: true })

      const segSec = Math.max(5, Math.min(30, Math.round(config.value.segmentSeconds)))
      const wrapCount = Math.max(4, Math.ceil(config.value.bufferSeconds / segSec) + 2)
      const segPattern = await join(bufferDir, 'seg_%03d.ts')

      const request = {
        label: 'stream-clip-buffer',
        args: [
          '-hide_banner',
          '-loglevel',
          'warning',
          '-nostdin',
          '-rw_timeout',
          '15000000',
          '-reconnect',
          '1',
          '-reconnect_streamed',
          '1',
          '-reconnect_delay_max',
          '5',
          '-user_agent',
          'Mozilla/5.0',
          '-headers',
          'Referer: https://live.bilibili.com/\r\nOrigin: https://live.bilibili.com\r\n',
          '-i',
          source.url,
          '-c',
          'copy',
          '-f',
          'segment',
          '-segment_format',
          'mpegts',
          '-segment_time',
          String(segSec),
          '-segment_wrap',
          String(wrapCount),
          '-reset_timestamps',
          '1',
          segPattern,
        ],
        stdin: 'null',
        stdout: 'null',
        stderr: 'null',
      }

      const spawned = await invoke<SpawnFfmpegJobResponse>('spawn_ffmpeg_job', { request })
      await new Promise((r) => setTimeout(r, 400))
      const status = await invoke<FfmpegJobStatus>('get_ffmpeg_job', { id: spawned.job.id })
      if (status.state !== 'running') {
        throw new Error(status.message || 'FFmpeg 缓冲拉流启动失败')
      }

      activeJobId.value = spawned.job.id
      activeBufferDir.value = bufferDir
      activeSource.value = source
      startedAt.value = Date.now()
      bufferedSegmentCount.value = 0
      isBuffering.value = true

      stopPolling()
      statusTimer = setInterval(() => void refreshBufferStatus(), 4000)
      toast.success(`已开启直播流回溯缓冲（最近 ${Math.round(config.value.bufferSeconds / 60)} 分钟）`)
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      isStarting.value = false
    }
  }

  async function stopBuffer() {
    stopPolling()
    const jobId = activeJobId.value
    const dir = activeBufferDir.value
    activeJobId.value = null
    activeSource.value = null
    isBuffering.value = false
    bufferedSegmentCount.value = 0

    if (jobId) {
      await invoke('stop_ffmpeg_job', { id: jobId }).catch(() => undefined)
    }
    if (dir) {
      await remove(dir, { recursive: true }).catch(() => undefined)
      activeBufferDir.value = null
    }
  }

  async function saveClip(label?: string, durationSeconds?: number): Promise<SavedStreamClip> {
    if (!isTauri()) throw new Error('仅桌面客户端支持本地切片')
    if (!isBuffering.value || !activeBufferDir.value) {
      throw new Error('回溯缓冲未运行，请先开启本地切片缓冲')
    }
    if (isSavingClip.value) {
      throw new Error('正在导出上一个切片，请稍候')
    }

    isSavingClip.value = true
    try {
      const targetSec = Math.max(15, Math.min(config.value.bufferSeconds, durationSeconds || config.value.defaultClipSeconds))
      const entries = await readDir(activeBufferDir.value)
      const tsFiles: Array<{ path: string; mtime: number; size: number }> = []
      const now = Date.now()

      for (const entry of entries) {
        if (!entry.name.endsWith('.ts')) continue
        const full = await join(activeBufferDir.value, entry.name)
        const info = await stat(full).catch(() => null)
        if (!info || info.size < 4096) continue
        const mtime = info.mtime ? info.mtime.getTime() : 0
        tsFiles.push({ path: full, mtime, size: info.size })
      }

      tsFiles.sort((a, b) => a.mtime - b.mtime)
      // 跳过正在写入中的最新分段，避免文件尾损坏（若只有一个分段则保留）
      const completed = tsFiles.length > 1 && now - tsFiles[tsFiles.length - 1].mtime < 1500
        ? tsFiles.slice(0, -1)
        : tsFiles

      if (completed.length === 0) {
        throw new Error('缓冲尚未生成可用分片，请等待约 15 秒后再保存')
      }

      const neededCount = Math.max(1, Math.ceil(targetSec / Math.max(5, config.value.segmentSeconds)))
      const picked = completed.slice(-neededCount)

      const concatListPath = await join(activeBufferDir.value, `concat_${now}.txt`)
      const concatContent = picked.map((f) => `file '${toFfmpegConcatPath(f.path)}'`).join('\n')
      await writeTextFile(concatListPath, concatContent)

      const outDir = await resolveOutputDir()
      const stamp = new Date(now)
      const dateStr = `${stamp.getFullYear()}${String(stamp.getMonth() + 1).padStart(2, '0')}${String(stamp.getDate()).padStart(2, '0')}_${String(stamp.getHours()).padStart(2, '0')}${String(stamp.getMinutes()).padStart(2, '0')}${String(stamp.getSeconds()).padStart(2, '0')}`
      const cleanLabel = label?.trim() || '高光切片'
      const outPath = await join(outDir, `${dateStr}_${sanitizeFileName(cleanLabel)}.mp4`)

      const request = {
        label: 'stream-clip-export',
        args: [
          '-hide_banner',
          '-loglevel',
          'error',
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          concatListPath,
          '-c',
          'copy',
          '-movflags',
          '+faststart',
          outPath,
        ],
        stdin: 'null',
        stdout: 'null',
        stderr: 'null',
      }

      const spawned = await invoke<SpawnFfmpegJobResponse>('spawn_ffmpeg_job', { request })
      const deadline = Date.now() + 60_000
      let finalStatus: FfmpegJobStatus | null = null
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 300))
        finalStatus = await invoke<FfmpegJobStatus>('get_ffmpeg_job', { id: spawned.job.id })
        if (finalStatus.state !== 'running') break
      }

      await remove(concatListPath).catch(() => undefined)

      if (!finalStatus || finalStatus.state === 'running') {
        await invoke('stop_ffmpeg_job', { id: spawned.job.id }).catch(() => undefined)
        throw new Error('切片合成超时')
      }
      if (finalStatus.state === 'failed' || (finalStatus.exitCode && finalStatus.exitCode !== 0)) {
        throw new Error(finalStatus.message || `FFmpeg 导出失败 (exit ${finalStatus.exitCode})`)
      }

      const fileInfo = (await exists(outPath)) ? await stat(outPath).catch(() => null) : null
      const clip: SavedStreamClip = {
        id: `${now}_${Math.random().toString(36).slice(2, 6)}`,
        label: cleanLabel,
        filePath: outPath,
        durationSeconds: picked.length * config.value.segmentSeconds,
        createdAt: now,
        sizeBytes: fileInfo?.size,
      }
      recentClips.value = [clip, ...recentClips.value].slice(0, 50)
      persistClips()
      toast.success(`已保存高光切片：${cleanLabel}`)
      return clip
    } finally {
      isSavingClip.value = false
    }
  }

  function recordDanmakuForBurst() {
    if (!isBuffering.value || !config.value.autoTriggerOnBurst) return
    const now = Date.now()
    const windowMs = Math.max(5, config.value.burstWindowSeconds) * 1000
    recentDanmakuTs.push(now)
    while (recentDanmakuTs.length > 0 && now - recentDanmakuTs[0] > windowMs) {
      recentDanmakuTs.shift()
    }
    if (
      recentDanmakuTs.length >= config.value.burstThreshold &&
      now - lastAutoBurstAt >= config.value.burstCooldownSeconds * 1000 &&
      !pendingBurstTimer
    ) {
      lastAutoBurstAt = now
      // 延迟 15 秒保存，以便完整包含高潮后半段
      pendingBurstTimer = setTimeout(() => {
        pendingBurstTimer = null
        void saveClip(`弹幕高能_${recentDanmakuTs.length}条`).catch(() => undefined)
      }, 15_000)
    }
  }

  async function openOutputFolder() {
    const dir = await resolveOutputDir()
    await openPath(dir)
  }

  async function revealClip(filePath: string) {
    await revealItemInDir(filePath)
  }

  function removeClipRecord(id: string) {
    recentClips.value = recentClips.value.filter((c) => c.id !== id)
    persistClips()
  }

  return {
    config,
    recentClips,
    isBuffering,
    isStarting,
    isSavingClip,
    activeSource,
    startedAt,
    lastError,
    bufferedSegmentCount,
    bufferedSecondsEstimate,
    updateConfig,
    startBuffer,
    stopBuffer,
    saveClip,
    recordDanmakuForBurst,
    openOutputFolder,
    revealClip,
    removeClipRecord,
  }
})
