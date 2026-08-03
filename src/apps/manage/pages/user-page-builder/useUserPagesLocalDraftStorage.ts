import { useStorage } from '@vueuse/core'
import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'

import { migrateUserPagesSettings } from '@/apps/user-page/normalize'
import type { UserPagesSettings } from '@/apps/user-page/types'
import { persistedGetItemRaw, usePersistedStorage } from '@/shared/storage/persist'

import { USER_PAGES_LOCAL_DRAFT_KEY } from './storageKeys'

export interface UserPagesLocalDraftSnapshot {
  settings: UserPagesSettings
  baseSnapshot: string | null
}

const LEGACY_USER_PAGES_LOCAL_DRAFT_KEY = 'vtsuru:user-pages:local-draft:v1'

export function getUserPagesLocalDraftKey(accountId: number) {
  return `${USER_PAGES_LOCAL_DRAFT_KEY}:${accountId}`
}

function getLegacyUserPagesLocalDraftKey(accountId: number) {
  return `${LEGACY_USER_PAGES_LOCAL_DRAFT_KEY}:${accountId}`
}

export function parseUserPagesLocalDraft(raw: string): UserPagesLocalDraftSnapshot | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  try {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const snapshot = parsed as Record<string, unknown>
    let baseSnapshot: string | null
    if (typeof snapshot.baseSnapshot === 'string') baseSnapshot = snapshot.baseSnapshot
    else if (snapshot.baseSnapshot === null) baseSnapshot = null
    else return null
    return {
      settings: migrateUserPagesSettings(snapshot.settings),
      baseSnapshot,
    }
  } catch {
    return null
  }
}

function parseLegacyUserPagesLocalDraft(raw: string): UserPagesLocalDraftSnapshot | null {
  try {
    return {
      settings: migrateUserPagesSettings(JSON.parse(raw)),
      baseSnapshot: null,
    }
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
    ? useStorage<UserPagesLocalDraftSnapshot | null>(storageKey, null, undefined, options)
    : usePersistedStorage<UserPagesLocalDraftSnapshot | null>(storageKey, null, options)
}

export async function readUserPagesLocalDraft(accountId: number) {
  const raw = await persistedGetItemRaw(getUserPagesLocalDraftKey(accountId))
  if (raw) return parseUserPagesLocalDraft(raw)

  const legacyRaw = await persistedGetItemRaw(getLegacyUserPagesLocalDraftKey(accountId))
  return legacyRaw ? parseLegacyUserPagesLocalDraft(legacyRaw) : null
}
