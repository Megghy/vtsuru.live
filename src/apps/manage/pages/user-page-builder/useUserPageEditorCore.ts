import { debounceFilter, useRefHistory } from '@vueuse/core'
import type { ComputedRef } from 'vue'
import { computed, ref, watch } from 'vue'

import type { BlockPageProject } from '@/apps/user-page/block/schema'
import type { ContribPageRef, UserPageConfig, UserPagesSettings } from '@/apps/user-page/types'

import { deepCloneJson } from './editorHelpers'
import { createDefaultProject, ensurePageConfig, getPageModeLabel } from './editorPageConfig'
import { useUserPageBlocks } from './useUserPageBlocks'
import { useUserPagePages } from './useUserPagePages'
import { useUserPageUploads } from './useUserPageUploads'

interface UseUserPageEditorCoreOptions {
  maxPagesCount: number
  notify: {
    success: (content: string) => void
    warning: (content: string) => void
    error: (content: string) => void
  }
}

function createCoreState() {
  const settings = ref<UserPagesSettings>({
    version: 2,
    home: { mode: 'block', block: createDefaultProject() },
    pages: {},
  })
  const currentKey = ref('home')
  const currentPage = computed<UserPageConfig>({
    get: () => ensurePageConfig(settings.value, currentKey.value),
    set: (page) => {
      if (currentKey.value === 'home') {
        settings.value.home = page
        return
      }
      settings.value.pages ??= {}
      settings.value.pages[currentKey.value] = page
    },
  })
  return {
    settings,
    isLoading: ref(true),
    loadStatus: ref<'loading' | 'ready' | 'error'>('loading'),
    isSaving: ref(false),
    error: ref<string | null>(null),
    rollbackAvailable: ref(false),
    loadedDraft: ref<UserPagesSettings | null>(null),
    loadedPublished: ref<UserPagesSettings | null>(null),
    loadedRollback: ref<UserPagesSettings | null>(null),
    loadedFrom: ref<'draft' | 'published' | 'default'>('default'),
    isDirty: ref(false),
    lastSavedAt: ref<number | null>(null),
    lastSavedSnapshot: ref(''),
    currentKey,
    currentPage,
    selectedBlockIds: ref<string[]>([]),
    hoveredBlockId: ref<string | null>(null),
    resourcesModal: ref(false),
    pageThemeModal: ref(false),
  }
}

function watchCurrentPageSelection(state: ReturnType<typeof createCoreState>, clearSelection: () => void) {
  watch(
    [state.settings, state.currentKey],
    ([settings, key]) => {
      if (key !== 'home' && !settings.pages?.[key]) {
        state.currentKey.value = 'home'
        return
      }
      clearSelection()
      state.hoveredBlockId.value = null
    },
    { immediate: true, flush: 'sync' },
  )
}

function createEditorHistory(settings: ReturnType<typeof ref<UserPagesSettings>>) {
  return useRefHistory(settings, {
    deep: true,
    flush: 'sync',
    capacity: 80,
    clone: (value) => deepCloneJson(value),
    eventFilter: debounceFilter(120),
  })
}

export function useUserPageEditorCore(options: UseUserPageEditorCoreOptions) {
  const state = createCoreState()
  const currentLabel = computed(() => (state.currentKey.value === 'home' ? '主页' : `/${state.currentKey.value}`))
  const currentProject = computed(() =>
    state.currentPage.value.mode === 'block' ? (state.currentPage.value.block ?? null) : null,
  )
  const currentTheme = computed(() => currentProject.value?.theme ?? null)
  const currentContrib = computed(() =>
    state.currentPage.value.mode === 'contrib' ? (state.currentPage.value.contrib ?? null) : null,
  )
  const loadedFromLabel = computed(() => {
    if (state.loadedFrom.value === 'draft') return '草稿'
    if (state.loadedFrom.value === 'published') return '已发布'
    return '默认配置'
  })

  const history = createEditorHistory(state.settings)
  const blocks = useUserPageBlocks({
    currentProject,
    selectedBlockIds: state.selectedBlockIds,
    history: { batch: history.batch },
    notify: { success: options.notify.success, warning: options.notify.warning },
  })
  const uploads = useUserPageUploads({
    currentProject,
    settings: state.settings,
    currentPage: state.currentPage,
    ensurePropsObject: blocks.ensurePropsObject,
    notify: { success: options.notify.success, error: options.notify.error },
  })
  watchCurrentPageSelection(state, blocks.clearSelection)
  const pages = useUserPagePages({
    settings: state.settings,
    currentKey: state.currentKey,
    history: { batch: history.batch },
    clearSelection: blocks.clearSelection,
    createDefaultProject,
    maxPagesCount: options.maxPagesCount,
  })

  return createCoreResult(state, {
    currentLabel,
    currentProject,
    currentTheme,
    currentContrib,
    loadedFromLabel,
    history,
    blocks,
    uploads,
    pages,
  })
}

function createCoreResult(
  state: ReturnType<typeof createCoreState>,
  features: {
    currentLabel: ComputedRef<string>
    currentProject: ComputedRef<BlockPageProject | null>
    currentTheme: ComputedRef<BlockPageProject['theme'] | null>
    currentContrib: ComputedRef<ContribPageRef | null>
    loadedFromLabel: ComputedRef<string>
    history: ReturnType<typeof createEditorHistory>
    blocks: ReturnType<typeof useUserPageBlocks>
    uploads: ReturnType<typeof useUserPageUploads>
    pages: ReturnType<typeof useUserPagePages>
  },
) {
  const api = {
    isLoading: state.isLoading,
    loadStatus: state.loadStatus,
    isSaving: state.isSaving,
    error: state.error,
    rollbackAvailable: state.rollbackAvailable,
    settings: state.settings,
    currentKey: state.currentKey,
    currentLabel: features.currentLabel,
    currentPage: state.currentPage,
    currentProject: features.currentProject,
    currentTheme: features.currentTheme,
    getPageModeLabel,
    selectedBlockIds: state.selectedBlockIds,
    hoveredBlockId: state.hoveredBlockId,
    selectedBlocks: features.blocks.selectedBlocks,
    selectedBlock: features.blocks.selectedBlock,
    ...features.blocks,
    ...features.uploads,
    ...features.pages,
    resourcesModal: state.resourcesModal,
    pageThemeModal: state.pageThemeModal,
    history: features.history.history,
    canUndo: features.history.canUndo,
    canRedo: features.history.canRedo,
    undo: features.history.undo,
    redo: features.history.redo,
    batchHistory: features.history.batch,
  }
  return { ...state, ...features, api, clearHistory: features.history.clear, batchHistory: features.history.batch }
}

export type UserPageEditorCore = ReturnType<typeof useUserPageEditorCore>
