import { invoke } from '@tauri-apps/api/core'
import type { BilibiliStreamSource } from './bilibili'

export interface FfmpegJobStatus {
  id: string
  label?: string
  state: 'running' | 'stopped' | 'failed'
  startedAt: number
  endedAt?: number
  exitCode?: number
  message?: string
}

interface SpawnFfmpegJobResponse {
  job: FfmpegJobStatus
  token: string
  wsBaseUrl: string
  hasStdin: boolean
  hasStdout: boolean
  hasStderr: boolean
}

export interface FfmpegAudioJob {
  id: string
  stdout: WebSocket
  stderr: WebSocket
  stop: () => Promise<FfmpegJobStatus>
}

export async function startAudioExtraction(
  source: BilibiliStreamSource,
  sampleRate: number,
  onAudio: (chunk: Uint8Array) => void,
  onStderr: (line: string) => void,
  onClose: () => void,
): Promise<FfmpegAudioJob> {
  const request = {
    label: 'live-transcription',
    args: buildArgs(source.url, sampleRate),
    stdin: 'null',
    stdout: 'pipe',
    stderr: 'pipe',
  }
  const spawned = await invoke<SpawnFfmpegJobResponse>('spawn_ffmpeg_job', { request })
  const token = encodeURIComponent(spawned.token)
  const stdout = new WebSocket(`${spawned.wsBaseUrl}/stdout?token=${token}`)
  let closed = false
  let active = false
  stdout.binaryType = 'arraybuffer'
  stdout.addEventListener('message', event => onAudio(new Uint8Array(event.data as ArrayBuffer)))
  stdout.addEventListener('close', () => {
    closed = true
    if (active) onClose()
  })

  const stderr = new WebSocket(`${spawned.wsBaseUrl}/stderr?token=${token}`)
  stderr.addEventListener('message', event => onStderr(String(event.data)))

  try {
    await Promise.all([waitForOpen(stdout), waitForOpen(stderr)])
    const status = await invoke<FfmpegJobStatus>('get_ffmpeg_job', { id: spawned.job.id })
    if (closed || status.state !== 'running') throw new Error(status.message || 'FFmpeg 音频提取进程启动失败')
  } catch (error) {
    await invoke('stop_ffmpeg_job', { id: spawned.job.id }).catch(() => undefined)
    throw error
  }

  active = true
  return {
    id: spawned.job.id,
    stdout,
    stderr,
    stop: async () => invoke<FfmpegJobStatus>('stop_ffmpeg_job', { id: spawned.job.id }),
  }
}

export async function stopStaleTranscriptionJobs() {
  const jobs = await invoke<FfmpegJobStatus[]>('list_ffmpeg_jobs')
  for (const job of jobs) {
    if (job.label === 'live-transcription' && job.state === 'running') {
      await invoke('stop_ffmpeg_job', { id: job.id })
    }
  }
}

function buildArgs(url: string, sampleRate: number): string[] {
  return [
    '-hide_banner',
    '-loglevel', 'warning',
    '-nostdin',
    '-rw_timeout', '15000000',
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-user_agent', 'Mozilla/5.0',
    '-headers', 'Referer: https://live.bilibili.com/\r\nOrigin: https://live.bilibili.com\r\n',
    '-re',
    '-i', url,
    '-map', '0:a:0',
    '-vn',
    '-ac', '1',
    '-ar', String(sampleRate),
    '-c:a', 'pcm_s16le',
    '-f', 's16le',
    'pipe:1',
  ]
}

async function waitForOpen(socket: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true })
    socket.addEventListener('error', () => reject(new Error('连接本地 FFmpeg 数据通道失败')), { once: true })
    socket.addEventListener('close', () => reject(new Error('本地 FFmpeg 数据通道已关闭')), { once: true })
  })
}
