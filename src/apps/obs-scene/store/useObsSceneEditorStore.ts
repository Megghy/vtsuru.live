import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import type { ObsSceneProjectDetail, ObsSceneProjectSummary } from '@/api/obs-scene'
import {
  createObsSceneProject,
  deleteObsSceneProject,
  getObsSceneProject,
  listObsSceneProjects,
  publishObsSceneProject,
  rotateObsSceneShareKey,
  saveObsSceneDraft,
  switchObsActiveScene,
} from '@/api/obs-scene'
import { getObsSyncState, updateObsSyncState } from '@/api/obs-store'

import type {
  ObsSceneDocument,
  ObsSceneItem,
  ObsSceneLayer,
  WidgetConfigMode,
} from '../types'
import {
  buildIsolatedChannelId,
  createDefaultSceneDocument,
  createGroupLayer,
  createShortId,
  isBridgeWidget,
  normalizeSceneDocument,
} from '../types'
import {
  cloneLayerSubtree,
  collectSubtreeLayerIds,
  findParentContainer,
  fitGroupBoundsToChildrenInDoc,
  getParentGroupId,
  groupLayersInDoc,
  isLayerInGlobalScope,
  moveLayerIntoGroupInDoc,
  moveLayerOutOfGroupInDoc,
  moveLayerToContainerInDoc,
  resolveCommonParentForGrouping,
  ungroupLayerInDoc,
} from '../utils/groupTree'

const MAX_HISTORY = 60

function cloneDoc(doc: ObsSceneDocument): ObsSceneDocument {
  return JSON.parse(JSON.stringify(doc)) as ObsSceneDocument
}

export const useObsSceneEditorStore = defineStore('obsSceneEditor', () => {
  const projects = ref<ObsSceneProjectSummary[]>([])
  const currentProject = ref<ObsSceneProjectDetail | null>(null)
  const doc = ref<ObsSceneDocument>(createDefaultSceneDocument())

  const loadingList = ref(false)
  const loadingProject = ref(false)
  const savingDraft = ref(false)
  const publishing = ref(false)
  const isDirty = ref(false)
  const autoLivePublish = ref(false)

  // 编辑器视图与选择状态
  const selectedLayerIds = ref<string[]>([])
  const editingGroupId = ref<string | null>(null)
  const editingScope = ref<'scene' | 'global'>('scene')
  const interactionMode = ref<'select' | 'interact'>('select')
  const showGrid = ref(true)
  const snapEnabled = ref(true)
  const zoom = ref(0.6)
  const panX = ref(0)
  const panY = ref(0)

  // 历史栈（JSON 字符串，轻量且绝对无引用污染）
  const history = ref<string[]>([])
  const historyIndex = ref(-1)

  let draftTimer: ReturnType<typeof setTimeout> | null = null
  let publishTimer: ReturnType<typeof setTimeout> | null = null

  const activeScene = computed<ObsSceneItem | null>(() => {
    return doc.value.scenes[doc.value.activeSceneId] ?? null
  })

  const currentScopeLayerIds = computed<string[]>(() => {
    if (editingScope.value === 'global') return doc.value.globalLayerIds
    return activeScene.value?.layerIds ?? []
  })

  const selectedLayer = computed<ObsSceneLayer | null>(() => {
    if (selectedLayerIds.value.length !== 1) return null
    return doc.value.layers[selectedLayerIds.value[0]] ?? null
  })

  const canGroupSelected = computed(() => {
    return resolveCommonParentForGrouping(doc.value, selectedLayerIds.value) !== null
  })

  const selectedParentGroup = computed<ObsSceneLayer | null>(() => {
    if (selectedLayerIds.value.length !== 1) return null
    const parentId = getParentGroupId(doc.value, selectedLayerIds.value[0])
    return parentId ? (doc.value.layers[parentId] ?? null) : null
  })

  function sanitizeSelectionAndEditGroup() {
    selectedLayerIds.value = selectedLayerIds.value.filter((id) => Boolean(doc.value.layers[id]))
    if (editingGroupId.value) {
      const grp = doc.value.layers[editingGroupId.value]
      if (!grp || grp.type !== 'group') editingGroupId.value = null
    }
  }

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value >= 0 && historyIndex.value < history.value.length - 1)

  const hasUnpublishedChanges = computed(() => {
    if (!currentProject.value) return false
    if (!currentProject.value.publishedJson) return true
    return JSON.stringify(doc.value) !== currentProject.value.publishedJson
  })

  function resetHistory() {
    history.value = [JSON.stringify(doc.value)]
    historyIndex.value = 0
  }

  function pushHistory() {
    const snap = JSON.stringify(doc.value)
    if (history.value[historyIndex.value] === snap) return
    history.value = history.value.slice(0, historyIndex.value + 1)
    history.value.push(snap)
    if (history.value.length > MAX_HISTORY) {
      history.value.shift()
    } else {
      historyIndex.value++
    }
    markDirty()
  }

  function undo() {
    if (!canUndo.value) return
    historyIndex.value--
    doc.value = normalizeSceneDocument(JSON.parse(history.value[historyIndex.value]))
    sanitizeSelectionAndEditGroup()
    markDirty()
  }

  function redo() {
    if (!canRedo.value) return
    historyIndex.value++
    doc.value = normalizeSceneDocument(JSON.parse(history.value[historyIndex.value]))
    sanitizeSelectionAndEditGroup()
    markDirty()
  }

  function markDirty() {
    isDirty.value = true
    scheduleDraftSave()
    if (autoLivePublish.value) {
      scheduleAutoPublish()
    }
  }

  function scheduleDraftSave() {
    if (!currentProject.value) return
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      void saveDraftNow(true)
    }, 1000)
  }

  function scheduleAutoPublish() {
    if (!currentProject.value) return
    if (publishTimer) clearTimeout(publishTimer)
    publishTimer = setTimeout(() => {
      void publishNow(true)
    }, 1500)
  }

  function syncProjectSummary(detail: ObsSceneProjectSummary) {
    const idx = projects.value.findIndex((p) => p.id === detail.id)
    const summary: ObsSceneProjectSummary = {
      id: detail.id,
      name: detail.name,
      shareKey: detail.shareKey,
      publishedVersion: detail.publishedVersion,
      activeSceneId: detail.activeSceneId,
      hasPublished: detail.hasPublished,
      createTime: detail.createTime,
      updateTime: detail.updateTime,
      publishTime: detail.publishTime,
    }
    if (idx >= 0) {
      projects.value.splice(idx, 1, summary)
    } else {
      projects.value.unshift(summary)
    }
  }

  async function loadProjectList(autoOpen = true) {
    loadingList.value = true
    try {
      projects.value = await listObsSceneProjects()
      if (autoOpen) {
        if (projects.value.length > 0) {
          await openProject(projects.value[0].id)
        } else {
          await createNewProject('我的直播场景')
        }
      }
    } finally {
      loadingList.value = false
    }
  }

  async function openProject(id: number) {
    loadingProject.value = true
    try {
      if (draftTimer) clearTimeout(draftTimer)
      if (publishTimer) clearTimeout(publishTimer)
      const detail = await getObsSceneProject(id)
      currentProject.value = detail
      syncProjectSummary(detail)
      let parsed: unknown
      try {
        parsed = JSON.parse(detail.draftJson)
      } catch {
        parsed = createDefaultSceneDocument()
      }
      doc.value = normalizeSceneDocument(parsed)
      selectedLayerIds.value = []
      editingGroupId.value = null
      editingScope.value = 'scene'
      isDirty.value = false
      resetHistory()
    } finally {
      loadingProject.value = false
    }
  }

  async function createNewProject(name?: string, initialDoc?: ObsSceneDocument) {
    const draftJson = initialDoc ? JSON.stringify(initialDoc) : undefined
    const detail = await createObsSceneProject({ name, draftJson })
    currentProject.value = detail
    syncProjectSummary(detail)
    doc.value = normalizeSceneDocument(JSON.parse(detail.draftJson))
    selectedLayerIds.value = []
    editingGroupId.value = null
    editingScope.value = 'scene'
    isDirty.value = false
    resetHistory()
    return detail
  }

  async function renameCurrentProject(name: string) {
    if (!currentProject.value) return
    const trimmed = name.trim()
    if (!trimmed) return
    currentProject.value.name = trimmed
    await saveDraftNow(true)
  }

  async function removeProject(id: number) {
    await deleteObsSceneProject(id)
    projects.value = projects.value.filter((p) => p.id !== id)
    if (currentProject.value?.id === id) {
      if (projects.value.length > 0) {
        await openProject(projects.value[0].id)
      } else {
        await createNewProject('我的直播场景')
      }
    }
  }

  async function saveDraftNow(silent = false) {
    if (!currentProject.value) return
    if (draftTimer) {
      clearTimeout(draftTimer)
      draftTimer = null
    }
    savingDraft.value = true
    try {
      const updated = await saveObsSceneDraft(currentProject.value.id, {
        name: currentProject.value.name,
        draftJson: JSON.stringify(doc.value),
      })
      currentProject.value = updated
      syncProjectSummary(updated)
      isDirty.value = false
      if (!silent) toast.success('草稿已保存')
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : '保存草稿失败')
      throw err
    } finally {
      savingDraft.value = false
    }
  }

  async function publishNow(silent = false) {
    if (!currentProject.value) return
    if (publishTimer) {
      clearTimeout(publishTimer)
      publishTimer = null
    }
    publishing.value = true
    try {
      const updated = await publishObsSceneProject(currentProject.value.id, {
        name: currentProject.value.name,
        draftJson: JSON.stringify(doc.value),
      })
      currentProject.value = updated
      syncProjectSummary(updated)
      isDirty.value = false
      if (!silent) toast.success(`已发布到 OBS (v${updated.publishedVersion})`)
    } catch (err) {
      if (!silent) toast.error(err instanceof Error ? err.message : '发布失败')
      throw err
    } finally {
      publishing.value = false
    }
  }

  async function rotateShareKeyNow() {
    if (!currentProject.value) return
    const summary = await rotateObsSceneShareKey(currentProject.value.id)
    currentProject.value.shareKey = summary.shareKey
    syncProjectSummary(summary)
    toast.success('已重置 OBS 播放链接，旧链接立即失效')
  }

  // ---- 子场景操作 ----

  function setActiveScene(sceneId: string, syncLive = false) {
    if (!doc.value.scenes[sceneId]) return
    doc.value.activeSceneId = sceneId
    selectedLayerIds.value = []
    editingGroupId.value = null
    editingScope.value = 'scene'
    pushHistory()

    if (syncLive && currentProject.value?.hasPublished) {
      void switchObsActiveScene(currentProject.value.id, { sceneId })
        .then((res) => {
          if (currentProject.value && res.activeSceneId) {
            currentProject.value.activeSceneId = res.activeSceneId
          }
        })
        .catch(() => {})
    }
  }

  async function handleLocalObsSceneChanged(obsSceneName: string): Promise<string | null> {
    if (!currentProject.value || !obsSceneName) return null
    const matchedLocal = Object.values(doc.value.scenes).find(
      (s) => s.obsSceneBinding?.trim().toLowerCase() === obsSceneName.trim().toLowerCase(),
    )
    if (matchedLocal && matchedLocal.id !== doc.value.activeSceneId) {
      doc.value.activeSceneId = matchedLocal.id
      selectedLayerIds.value = []
    }
    if (currentProject.value.hasPublished) {
      const res = await switchObsActiveScene(currentProject.value.id, { obsSceneName })
      if (res.matched && res.activeSceneId) {
        currentProject.value.activeSceneId = res.activeSceneId
        return res.activeSceneId
      }
    }
    return matchedLocal?.id ?? null
  }

  function addScene(name?: string) {
    const id = createShortId('scene')
    const count = doc.value.sceneOrder.length + 1
    doc.value.scenes[id] = {
      id,
      name: name?.trim() || `场景 ${count}`,
      layerIds: [],
      transition: 'fade',
    }
    doc.value.sceneOrder.push(id)
    doc.value.activeSceneId = id
    selectedLayerIds.value = []
    editingScope.value = 'scene'
    pushHistory()
    return id
  }

  function duplicateScene(sceneId: string) {
    const src = doc.value.scenes[sceneId]
    if (!src) return
    const nextSceneId = createShortId('scene')
    const clonedIds: string[] = []
    for (const lid of src.layerIds) {
      const clonedRootId = cloneLayerSubtree(doc.value, lid)
      if (clonedRootId) clonedIds.push(clonedRootId)
    }
    doc.value.scenes[nextSceneId] = {
      id: nextSceneId,
      name: `${src.name} 副本`,
      layerIds: clonedIds,
      transition: src.transition,
    }
    doc.value.sceneOrder.push(nextSceneId)
    doc.value.activeSceneId = nextSceneId
    selectedLayerIds.value = []
    editingGroupId.value = null
    pushHistory()
  }

  function updateSceneMeta(sceneId: string, patch: Partial<Pick<ObsSceneItem, 'name' | 'transition' | 'obsSceneBinding'>>) {
    const scene = doc.value.scenes[sceneId]
    if (!scene) return
    if (patch.name !== undefined) scene.name = patch.name
    if (patch.transition !== undefined) scene.transition = patch.transition
    if (patch.obsSceneBinding !== undefined) {
      scene.obsSceneBinding = patch.obsSceneBinding.trim() || undefined
    }
    pushHistory()
  }

  function deleteScene(sceneId: string) {
    if (doc.value.sceneOrder.length <= 1) {
      toast.warning('至少保留 1 个子场景')
      return
    }
    const scene = doc.value.scenes[sceneId]
    if (!scene) return
    for (const lid of scene.layerIds) {
      for (const subId of collectSubtreeLayerIds(doc.value, lid)) {
        delete doc.value.layers[subId]
      }
    }
    delete doc.value.scenes[sceneId]
    doc.value.sceneOrder = doc.value.sceneOrder.filter((id) => id !== sceneId)
    if (doc.value.activeSceneId === sceneId) {
      doc.value.activeSceneId = doc.value.sceneOrder[0]
    }
    selectedLayerIds.value = []
    editingGroupId.value = null
    pushHistory()
  }

  // ---- 图层操作 ----

  function addLayer(layer: ObsSceneLayer, scope: 'scene' | 'global' = editingScope.value) {
    const resolvedScope = layer.type === 'obs-source' ? 'scene' : scope
    doc.value.layers[layer.id] = layer
    if (resolvedScope === 'global') {
      doc.value.globalLayerIds.push(layer.id)
      editingScope.value = 'global'
    } else if (activeScene.value) {
      activeScene.value.layerIds.push(layer.id)
      editingScope.value = 'scene'
    }
    selectedLayerIds.value = [layer.id]
    editingGroupId.value = null
    pushHistory()
  }

  function updateLayer(layerId: string, patch: Partial<ObsSceneLayer>, commit = true) {
    const existing = doc.value.layers[layerId]
    if (!existing) return
    Object.assign(existing, patch)
    if (commit) pushHistory()
  }

  function duplicateLayer(layerId: string) {
    const parent = findParentContainer(doc.value, layerId)
    if (!parent) return
    const newId = cloneLayerSubtree(doc.value, layerId, { dx: 24, dy: 24, renameRoot: true })
    if (!newId) return
    parent.list.splice(parent.index + 1, 0, newId)
    selectedLayerIds.value = [newId]
    editingScope.value = isLayerInGlobalScope(doc.value, newId) ? 'global' : 'scene'
    pushHistory()
  }

  function deleteLayers(ids: string[]) {
    if (ids.length === 0) return
    const toDelete = new Set<string>()
    for (const id of ids) {
      for (const subId of collectSubtreeLayerIds(doc.value, id)) {
        toDelete.add(subId)
      }
    }
    if (toDelete.size === 0) return

    for (const id of toDelete) {
      delete doc.value.layers[id]
    }
    doc.value.globalLayerIds = doc.value.globalLayerIds.filter((id) => !toDelete.has(id))
    for (const scene of Object.values(doc.value.scenes)) {
      scene.layerIds = scene.layerIds.filter((id) => !toDelete.has(id))
    }
    for (const layer of Object.values(doc.value.layers)) {
      if (layer.type === 'group') {
        layer.group.childIds = layer.group.childIds.filter((id) => !toDelete.has(id))
      }
    }
    sanitizeSelectionAndEditGroup()
    pushHistory()
  }

  function reorderLayers(newBottomToTopIds: string[], scope: 'scene' | 'global' = editingScope.value) {
    if (scope === 'global') {
      doc.value.globalLayerIds = [...newBottomToTopIds]
    } else if (activeScene.value) {
      activeScene.value.layerIds = [...newBottomToTopIds]
    }
    pushHistory()
  }

  function reorderGroupChildren(groupId: string, newBottomToTopIds: string[]) {
    const grp = doc.value.layers[groupId]
    if (!grp || grp.type !== 'group') return
    grp.group.childIds = [...newBottomToTopIds]
    pushHistory()
  }

  function moveLayerScope(layerId: string, toScope: 'scene' | 'global') {
    const targetLayer = doc.value.layers[layerId]
    if (!targetLayer || !activeScene.value) return
    if (targetLayer.type === 'obs-source' && toScope === 'global') {
      toast.warning('本地 OBS 源图层仅支持放在子场景顶层')
      return
    }
    // 若图层原本在组内，先移出组再切换作用域，避免悬空引用
    while (getParentGroupId(doc.value, layerId)) {
      if (!moveLayerOutOfGroupInDoc(doc.value, layerId)) break
    }
    doc.value.globalLayerIds = doc.value.globalLayerIds.filter((id) => id !== layerId)
    for (const sc of Object.values(doc.value.scenes)) {
      sc.layerIds = sc.layerIds.filter((id) => id !== layerId)
    }
    if (toScope === 'global') {
      doc.value.globalLayerIds.push(layerId)
    } else {
      activeScene.value.layerIds.push(layerId)
    }
    editingScope.value = toScope
    editingGroupId.value = null
    pushHistory()
  }

  // ---- 分组与层级/批量对齐操作 ----

  function addEmptyGroup(customName?: string, scope: 'scene' | 'global' = editingScope.value) {
    const c = doc.value.canvas
    const w = Math.min(480, Math.round(c.width * 0.35))
    const h = Math.min(320, Math.round(c.height * 0.35))
    const existingGroupCount = Object.values(doc.value.layers).filter((l) => l.type === 'group').length
    const group = createGroupLayer(
      customName?.trim() || `分组 ${existingGroupCount + 1}`,
      {
        x: Math.round((c.width - w) / 2),
        y: Math.round((c.height - h) / 2),
        width: w,
        height: h,
      },
      [],
    )
    addLayer(group, scope)
    toast.success(`已新建「${group.name}」，可将图层拖入或右键移入此分组`)
    return group
  }

  function groupSelectedLayers(customName?: string) {
    const group = groupLayersInDoc(doc.value, selectedLayerIds.value, customName)
    if (!group) {
      toast.warning('请选择同一层级内的至少 2 个图层进行编组')
      return null
    }
    selectedLayerIds.value = [group.id]
    pushHistory()
    toast.success(`已创建「${group.name}」`)
    return group
  }

  function ungroupLayer(groupId: string) {
    const target = doc.value.layers[groupId]
    if (!target || target.type !== 'group') return
    const parentBefore = getParentGroupId(doc.value, groupId)
    const restored = ungroupLayerInDoc(doc.value, groupId)
    if (editingGroupId.value === groupId) {
      editingGroupId.value = parentBefore
    }
    selectedLayerIds.value = restored
    pushHistory()
    toast.success('已解散分组')
  }

  function enterGroupEdit(groupId: string, selectChildId?: string) {
    const grp = doc.value.layers[groupId]
    if (!grp || grp.type !== 'group') return
    editingGroupId.value = groupId
    grp.group.collapsed = false
    if (selectChildId && doc.value.layers[selectChildId]) {
      selectedLayerIds.value = [selectChildId]
    } else if (grp.group.childIds.length > 0) {
      selectedLayerIds.value = [grp.group.childIds[grp.group.childIds.length - 1]]
    } else {
      selectedLayerIds.value = []
    }
  }

  function exitGroupEdit() {
    if (!editingGroupId.value) return
    const current = editingGroupId.value
    const parentGroupId = getParentGroupId(doc.value, current)
    editingGroupId.value = parentGroupId
    if (doc.value.layers[current]) {
      selectedLayerIds.value = [current]
    }
  }

  function moveLayerOutOfGroup(layerId: string) {
    const ok = moveLayerOutOfGroupInDoc(doc.value, layerId)
    if (!ok) return
    editingGroupId.value = getParentGroupId(doc.value, layerId)
    selectedLayerIds.value = [layerId]
    pushHistory()
  }

  function moveLayerIntoGroup(layerId: string, targetGroupId: string) {
    const ok = moveLayerIntoGroupInDoc(doc.value, layerId, targetGroupId)
    if (!ok) return
    const target = doc.value.layers[targetGroupId]
    if (target?.type === 'group') target.group.collapsed = false
    editingGroupId.value = targetGroupId
    selectedLayerIds.value = [layerId]
    pushHistory()
  }

  function moveLayersIntoGroup(layerIds: string[], targetGroupId: string) {
    const target = doc.value.layers[targetGroupId]
    if (!target || target.type !== 'group') return
    let movedCount = 0
    for (const id of layerIds) {
      if (moveLayerIntoGroupInDoc(doc.value, id, targetGroupId)) {
        movedCount++
      }
    }
    if (movedCount === 0) return
    target.group.collapsed = false
    editingGroupId.value = targetGroupId
    selectedLayerIds.value = layerIds.filter((id) => Boolean(doc.value.layers[id]))
    pushHistory()
    toast.success(`已移入「${target.name}」`)
  }

  function moveLayerToContainer(layerId: string, targetGroupId: string | null, insertIndex?: number) {
    const layer = doc.value.layers[layerId]
    if (layer?.type === 'obs-source' && targetGroupId) {
      toast.warning('本地 OBS 源图层不能移入分组，需保持在子场景顶层以参与 Z 轴分层')
      return
    }
    const ok = moveLayerToContainerInDoc(doc.value, layerId, editingScope.value, targetGroupId, insertIndex)
    if (!ok) return
    if (targetGroupId) {
      const target = doc.value.layers[targetGroupId]
      if (target?.type === 'group') target.group.collapsed = false
    }
    editingGroupId.value = targetGroupId
    selectedLayerIds.value = [layerId]
    pushHistory()
  }

  function fitGroupBounds(groupId: string) {
    if (fitGroupBoundsToChildrenInDoc(doc.value, groupId)) {
      pushHistory()
    }
  }

  function moveLayerZOrder(layerId: string, action: 'top' | 'up' | 'down' | 'bottom') {
    const parent = findParentContainer(doc.value, layerId)
    if (!parent || parent.list.length <= 1) return
    const idx = parent.index
    let nextIdx = idx
    if (action === 'top') nextIdx = parent.list.length - 1
    else if (action === 'bottom') nextIdx = 0
    else if (action === 'up') nextIdx = Math.min(parent.list.length - 1, idx + 1)
    else if (action === 'down') nextIdx = Math.max(0, idx - 1)
    if (nextIdx === idx) return
    const [item] = parent.list.splice(idx, 1)
    parent.list.splice(nextIdx, 0, item)
    pushHistory()
  }

  function alignSelectedLayers(mode: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom') {
    const targets = selectedLayerIds.value
      .map((id) => doc.value.layers[id])
      .filter((l): l is ObsSceneLayer => Boolean(l) && !l.locked)
    if (targets.length < 2) return
    const minX = Math.min(...targets.map((l) => l.x))
    const maxX = Math.max(...targets.map((l) => l.x + l.width))
    const minY = Math.min(...targets.map((l) => l.y))
    const maxY = Math.max(...targets.map((l) => l.y + l.height))
    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2

    for (const l of targets) {
      if (mode === 'left') l.x = Math.round(minX)
      else if (mode === 'right') l.x = Math.round(maxX - l.width)
      else if (mode === 'center-x') l.x = Math.round(midX - l.width / 2)
      else if (mode === 'top') l.y = Math.round(minY)
      else if (mode === 'bottom') l.y = Math.round(maxY - l.height)
      else if (mode === 'center-y') l.y = Math.round(midY - l.height / 2)
    }
    pushHistory()
  }

  function setCanvasSize(width: number, height: number) {
    doc.value.canvas.width = Math.max(320, Math.round(width))
    doc.value.canvas.height = Math.max(240, Math.round(height))
    pushHistory()
  }

  function setCanvasBackground(background: string | undefined) {
    doc.value.canvas.background = background || undefined
    pushHistory()
  }

  /**
   * 站内组件配置模式切换（默认复用现有通道，可选独立保存配置）
   */
  async function setWidgetConfigMode(layerId: string, mode: WidgetConfigMode, sharedChannel = 'default') {
    const layer = doc.value.layers[layerId]
    if (!layer || layer.type !== 'vtsuru-widget') return

    const componentId = layer.widget.componentId
    if (!isBridgeWidget(componentId)) {
      layer.widget.configMode = mode
      pushHistory()
      return
    }

    if (mode === 'isolated') {
      const prevChannel = layer.widget.channelId || 'default'
      const isolatedChannel = buildIsolatedChannelId(layer.id)
      // 首次切换独立配置时，如果目标独立通道为空，则从当前复用通道深拷贝初始配置
      try {
        const targetSnap = await getObsSyncState(componentId, isolatedChannel)
        if (!targetSnap.data) {
          const sourceSnap = await getObsSyncState(componentId, prevChannel)
          if (sourceSnap.data) {
            await updateObsSyncState(componentId, isolatedChannel, sourceSnap.data, '')
          }
        }
      } catch (err) {
        console.warn('[ObsScene] 复制初始独立配置失败，将使用默认配置:', err)
      }
      layer.widget.configMode = 'isolated'
      layer.widget.channelId = isolatedChannel
      pushHistory()
      toast.success('已切换为独立保存配置，修改不会影响外部组件库通道')
    } else {
      layer.widget.configMode = 'shared'
      layer.widget.channelId = sharedChannel.trim() || 'default'
      pushHistory()
      toast.success(`已切换为复用通道「${layer.widget.channelId}」`)
    }
  }

  function importDocumentJson(rawJson: string) {
    const parsed = JSON.parse(rawJson)
    doc.value = normalizeSceneDocument(parsed)
    selectedLayerIds.value = []
    pushHistory()
  }

  function exportDocumentJson(): string {
    return JSON.stringify(cloneDoc(doc.value), null, 2)
  }

  return {
    projects,
    currentProject,
    doc,
    loadingList,
    loadingProject,
    savingDraft,
    publishing,
    isDirty,
    autoLivePublish,
    selectedLayerIds,
    editingGroupId,
    editingScope,
    interactionMode,
    showGrid,
    snapEnabled,
    zoom,
    panX,
    panY,
    activeScene,
    currentScopeLayerIds,
    selectedLayer,
    canGroupSelected,
    selectedParentGroup,
    canUndo,
    canRedo,
    hasUnpublishedChanges,
    loadProjectList,
    openProject,
    createNewProject,
    renameCurrentProject,
    removeProject,
    saveDraftNow,
    publishNow,
    rotateShareKeyNow,
    pushHistory,
    undo,
    redo,
    setActiveScene,
    handleLocalObsSceneChanged,
    addScene,
    duplicateScene,
    updateSceneMeta,
    deleteScene,
    addLayer,
    updateLayer,
    duplicateLayer,
    deleteLayers,
    reorderLayers,
    reorderGroupChildren,
    moveLayerScope,
    addEmptyGroup,
    groupSelectedLayers,
    ungroupLayer,
    enterGroupEdit,
    exitGroupEdit,
    moveLayerOutOfGroup,
    moveLayerIntoGroup,
    moveLayersIntoGroup,
    moveLayerToContainer,
    fitGroupBounds,
    moveLayerZOrder,
    alignSelectedLayers,
    setCanvasSize,
    setCanvasBackground,
    setWidgetConfigMode,
    importDocumentJson,
    exportDocumentJson,
  }
})
