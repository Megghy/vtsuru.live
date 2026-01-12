import { useAccount } from '@/api/account'
import { fetchMyUserPagesState } from '@/features/user-page/api'
import type { BlockPageProject } from '@/features/user-page/block/schema'
import { listContribPageRefs, getContribPageImporter } from '@/features/user-page/contrib/registry'
import type { UserPageConfig, UserPagesSettingsV1 } from '@/features/user-page/types'
import type { ConfigItemDefinition } from '@/shared/types/VTsuruConfigTypes'
import { debounceFilter, useRefHistory } from '@vueuse/core'
import { useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { createId, deepCloneJson, diffByLines, estimateUtf8Bytes, stableStringify } from './editorHelpers'
import { collectFileRefsFromSettings, normalizeRichTextImagesFile } from './editorResources'
import { useUserPageBlocks } from './useUserPageBlocks'
import { useUserPagePages } from './useUserPagePages'
import { useUserPagePersistence } from './useUserPagePersistence'
import { useUserPageUploads } from './useUserPageUploads'
import { useUserPagesLocalDraftStorage } from './useUserPagesLocalDraftStorage'
import { validateUserPagesSettings } from './validateUserPagesSettings'

const MAX_PAGES_COUNT = 16
const MAX_CONFIG_BYTES = 128 * 1024

export function useUserPageEditor() {
  const message = useMessage()
  const account = useAccount()

  const isLoading = ref(true)
  const isSaving = ref(false)
  const error = ref<string | null>(null)

  const rollbackAvailable = ref(false)
  const loadedFrom = ref<'draft' | 'published' | 'default'>('default')
  const autoSaveEnabled = ref(true)
  const isDirty = ref(false)
  const isAutoSaving = ref(false)
  const lastSavedAt = ref<number | null>(null)
  const lastSavedSnapshot = ref<string>('')
  let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
  let isSanitizingJson = false
  let hasNotifiedJsonSanitized = false

  const settings = ref<UserPagesSettingsV1>({
    version: 1,
    home: { mode: 'block', block: createDefaultProject() },
    pages: {},
  })
  const localDraftStorage = useUserPagesLocalDraftStorage()

  const loadedDraft = ref<UserPagesSettingsV1 | null>(null)
  const loadedPublished = ref<UserPagesSettingsV1 | null>(null)
  const loadedRollback = ref<UserPagesSettingsV1 | null>(null)

  const currentKey = ref<string>('home')
  const currentPage = ref<UserPageConfig>({ mode: 'legacy' })

  const selectedBlockIds = ref<string[]>([])

  const diffModal = ref(false)
  const resourcesModal = ref(false)

  function isEmptyDraftPlaceholder(s: UserPagesSettingsV1 | null): boolean {
    if (!s) return false
    if (s.version !== 1) return false
    const pagesCount = Object.keys(s.pages ?? {}).length
    if (pagesCount !== 0) return false
    if (!s.home || s.home.mode !== 'legacy') return false
    const homeKeys = Object.keys(s.home as any)
    return homeKeys.length === 1 && homeKeys[0] === 'mode'
  }

  function isValidPageConfig(cfg: unknown): boolean {
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return false
    const mode = (cfg as any).mode
    if (mode === 'legacy') return true
    if (mode === 'block') return !!(cfg as any).block
    if (mode === 'contrib') return !!(cfg as any).contrib
    return false
  }

  function isMeaningfulSettings(s: UserPagesSettingsV1 | null): s is UserPagesSettingsV1 {
    if (!s) return false
    if (s.version !== 1) return false
    if (isValidPageConfig(s.home)) return true
    return Object.values(s.pages ?? {}).some(cfg => isValidPageConfig(cfg))
  }

  function getPageModeLabel(mode: UserPageConfig['mode']) {
    if (mode === 'legacy') return '传统模式'
    if (mode === 'block') return '区块模式'
    if (mode === 'contrib') return '自定义页'
    return mode
  }

  const loadedFromLabel = computed(() => {
    if (loadedFrom.value === 'draft') return '草稿'
    if (loadedFrom.value === 'published') return '已发布'
    return '默认配置'
  })

  function createDefaultProject(): BlockPageProject {
    return {
      version: 1,
      theme: {
        spacing: 'normal',
        radius: 12,
        primaryColor: '#18a058',
      },
      blocks: [
        { id: createId(), type: 'profile' },
        { id: createId(), type: 'buttons', props: { items: [] } },
        { id: createId(), type: 'footer' },
      ],
    }
  }

  function ensurePageConfig(key: string): UserPageConfig {
    if (key === 'home') {
      settings.value.home ??= { mode: 'block', block: createDefaultProject() }
      if (!isValidPageConfig(settings.value.home)) {
        settings.value.home.mode = 'block'
        settings.value.home.block ??= createDefaultProject()
      }
      return settings.value.home
    }
    settings.value.pages ??= {}
    settings.value.pages[key] ??= { mode: 'block', block: createDefaultProject() }
    if (!isValidPageConfig(settings.value.pages[key])) {
      settings.value.pages[key].mode = 'block'
      settings.value.pages[key].block ??= createDefaultProject()
    }
    return settings.value.pages[key]
  }

  const currentLabel = computed(() => (currentKey.value === 'home' ? '主页' : `/${currentKey.value}`))
  const currentProject = computed(() => (currentPage.value.mode === 'block' ? (currentPage.value.block ?? null) : null))
  const currentTheme = computed(() => currentProject.value?.theme ?? null)
  const currentContrib = computed(() => (currentPage.value.mode === 'contrib' ? (currentPage.value.contrib ?? null) : null))

  const {
    history,
    canUndo,
    canRedo,
    undo,
    redo,
    clear: clearHistory,
    batch: batchHistory,
  } = useRefHistory(settings, {
    deep: true,
    flush: 'sync',
    capacity: 80,
    clone: v => deepCloneJson(v),
    eventFilter: debounceFilter(120),
  })

  const blocks = useUserPageBlocks({
    currentProject,
    selectedBlockIds,
    history: { batch: batchHistory },
    notify: {
      success: message.success,
      warning: message.warning,
    },
  })

  const uploads = useUserPageUploads({
    currentProject,
    settings,
    currentPage,
    ensurePropsObject: blocks.ensurePropsObject,
    notify: {
      success: message.success,
      error: message.error,
    },
  })

  watch(
    () => currentKey.value,
    (key) => {
      currentPage.value = ensurePageConfig(key)
      blocks.clearSelection()
    },
    { immediate: true },
  )

  watch(
    () => currentPage.value.mode,
    (mode) => {
      if (mode === 'block') {
        currentPage.value.block ??= createDefaultProject()
        currentPage.value.block.theme ??= {}
      }
      if (mode === 'contrib') {
        currentPage.value.contrib ??= { scope: 'global', pageId: '' }
        if (currentPage.value.contrib.scope === 'streamer') currentPage.value.contrib.streamerId = account.value.id
      }
    },
    { immediate: true },
  )

  watch(
    () => account.value.id,
    (id) => {
      if (currentPage.value.mode !== 'contrib') return
      if (currentPage.value.contrib?.scope === 'streamer') currentPage.value.contrib.streamerId = id
    },
  )

  watch(
    () => currentPage.value.contrib?.scope,
    (scope) => {
      if (currentPage.value.mode !== 'contrib') return
      if (!currentPage.value.contrib) return
      if (scope === 'streamer') currentPage.value.contrib.streamerId = account.value.id
      else delete currentPage.value.contrib.streamerId
    },
  )

  const pages = useUserPagePages({
    settings,
    currentKey,
    history: { batch: batchHistory },
    clearSelection: blocks.clearSelection,
    createDefaultProject,
    maxPagesCount: MAX_PAGES_COUNT,
  })

  const contribPageIdOptions = computed(() => {
    const c = currentContrib.value
    if (!c) return []
    const pageRefs = listContribPageRefs()
    if (!Array.isArray(pageRefs)) return []
    return pageRefs
      .filter((it) => {
        if (c.scope === 'global') return it.scope === 'global'
        if (c.scope !== 'streamer') return false
        if (it.scope !== 'streamer') return false
        return it.streamerId === c.streamerId
      })
      .map(it => ({ label: it.pageId, value: it.pageId }))
  })

  const contribConfigItems = ref<ConfigItemDefinition[] | null>(null)
  const contribConfigLoading = ref(false)
  const contribConfigError = ref<string | null>(null)
  const contribDefaultConfig = ref<Record<string, any> | null>(null)

  function resetContribConfigToDefault() {
    const c = currentContrib.value
    if (!c) return
    c.config = deepCloneJson(contribDefaultConfig.value ?? {})
    message.success('已重置为默认配置')
  }

  watch(
    () => [currentPage.value.mode, currentContrib.value?.scope, currentContrib.value?.pageId, currentContrib.value?.streamerId] as const,
    async () => {
      contribConfigItems.value = null
      contribDefaultConfig.value = null
      contribConfigError.value = null
      if (currentPage.value.mode !== 'contrib') return
      const c = currentContrib.value
      if (!c?.pageId) return

      contribConfigLoading.value = true
      try {
        const importer = getContribPageImporter(c)
        const mod: any = await importer()
        const config = mod?.Config
        const defaultConfig = mod?.DefaultConfig
        if (Array.isArray(config)) contribConfigItems.value = config as ConfigItemDefinition[]
        if (defaultConfig && typeof defaultConfig === 'object' && !Array.isArray(defaultConfig)) contribDefaultConfig.value = defaultConfig as Record<string, any>
        else contribDefaultConfig.value = {}

        if (contribConfigItems.value) {
          if (!c.config || typeof c.config !== 'object' || Array.isArray(c.config)) c.config = deepCloneJson(contribDefaultConfig.value ?? {})
        }
      } catch (e) {
        contribConfigError.value = (e as Error).message || String(e)
      } finally {
        contribConfigLoading.value = false
      }
    },
    { immediate: true },
  )

  const validateAll = validateUserPagesSettings

  async function loadState() {
    const state = await fetchMyUserPagesState()
    loadedDraft.value = state.draft
    loadedPublished.value = state.published
    loadedRollback.value = state.rollback
    rollbackAvailable.value = !!state.rollback

    const localDraft = localDraftStorage.value

    const isSameAsPublished = (a: UserPagesSettingsV1 | null, b: UserPagesSettingsV1 | null) => {
      if (!a || !b) return false
      try {
        return stableStringify(a) === stableStringify(b)
      } catch {
        return false
      }
    }

    if (isMeaningfulSettings(state.draft) && !(state.published && isEmptyDraftPlaceholder(state.draft))) {
      settings.value = state.draft
      loadedFrom.value = isSameAsPublished(state.draft, state.published) ? 'published' : 'draft'
      localDraftStorage.value = state.draft
    } else if (state.published) {
      settings.value = state.published
      loadedFrom.value = 'published'
      localDraftStorage.value = null
    } else if (isMeaningfulSettings(localDraft) && !(state.published && isEmptyDraftPlaceholder(localDraft))) {
      settings.value = localDraft
      loadedFrom.value = isSameAsPublished(localDraft, state.published) ? 'published' : 'draft'
    } else {
      settings.value = { version: 1, home: { mode: 'block', block: createDefaultProject() }, pages: {} }
      loadedFrom.value = 'default'
      localDraftStorage.value = null
    }

    currentPage.value = ensurePageConfig(currentKey.value)

    try {
      lastSavedSnapshot.value = JSON.stringify(settings.value)
    } catch (e) {
      settings.value = deepCloneJson(settings.value)
      lastSavedSnapshot.value = JSON.stringify(settings.value)
      if (!hasNotifiedJsonSanitized) {
        hasNotifiedJsonSanitized = true
        message.error(`配置包含不可序列化的值，已自动清理：${(e as Error).message || String(e)}`)
      }
    }
    isDirty.value = false
    lastSavedAt.value = Date.now()
  }

  const persistence = useUserPagePersistence({
    settings,
    loadedPublished,
    loadedFrom,
    isSaving,
    isDirty,
    lastSavedAt,
    lastSavedSnapshot,
    maxConfigBytes: MAX_CONFIG_BYTES,
    history: { batch: batchHistory },
    validateAll,
    loadState,
    notify: {
      success: message.success,
      error: message.error,
    },
  })

  const saveStatusText = computed(() => {
    if (isSaving.value || isAutoSaving.value) return '保存中...'
    if (isDirty.value) return '未保存'
    if (!lastSavedAt.value) return '已保存'
    return `已保存（${new Date(lastSavedAt.value).toLocaleTimeString()}）`
  })

  watch(
    () => settings.value,
    () => {
      let snapshot = ''
      try {
        snapshot = JSON.stringify(settings.value)
      } catch (e) {
        if (isSanitizingJson) return
        isSanitizingJson = true
        try {
          settings.value = deepCloneJson(settings.value)
          snapshot = JSON.stringify(settings.value)
        } catch (e2) {
          error.value = (e2 as Error).message || String(e2)
          return
        } finally {
          isSanitizingJson = false
        }
        if (!hasNotifiedJsonSanitized) {
          hasNotifiedJsonSanitized = true
          message.error(`配置包含不可序列化的值，已自动清理：${(e as Error).message || String(e)}`)
        }
      }
      isDirty.value = snapshot !== lastSavedSnapshot.value

      if (!autoSaveEnabled.value) return
      if (!isDirty.value) return
      if (isLoading.value || isSaving.value || isAutoSaving.value) return

      if (autoSaveTimer) clearTimeout(autoSaveTimer)
      autoSaveTimer = setTimeout(async () => {
        autoSaveTimer = null
        if (!autoSaveEnabled.value) return
        if (!isDirty.value) return
        if (isLoading.value || isSaving.value || isAutoSaving.value) return
        isAutoSaving.value = true
        try {
          await persistence.saveDraftInternal(true)
        } finally {
          isAutoSaving.value = false
        }
      }, 1600)
    },
    { deep: true },
  )

  const configBytes = computed(() => {
    try {
      return estimateUtf8Bytes(JSON.stringify(settings.value))
    } catch {
      return MAX_CONFIG_BYTES
    }
  })
  const configBytesPercent = computed(() => Math.min(100, Math.round((configBytes.value / MAX_CONFIG_BYTES) * 100)))

  const diffOps = computed(() => {
    const published = loadedPublished.value
    if (!published) return null
    try {
      const a = stableStringify(published)
      const b = stableStringify(settings.value)
      return diffByLines(a, b)
    } catch (e) {
      return [{ kind: 'del', text: `diff 失败: ${(e as Error).message || String(e)}` }]
    }
  })

  const fileRefs = computed(() => collectFileRefsFromSettings(settings.value))

  function normalizeRichTextImagesFileAndNotify() {
    normalizeRichTextImagesFile(settings.value, blocks.ensurePropsObject)
    message.success('已整理富文本图片引用')
  }

  function openPreview() {
    const name = account.value?.name
    if (!name) return
    const path = currentKey.value === 'home' ? `/@${name}` : `/@${name}/${currentKey.value}`
    window.open(path, '_blank', 'noopener,noreferrer')
  }

  async function init() {
    isLoading.value = true
    error.value = null
    try {
      await loadState()
      clearHistory()
    } catch (e) {
      error.value = (e as Error).message || String(e)
    } finally {
      isLoading.value = false
    }
  }

  function destroy() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }

  return {
    account,
    message,

    MAX_PAGES_COUNT,
    MAX_CONFIG_BYTES,

    isLoading,
    isSaving,
    error,
    rollbackAvailable,

    loadedDraft,
    loadedPublished,
    loadedRollback,
    loadedFromLabel,

    autoSaveEnabled,
    isDirty,
    isAutoSaving,
    saveStatusText,

    settings,

    currentKey,
    currentLabel,
    currentPage,
    currentProject,
    currentTheme,
    getPageModeLabel,

    selectedBlockIds,
    selectedBlocks: blocks.selectedBlocks,
    selectedBlock: blocks.selectedBlock,

    ...blocks,
    ...uploads,
    ...pages,

    currentContrib,
    contribPageIdOptions,
    contribConfigItems,
    contribConfigLoading,
    contribConfigError,
    contribDefaultConfig,
    resetContribConfigToDefault,

    diffModal,
    diffOps,
    resourcesModal,
    fileRefs,
    normalizeRichTextImagesFile: normalizeRichTextImagesFileAndNotify,

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

    history,
    canUndo,
    canRedo,
    undo,
    redo,
    batchHistory,

    openPreview,
    validateAll,

    init,
    destroy,
  }
}

export type UserPageEditor = ReturnType<typeof useUserPageEditor>
