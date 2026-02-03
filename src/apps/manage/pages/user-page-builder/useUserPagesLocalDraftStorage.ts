import type { UserPagesSettingsV1 } from '@/apps/user-page/types'
import { normalizeUserPagesSettingsV1InPlace } from '@/apps/user-page/normalize'
import { useStorage } from '@vueuse/core'
import { USER_PAGES_LOCAL_DRAFT_KEY } from './storageKeys'
import { usePersistedStorage } from '@/shared/storage/persist'

export function parseUserPagesLocalDraft(raw: string): UserPagesSettingsV1 | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  if ((parsed as any).version !== 1) return null
  const settings = parsed as UserPagesSettingsV1
  normalizeUserPagesSettingsV1InPlace(settings)
  return settings
}

export function useUserPagesLocalDraftStorage() {
  const options = {
    writeDefaults: false,
    serializer: {
      read: (v: any) => (typeof v === 'string' && v.length ? parseUserPagesLocalDraft(v) : null),
      write: (v: any) => (v ? JSON.stringify(v) : ''),
    },
  } as const

  return typeof window === 'undefined'
    ? useStorage<UserPagesSettingsV1 | null>(USER_PAGES_LOCAL_DRAFT_KEY, null, undefined, options)
    : usePersistedStorage<UserPagesSettingsV1 | null>(USER_PAGES_LOCAL_DRAFT_KEY, null, options)
}
