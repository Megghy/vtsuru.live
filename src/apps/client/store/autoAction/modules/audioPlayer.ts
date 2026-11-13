import { isTauri } from '@/shared/config'

import type { AutoActionItem } from '../types'

const REMOTE_OR_VIRTUAL_SCHEME = /^(?:https?:|blob:|data:|asset:|tauri:)/i

export async function resolveAudioPlayUrl(source: string): Promise<string> {
  const trimmed = source.trim()
  if (!trimmed) throw new Error('未配置音效文件或 URL')
  if (REMOTE_OR_VIRTUAL_SCHEME.test(trimmed)) return trimmed
  if (isTauri()) {
    const { convertFileSrc } = await import('@tauri-apps/api/core')
    return convertFileSrc(trimmed)
  }
  return trimmed
}

export async function executePlayAudio(action: AutoActionItem): Promise<string> {
  const source = action.actionConfig.audioSource?.trim()
  if (!source) {
    throw new Error(`PLAY_AUDIO 缺少音效地址: ${action.name || action.id}`)
  }

  const resolvedUrl = await resolveAudioPlayUrl(source)
  const rawVolume = action.actionConfig.audioVolume ?? 0.8
  const volume = Number.isFinite(rawVolume) ? Math.min(1, Math.max(0, rawVolume)) : 0.8
  const waitForEnd = action.actionConfig.audioWaitForEnd ?? false

  const audio = new Audio(resolvedUrl)
  audio.volume = volume

  const ended = new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve()
    audio.onerror = () => reject(new Error(`音效加载或播放失败: ${source}`))
  })

  await audio.play()
  if (waitForEnd) await ended
  return source
}
