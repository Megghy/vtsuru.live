export interface ProviderTranscript {
  id: string
  text: string
  startMs?: number
  endMs?: number
  speaker?: string
}

export interface TranscriptionProviderCallbacks {
  onPartial: (result: ProviderTranscript) => void
  onFinal: (result: ProviderTranscript) => void
  onError: (error: Error) => void
}

export interface TranscriptionProviderClient {
  readonly sampleRate: number
  connect: () => Promise<void>
  sendAudio: (chunk: Uint8Array) => void
  finish: () => Promise<void>
}
