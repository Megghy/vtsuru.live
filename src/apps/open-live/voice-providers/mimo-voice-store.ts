import { createStore, get, set, del, keys } from 'idb-keyval'

const STORE = createStore('vtsuru-mimo-voices', 'audio-blobs')

export interface StoredVoiceAudio {
  blob: Blob
  mimeType: string
  name: string
}

export async function saveVoiceAudio(voiceId: number | string, audio: StoredVoiceAudio) {
  await set(String(voiceId), audio, STORE)
}

export async function getVoiceAudio(voiceId: number | string): Promise<StoredVoiceAudio | undefined> {
  return get(String(voiceId), STORE)
}

export async function deleteVoiceAudio(voiceId: number | string) {
  await del(String(voiceId), STORE)
}

export async function ensureVoiceAudio(voiceId: number | string, audioUrl: string, name: string): Promise<StoredVoiceAudio> {
  const cached = await getVoiceAudio(voiceId)
  if (cached) return cached

  const resp = await fetch(audioUrl)
  if (!resp.ok) throw new Error(`下载音频失败: ${resp.status}`)

  const blob = await resp.blob()
  const mimeType = blob.type || (audioUrl.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg')
  const audio: StoredVoiceAudio = { blob, mimeType, name }
  await saveVoiceAudio(voiceId, audio)
  return audio
}
