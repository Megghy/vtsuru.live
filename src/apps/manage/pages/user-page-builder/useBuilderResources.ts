import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { computed, ref, toValue } from 'vue'

import { deleteApiFilesDeleteId, getApiFilesList } from '@/api/generated/file/file'
import type { APIFileModel, FileKind } from '@/api/generated/model'
import { unwrapOk } from '@/api/query'

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
  kind?: FileKind
  stores?: MaybeRefOrGetter<readonly string[] | undefined>
}

async function fetchStoreFiles(kind?: FileKind, store?: string) {
  const pageSize = 100
  const first = await getApiFilesList({ page: 1, pageSize, kind, store })
  const files = [...(unwrapOk(first, '加载资源失败') ?? [])]
  const pageCount = Math.ceil(first.total / pageSize)
  for (let page = 2; page <= pageCount; page++) {
    const response = await getApiFilesList({ page, pageSize, kind, store })
    files.push(...(unwrapOk(response, '加载资源失败') ?? []))
  }
  return files
}

async function fetchAllFiles(kind?: FileKind, stores?: readonly string[]) {
  if (stores && stores.length === 0) return []
  if (!stores) return fetchStoreFiles(kind)
  const groups = await Promise.all(stores.map((store) => fetchStoreFiles(kind, store)))
  return [...new Map(groups.flat().map((file) => [file.id, file])).values()]
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
      store: '',
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
  let loadGeneration = 0

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
    const generation = ++loadGeneration
    const knownIds = new Set(allFiles.value.map((file) => file.id))
    isLoading.value = true
    loadError.value = ''
    try {
      const fetched = await fetchAllFiles(options.kind, toValue(options.stores))
      if (generation !== loadGeneration) return
      const fetchedIds = new Set(fetched.map((file) => file.id))
      const addedDuringLoad = allFiles.value.filter((file) => !knownIds.has(file.id) && !fetchedIds.has(file.id))
      allFiles.value = addedDuringLoad.length ? [...fetched, ...addedDuringLoad] : fetched
    } catch (error) {
      if (generation !== loadGeneration) return
      loadError.value = (error as Error).message || String(error)
      options.notifyError(loadError.value)
    } finally {
      if (generation === loadGeneration) isLoading.value = false
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
      const response = (await deleteApiFilesDeleteId(resource.id)) as any
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
