import type { ComputedRef, Ref } from 'vue'
import { computed, ref, watch } from 'vue'

import { getContribPageImporter, listContribPageRefs } from '@/apps/user-page/contrib/registry'
import type { ContribPageRef, UserPageConfig } from '@/apps/user-page/types'
import type { ConfigItemDefinition } from '@/shared/types/VTsuruConfigTypes'

import { deepCloneJson } from './editorHelpers'
import { createDefaultProject } from './editorPageConfig'

interface UseUserPageContribOptions {
  currentPage: Ref<UserPageConfig>
  currentContrib: ComputedRef<ContribPageRef | null>
  accountId: ComputedRef<number>
  notifySuccess: (content: string) => void
}

function createPageIdOptions(currentContrib: ComputedRef<ContribPageRef | null>) {
  return computed(() => {
    const contrib = currentContrib.value
    if (!contrib) return []
    return listContribPageRefs()
      .filter((pageRef) => {
        if (contrib.scope === 'global') return pageRef.scope === 'global'
        return pageRef.scope === 'streamer' && pageRef.streamerId === contrib.streamerId
      })
      .map((pageRef) => ({ label: pageRef.pageId, value: pageRef.pageId }))
  })
}

function syncContribReference(options: UseUserPageContribOptions) {
  watch(
    () => options.currentPage.value.mode,
    (mode) => {
      if (mode === 'block') {
        options.currentPage.value.block ??= createDefaultProject()
        options.currentPage.value.block.theme ??= {}
      }
      if (mode !== 'contrib') return
      options.currentPage.value.contrib ??= { scope: 'global', pageId: '' }
      if (options.currentPage.value.contrib.scope === 'streamer') {
        options.currentPage.value.contrib.streamerId = options.accountId.value
      }
    },
    { immediate: true },
  )

  watch(options.accountId, (id) => {
    if (options.currentPage.value.mode !== 'contrib') return
    if (options.currentPage.value.contrib?.scope === 'streamer') options.currentPage.value.contrib.streamerId = id
  })

  watch(
    () => options.currentContrib.value?.scope,
    (scope) => {
      if (!options.currentContrib.value) return
      if (scope === 'streamer') options.currentContrib.value.streamerId = options.accountId.value
      else delete options.currentContrib.value.streamerId
    },
  )
}

export function useUserPageContrib(options: UseUserPageContribOptions) {
  const contribPageIdOptions = createPageIdOptions(options.currentContrib)
  const contribConfigItems = ref<ConfigItemDefinition[] | null>(null)
  const contribConfigLoading = ref(false)
  const contribConfigError = ref<string | null>(null)
  const contribDefaultConfig = ref<Record<string, any> | null>(null)

  function resetContribConfigToDefault() {
    const contrib = options.currentContrib.value
    if (!contrib) return
    contrib.config = deepCloneJson(contribDefaultConfig.value ?? {})
    options.notifySuccess('已重置为默认配置')
  }

  syncContribReference(options)
  watchContribConfig(options.currentPage, options.currentContrib, {
    items: contribConfigItems,
    loading: contribConfigLoading,
    error: contribConfigError,
    defaults: contribDefaultConfig,
  })

  return {
    currentContrib: options.currentContrib,
    contribPageIdOptions,
    contribConfigItems,
    contribConfigLoading,
    contribConfigError,
    contribDefaultConfig,
    resetContribConfigToDefault,
  }
}

interface ContribConfigState {
  items: Ref<ConfigItemDefinition[] | null>
  loading: Ref<boolean>
  error: Ref<string | null>
  defaults: Ref<Record<string, any> | null>
}

function watchContribConfig(
  currentPage: Ref<UserPageConfig>,
  currentContrib: ComputedRef<ContribPageRef | null>,
  state: ContribConfigState,
) {
  watch(
    () =>
      [
        currentPage.value.mode,
        currentContrib.value?.scope,
        currentContrib.value?.pageId,
        currentContrib.value?.streamerId,
      ] as const,
    async () => {
      state.items.value = null
      state.defaults.value = null
      state.error.value = null
      const contrib = currentContrib.value
      if (currentPage.value.mode !== 'contrib' || !contrib?.pageId) return

      state.loading.value = true
      try {
        const module: any = await getContribPageImporter(contrib)()
        state.items.value = Array.isArray(module?.Config) ? module.Config : null
        state.defaults.value =
          module?.DefaultConfig && typeof module.DefaultConfig === 'object' && !Array.isArray(module.DefaultConfig)
            ? module.DefaultConfig
            : {}
        if (
          state.items.value &&
          (!contrib.config || typeof contrib.config !== 'object' || Array.isArray(contrib.config))
        ) {
          contrib.config = deepCloneJson(state.defaults.value)
        }
      } catch (error) {
        state.error.value = (error as Error).message || String(error)
      } finally {
        state.loading.value = false
      }
    },
    { immediate: true },
  )
}
