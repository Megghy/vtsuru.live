import type { UserPagesSettingsV1 } from '../types'

const STORAGE_PREFIX = 'vtsuru:user-page-draft-preview:'
const PREVIEW_TTL_MS = 60_000

interface DraftPreviewPayload {
  expiresAt: number
  userId: number
  settings: UserPagesSettingsV1
}

export function createDraftPreview(userId: number, settings: UserPagesSettingsV1) {
  const token = crypto.randomUUID()
  const payload: DraftPreviewPayload = {
    expiresAt: Date.now() + PREVIEW_TTL_MS,
    userId,
    settings: structuredClone(settings),
  }
  localStorage.setItem(`${STORAGE_PREFIX}${token}`, JSON.stringify(payload))
  return token
}

export function consumeDraftPreview(token: unknown, userId: number) {
  if (typeof token !== 'string' || !/^[0-9a-f-]{36}$/i.test(token)) return null
  const key = `${STORAGE_PREFIX}${token}`
  const raw = localStorage.getItem(key)
  localStorage.removeItem(key)
  if (!raw) return null

  try {
    const payload = JSON.parse(raw) as DraftPreviewPayload
    if (payload.expiresAt < Date.now() || payload.userId !== userId || payload.settings?.version !== 1) return null
    return payload.settings
  } catch {
    return null
  }
}
