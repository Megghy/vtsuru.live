import { collectFileRefsFromSettings, normalizeRichTextImagesFile } from './editorResources'
import { deepCloneJson, estimateUtf8Bytes } from './editorHelpers'
import { validateUserPagesSettings } from './validateUserPagesSettings'
import { useUserPageAutoSave } from './useUserPageAutoSave'
import type { UserPageEditorCore } from './useUserPageEditorCore'
import { useUserPagePersistence } from './useUserPagePersistence'
import { useUserPageStateLoader } from './useUserPageStateLoader'
import { readUserPagesLocalDraft, useUserPagesLocalDraftStorage } from './useUserPagesLocalDraftStorage'
import type { MessageApiInjection } from 'naive-ui/es/message/src/MessageProvider'
import type { ComputedRef } from 'vue'
import { computed, ref, watch } from 'vue'

interface UseUserPageEditorLifecycleOptions {
  core: UserPageEditorCore
  message: MessageApiInjection
  accountId: ComputedRef<number>
  maxConfigBytes: number
}

function createResourceApi(core: UserPageEditorCore, message: MessageApiInjection) {
  const fileRefs = computed(() => collectFileRefsFromSettings(core.settings.value))
  function normalizeRichTextImagesFileAndNotify() {
    normalizeRichTextImagesFile(core.settings.value, core.blocks.ensurePropsObject)
    message.success('已整理富文本图片引用')
  }
  return { fileRefs, normalizeRichTextImagesFile: normalizeRichTextImagesFileAndNotify }
}

function createInitializer(core: UserPageEditorCore, loadState: () => Promise<void>) {
  return async () => {
    core.isLoading.value = true
    core.error.value = null
    try {
      await loadState()
      core.clearHistory()
    } catch (error) {
      core.error.value = (error as Error).message || String(error)
    } finally {
      core.isLoading.value = false
    }
  }
}

export function useUserPageEditorLifecycle(options: UseUserPageEditorLifecycleOptions) {
  const { core, message, maxConfigBytes } = options
  const jsonSanitizedNotified = ref(false)
  const localDraftStorage = useUserPagesLocalDraftStorage(options.accountId)
  watch(core.settings, settings => {
    localDraftStorage.value = deepCloneJson(settings)
  }, { deep: true })
  const loader = useUserPageStateLoader({
    settings: core.settings,
    currentKey: core.currentKey,
    currentPage: core.currentPage,
    loadedDraft: core.loadedDraft,
    loadedPublished: core.loadedPublished,
    loadedRollback: core.loadedRollback,
    loadedFrom: core.loadedFrom,
    rollbackAvailable: core.rollbackAvailable,
    isDirty: core.isDirty,
    lastSavedAt: core.lastSavedAt,
    lastSavedSnapshot: core.lastSavedSnapshot,
    jsonSanitizedNotified,
    localDraftStorage,
    readLocalDraft: async () => readUserPagesLocalDraft(options.accountId.value),
    notifyError: message.error,
  })
  const persistence = useUserPagePersistence({
    settings: core.settings,
    loadedPublished: core.loadedPublished,
    loadedFrom: core.loadedFrom,
    isSaving: core.isSaving,
    isDirty: core.isDirty,
    lastSavedAt: core.lastSavedAt,
    lastSavedSnapshot: core.lastSavedSnapshot,
    localDraftStorage,
    maxConfigBytes,
    history: { batch: core.batchHistory },
    validateAll: validateUserPagesSettings,
    loadState: loader.loadState,
    notify: { success: message.success, error: message.error },
  })
  const autoSave = useUserPageAutoSave({
    settings: core.settings,
    isLoading: core.isLoading,
    isSaving: core.isSaving,
    isDirty: core.isDirty,
    lastSavedAt: core.lastSavedAt,
    lastSavedSnapshot: core.lastSavedSnapshot,
    error: core.error,
    jsonSanitizedNotified,
    validateAll: validateUserPagesSettings,
    saveDraft: async () => persistence.saveDraftInternal(true),
    notifyError: message.error,
  })
  const resources = createResourceApi(core, message)
  const configBytes = computed(() => {
    try {
      return estimateUtf8Bytes(JSON.stringify(core.settings.value))
    } catch {
      return maxConfigBytes
    }
  })
  const configBytesPercent = computed(() => Math.min(100, Math.round((configBytes.value / maxConfigBytes) * 100)))

  return createLifecycleResult(core, persistence, autoSave, resources, configBytes, configBytesPercent, createInitializer(core, loader.loadState))
}

function createLifecycleResult(
  core: UserPageEditorCore,
  persistence: ReturnType<typeof useUserPagePersistence>,
  autoSave: ReturnType<typeof useUserPageAutoSave>,
  resources: ReturnType<typeof createResourceApi>,
  configBytes: ComputedRef<number>,
  configBytesPercent: ComputedRef<number>,
  init: () => Promise<void>,
) {
  return {
    loadedDraft: core.loadedDraft,
    loadedPublished: core.loadedPublished,
    loadedRollback: core.loadedRollback,
    loadedFromLabel: core.loadedFromLabel,
    autoSaveEnabled: autoSave.autoSaveEnabled,
    isDirty: core.isDirty,
    isAutoSaving: autoSave.isAutoSaving,
    saveStatusText: autoSave.saveStatusText,
    validationTick: autoSave.validationTick,
    liveValidationErrors: autoSave.liveValidationErrors,
    ...resources,
    publishModal: persistence.publishModal,
    publishCheckErrors: persistence.publishCheckErrors,
    publishCheckWarnings: persistence.publishCheckWarnings,
    publishCheckBytes: persistence.publishCheckBytes,
    openPublishModal: persistence.openPublishModal,
    confirmPublish: persistence.confirmPublish,
    saveDraft: persistence.saveDraft,
    clearDraft: persistence.clearDraft,
    rollback: persistence.rollback,
    configBytes,
    configBytesPercent,
    validateAll: validateUserPagesSettings,
    init,
    destroy: autoSave.destroy,
  }
}
