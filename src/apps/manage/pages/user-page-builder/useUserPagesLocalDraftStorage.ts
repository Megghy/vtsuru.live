import type { UserPagesSettingsV1 } from '@/apps/user-page/types'
import { migrateUserPagesSettings } from '@/apps/user-page/normalize'
import { useStorage } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'
import { USER_PAGES_LOCAL_DRAFT_KEY } from './storageKeys'
import { persistedGetItemRaw, usePersistedStorage } from '@/shared/storage/persist'

export function getUserPagesLocalDraftKey(accountId: number) {
  return `${USER_PAGES_LOCAL_DRAFT_KEY}:${accountId}`
}

export function parseUserPagesLocalDraft(raw: string): UserPagesSettingsV1 | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  try {
    return migrateUserPagesSettings(parsed)
  } catch {
    return null
  }
}

export function useUserPagesLocalDraftStorage(accountId: MaybeRefOrGetter<number>) {
  const storageKey = computed(() => getUserPagesLocalDraftKey(toValue(accountId)))
  const options = {
    writeDefaults: false,
    serializer: {
      read: (v: any) => (typeof v === 'string' && v.length ? parseUserPagesLocalDraft(v) : null),
      write: (v: any) => (v ? JSON.stringify(v) : ''),
    },
  } as const

  return typeof window === 'undefined'
    ? useStorage<UserPagesSettingsV1 | null>(storageKey, null, undefined, options)
    : usePersistedStorage<UserPagesSettingsV1 | null>(storageKey, null, options)
}

export async function readUserPagesLocalDraft(accountId: number) {
  const raw = await persistedGetItemRaw(getUserPagesLocalDraftKey(accountId))
  return raw ? parseUserPagesLocalDraft(raw) : null
}
