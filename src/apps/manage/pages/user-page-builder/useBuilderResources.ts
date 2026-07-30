import type { ComputedRef } from 'vue'
import { computed, ref } from 'vue'

import type { APIFileModel } from '@/api/api-models'
import { QueryDeleteAPI, QueryGetPaginationAPI, unwrapOk } from '@/api/query'
import { FILE_API_URL } from '@/shared/config'

import type { FileRefEntry } from './editorResources'

export type ResourceView = 'all' | 'used' | 'unused'

export interface BuilderResource extends APIFileModel {
  locations: string[]
  missing: boolean
}

interface UseBuilderResourcesOptions {
  fileRefs: ComputedRef<FileRefEntry[]>
  notifyError: (content: string) => void
  notifySuccess: (content: string) => void
}

async function fetchAllFiles() {
  const pageSize = 100
  const first = await QueryGetPaginationAPI<APIFileModel[]>(`${FILE_API_URL}list`, { page: 1, pageSize })
  const files = [...unwrapOk(first, '加载资源失败')]
  const pageCount = Math.ceil(first.total / pageSize)
  for (let page = 2; page <= pageCount; page++) {
    const response = await QueryGetPaginationAPI<APIFileModel[]>(`${FILE_API_URL}list`, { page, pageSize })
    files.push(...unwrapOk(response, '加载资源失败'))
  }
  return files
}

export function mergeBuilderResources(filesToMerge: APIFileModel[], references: FileRefEntry[]): BuilderResource[] {
  const refs = new Map(references.map((item) => [item.id, item]))
  const files = filesToMerge.map((file) => ({
    ...file,
    locations: refs.get(file.id)?.locations ?? [],
    missing: false,
  }))
  const fileIds = new Set(files.map((file) => file.id))
  const missing = references
    .filter((file) => !fileIds.has(file.id))
    .map((file) => ({
      id: file.id,
      path: file.path ?? '',
      name: file.name ?? `资源 #${file.id}`,
      hash: '',
      size: undefined,
      locations: file.locations,
      missing: true,
    }))
  return [...files, ...missing].toSorted((a, b) => b.id - a.id)
}

export function useBuilderResources(options: UseBuilderResourcesOptions) {
  const allFiles = ref<APIFileModel[]>([])
  const currentView = ref<ResourceView>('all')
  const isLoading = ref(false)
  const deletingId = ref<number | null>(null)
  const loadError = ref('')

  const resources = computed(() => mergeBuilderResources(allFiles.value, options.fileRefs.value))

  const visibleResources = computed(() =>
    resources.value.filter((resource) => {
      if (currentView.value === 'used') return resource.locations.length > 0
      if (currentView.value === 'unused') return resource.locations.length === 0
      return true
    }),
  )
  const usedCount = computed(() => resources.value.filter((resource) => resource.locations.length > 0).length)
  const unusedCount = computed(() => resources.value.filter((resource) => resource.locations.length === 0).length)
  const missingCount = computed(() => resources.value.filter((resource) => resource.missing).length)

  async function loadResources() {
    isLoading.value = true
    loadError.value = ''
    try {
      allFiles.value = await fetchAllFiles()
    } catch (error) {
      loadError.value = (error as Error).message || String(error)
      options.notifyError(loadError.value)
    } finally {
      isLoading.value = false
    }
  }

  function addResources(files: APIFileModel[]) {
    const next = new Map(allFiles.value.map((file) => [file.id, file]))
    files.forEach((file) => next.set(file.id, file))
    allFiles.value = [...next.values()]
  }

  async function deleteResource(resource: BuilderResource) {
    deletingId.value = resource.id
    try {
      const response = await QueryDeleteAPI<unknown>(`${FILE_API_URL}delete/${resource.id}`)
      unwrapOk(response, '删除资源失败')
      allFiles.value = allFiles.value.filter((file) => file.id !== resource.id)
      options.notifySuccess('资源已删除')
    } catch (error) {
      options.notifyError((error as Error).message || String(error))
      throw error
    } finally {
      deletingId.value = null
    }
  }

  return {
    currentView,
    isLoading,
    deletingId,
    loadError,
    resources,
    visibleResources,
    usedCount,
    unusedCount,
    missingCount,
    loadResources,
    addResources,
    deleteResource,
  }
}
