import { TTS_API_URL } from '@/shared/config'
import type { ConfigSource, VoiceOption, VoiceProvider } from './types'

const DASH_SCOPE_TTS_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer'
const DASH_SCOPE_CUSTOMIZATION_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization'

export const DEFAULT_COSYVOICE_MODEL = 'cosyvoice-v3-flash'
export const DEFAULT_COSYVOICE_VOICE = 'longanyang'

export const COSYVOICE_MODELS = [
  {
    label: 'CosyVoice3 Flash',
    value: 'cosyvoice-v3-flash',
    price: '1 元 / 1 万字符',
    note: '支持系统音色和自定义音色，适合默认读弹幕。',
    customVoiceOnly: false,
  },
  {
    label: 'CosyVoice3 Plus',
    value: 'cosyvoice-v3-plus',
    price: '2 元 / 1 万字符',
    note: '支持系统音色和自定义音色，质量更高但价格更贵。',
    customVoiceOnly: false,
  },
  {
    label: 'CosyVoice3.5 Flash',
    value: 'cosyvoice-v3.5-flash',
    price: '0.8 元 / 1 万字符',
    note: '仅支持声音复刻/声音设计音色，需要填写自己的 DashScope Key 并选择自定义音色。',
    customVoiceOnly: true,
  },
  {
    label: 'CosyVoice3.5 Plus',
    value: 'cosyvoice-v3.5-plus',
    price: '1.5 元 / 1 万字符',
    note: '仅支持声音复刻/声音设计音色，需要填写自己的 DashScope Key 并选择自定义音色。',
    customVoiceOnly: true,
  },
]

export const COSYVOICE_LANGUAGE_HINTS = [
  { label: '自动', value: '' },
  { label: '中文', value: 'zh' },
  { label: '英文', value: 'en' },
  { label: '日语', value: 'ja' },
  { label: '韩语', value: 'ko' },
  { label: '法语', value: 'fr' },
  { label: '德语', value: 'de' },
  { label: '俄语', value: 'ru' },
  { label: '葡萄牙语', value: 'pt' },
  { label: '泰语', value: 'th' },
  { label: '印尼语', value: 'id' },
  { label: '越南语', value: 'vi' },
]

export const COSYVOICE_SYSTEM_VOICES: VoiceOption[] = [
  { label: '龙安洋 - 阳光大男孩 (中/英)', value: 'longanyang', meta: { language: 'zh,en', gender: 'Male', type: 'system' } },
  { label: '龙安莉 - 利落从容女 (中/英)', value: 'longanli_v3', meta: { language: 'zh,en', gender: 'Female', type: 'system' } },
  { label: '龙安朗 - 清爽利落男 (中/英)', value: 'longanlang_v3', meta: { language: 'zh,en', gender: 'Male', type: 'system' } },
  { label: '龙安温 - 优雅知性女 (中/英)', value: 'longanwen_v3', meta: { language: 'zh,en', gender: 'Female', type: 'system' } },
  { label: '龙安昀 - 居家暖男 (中/英)', value: 'longanyun_v3', meta: { language: 'zh,en', gender: 'Male', type: 'system' } },
  { label: '龙安亲 - 亲和活泼女 (中/英)', value: 'longanqin_v3', meta: { language: 'zh,en', gender: 'Female', type: 'system' } },
  { label: '龙安灵 - 思维灵动女 (中/英)', value: 'longanling_v3', meta: { language: 'zh,en', gender: 'Female', type: 'system' } },
  { label: '龙安智 - 睿智轻熟男 (中/英)', value: 'longanzhi_v3', meta: { language: 'zh,en', gender: 'Male', type: 'system' } },
  { label: '龙安燃 - 活泼质感女 (中/英)', value: 'longanran_v3', meta: { language: 'zh,en', gender: 'Female', type: 'system' } },
  { label: '龙安宣 - 经典直播女 (中/英)', value: 'longanxuan_v3', meta: { language: 'zh,en', gender: 'Female', type: 'system' } },
]

interface CosyVoiceProviderConfig {
  apiKey?: string
  model?: string
  voice?: string
  languageHint?: string
  customVoices?: VoiceOption[]
}

interface CosyVoiceSynthesisRequest {
  text: string
  voice: string
  model: string
  rate: number
  pitch: number
  languageHints?: string[]
}

export class CosyVoiceProvider implements VoiceProvider {
  readonly id = 'cosyvoice'
  readonly name = '阿里云 CosyVoice'
  readonly description = '使用阿里云百炼 CosyVoice3，支持中英混合与语言提示'
  readonly isAudioProvider = true

  constructor(private getConfig: ConfigSource) {}

  async initialize(): Promise<void> {}

  getVoices(): VoiceOption[] {
    const cfg = this.readConfig()
    const customVoices = cfg.customVoices ?? []
    if (customVoices.length === 0) return COSYVOICE_SYSTEM_VOICES
    return [
      { type: 'group', label: '自定义音色', value: 'custom', key: 'custom', children: customVoices },
      { type: 'group', label: '系统音色', value: 'system', key: 'system', children: COSYVOICE_SYSTEM_VOICES },
    ]
  }

  async fetchAudio(text: string): Promise<Blob> {
    const cfg = this.readConfig()
    if (cfg.apiKey) {
      return synthesizeCosyVoiceDirect(text, this.createRequestBody(text, cfg), cfg.apiKey)
    }

    const body = {
      provider: 'cosyvoice',
      text,
      ...this.createRequestBody(text, cfg),
      apiKey: undefined,
      streaming: true,
    }

    const response = await fetch(`${TTS_API_URL}synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null)
      throw new Error(error?.details || error?.error || `CosyVoice 请求失败: ${response.status}`)
    }
    return await response.blob()
  }

  speak(): void {}
  stop(): void {}

  private readConfig(): CosyVoiceProviderConfig {
    return (this.getConfig().providers?.cosyvoice ?? {}) as CosyVoiceProviderConfig
  }

  private createRequestBody(text: string, cfg: CosyVoiceProviderConfig): CosyVoiceSynthesisRequest {
    const speechInfo = this.getConfig().speechInfo ?? {}
    return {
      text,
      voice: cfg.voice || DEFAULT_COSYVOICE_VOICE,
      model: cfg.model || DEFAULT_COSYVOICE_MODEL,
      rate: Math.min(2, Math.max(0.5, speechInfo.rate ?? 1)),
      pitch: Math.min(2, Math.max(0.5, speechInfo.pitch ?? 1)),
      languageHints: cfg.languageHint ? [cfg.languageHint] : undefined,
    }
  }
}

export async function listCosyVoiceCustomVoices(apiKey: string): Promise<VoiceOption[]> {
  const response = await fetch(DASH_SCOPE_CUSTOMIZATION_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'voice-enrollment',
      input: {
        action: 'list_voice',
        page_size: 100,
        page_index: 0,
      },
    }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(payload?.message || payload?.code || `拉取自定义音色失败: ${response.status}`)
  }

  const voices = payload?.output?.voice_list
  if (!Array.isArray(voices)) return []
  return voices
    .filter(v => typeof v?.voice_id === 'string' && v.voice_id.length > 0 && (v.status == null || v.status === 'OK'))
    .map(v => ({
      label: `${v.voice_id}${v.target_model ? ` (${v.target_model})` : ''}`,
      value: v.voice_id,
      meta: { type: 'custom', status: v.status, targetModel: v.target_model },
    }))
}

async function synthesizeCosyVoiceDirect(text: string, req: CosyVoiceSynthesisRequest, apiKey: string) {
  const response = await fetch(DASH_SCOPE_TTS_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-SSE': 'enable',
    },
    body: JSON.stringify({
      model: req.model,
      input: {
        text,
        voice: req.voice,
        format: 'mp3',
        sample_rate: 24000,
        rate: req.rate,
        pitch: req.pitch,
        language_hints: req.languageHints,
      },
    }),
  })
  const streamText = await response.text()
  if (!response.ok) {
    throw new Error(readDashScopeError(streamText) || `CosyVoice 请求失败: ${response.status}`)
  }

  const audio = extractSseAudio(streamText)
  if (audio.length === 0) throw new Error('CosyVoice 响应中无音频数据')
  return new Blob(audio, { type: 'audio/mpeg' })
}

function extractSseAudio(streamText: string): ArrayBuffer[] {
  return streamText
    .split('\n')
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trim())
    .filter(Boolean)
    .flatMap((json) => {
      try {
        const data = JSON.parse(json)?.output?.audio?.data
        return data ? [base64ToArrayBuffer(data)] : []
      } catch {
        return []
      }
    })
}

function readDashScopeError(streamText: string) {
  const dataLine = streamText.split('\n').find(line => line.startsWith('data:'))
  if (!dataLine) return ''
  try {
    const payload = JSON.parse(dataLine.slice(5).trim())
    return payload?.message || payload?.code || ''
  } catch {
    return ''
  }
}

function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}
