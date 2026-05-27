import OpenAI from 'openai'

export interface TtsClientOptions {
  apiKey: string
  baseURL?: string
}

export function createOpenAIClient(options: TtsClientOptions): OpenAI {
  return new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL || 'https://api.openai.com/v1',
    dangerouslyAllowBrowser: true,
  })
}

export interface SpeechRequest {
  model?: string
  input: string
  voice: string
  responseFormat?: 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm'
  speed?: number
}

export async function synthesizeSpeech(client: OpenAI, req: SpeechRequest): Promise<Blob> {
  const response = await client.audio.speech.create({
    model: req.model || 'tts-1',
    input: req.input,
    voice: req.voice as any,
    response_format: req.responseFormat || 'mp3',
    speed: req.speed,
  })
  return new Blob([await response.arrayBuffer()], {
    type: `audio/${req.responseFormat || 'mp3'}`,
  })
}

export interface MimoTtsRequest {
  model: 'mimo-v2.5-tts' | 'mimo-v2.5-tts-voiceclone' | 'mimo-v2.5-tts-voicedesign'
  messages: Array<{ role: string; content: string }>
  audio: { format?: string; voice?: string }
}

export async function synthesizeMimoTts(client: OpenAI, req: MimoTtsRequest): Promise<Blob> {
  const response = await client.chat.completions.create({
    model: req.model,
    messages: req.messages as any,
    audio: req.audio as any,
  } as any)

  const audioData = (response as any).choices?.[0]?.message?.audio?.data
  if (!audioData) throw new Error('MiMo 响应中无音频数据')

  const binary = atob(audioData)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: `audio/${req.audio.format || 'wav'}` })
}

const MIMO_BASE_URL = 'https://api.xiaomimimo.com/v1'

export function createMimoClient(apiKey: string): OpenAI {
  return createOpenAIClient({ apiKey, baseURL: MIMO_BASE_URL })
}
