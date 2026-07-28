import { fetchMyUserPagesState } from '@/apps/user-page/api'
import type { UserPagesSettingsV1 } from '@/apps/user-page/types'
import type { Ref } from 'vue'
import { deepCloneJson, stableStringify } from './editorHelpers'
import { createDefaultProject, isEmptyDraftPlaceholder, isMeaningfulSettings } from './editorPageConfig'

interface UseUserPageStateLoaderOptions {
  settings: Ref<UserPagesSettingsV1>
  loadedDraft: Ref<UserPagesSettingsV1 | null>
  loadedPublished: Ref<UserPagesSettingsV1 | null>
  loadedRollback: Ref<UserPagesSettingsV1 | null>
  loadedFrom: Ref<'draft' | 'published' | 'default'>
  rollbackAvailable: Ref<boolean>
  isDirty: Ref<boolean>
  lastSavedAt: Ref<number | null>
  lastSavedSnapshot: Ref<string>
  jsonSanitizedNotified: Ref<boolean>
  localDraftStorage: Ref<UserPagesSettingsV1 | null>
  readLocalDraft: () => Promise<UserPagesSettingsV1 | null>
  notifyError: (content: string) => void
}

function isSameSettings(first: UserPagesSettingsV1 | null, second: UserPagesSettingsV1 | null) {
  if (!first || !second) return false
  try {
    return stableStringify(first) === stableStringify(second)
  } catch {
    return false
  }
}

export function selectInitialSettings(
  state: Awaited<ReturnType<typeof fetchMyUserPagesState>>,
  localDraft: UserPagesSettingsV1 | null,
) {
  const serverSettings = isMeaningfulSettings(state.draft) && !(state.published && isEmptyDraftPlaceholder(state.draft))
    ? state.draft
    : state.published
  if (isMeaningfulSettings(localDraft) && !isSameSettings(localDraft, serverSettings)) {
    return {
      settings: localDraft,
      source: 'draft',
      savedSettings: serverSettings,
      dirty: true,
    } as const
  }
  if (serverSettings) {
    return {
      settings: serverSettings,
      source: isSameSettings(serverSettings, state.published) ? 'published' : 'draft',
      savedSettings: serverSettings,
      dirty: false,
    } as const
  }
  return {
    settings: { version: 1, home: { mode: 'block', block: createDefaultProject() }, pages: {} } as UserPagesSettingsV1,
    source: 'default',
    savedSettings: null,
    dirty: false,
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
    options.settings.value = selected.settings
    options.loadedFrom.value = selected.source
    options.localDraftStorage.value = deepCloneJson(selected.settings)

    options.lastSavedSnapshot.value = selected.savedSettings
      ? JSON.stringify(selected.savedSettings)
      : createSavedSnapshot(options)
    options.isDirty.value = selected.dirty
    options.lastSavedAt.value = Date.now()
  }

  return { loadState }
}
