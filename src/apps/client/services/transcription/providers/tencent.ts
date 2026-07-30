import type { TencentTranscriptionProfile } from '@/shared/models/transcription'
import type { TranscriptionProviderCallbacks, TranscriptionProviderClient } from '../types'

const HOST = 'asr.cloud.tencent.com'

interface TencentResult {
  slice_type: number
  index: number
  start_time?: number
  end_time?: number
  voice_text_str: string
}

interface TencentEvent {
  code: number
  message?: string
  final?: number
  result?: TencentResult
}

export class TencentTranscriptionClient implements TranscriptionProviderClient {
  readonly sampleRate = 16_000
  private socket?: WebSocket
  private closing = false

  constructor(
    private readonly profile: TencentTranscriptionProfile,
    private readonly callbacks: TranscriptionProviderCallbacks,
  ) {}

  async connect() {
    const url = await createSignedUrl(this.profile)
    const socket = new WebSocket(url)
    socket.binaryType = 'arraybuffer'
    this.socket = socket

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('连接腾讯云实时语音识别超时')), 10_000)
      const fail = (error: Error) => {
        clearTimeout(timeout)
        reject(error)
      }
      socket.addEventListener('error', () => fail(new Error('连接腾讯云实时语音识别失败')), { once: true })
      socket.addEventListener('message', (event) => {
        const payload = JSON.parse(String(event.data)) as TencentEvent
        if (payload.code !== 0) return fail(new Error(payload.message || `腾讯云返回 ${payload.code}`))
        clearTimeout(timeout)
        resolve()
      }, { once: true })
    })

    socket.addEventListener('message', event => this.handleMessage(JSON.parse(String(event.data))))
    socket.addEventListener('error', () => {
      if (!this.closing) this.callbacks.onError(new Error('腾讯云实时语音识别连接异常'))
    })
    socket.addEventListener('close', () => {
      if (!this.closing) this.callbacks.onError(new Error('腾讯云实时语音识别连接已断开'))
    })
  }

  sendAudio(chunk: Uint8Array) {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error('腾讯云实时语音识别尚未连接')
    this.socket.send(chunk.slice().buffer)
  }

  async finish() {
    const socket = this.socket
    if (!socket || socket.readyState >= WebSocket.CLOSING) return
    this.closing = true
    socket.send(JSON.stringify({ type: 'end' }))
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, 4_000)
      const done = () => {
        clearTimeout(timeout)
        resolve()
      }
      socket.addEventListener('message', (event) => {
        const payload = JSON.parse(String(event.data)) as TencentEvent
        if (payload.final === 1) done()
      })
      socket.addEventListener('close', done, { once: true })
    })
    socket.close()
  }

  private handleMessage(payload: TencentEvent) {
    if (payload.code !== 0) {
      this.callbacks.onError(new Error(payload.message || `腾讯云返回 ${payload.code}`))
      return
    }
    const result = payload.result
    if (!result?.voice_text_str) return
    const transcript = {
      id: String(result.index),
      text: result.voice_text_str,
      startMs: result.start_time,
      endMs: result.end_time,
    }
    if (result.slice_type === 2) this.callbacks.onFinal(transcript)
    else this.callbacks.onPartial(transcript)
  }
}

async function createSignedUrl(profile: TencentTranscriptionProfile) {
  const timestamp = Math.floor(Date.now() / 1000)
  const query = new URLSearchParams({
    secretid: profile.secretId,
    timestamp: String(timestamp),
    expired: String(timestamp + 86_400),
    nonce: String(crypto.getRandomValues(new Uint32Array(1))[0]),
    engine_model_type: profile.engineModelType,
    voice_id: crypto.randomUUID(),
    voice_format: '1',
    needvad: '1',
    filter_dirty: '1',
    filter_modal: '1',
    filter_punc: '1',
    convert_num_mode: '1',
    word_info: '0',
  })
  if (profile.hotwords.length) {
    query.set('reinforce_hotword', '1')
    query.set('hotword_list', profile.hotwords.join(','))
  }
  query.sort()
  const unsigned = `${HOST}/asr/v2/${profile.appId}?${query}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(profile.secretKey),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(unsigned))
  const signatureBase64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
  query.set('signature', signatureBase64)
  return `wss://${HOST}/asr/v2/${profile.appId}?${query}`
}
