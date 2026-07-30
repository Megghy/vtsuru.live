import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import type { OpenAITranscriptionProfile } from '@/shared/models/transcription'

import { toBase64 } from '../audio'
import type { ProviderTranscript, TranscriptionProviderCallbacks, TranscriptionProviderClient } from '../types'

interface ClientSecretResponse {
  value: string
}

interface RealtimeEvent {
  type: string
  item_id?: string
  delta?: string
  transcript?: string
  audio_start_ms?: number
  audio_end_ms?: number
  error?: { message?: string }
}

export class OpenAITranscriptionClient implements TranscriptionProviderClient {
  readonly sampleRate = 24_000
  private socket?: WebSocket
  private closing = false
  private hasUncommittedAudio = false
  private activeStartMs?: number
  private readonly partials = new Map<string, string>()
  private readonly times = new Map<string, { startMs?: number; endMs?: number }>()
  private readonly itemOrder: string[] = []
  private readonly completed = new Map<string, ProviderTranscript>()

  constructor(
    private readonly profile: OpenAITranscriptionProfile,
    private readonly callbacks: TranscriptionProviderCallbacks,
  ) {}

  async connect() {
    const token = await createClientSecret(this.profile)
    const realtimeUrl = new URL(this.profile.baseUrl)
    realtimeUrl.searchParams.set('model', this.profile.model)
    const socket = new WebSocket(realtimeUrl, ['realtime', `openai-insecure-api-key.${token}`])
    this.socket = socket
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('连接 OpenAI Realtime 超时')), 10_000)
      socket.addEventListener(
        'open',
        () => {
          clearTimeout(timeout)
          resolve()
        },
        { once: true },
      )
      socket.addEventListener(
        'error',
        () => {
          clearTimeout(timeout)
          reject(new Error('连接 OpenAI Realtime 失败'))
        },
        { once: true },
      )
    })
    socket.addEventListener('message', (event) => this.handleMessage(JSON.parse(String(event.data))))
    socket.addEventListener('error', () => {
      if (!this.closing) this.callbacks.onError(new Error('OpenAI Realtime 连接异常'))
    })
    socket.addEventListener('close', () => {
      if (!this.closing) this.callbacks.onError(new Error('OpenAI Realtime 连接已断开'))
    })
  }

  sendAudio(chunk: Uint8Array) {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error('OpenAI Realtime 尚未连接')
    this.socket.send(
      JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: toBase64(chunk),
      }),
    )
    this.hasUncommittedAudio = true
  }

  async finish() {
    const socket = this.socket
    if (!socket || socket.readyState >= WebSocket.CLOSING) return
    this.closing = true
    if (!this.hasUncommittedAudio && this.partials.size === 0) {
      socket.close()
      return
    }
    if (this.hasUncommittedAudio) {
      socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }))
      this.hasUncommittedAudio = false
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    socket.close()
  }

  private handleMessage(event: RealtimeEvent) {
    if (event.type === 'error') {
      this.callbacks.onError(new Error(event.error?.message || 'OpenAI Realtime 返回错误'))
      return
    }
    if (event.type === 'conversation.item.input_audio_transcription.failed') {
      this.callbacks.onError(new Error(event.error?.message || 'OpenAI Realtime 转写失败'))
      return
    }
    if (event.type === 'input_audio_buffer.speech_started') {
      this.activeStartMs = event.audio_start_ms
      return
    }
    if (event.type === 'input_audio_buffer.speech_stopped' && event.item_id) {
      this.hasUncommittedAudio = false
      if (!this.itemOrder.includes(event.item_id)) this.itemOrder.push(event.item_id)
      this.times.set(event.item_id, { startMs: this.activeStartMs, endMs: event.audio_end_ms })
      this.activeStartMs = undefined
      return
    }
    if (event.type === 'conversation.item.input_audio_transcription.delta' && event.item_id && event.delta) {
      const text = `${this.partials.get(event.item_id) ?? ''}${event.delta}`
      this.partials.set(event.item_id, text)
      this.callbacks.onPartial({ id: event.item_id, text, ...this.times.get(event.item_id) })
      return
    }
    if (event.type === 'conversation.item.input_audio_transcription.completed' && event.item_id) {
      const text = event.transcript ?? this.partials.get(event.item_id) ?? ''
      this.partials.delete(event.item_id)
      const time = this.times.get(event.item_id)
      this.times.delete(event.item_id)
      if (!this.itemOrder.includes(event.item_id)) this.itemOrder.push(event.item_id)
      this.completed.set(event.item_id, { id: event.item_id, text, ...time })
      this.flushCompleted()
    }
  }

  private flushCompleted() {
    while (this.itemOrder.length) {
      const id = this.itemOrder[0]
      const result = this.completed.get(id)
      if (!result) return
      this.itemOrder.shift()
      this.completed.delete(id)
      if (result.text.trim()) this.callbacks.onFinal(result)
    }
  }
}

async function createClientSecret(profile: OpenAITranscriptionProfile) {
  const endpoint = new URL(profile.baseUrl)
  endpoint.protocol = endpoint.protocol === 'ws:' ? 'http:' : 'https:'
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, '')}/client_secrets`
  endpoint.search = ''
  const transcription: Record<string, unknown> = {
    model: profile.model,
    delay: 'low',
  }
  if (profile.language) transcription.languages = [profile.language]
  if (profile.hotwords.length) transcription.keywords = profile.hotwords

  const response = await tauriFetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${profile.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: 24_000 },
            transcription,
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
          },
        },
      },
    }),
  })
  if (!response.ok) throw new Error(`创建 OpenAI Realtime 临时令牌失败: HTTP ${response.status}`)
  const payload = (await response.json()) as ClientSecretResponse
  if (!payload.value) throw new Error('OpenAI Realtime 未返回临时令牌')
  return payload.value
}
