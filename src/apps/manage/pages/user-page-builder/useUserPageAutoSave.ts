import type { UserPagesSettingsV1 } from '@/apps/user-page/types'
import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'
import { deepCloneJson } from './editorHelpers'

interface UseUserPageAutoSaveOptions {
  settings: Ref<UserPagesSettingsV1>
  isLoading: Ref<boolean>
  isSaving: Ref<boolean>
  isDirty: Ref<boolean>
  lastSavedAt: Ref<number | null>
  lastSavedSnapshot: Ref<string>
  error: Ref<string | null>
  jsonSanitizedNotified: Ref<boolean>
  validateAll: (settings: UserPagesSettingsV1) => void
  saveDraft: () => Promise<boolean>
  notifyError: (content: string) => void
}

function createLiveValidator(options: UseUserPageAutoSaveOptions, liveErrors: Ref<string[] | null>, tick: Ref<number>) {
  return () => {
    tick.value += 1
    try {
      options.validateAll(options.settings.value)
      liveErrors.value = null
    } catch (error) {
      liveErrors.value = ((error as Error).message || String(error)).split('\n').filter(Boolean)
    }
  }
}

function serializeSettings(options: UseUserPageAutoSaveOptions, sanitizing: Ref<boolean>) {
  try {
    return JSON.stringify(options.settings.value)
  } catch (error) {
    if (sanitizing.value) return null
    sanitizing.value = true
    try {
      options.settings.value = deepCloneJson(options.settings.value)
      const snapshot = JSON.stringify(options.settings.value)
      if (!options.jsonSanitizedNotified.value) {
        options.jsonSanitizedNotified.value = true
        options.notifyError(`配置包含不可序列化的值，已自动清理：${(error as Error).message || String(error)}`)
      }
      return snapshot
    } catch (sanitizeError) {
      options.error.value = (sanitizeError as Error).message || String(sanitizeError)
      return null
    } finally {
      sanitizing.value = false
    }
  }
}

export function useUserPageAutoSave(options: UseUserPageAutoSaveOptions) {
  const autoSaveEnabled = ref(true)
  const isAutoSaving = ref(false)
  const validationTick = ref(0)
  const liveValidationErrors = ref<string[] | null>(null)
  const isSanitizingJson = ref(false)
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
  let validationTimer: ReturnType<typeof setTimeout> | null = null
  const validateLive = createLiveValidator(options, liveValidationErrors, validationTick)

  function scheduleAutoSave() {
    if (!autoSaveEnabled.value || !options.isDirty.value) return
    if (options.isLoading.value || options.isSaving.value || isAutoSaving.value) return
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = setTimeout(async () => {
      autoSaveTimer = null
      if (!autoSaveEnabled.value || !options.isDirty.value) return
      if (options.isLoading.value || options.isSaving.value || isAutoSaving.value) return
      isAutoSaving.value = true
      let saved = false
      try {
        saved = await options.saveDraft()
      } finally {
        isAutoSaving.value = false
        if (saved) scheduleAutoSave()
      }
    }, 1600)
  }

  watch(options.settings, () => {
    const snapshot = serializeSettings(options, isSanitizingJson)
    if (snapshot === null) return
    options.isDirty.value = snapshot !== options.lastSavedSnapshot.value

    if (!(options.isLoading.value || options.isSaving.value || isAutoSaving.value)) {
      if (validationTimer) clearTimeout(validationTimer)
      validationTimer = setTimeout(validateLive, 1600)
    }
    scheduleAutoSave()
  }, { deep: true })

  watch([options.isLoading, options.isSaving], ([loading, saving]) => {
    if (!loading && !saving) scheduleAutoSave()
  })

  const saveStatusText = computed(() => {
    if (options.isSaving.value || isAutoSaving.value) return '保存中...'
    if (options.isDirty.value) return '未保存'
    if (!options.lastSavedAt.value) return '已保存'
    return `已保存 · ${new Date(options.lastSavedAt.value).toLocaleTimeString()}`
  })

  function destroy() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    if (validationTimer) clearTimeout(validationTimer)
    autoSaveTimer = null
    validationTimer = null
  }

  return { autoSaveEnabled, isAutoSaving, validationTick, liveValidationErrors, saveStatusText, destroy }
}
