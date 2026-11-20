<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { ChevronRight, FolderOpen, X } from 'lucide-vue-next'
import Moveable from 'moveable'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { RpcObsSceneItemRef } from '@/shared/rpc/contract'
import { Button } from '@/shared/ui/button'

import { useObsSceneEditorStore } from '../store/useObsSceneEditorStore'
import {
  applyGroupSubtreeScale,
  captureGroupSubtreeScaleSnapshot,
  getAncestorGroupIds,
  getParentGroupId,
  isLayerEffectivelyLocked,
  isLayerEffectivelyVisible,
  isLayerInGlobalScope,
  type SubtreeScaleSnapshot,
} from '../utils/groupTree'
import {
  collectHitLayersAtClientPoint,
  type HitLayerEntry,
  resolveTargetAtEditingScope,
} from '../utils/hitTest'
import ObsSceneRenderer from './ObsSceneRenderer.vue'
import SceneCanvasContextMenu from './SceneCanvasContextMenu.vue'

const props = defineProps<{
  ownerUserId?: number
  referenceItems?: RpcObsSceneItemRef[]
  referenceCanvasSize?: { width: number; height: number }
  showReferenceOverlay?: boolean
}>()

const store = useObsSceneEditorStore()

const viewportRef = ref<HTMLElement | null>(null)
const stageHostRef = ref<HTMLElement | null>(null)
const { width: vpWidth, height: vpHeight } = useElementSize(viewportRef)

const autoFit = ref(true)
const isSpaceDown = ref(false)
const isRatioLockKeyDown = ref(false)
const isPanning = ref(false)
let panPointerId: number | null = null
let panStartClientX = 0
let panStartClientY = 0
let panStartX = 0
let panStartY = 0

// 右键上下文菜单状态
const contextMenu = ref<{
  open: boolean
  x: number
  y: number
  hits: HitLayerEntry[]
}>({
  open: false,
  x: 0,
  y: 0,
  hits: [],
})

const marquee = ref<{
  active: boolean
  moved: boolean
  startX: number
  startY: number
  curX: number
  curY: number
  additive: boolean
  baseIds: string[]
  pointerId: number | null
}>({
  active: false,
  moved: false,
  startX: 0,
  startY: 0,
  curX: 0,
  curY: 0,
  additive: false,
  baseIds: [],
  pointerId: null,
})

const marqueeBoxStyle = computed(() => {
  if (!marquee.value.active || !marquee.value.moved || !viewportRef.value) return null
  const rect = viewportRef.value.getBoundingClientRect()
  const left = Math.min(marquee.value.startX, marquee.value.curX) - rect.left
  const top = Math.min(marquee.value.startY, marquee.value.curY) - rect.top
  const width = Math.abs(marquee.value.curX - marquee.value.startX)
  const height = Math.abs(marquee.value.curY - marquee.value.startY)
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  }
})

function syncRatioLockKey(locked: boolean) {
  if (isRatioLockKeyDown.value !== locked) {
    isRatioLockKeyDown.value = locked
  }
  if (moveable && moveable.keepRatio !== locked) {
    moveable.keepRatio = locked
  }
}

let moveable: Moveable | null = null
let moveableContainerEl: HTMLElement | null = null
let activeDragLayerId: string | null = null
let dragChanged = false

// 整组联动缩放快照（避免拖动缩放时产生累计四舍五入漂移）
let activeGroupResize: {
  groupId: string
  startWidth: number
  startHeight: number
  snapshot: SubtreeScaleSnapshot
} | null = null

const editingGroupBreadcrumb = computed(() => {
  if (!store.editingGroupId) return []
  const chain = [...getAncestorGroupIds(store.doc, store.editingGroupId), store.editingGroupId]
  return chain
    .map((id) => store.doc.layers[id])
    .filter((l): l is NonNullable<typeof l> => Boolean(l))
})

function fitCanvasToViewport(enableAutoFit = true) {
  if (enableAutoFit) autoFit.value = true
  const el = viewportRef.value
  const w = el?.clientWidth || vpWidth.value
  const h = el?.clientHeight || vpHeight.value
  if (w < 80 || h < 80) return
  const pad = 48
  const availW = Math.max(120, w - pad)
  const availH = Math.max(100, h - pad)
  const nextZoom = Math.min(1, availW / store.doc.canvas.width, availH / store.doc.canvas.height)
  store.zoom = Math.max(0.1, Math.floor(nextZoom * 1000) / 1000)
  store.panX = 0
  store.panY = 0
}

function setManualZoom(nextZoom: number) {
  autoFit.value = false
  store.zoom = Math.min(4, Math.max(0.1, Math.round(nextZoom * 1000) / 1000))
}

defineExpose({ fitCanvasToViewport, setManualZoom })

const stageWrapperStyle = computed(() => ({
  width: `${store.doc.canvas.width}px`,
  height: `${store.doc.canvas.height}px`,
  transform: `translate3d(${store.panX}px, ${store.panY}px, 0) scale(${store.zoom})`,
  transformOrigin: 'center center',
}))

function querySelectedElements(): { els: HTMLElement[]; commonParentGroupId: string | null } {
  if (!stageHostRef.value || store.interactionMode !== 'select') {
    return { els: [], commonParentGroupId: null }
  }
  const els: HTMLElement[] = []
  let commonParentGroupId: string | null | undefined
  for (const id of store.selectedLayerIds) {
    const layer = store.doc.layers[id]
    if (!layer || isLayerEffectivelyLocked(store.doc, id) || !isLayerEffectivelyVisible(store.doc, id)) continue
    const el = stageHostRef.value.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(id)}"]`)
    if (!el) continue
    els.push(el)
    const pId = getParentGroupId(store.doc, id)
    if (commonParentGroupId === undefined) commonParentGroupId = pId
    else if (commonParentGroupId !== pId) commonParentGroupId = null
  }
  return { els, commonParentGroupId: commonParentGroupId ?? null }
}

function queryElementGuidelines(containerEl: HTMLElement, parentGroupId: string | null): HTMLElement[] {
  if (!store.snapEnabled) return []
  const selectedSet = new Set(store.selectedLayerIds)
  if (parentGroupId) {
    const grp = store.doc.layers[parentGroupId]
    if (!grp || grp.type !== 'group') return []
    return grp.group.childIds
      .filter((cid) => !selectedSet.has(cid))
      .map((cid) => containerEl.querySelector<HTMLElement>(`:scope > [data-layer-id="${CSS.escape(cid)}"]`))
      .filter((el): el is HTMLElement => Boolean(el))
  }
  const activeScene = store.activeScene
  const topIds = [...(activeScene?.layerIds ?? []), ...store.doc.globalLayerIds]
  return topIds
    .filter((id) => !selectedSet.has(id))
    .map((id) => containerEl.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(id)}"]`))
    .filter((el): el is HTMLElement => Boolean(el))
}

function computeMoveableZoom() {
  // 让手柄在任意缩放倍率下都保持纤细可点，避免低缩放下句柄过大遮挡小图层拖拽区
  return Math.min(2.2, Math.max(0.75, 0.72 / Math.max(0.25, store.zoom)))
}

function resolveContainerGuidelines(parentGroupId: string | null) {
  if (parentGroupId) {
    const grp = store.doc.layers[parentGroupId]
    if (grp) {
      return {
        vertical: [0, grp.width / 2, grp.width],
        horizontal: [0, grp.height / 2, grp.height],
      }
    }
  }
  return {
    vertical: [0, store.doc.canvas.width / 2, store.doc.canvas.width],
    horizontal: [0, store.doc.canvas.height / 2, store.doc.canvas.height],
  }
}

function destroyMoveable() {
  moveable?.destroy()
  moveable = null
  moveableContainerEl = null
}

function syncMoveable() {
  if (!stageHostRef.value) return
  const { els: targets, commonParentGroupId } = querySelectedElements()
  const target: HTMLElement | HTMLElement[] | null =
    targets.length === 0 ? null : targets.length === 1 ? targets[0] : targets

  // 若选中的图层在某个组内，将 Moveable 挂载到该组容器上，确保旋转/平移组的局部坐标 100% 精准
  const desiredContainer =
    (commonParentGroupId
      ? stageHostRef.value.querySelector<HTMLElement>(`[data-layer-id="${CSS.escape(commonParentGroupId)}"]`)
      : null) ?? stageHostRef.value

  if (moveable && moveableContainerEl !== desiredContainer) {
    destroyMoveable()
  }

  const guidelines = resolveContainerGuidelines(commonParentGroupId)

  if (!moveable) {
    moveableContainerEl = desiredContainer
    moveable = new Moveable(desiredContainer, {
      target,
      draggable: true,
      resizable: true,
      rotatable: true,
      throttleDrag: 1,
      throttleResize: 1,
      throttleRotate: 1,
      keepRatio: isRatioLockKeyDown.value,
      snappable: store.snapEnabled,
      snapThreshold: 6,
      isDisplaySnapDigit: true,
      snapDirections: { top: true, left: true, bottom: true, right: true, center: true, middle: true },
      elementSnapDirections: { top: true, left: true, bottom: true, right: true, center: true, middle: true },
      verticalGuidelines: guidelines.vertical,
      horizontalGuidelines: guidelines.horizontal,
      elementGuidelines: queryElementGuidelines(desiredContainer, commonParentGroupId),
      zoom: computeMoveableZoom(),
      origin: false,
    })

    // 单选拖拽
    moveable.on('dragStart', ({ target: el, set }) => {
      const id = (el as HTMLElement).dataset.layerId
      if (!id) return
      const layer = store.doc.layers[id]
      if (!layer) return
      activeDragLayerId = id
      dragChanged = false
      set([layer.x, layer.y])
    })

    moveable.on('drag', ({ target: el, beforeTranslate }) => {
      const id = (el as HTMLElement).dataset.layerId || activeDragLayerId
      if (!id) return
      const layer = store.doc.layers[id]
      if (!layer) return
      const nx = Math.round(beforeTranslate[0])
      const ny = Math.round(beforeTranslate[1])
      layer.x = nx
      layer.y = ny
      el.style.transform = `translate3d(${nx}px, ${ny}px, 0) rotate(${layer.rotation}deg)`
      dragChanged = true
    })

    moveable.on('dragEnd', () => {
      if (dragChanged) store.pushHistory()
      dragChanged = false
      activeDragLayerId = null
    })

    // 单选缩放（按住 Ctrl 或 Shift 锁定固定比例；组图层默认按比例联动缩放子树）
    moveable.on('resizeStart', ({ target: el, dragStart, inputEvent }) => {
      const ev = inputEvent as MouseEvent | PointerEvent | undefined
      if (ev) syncRatioLockKey(Boolean(ev.shiftKey || ev.ctrlKey))
      const id = (el as HTMLElement).dataset.layerId
      if (!id) return
      const layer = store.doc.layers[id]
      if (!layer) return
      activeDragLayerId = id
      dragChanged = false
      if (layer.type === 'group' && layer.group.scaleChildren !== false) {
        activeGroupResize = {
          groupId: id,
          startWidth: Math.max(1, layer.width),
          startHeight: Math.max(1, layer.height),
          snapshot: captureGroupSubtreeScaleSnapshot(store.doc, id),
        }
      } else {
        activeGroupResize = null
      }
      if (dragStart) dragStart.set([layer.x, layer.y])
    })

    moveable.on('resize', ({ target: el, width, height, drag, inputEvent }) => {
      const ev = inputEvent as MouseEvent | PointerEvent | undefined
      if (ev) syncRatioLockKey(Boolean(ev.shiftKey || ev.ctrlKey))
      const id = (el as HTMLElement).dataset.layerId || activeDragLayerId
      if (!id) return
      const layer = store.doc.layers[id]
      if (!layer) return
      const nw = Math.max(24, Math.round(width))
      const nh = Math.max(24, Math.round(height))
      const nx = Math.round(drag.beforeTranslate[0])
      const ny = Math.round(drag.beforeTranslate[1])
      layer.width = nw
      layer.height = nh
      layer.x = nx
      layer.y = ny
      el.style.width = `${nw}px`
      el.style.height = `${nh}px`
      el.style.transform = `translate3d(${nx}px, ${ny}px, 0) rotate(${layer.rotation}deg)`

      if (activeGroupResize && activeGroupResize.groupId === id) {
        const scaleX = nw / activeGroupResize.startWidth
        const scaleY = nh / activeGroupResize.startHeight
        applyGroupSubtreeScale(store.doc, activeGroupResize.snapshot, scaleX, scaleY)
      }
      dragChanged = true
    })

    moveable.on('resizeEnd', () => {
      activeGroupResize = null
      if (dragChanged) store.pushHistory()
      dragChanged = false
      activeDragLayerId = null
    })

    // 单选旋转
    moveable.on('rotateStart', ({ target: el, set }) => {
      const id = (el as HTMLElement).dataset.layerId
      if (!id) return
      const layer = store.doc.layers[id]
      if (!layer) return
      activeDragLayerId = id
      dragChanged = false
      set(layer.rotation)
    })

    moveable.on('rotate', ({ target: el, beforeRotate }) => {
      const id = (el as HTMLElement).dataset.layerId || activeDragLayerId
      if (!id) return
      const layer = store.doc.layers[id]
      if (!layer) return
      const nr = Math.round(beforeRotate % 360)
      layer.rotation = nr
      el.style.transform = `translate3d(${layer.x}px, ${layer.y}px, 0) rotate(${nr}deg)`
      dragChanged = true
    })

    moveable.on('rotateEnd', () => {
      if (dragChanged) store.pushHistory()
      dragChanged = false
      activeDragLayerId = null
    })

    // 多选拖拽
    moveable.on('dragGroupStart', ({ events }) => {
      dragChanged = false
      for (const ev of events) {
        const id = (ev.target as HTMLElement).dataset.layerId
        const layer = id ? store.doc.layers[id] : undefined
        if (layer) ev.set([layer.x, layer.y])
      }
    })

    moveable.on('dragGroup', ({ events }) => {
      for (const ev of events) {
        const id = (ev.target as HTMLElement).dataset.layerId
        const layer = id ? store.doc.layers[id] : undefined
        if (!layer) continue
        const nx = Math.round(ev.beforeTranslate[0])
        const ny = Math.round(ev.beforeTranslate[1])
        layer.x = nx
        layer.y = ny
        ev.target.style.transform = `translate3d(${nx}px, ${ny}px, 0) rotate(${layer.rotation}deg)`
        dragChanged = true
      }
    })

    moveable.on('dragGroupEnd', () => {
      if (dragChanged) store.pushHistory()
      dragChanged = false
    })
  } else {
    moveable.target = target
    moveable.keepRatio = isRatioLockKeyDown.value
    moveable.snappable = store.snapEnabled
    moveable.verticalGuidelines = guidelines.vertical
    moveable.horizontalGuidelines = guidelines.horizontal
    moveable.elementGuidelines = queryElementGuidelines(desiredContainer, commonParentGroupId)
    moveable.zoom = computeMoveableZoom()
    moveable.updateRect()
  }
}

// 视口首次测量就绪、拖分割条或更改画布分辨率时，保持 16:9 完整可见不裁切
watch(
  [vpWidth, vpHeight, () => store.doc.canvas.width, () => store.doc.canvas.height],
  ([w, h]) => {
    if (autoFit.value && w >= 80 && h >= 80) {
      fitCanvasToViewport(false)
    }
  },
  { immediate: true },
)

watch(
  [
    () => store.selectedLayerIds.join(','),
    () => store.editingGroupId,
    () => store.doc.activeSceneId,
    () => store.interactionMode,
    () => store.snapEnabled,
    () => store.zoom,
    () => store.doc.canvas.width,
    () => store.doc.canvas.height,
    () => {
      const l = store.selectedLayer
      return l ? `${l.x}:${l.y}:${l.width}:${l.height}:${l.rotation}:${l.locked}:${l.visible}` : ''
    },
  ],
  async () => {
    await nextTick()
    syncMoveable()
  },
)

function getStageElement(): HTMLElement | null {
  return stageHostRef.value?.querySelector<HTMLElement>('.obs-scene-stage') ?? null
}

function isMoveableHandleTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest('.moveable-control') ||
      target.closest('.moveable-rotation-control') ||
      target.closest('.moveable-line'),
  )
}

function selectSingleLayer(layerId: string, syncGroupScope = true) {
  store.selectedLayerIds = [layerId]
  if (syncGroupScope) {
    store.editingGroupId = getParentGroupId(store.doc, layerId)
  }
  store.editingScope = isLayerInGlobalScope(store.doc, layerId) ? 'global' : 'scene'
}

/**
 * 在编辑态 select 模式下，解析左键点击应选中的目标图层：
 * - 自动穿透已锁定图层（含锁定组）
 * - Alt+点击：无视组边界与空心框，在光标下所有未锁定重叠图层间逐层循环穿透
 * - 普通点击：优先跳过未选中空心装饰框内部空白区，命中下层组件；命中组内元素时按当前 editingGroupId 归属选中
 */
function handleCanvasSelectPointerDown(e: PointerEvent) {
  if (e.button !== 0 || isSpaceDown.value || store.interactionMode !== 'select') return
  if (isMoveableHandleTarget(e.target)) return
  if (contextMenu.value.open) contextMenu.value.open = false

  const stageEl = getStageElement()
  if (!stageEl) return

  const hits = collectHitLayersAtClientPoint(store.doc, stageEl, e.clientX, e.clientY)
  const unlockedHits = hits.filter((h) => !h.effectivelyLocked)

  // 1. Alt + 点击：逐层深度穿透切换选中
  if (e.altKey) {
    const deepCandidates: HitLayerEntry[] = []
    const seen = new Set<string>()
    for (const h of unlockedHits) {
      if (h.layer.type === 'group' && h.layer.group.childIds.length > 0) continue
      if (seen.has(h.layerId)) continue
      seen.add(h.layerId)
      deepCandidates.push(h)
    }
    if (deepCandidates.length === 0) {
      store.selectedLayerIds = []
      store.editingGroupId = null
      return
    }
    const currentId = store.selectedLayerIds.length === 1 ? store.selectedLayerIds[0] : null
    const curIdx = currentId ? deepCandidates.findIndex((c) => c.layerId === currentId) : -1
    const nextEntry = deepCandidates[(curIdx + 1) % deepCandidates.length]
    selectSingleLayer(nextEntry.layerId, true)
    // 阻止 Moveable 立即开始拖拽旧目标
    e.stopPropagation()
    return
  }

  // 2. 普通点击 / Shift / Ctrl 多选：按当前 editingGroupId 汇总去重候选目标
  const scopedTargets: Array<{
    targetId: string
    nextEditingGroupId: string | null
    hasSolidHit: boolean
  }> = []
  const byTarget = new Map<string, (typeof scopedTargets)[number]>()

  for (const h of unlockedHits) {
    const resolved = resolveTargetAtEditingScope(store.doc, h.layerId, store.editingGroupId)
    // 组自身的空白命中不算实心命中；组内子图层的非空心命中算组实心命中
    const solidHit = !h.isHollowInterior
    const existing = byTarget.get(resolved.targetId)
    if (existing) {
      if (solidHit) existing.hasSolidHit = true
    } else {
      const item = {
        targetId: resolved.targetId,
        nextEditingGroupId: resolved.nextEditingGroupId,
        hasSolidHit: solidHit,
      }
      byTarget.set(resolved.targetId, item)
      scopedTargets.push(item)
    }
  }

  if (scopedTargets.length === 0) {
    // 空白区域左键拖拽启动框选多选；轻点则清空选中
    marquee.value = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      curX: e.clientX,
      curY: e.clientY,
      additive: Boolean(e.shiftKey || e.ctrlKey || e.metaKey),
      baseIds: [...store.selectedLayerIds],
      pointerId: e.pointerId,
    }
    viewportRef.value?.setPointerCapture(e.pointerId)
    if (!marquee.value.additive) {
      store.selectedLayerIds = []
      store.editingGroupId = null
    }
    return
  }

  // 空心装饰框内部点击穿透：优先选第一个实心命中，或已选中的目标；全为空心时退回顶层避免点不中
  const picked =
    scopedTargets.find((t) => t.hasSolidHit || store.selectedLayerIds.includes(t.targetId)) ?? scopedTargets[0]

  if (e.shiftKey || e.ctrlKey || e.metaKey) {
    if (store.selectedLayerIds.includes(picked.targetId)) {
      store.selectedLayerIds = store.selectedLayerIds.filter((id) => id !== picked.targetId)
    } else {
      store.selectedLayerIds = [...store.selectedLayerIds, picked.targetId]
    }
    store.editingGroupId = picked.nextEditingGroupId
    store.editingScope = isLayerInGlobalScope(store.doc, picked.targetId) ? 'global' : 'scene'
    e.stopPropagation()
    return
  }

  const alreadySelectedSingle =
    store.selectedLayerIds.length === 1 && store.selectedLayerIds[0] === picked.targetId
  if (!alreadySelectedSingle) {
    store.selectedLayerIds = [picked.targetId]
    store.editingGroupId = picked.nextEditingGroupId
    store.editingScope = isLayerInGlobalScope(store.doc, picked.targetId) ? 'global' : 'scene'
    // 新选中目标与 Moveable 当前旧 target 不同时，阻止旧 target 响应本次 pointerdown
    e.stopPropagation()
  }
}

/** 双击画布进入组内编辑子图层（支持嵌套逐级深入） */
function onViewportDblClick(e: MouseEvent) {
  if (store.interactionMode !== 'select' || isMoveableHandleTarget(e.target)) return
  const stageEl = getStageElement()
  if (!stageEl) return

  const hits = collectHitLayersAtClientPoint(store.doc, stageEl, e.clientX, e.clientY).filter(
    (h) => !h.effectivelyLocked,
  )
  const leaf = hits.find((h) => h.layer.type !== 'group') ?? hits[0]
  if (!leaf) return

  const chain = leaf.layer.type === 'group' ? [...leaf.ancestorGroupIds, leaf.layerId] : leaf.ancestorGroupIds
  if (chain.length === 0) return

  if (!store.editingGroupId) {
    const enterId = chain[0]
    const childToSelect = chain[1] ?? leaf.layerId
    store.enterGroupEdit(enterId, childToSelect === enterId ? undefined : childToSelect)
  } else {
    const idx = chain.indexOf(store.editingGroupId)
    if (idx >= 0 && idx + 1 < chain.length) {
      const nextGroupId = chain[idx + 1]
      const childToSelect = chain[idx + 2] ?? leaf.layerId
      store.enterGroupEdit(nextGroupId, childToSelect === nextGroupId ? undefined : childToSelect)
    }
  }
}

/** 右键弹出画布上下文菜单（含重叠图层穿透选择列表） */
function onViewportContextMenu(e: MouseEvent) {
  if (store.interactionMode !== 'select') return
  e.preventDefault()

  const stageEl = getStageElement()
  const hits = stageEl ? collectHitLayersAtClientPoint(store.doc, stageEl, e.clientX, e.clientY) : []

  // 若右键位置未命中已选图层，自动按顶层未锁定层预选以便直接执行常用操作
  const unlockedHits = hits.filter((h) => !h.effectivelyLocked)
  if (unlockedHits.length > 0) {
    const firstResolved = resolveTargetAtEditingScope(store.doc, unlockedHits[0].layerId, store.editingGroupId)
    const hitAlreadySelected = unlockedHits.some(
      (h) =>
        store.selectedLayerIds.includes(h.layerId) ||
        h.ancestorGroupIds.some((gid) => store.selectedLayerIds.includes(gid)),
    )
    if (!hitAlreadySelected && store.selectedLayerIds.length <= 1) {
      store.selectedLayerIds = [firstResolved.targetId]
      store.editingGroupId = firstResolved.nextEditingGroupId
    }
  }

  contextMenu.value = {
    open: true,
    x: e.clientX,
    y: e.clientY,
    hits,
  }
}

function shouldStartPan(button: number): boolean {
  return button === 1 || (isSpaceDown.value && button === 0)
}

function onViewportMouseDownCapture(e: MouseEvent) {
  // 捕获阶段先拦截中键与 Space+左键，阻止浏览器中键自动滚屏及 Moveable 在已选图层上误触发拖拽
  if (shouldStartPan(e.button)) {
    e.preventDefault()
    e.stopPropagation()
  }
}

function onViewportPointerDownCapture(e: PointerEvent) {
  if (shouldStartPan(e.button)) {
    isPanning.value = true
    panPointerId = e.pointerId
    panStartClientX = e.clientX
    panStartClientY = e.clientY
    panStartX = store.panX
    panStartY = store.panY
    viewportRef.value?.setPointerCapture(e.pointerId)
    e.preventDefault()
    e.stopPropagation()
    return
  }

  // 编辑态左键点击：在捕获阶段优先做穿透命中检测（处理锁定穿透、空心装饰框穿透、Alt+点击逐层切换）
  if (e.button === 0 && store.interactionMode === 'select') {
    const target = e.target as HTMLElement | null
    // 顶部面包屑或浮层按钮放行
    if (target?.closest('[data-viewport-overlay]')) return
    handleCanvasSelectPointerDown(e)
  }
}

function updateMarqueeSelection() {
  const stageEl = getStageElement()
  if (!stageEl) return
  const mLeft = Math.min(marquee.value.startX, marquee.value.curX)
  const mRight = Math.max(marquee.value.startX, marquee.value.curX)
  const mTop = Math.min(marquee.value.startY, marquee.value.curY)
  const mBottom = Math.max(marquee.value.startY, marquee.value.curY)

  // 仅框选当前编辑层级的未锁定可见图层（组内编辑时框选组内子项，画布根级时框选当前场景/全局顶层）
  let candidateIds: string[] = []
  if (store.editingGroupId) {
    const grp = store.doc.layers[store.editingGroupId]
    if (grp?.type === 'group') candidateIds = grp.group.childIds
  } else {
    const sceneIds = store.activeScene?.layerIds ?? []
    candidateIds = [...sceneIds, ...store.doc.globalLayerIds]
  }

  const matchedIds: string[] = []
  for (const id of candidateIds) {
    const layer = store.doc.layers[id]
    if (!layer || !layer.visible || isLayerEffectivelyLocked(store.doc, id)) continue
    const el = stageEl.querySelector<HTMLElement>(`[data-layer-id="${id}"]`)
    if (!el) continue
    const r = el.getBoundingClientRect()
    const intersects = r.right >= mLeft && r.left <= mRight && r.bottom >= mTop && r.top <= mBottom
    if (intersects) matchedIds.push(id)
  }

  if (marquee.value.additive) {
    const merged = new Set([...marquee.value.baseIds, ...matchedIds])
    store.selectedLayerIds = [...merged]
  } else {
    store.selectedLayerIds = matchedIds
  }
}

function onViewportPointerMove(e: PointerEvent) {
  if (marquee.value.active) {
    if (marquee.value.pointerId !== null && e.pointerId !== marquee.value.pointerId) return
    marquee.value.curX = e.clientX
    marquee.value.curY = e.clientY
    if (
      !marquee.value.moved &&
      (Math.abs(e.clientX - marquee.value.startX) >= 4 || Math.abs(e.clientY - marquee.value.startY) >= 4)
    ) {
      marquee.value.moved = true
    }
    if (marquee.value.moved) {
      updateMarqueeSelection()
    }
    return
  }

  if (!isPanning.value) return
  if (panPointerId !== null && e.pointerId !== panPointerId) return
  autoFit.value = false
  store.panX = Math.round(panStartX + (e.clientX - panStartClientX))
  store.panY = Math.round(panStartY + (e.clientY - panStartClientY))
}

function stopPanning(e?: PointerEvent) {
  if (marquee.value.active && (!e || marquee.value.pointerId === null || e.pointerId === marquee.value.pointerId)) {
    if (marquee.value.pointerId !== null && viewportRef.value?.hasPointerCapture(marquee.value.pointerId)) {
      viewportRef.value.releasePointerCapture(marquee.value.pointerId)
    }
    marquee.value.active = false
    marquee.value.moved = false
    marquee.value.pointerId = null
  }

  if (e && panPointerId !== null && e.pointerId !== panPointerId) return
  if (panPointerId !== null && viewportRef.value?.hasPointerCapture(panPointerId)) {
    viewportRef.value.releasePointerCapture(panPointerId)
  }
  panPointerId = null
  isPanning.value = false
}

function onViewportWheel(e: WheelEvent) {
  if (contextMenu.value.open) contextMenu.value.open = false
  // 交互模式下，光标在图层内部且未按 Ctrl/Meta 时放行给组件自身滚动
  if (store.interactionMode === 'interact' && !e.ctrlKey && !e.metaKey) {
    const target = e.target as HTMLElement | null
    if (target?.closest('[data-layer-id]')) return
  }

  e.preventDefault()
  if (e.deltaY === 0) return

  const oldZoom = store.zoom
  const factor = e.ctrlKey
    ? Math.exp(-e.deltaY * 0.008)
    : e.deltaY > 0
      ? 1 / 1.1
      : 1.1
  const nextZoom = Math.min(4, Math.max(0.1, Math.round(oldZoom * factor * 1000) / 1000))
  if (nextZoom === oldZoom) return

  autoFit.value = false
  const vp = viewportRef.value
  if (vp) {
    const rect = vp.getBoundingClientRect()
    const mx = e.clientX - (rect.left + rect.width / 2)
    const my = e.clientY - (rect.top + rect.height / 2)
    const ratio = nextZoom / oldZoom
    store.panX = Math.round(mx - (mx - store.panX) * ratio)
    store.panY = Math.round(my - (my - store.panY) * ratio)
  }
  store.zoom = nextZoom
}

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function onKeyDown(e: KeyboardEvent) {
  syncRatioLockKey(Boolean(e.shiftKey || e.ctrlKey))

  if (e.code === 'Space' && !isEditableTarget(e.target)) {
    isSpaceDown.value = true
    e.preventDefault()
    return
  }

  if (isEditableTarget(e.target)) return

  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) store.redo()
    else store.undo()
    return
  }
  if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    store.redo()
    return
  }
  if (mod && e.key.toLowerCase() === 'g') {
    e.preventDefault()
    if (e.shiftKey) {
      if (store.selectedLayer?.type === 'group') {
        store.ungroupLayer(store.selectedLayer.id)
      }
    } else if (store.canGroupSelected) {
      store.groupSelectedLayers()
    }
    return
  }
  if (mod && e.key.toLowerCase() === 'd' && store.selectedLayerIds.length === 1) {
    e.preventDefault()
    store.duplicateLayer(store.selectedLayerIds[0])
    return
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && store.selectedLayerIds.length > 0) {
    e.preventDefault()
    store.deleteLayers([...store.selectedLayerIds])
    return
  }
  if (e.key === 'Escape') {
    if (contextMenu.value.open) {
      contextMenu.value.open = false
      return
    }
    if (store.editingGroupId) {
      store.exitGroupEdit()
      return
    }
    store.selectedLayerIds = []
    return
  }

  // 方向键微调（Shift + 10px）
  if (
    store.selectedLayerIds.length > 0 &&
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
  ) {
    e.preventDefault()
    const step = e.shiftKey ? 10 : 1
    const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
    const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
    let moved = false
    for (const id of store.selectedLayerIds) {
      const layer = store.doc.layers[id]
      if (!layer || isLayerEffectivelyLocked(store.doc, id)) continue
      layer.x += dx
      layer.y += dy
      moved = true
    }
    if (moved) {
      store.pushHistory()
      void nextTick(() => moveable?.updateRect())
    }
  }
}

function onKeyUp(e: KeyboardEvent) {
  syncRatioLockKey(Boolean(e.shiftKey || e.ctrlKey))
  if (e.code === 'Space') {
    isSpaceDown.value = false
    stopPanning()
  }
}

function onWindowBlur() {
  isSpaceDown.value = false
  syncRatioLockKey(false)
  stopPanning()
}

onMounted(async () => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onWindowBlur)
  await nextTick()
  fitCanvasToViewport()
  syncMoveable()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', onWindowBlur)
  destroyMoveable()
})
</script>

<template>
  <div
    ref="viewportRef"
    class="relative w-full h-full overflow-hidden flex-center bg-muted/40 select-none"
    :class="{
      'cursor-grab': isSpaceDown && !isPanning,
      'cursor-grabbing': isPanning,
    }"
    @mousedown.capture="onViewportMouseDownCapture"
    @pointerdown.capture="onViewportPointerDownCapture"
    @pointermove="onViewportPointerMove"
    @pointerup="stopPanning"
    @pointercancel="stopPanning"
    @lostpointercapture="stopPanning()"
    @dblclick="onViewportDblClick"
    @contextmenu="onViewportContextMenu"
    @auxclick.prevent
    @wheel="onViewportWheel"
  >
    <!-- 缩放与平移后的逻辑画布壳 -->
    <div
      ref="stageHostRef"
      class="relative shrink-0 shadow-2xl ring-1 ring-border/80 obs-checkerboard"
      :style="stageWrapperStyle"
    >
      <ObsSceneRenderer
        :doc="store.doc"
        :owner-user-id="ownerUserId"
        mode="edit"
        :selected-layer-ids="store.selectedLayerIds"
        :editing-group-id="store.editingGroupId"
        :interaction-mode="store.interactionMode"
        :show-grid="store.showGrid"
        :reference-items="props.referenceItems"
        :reference-canvas-size="props.referenceCanvasSize"
        :show-reference-overlay="props.showReferenceOverlay"
      />
    </div>

    <!-- 组内编辑面包屑指示条 -->
    <div
      v-if="editingGroupBreadcrumb.length > 0"
      data-viewport-overlay
      class="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-primary/35 bg-background/92 px-3 py-1 text-xs shadow-md backdrop-blur"
    >
      <button
        type="button"
        class="text-muted-foreground hover:text-foreground transition-colors"
        @click="store.editingGroupId = null"
      >
        画布
      </button>
      <template v-for="(grp, idx) in editingGroupBreadcrumb" :key="grp.id">
        <ChevronRight class="w-3 h-3 text-muted-foreground" />
        <button
          type="button"
          class="flex items-center gap-1 transition-colors"
          :class="idx === editingGroupBreadcrumb.length - 1 ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground'"
          @click="store.editingGroupId = grp.id"
        >
          <FolderOpen class="w-3 h-3" />
          <span>{{ grp.name }}</span>
        </button>
      </template>
      <Button
        variant="ghost"
        size="none"
        class="ml-1 w-4 h-4 rounded-full flex-center [&_svg]:size-3"
        title="退出组编辑 (Esc)"
        @click="store.exitGroupEdit()"
      >
        <X />
      </Button>
    </div>

    <!-- 画布框选多选矩形 -->
    <div
      v-if="marqueeBoxStyle"
      class="pointer-events-none absolute z-30 border border-primary bg-primary/15 rounded-[2px]"
      :style="marqueeBoxStyle"
    />

    <!-- 左下角操作提示条 -->
    <div
      class="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-border bg-background/85 px-2.5 py-1 text-[11px] text-muted-foreground backdrop-blur"
    >
      <span>{{ store.doc.canvas.width }}×{{ store.doc.canvas.height }}</span>
      <span>·</span>
      <span>{{ Math.round(store.zoom * 100) }}%</span>
      <span>·</span>
      <span>空白拖拽框选 / Alt+点击穿透 / 右键选层与分组 / Ctrl+G编组</span>
    </div>

    <!-- 画布右键上下文菜单 -->
    <SceneCanvasContextMenu
      :open="contextMenu.open"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :doc="store.doc"
      :hit-entries="contextMenu.hits"
      :selected-layer-ids="store.selectedLayerIds"
      :editing-group-id="store.editingGroupId"
      :can-group-selected="store.canGroupSelected"
      @close="contextMenu.open = false"
      @select-layer="(id) => selectSingleLayer(id, true)"
      @create-empty-group="store.addEmptyGroup()"
      @group-selected="store.groupSelectedLayers()"
      @ungroup="(gid) => store.ungroupLayer(gid)"
      @enter-group="(gid) => store.enterGroupEdit(gid)"
      @exit-group="store.exitGroupEdit()"
      @fit-group-bounds="(gid) => store.fitGroupBounds(gid)"
      @move-out-of-group="(id) => store.moveLayerOutOfGroup(id)"
      @move-into-group="(ids, gid) => store.moveLayersIntoGroup(ids, gid)"
      @move-z-order="(id, action) => store.moveLayerZOrder(id, action)"
      @toggle-lock="(id) => { const l = store.doc.layers[id]; if (l) store.updateLayer(id, { locked: !l.locked }) }"
      @hide-layer="(id) => store.updateLayer(id, { visible: false })"
      @duplicate-layer="(id) => store.duplicateLayer(id)"
      @delete-selected="store.deleteLayers([...store.selectedLayerIds])"
    />
  </div>
</template>

<style scoped>
.obs-checkerboard {
  background-color: #0f172a;
  background-image:
    linear-gradient(45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.04) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.04) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.04) 75%);
  background-size: 24px 24px;
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
}
</style>
