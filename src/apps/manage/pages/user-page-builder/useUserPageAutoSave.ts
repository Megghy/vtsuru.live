import type { Ref } from 'vue'
import { computed, ref, watch } from 'vue'

import type { UserPagesSettings } from '@/apps/user-page/types'

import { deepCloneJson } from './editorHelpers'
import type { UserPageValidationIssue } from './validateUserPagesSettings'

interface UseUserPageAutoSaveOptions {
  settings: Ref<UserPagesSettings>
  isLoading: Ref<boolean>
  isSaving: Ref<boolean>
  isDirty: Ref<boolean>
  lastSavedAt: Ref<number | null>
  lastSavedSnapshot: Ref<string>
  error: Ref<string | null>
  jsonSanitizedNotified: Ref<boolean>
  validateAll: (settings: UserPagesSettings) => UserPageValidationIssue[]
  saveDraft: () => Promise<boolean>
  notifyError: (content: string) => void
}

function createLiveValidator(options: UseUserPageAutoSaveOptions, liveIssues: Ref<UserPageValidationIssue[]>) {
  return () => {
    liveIssues.value = options.validateAll(options.settings.value)
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
  const liveValidationIssues = ref<UserPageValidationIssue[]>([])
  const isSanitizingJson = ref(false)
  const hasSyncError = ref(false)
  let retryCount = 0
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
  let validationTimer: ReturnType<typeof setTimeout> | null = null
  const validateLive = createLiveValidator(options, liveValidationIssues)

  function scheduleAutoSave(delay = 1600) {
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
      }
      hasSyncError.value = !saved
      if (saved) retryCount = 0
      else if (retryCount < 3) {
        retryCount += 1
        scheduleAutoSave(3000 * retryCount)
      }
    }, delay)
  }

  watch(
    options.settings,
    () => {
      const snapshot = serializeSettings(options, isSanitizingJson)
      if (snapshot === null) return
      options.isDirty.value = snapshot !== options.lastSavedSnapshot.value
      retryCount = 0
      hasSyncError.value = false

      if (!(options.isLoading.value || options.isSaving.value || isAutoSaving.value)) {
        if (validationTimer) clearTimeout(validationTimer)
        validationTimer = setTimeout(validateLive, 1600)
      }
      scheduleAutoSave()
    },
    { deep: true },
  )

  watch([options.isLoading, options.isSaving], ([loading, saving]) => {
    if (!loading && !saving) scheduleAutoSave()
  })

  const saveStatusText = computed(() => {
    if (options.isSaving.value || isAutoSaving.value) return '正在同步...'
    if (options.isDirty.value && hasSyncError.value) return '同步失败'
    if (options.isDirty.value && !autoSaveEnabled.value) return '本机已保存 · 自动同步关闭'
    if (options.isDirty.value) return '本机已保存'
    if (!options.lastSavedAt.value) return '服务端草稿已同步'
    return `已同步 · ${new Date(options.lastSavedAt.value).toLocaleTimeString()}`
  })

  function destroy() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    if (validationTimer) clearTimeout(validationTimer)
    autoSaveTimer = null
    validationTimer = null
  }

  return { autoSaveEnabled, isAutoSaving, hasSyncError, liveValidationIssues, saveStatusText, destroy }
}
