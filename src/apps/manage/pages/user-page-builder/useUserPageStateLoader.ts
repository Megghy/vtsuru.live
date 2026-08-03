import type { Ref } from 'vue'

import { fetchMyUserPagesState } from '@/apps/user-page/api'
import type { UserPagesSettings } from '@/apps/user-page/types'

import { deepCloneJson, stableStringify } from './editorHelpers'
import { createDefaultProject, isEmptyDraftPlaceholder, isMeaningfulSettings } from './editorPageConfig'
import type { UserPagesLocalDraftSnapshot } from './useUserPagesLocalDraftStorage'

interface UseUserPageStateLoaderOptions {
  settings: Ref<UserPagesSettings>
  loadedDraft: Ref<UserPagesSettings | null>
  loadedPublished: Ref<UserPagesSettings | null>
  loadedRollback: Ref<UserPagesSettings | null>
  loadedFrom: Ref<'draft' | 'published' | 'default'>
  rollbackAvailable: Ref<boolean>
  isDirty: Ref<boolean>
  lastSavedAt: Ref<number | null>
  lastSavedSnapshot: Ref<string>
  jsonSanitizedNotified: Ref<boolean>
  localDraftStorage: Ref<UserPagesLocalDraftSnapshot | null>
  localDraftConflict: Ref<UserPagesLocalDraftSnapshot | null>
  localDraftBaseSnapshot: Ref<string>
  readLocalDraft: () => Promise<UserPagesLocalDraftSnapshot | null>
  notifyError: (content: string) => void
}

function isSameSettings(first: UserPagesSettings | null, second: UserPagesSettings | null) {
  if (!first || !second) return false
  try {
    return stableStringify(first) === stableStringify(second)
  } catch {
    return false
  }
}

function isSnapshotOfSettings(snapshot: string | null, settings: UserPagesSettings) {
  if (snapshot === null) return false
  try {
    return stableStringify(JSON.parse(snapshot)) === stableStringify(settings)
  } catch {
    return false
  }
}

export function selectInitialSettings(
  state: Awaited<ReturnType<typeof fetchMyUserPagesState>>,
  localDraft: UserPagesLocalDraftSnapshot | null,
) {
  const serverSettings =
    isMeaningfulSettings(state.draft) && !(state.published && isEmptyDraftPlaceholder(state.draft))
      ? state.draft
      : state.published
  const localSettings = localDraft?.settings ?? null
  const serverBaseSnapshot = serverSettings ? JSON.stringify(serverSettings) : ''
  const canRecoverLocal = serverSettings
    ? !!localDraft && isSnapshotOfSettings(localDraft.baseSnapshot, serverSettings)
    : localDraft?.baseSnapshot === ''
  if (isMeaningfulSettings(localSettings) && canRecoverLocal && !isSameSettings(localSettings, serverSettings)) {
    return {
      settings: localSettings,
      source: 'draft',
      savedSettings: serverSettings,
      serverBaseSnapshot,
      dirty: true,
      conflict: null,
    } as const
  }
  if (serverSettings) {
    return {
      settings: serverSettings,
      source: isSameSettings(serverSettings, state.published) ? 'published' : 'draft',
      savedSettings: serverSettings,
      serverBaseSnapshot,
      dirty: false,
      conflict:
        isMeaningfulSettings(localSettings) && !isSameSettings(localSettings, serverSettings) ? localDraft : null,
    } as const
  }
  const settings = {
    version: 2,
    home: { mode: 'block', block: createDefaultProject() },
    pages: {},
  } as UserPagesSettings
  return {
    settings,
    source: 'default',
    savedSettings: null,
    serverBaseSnapshot,
    dirty: false,
    conflict: isMeaningfulSettings(localSettings) ? localDraft : null,
  } as const
}

function createSavedSnapshot(options: UseUserPageStateLoaderOptions) {
  try {
    return JSON.stringify(options.settings.value)
  } catch (error) {
    options.settings.value = deepCloneJson(options.settings.value)
    if (!options.jsonSanitizedNotified.value) {
      options.jsonSanitizedNotified.value = true
      options.notifyError(`配置包含不可序列化的值，已自动清理：${(error as Error).message || String(error)}`)
    }
    return JSON.stringify(options.settings.value)
  }
}

export function useUserPageStateLoader(options: UseUserPageStateLoaderOptions) {
  async function loadState() {
    const [state, localDraft] = await Promise.all([fetchMyUserPagesState(), options.readLocalDraft()])
    options.loadedDraft.value = state.draft
    options.loadedPublished.value = state.published
    options.loadedRollback.value = state.rollback
    options.rollbackAvailable.value = !!state.rollback

    const selected = selectInitialSettings(state, localDraft)
    options.localDraftConflict.value = selected.conflict
    options.localDraftBaseSnapshot.value = selected.serverBaseSnapshot
    options.settings.value = selected.settings
    options.loadedFrom.value = selected.source

    options.lastSavedSnapshot.value = selected.savedSettings
      ? JSON.stringify(selected.savedSettings)
      : createSavedSnapshot(options)
    if (!selected.conflict) {
      options.localDraftStorage.value = {
        settings: deepCloneJson(selected.settings),
        baseSnapshot: selected.serverBaseSnapshot,
      }
    }
    options.isDirty.value = selected.dirty
    options.lastSavedAt.value = Date.now()
  }

  return { loadState }
}
