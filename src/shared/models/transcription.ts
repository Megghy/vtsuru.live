export type TranscriptionProvider = 'tencent' | 'openai'

export interface TranscriptionProfileBase {
  id: string
  name: string
  provider: TranscriptionProvider
  language: string
  hotwords: string[]
}

export interface TencentTranscriptionProfile extends TranscriptionProfileBase {
  provider: 'tencent'
  engineModelType: string
  appId: string
  secretId: string
  secretKey: string
}

export interface OpenAITranscriptionProfile extends TranscriptionProfileBase {
  provider: 'openai'
  model: string
  apiKey: string
  baseUrl: string
}

export type TranscriptionProfile = TencentTranscriptionProfile | OpenAITranscriptionProfile

export interface TranscriptionSettings {
  activeProfileId: string
  profiles: TranscriptionProfile[]
}

export type TranscriptionPhase =
  | 'idle'
  | 'resolving_stream'
  | 'connecting_provider'
  | 'starting_ffmpeg'
  | 'running'
  | 'stopping'
  | 'error'

export interface TranscriptionStatus {
  running: boolean
  phase: TranscriptionPhase
  provider?: string
  roomId?: number
  canonicalRoomId?: number
  sourceProtocol?: string
  sourceFormat?: string
  startedAt?: number
  message?: string
}

export interface TranscriptSegment {
  sequence: number
  startMs: number
  endMs: number
  text: string
  speaker?: string
}

export interface TranscriptSession {
  id: string
  liveId: string
  provider: TranscriptionProvider
  model: string
  language: string
  startedAt: number
  endedAt?: number
}

export interface TranscriptSegmentPage {
  segments: (TranscriptSegment & { sessionId: string })[]
  page: number
  pageSize: number
  total: number
  more: boolean
}
