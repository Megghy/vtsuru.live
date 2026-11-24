import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import {
  getObsSceneProject,
  listObsSceneProjects,
  type ObsSceneProjectDetail,
  type ObsSceneProjectSummary,
  switchObsActiveScene,
} from '@/api/obs-scene'
import { documentRequiresAuthToken, normalizeSceneDocument, type ObsSceneDocument } from '@/apps/obs-scene/types'
import { buildSyncLayoutParamsForScene } from '@/apps/obs-scene/utils/sceneSlices'

import { useOBSStore } from './useOBSStore'

export interface CachedObsSceneProject {
  detail: ObsSceneProjectDetail
  doc: ObsSceneDocument
}

export interface ObsSceneSubSceneOption {
  id: string
  name: string
  obsSceneBinding?: string
}

export const useObsSceneControl = defineStore('obsSceneControl', () => {
  const projects = ref<ObsSceneProjectSummary[]>([])
  const projectCache = ref<Record<number, CachedObsSceneProject>>({})
  const selectedProjectId = ref<number | null>(null)
  const loadingProjects = ref(false)
  const loadingDetail = ref(false)
  const switchingScene = ref(false)
  const syncingLayout = ref(false)
  const lastError = ref<string | null>(null)
  const loadedOnce = ref(false)

  const selectedProject = computed(() =>
    selectedProjectId.value != null
      ? projects.value.find((p) => p.id === selectedProjectId.value) ?? null
      : null,
  )

  const selectedEntry = computed(() =>
    selectedProjectId.value != null ? projectCache.value[selectedProjectId.value] ?? null : null,
  )

  const selectedDoc = computed(() => selectedEntry.value?.doc ?? null)
  const selectedDetail = computed(() => selectedEntry.value?.detail ?? null)

  const activeSceneId = computed(() => {
    const summaryActive = selectedProject.value?.activeSceneId
    if (summaryActive && selectedDoc.value?.scenes[summaryActive]) return summaryActive
    return selectedDoc.value?.activeSceneId ?? ''
  })

  const subScenes = computed<ObsSceneSubSceneOption[]>(() => {
    if (selectedProjectId.value == null) return []
    return getSubScenesFor(selectedProjectId.value)
  })

  function getSubScenesFor(projectId: number): ObsSceneSubSceneOption[] {
    const entry = projectCache.value[projectId]
    if (!entry) return []
    const doc = entry.doc
    return doc.sceneOrder
      .map((id) => doc.scenes[id])
      .filter((s): s is NonNullable<typeof s> => Boolean(s))
      .map((s) => ({
        id: s.id,
        name: s.name || s.id,
        obsSceneBinding: s.obsSceneBinding?.trim() || undefined,
      }))
  }

  async function refreshProjects(force = false) {
    if (loadingProjects.value) return projects.value
    if (loadedOnce.value && !force && projects.value.length > 0) return projects.value
    loadingProjects.value = true
    lastError.value = null
    try {
      const list = await listObsSceneProjects()
      projects.value = list
      loadedOnce.value = true
      if (list.length > 0) {
        const keepCurrent = selectedProjectId.value != null && list.some((p) => p.id === selectedProjectId.value)
        const nextId = keepCurrent ? selectedProjectId.value! : list[0].id
        selectedProjectId.value = nextId
        await loadProject(nextId, force)
      } else {
        selectedProjectId.value = null
      }
      return list
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err)
      return projects.value
    } finally {
      loadingProjects.value = false
    }
  }

  async function loadProject(projectId: number, force = false): Promise<CachedObsSceneProject | null> {
    if (!projectId) return null
    if (!force && projectCache.value[projectId]) {
      return projectCache.value[projectId]
    }
    loadingDetail.value = true
    lastError.value = null
    try {
      const detail = await getObsSceneProject(projectId)
      const rawJson = detail.publishedJson || detail.draftJson
      const parsed = rawJson ? JSON.parse(rawJson) : null
      const doc = normalizeSceneDocument(parsed)
      if (detail.activeSceneId && doc.scenes[detail.activeSceneId]) {
        doc.activeSceneId = detail.activeSceneId
      }
      const entry: CachedObsSceneProject = { detail, doc }
      projectCache.value = {
        ...projectCache.value,
        [projectId]: entry,
      }
      return entry
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      loadingDetail.value = false
    }
  }

  async function selectProject(projectId: number) {
    selectedProjectId.value = projectId
    await loadProject(projectId)
  }

  /**
   * 切换云端 VTsuru 场景子场景（单一数据源在后端 /api/obs-scene/:id/switch-scene）。
   * 若子场景绑定了本地 OBS 场景名且 OBS 已连接，可按需联动切换本地 OBS 场景；
   * VTS 动作由 OBS 浏览器源主槽位监听 ActiveSceneChanged 统一触发，此处不重复执行。
   */
  async function switchSubScene(
    projectId: number,
    sceneId: string,
    options?: { syncLocalObsScene?: boolean; silent?: boolean },
  ) {
    if (!projectId || !sceneId) throw new Error('未指定场景项目或子场景')
    switchingScene.value = true
    try {
      const result = await switchObsActiveScene(projectId, { sceneId })
      const resolvedId = result.activeSceneId || sceneId
      projects.value = projects.value.map((p) => (p.id === projectId ? { ...p, activeSceneId: resolvedId } : p))

      let entry = projectCache.value[projectId]
      if (!entry) {
        entry = (await loadProject(projectId)) ?? undefined
      }
      if (entry && entry.doc.scenes[resolvedId]) {
        entry.doc.activeSceneId = resolvedId
        entry.detail.activeSceneId = resolvedId
      }

      const scene = entry?.doc.scenes[resolvedId]
      const binding = scene?.obsSceneBinding?.trim()
      if (options?.syncLocalObsScene !== false && binding) {
        const obs = useOBSStore()
        if (obs.obsConnected && obs.obsScenes.includes(binding) && obs.currentObsScene !== binding) {
          await obs.switchToScene(binding)
        }
      }

      if (!options?.silent) {
        toast.success(`已切换 VTsuru 子场景：${scene?.name || resolvedId}`)
      }
      return result
    } finally {
      switchingScene.value = false
    }
  }

  /** 将指定子场景的浏览器槽位与本地 OBS 源 Z 序显式对齐到当前 OBS 场景 */
  async function syncCurrentLayoutToObs(projectId: number, sceneId?: string) {
    const obs = useOBSStore()
    if (!obs.obsConnected) throw new Error('OBS 未连接，无法同步场景布局')
    const entry = (await loadProject(projectId)) ?? projectCache.value[projectId]
    if (!entry) throw new Error('未能加载场景项目详情')

    const resolvedSceneId = sceneId || entry.detail.activeSceneId || entry.doc.activeSceneId
    const targetScene = entry.doc.scenes[resolvedSceneId]
    const obsSceneName = targetScene?.obsSceneBinding?.trim() || obs.currentObsScene || obs.obsScenes[0] || ''
    if (!obsSceneName) throw new Error('未找到可用的目标 OBS 场景')

    const account = useAccount()
    const authToken = documentRequiresAuthToken(entry.doc) ? account.value?.token || undefined : undefined

    syncingLayout.value = true
    try {
      const params = buildSyncLayoutParamsForScene({
        doc: entry.doc,
        sceneId: resolvedSceneId,
        obsSceneName,
        baseSourceName: `VTsuru Scene - ${entry.detail.name}`,
        shareKey: entry.detail.shareKey,
        origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        authToken,
      })
      const res = await obs.syncSceneLayout(params)
      if (!res.ok) throw new Error(res.message || '同步布局失败')
      toast.success(`已将「${targetScene?.name || entry.detail.name}」布局推送到 OBS 场景「${obsSceneName}」`)
      return res
    } finally {
      syncingLayout.value = false
    }
  }

  return {
    projects,
    projectCache,
    selectedProjectId,
    selectedProject,
    selectedDetail,
    selectedDoc,
    activeSceneId,
    subScenes,
    loadingProjects,
    loadingDetail,
    switchingScene,
    syncingLayout,
    lastError,
    loadedOnce,
    getSubScenesFor,
    refreshProjects,
    loadProject,
    selectProject,
    switchSubScene,
    syncCurrentLayoutToObs,
  }
})

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useObsSceneControl, import.meta.hot))
