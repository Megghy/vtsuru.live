import type { GroupLayer, ObsSceneDocument, ObsSceneLayer } from '../types'
import { createGroupLayer, createShortId } from '../types'

export interface ParentContainerRef {
  kind: 'scene' | 'global' | 'group'
  ownerId: string
  list: string[]
  index: number
}

export interface Point2D {
  x: number
  y: number
}

export interface SubtreeScaleEntry {
  x: number
  y: number
  width: number
  height: number
  fontSize?: number
}

export type SubtreeScaleSnapshot = Record<string, SubtreeScaleEntry>

export function normalizeAngleDeg(deg: number): number {
  const normalized = ((deg % 360) + 360) % 360
  return normalized > 180 ? normalized - 360 : normalized
}

/** 将图层局部坐标 (lx, ly) 映射到父容器坐标系 */
export function localPointToParent(layer: ObsSceneLayer, lx: number, ly: number): Point2D {
  const cx = layer.width / 2
  const cy = layer.height / 2
  const dx = lx - cx
  const dy = ly - cy
  const rad = ((layer.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: layer.x + cx + dx * cos - dy * sin,
    y: layer.y + cy + dx * sin + dy * cos,
  }
}

/** 将父容器坐标 (px, py) 逆变换到图层局部坐标系 */
export function parentPointToLocal(layer: ObsSceneLayer, px: number, py: number): Point2D {
  const cx = layer.width / 2
  const cy = layer.height / 2
  const dx = px - (layer.x + cx)
  const dy = py - (layer.y + cy)
  const rad = (-(layer.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  }
}

/** 计算单个图层（含旋转）在父坐标系中的 4 个角点 */
export function getLayerCornersInParent(layer: ObsSceneLayer): Point2D[] {
  return [
    localPointToParent(layer, 0, 0),
    localPointToParent(layer, layer.width, 0),
    localPointToParent(layer, layer.width, layer.height),
    localPointToParent(layer, 0, layer.height),
  ]
}

/** 计算多个同父级图层在父坐标系中的联合外包围盒 */
export function computeBoundingBox(layers: ObsSceneLayer[]): { x: number; y: number; width: number; height: number } {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const layer of layers) {
    for (const pt of getLayerCornersInParent(layer)) {
      if (pt.x < minX) minX = pt.x
      if (pt.y < minY) minY = pt.y
      if (pt.x > maxX) maxX = pt.x
      if (pt.y > maxY) maxY = pt.y
    }
  }

  if (!Number.isFinite(minX)) {
    return { x: 0, y: 0, width: 200, height: 120 }
  }
  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.max(24, Math.round(maxX - minX)),
    height: Math.max(24, Math.round(maxY - minY)),
  }
}

/** 查找任意图层所在的直接父容器（场景根 / 全局根 / 某个 GroupLayer） */
export function findParentContainer(doc: ObsSceneDocument, layerId: string): ParentContainerRef | null {
  const globalIdx = doc.globalLayerIds.indexOf(layerId)
  if (globalIdx >= 0) {
    return { kind: 'global', ownerId: 'global', list: doc.globalLayerIds, index: globalIdx }
  }
  for (const scene of Object.values(doc.scenes)) {
    const idx = scene.layerIds.indexOf(layerId)
    if (idx >= 0) {
      return { kind: 'scene', ownerId: scene.id, list: scene.layerIds, index: idx }
    }
  }
  for (const layer of Object.values(doc.layers)) {
    if (layer.type !== 'group') continue
    const idx = layer.group.childIds.indexOf(layerId)
    if (idx >= 0) {
      return { kind: 'group', ownerId: layer.id, list: layer.group.childIds, index: idx }
    }
  }
  return null
}

/** 获取从最外层祖先组到直接父组的 ID 列表 */
export function getAncestorGroupIds(doc: ObsSceneDocument, layerId: string): string[] {
  const ancestors: string[] = []
  const visited = new Set<string>([layerId])
  let cur = layerId
  while (true) {
    const parent = findParentContainer(doc, cur)
    if (!parent || parent.kind !== 'group' || visited.has(parent.ownerId)) break
    visited.add(parent.ownerId)
    ancestors.unshift(parent.ownerId)
    cur = parent.ownerId
  }
  return ancestors
}

export function getParentGroupId(doc: ObsSceneDocument, layerId: string): string | null {
  const parent = findParentContainer(doc, layerId)
  return parent?.kind === 'group' ? parent.ownerId : null
}

export function isDescendantOf(doc: ObsSceneDocument, ancestorId: string, targetId: string): boolean {
  if (ancestorId === targetId) return true
  return getAncestorGroupIds(doc, targetId).includes(ancestorId)
}

export function isLayerInGlobalScope(doc: ObsSceneDocument, layerId: string): boolean {
  const ancestors = getAncestorGroupIds(doc, layerId)
  const rootId = ancestors[0] ?? layerId
  return doc.globalLayerIds.includes(rootId)
}

export function isLayerEffectivelyLocked(doc: ObsSceneDocument, layerId: string): boolean {
  const layer = doc.layers[layerId]
  if (!layer) return false
  if (layer.locked) return true
  for (const gid of getAncestorGroupIds(doc, layerId)) {
    if (doc.layers[gid]?.locked) return true
  }
  return false
}

export function isLayerEffectivelyVisible(
  doc: ObsSceneDocument,
  layerId: string,
  visibilityOverride?: Record<string, boolean>,
): boolean {
  const checkOne = (id: string) => {
    if (visibilityOverride && id in visibilityOverride) return visibilityOverride[id]
    return doc.layers[id]?.visible !== false
  }
  if (!checkOne(layerId)) return false
  for (const gid of getAncestorGroupIds(doc, layerId)) {
    if (!checkOne(gid)) return false
  }
  return true
}

/** 递归收集节点及其全部后代图层 ID（包含自身） */
export function collectSubtreeLayerIds(doc: ObsSceneDocument, rootId: string): string[] {
  const out: string[] = []
  const visited = new Set<string>()
  const walk = (id: string) => {
    if (visited.has(id)) return
    const layer = doc.layers[id]
    if (!layer) return
    visited.add(id)
    out.push(id)
    if (layer.type === 'group') {
      for (const cid of layer.group.childIds) walk(cid)
    }
  }
  walk(rootId)
  return out
}

/** 将画布世界坐标转换为指定图层自身局部坐标 */
export function canvasPointToLayerLocal(doc: ObsSceneDocument, layerId: string, canvasX: number, canvasY: number): Point2D | null {
  const layer = doc.layers[layerId]
  if (!layer) return null
  const chain = [...getAncestorGroupIds(doc, layerId), layerId]
  let pt: Point2D = { x: canvasX, y: canvasY }
  for (const id of chain) {
    const node = doc.layers[id]
    if (!node) return null
    pt = parentPointToLocal(node, pt.x, pt.y)
  }
  return pt
}

/** 将某图层的中心点及累积旋转转换到画布世界坐标系 */
export function getLayerCenterAndRotationInCanvas(
  doc: ObsSceneDocument,
  layerId: string,
): { cx: number; cy: number; rotation: number } | null {
  const layer = doc.layers[layerId]
  if (!layer) return null
  const ancestors = getAncestorGroupIds(doc, layerId)
  let pt = localPointToParent(layer, layer.width / 2, layer.height / 2)
  let rotation = layer.rotation || 0
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const group = doc.layers[ancestors[i]]
    if (!group) return null
    pt = localPointToParent(group, pt.x, pt.y)
    rotation += group.rotation || 0
  }
  return { cx: pt.x, cy: pt.y, rotation: normalizeAngleDeg(rotation) }
}

/** 深拷贝图层子树（用于复制图层、复制组或复制子场景），返回新根节点 ID */
export function cloneLayerSubtree(
  doc: ObsSceneDocument,
  sourceId: string,
  offset?: { dx: number; dy: number; renameRoot?: boolean },
): string | null {
  const src = doc.layers[sourceId]
  if (!src) return null

  const cloneNode = (id: string, isRoot: boolean): string | null => {
    const node = doc.layers[id]
    if (!node) return null
    const copy = JSON.parse(JSON.stringify(node)) as ObsSceneLayer
    const newId = createShortId(copy.type === 'group' ? 'grp' : copy.type.slice(0, 3))
    copy.id = newId
    if (isRoot) {
      if (offset?.renameRoot) copy.name = `${node.name} 副本`
      if (offset) {
        copy.x = Math.round(node.x + offset.dx)
        copy.y = Math.round(node.y + offset.dy)
      }
    }
    if (copy.type === 'group') {
      const nextChildren: string[] = []
      for (const cid of copy.group.childIds) {
        const clonedCid = cloneNode(cid, false)
        if (clonedCid) nextChildren.push(clonedCid)
      }
      copy.group.childIds = nextChildren
    }
    doc.layers[newId] = copy
    return newId
  }

  return cloneNode(sourceId, true)
}

/** 校验给定图层列表是否共享同一父容器且可编组 */
export function resolveCommonParentForGrouping(doc: ObsSceneDocument, layerIds: string[]): ParentContainerRef | null {
  const uniqueIds = [...new Set(layerIds)].filter((id) => Boolean(doc.layers[id]))
  if (uniqueIds.length < 2) return null
  // obs-source 仅允许置于子场景顶层作为 Z 轴切分边界，不能编入分组
  if (uniqueIds.some((id) => doc.layers[id]?.type === 'obs-source')) return null
  const firstParent = findParentContainer(doc, uniqueIds[0])
  if (!firstParent) return null
  for (let i = 1; i < uniqueIds.length; i++) {
    const parent = findParentContainer(doc, uniqueIds[i])
    if (!parent || parent.kind !== firstParent.kind || parent.ownerId !== firstParent.ownerId) {
      return null
    }
  }
  return firstParent
}

/** 将同一父容器内的多个图层合并为一个新 GroupLayer */
export function groupLayersInDoc(doc: ObsSceneDocument, layerIds: string[], customName?: string): GroupLayer | null {
  const parent = resolveCommonParentForGrouping(doc, layerIds)
  if (!parent) return null

  const idSet = new Set(layerIds)
  // 保持子图层原有的从底到顶 Z 序
  const orderedIds = parent.list.filter((id) => idSet.has(id))
  if (orderedIds.length < 2) return null

  const memberLayers = orderedIds.map((id) => doc.layers[id]).filter((l): l is ObsSceneLayer => Boolean(l))
  const box = computeBoundingBox(memberLayers)

  const existingGroupCount = Object.values(doc.layers).filter((l) => l.type === 'group').length
  const group = createGroupLayer(customName?.trim() || `分组 ${existingGroupCount + 1}`, box, orderedIds)

  // 将成员坐标转为相对新组的局部坐标
  for (const child of memberLayers) {
    child.x = Math.round(child.x - box.x)
    child.y = Math.round(child.y - box.y)
  }

  // 在最高成员的位置插入新组，并移除成员原有占位
  const highestIndex = Math.max(...orderedIds.map((id) => parent.list.indexOf(id)))
  const before = parent.list.slice(0, highestIndex + 1).filter((id) => !idSet.has(id))
  const after = parent.list.slice(highestIndex + 1).filter((id) => !idSet.has(id))
  parent.list.splice(0, parent.list.length, ...before, group.id, ...after)

  doc.layers[group.id] = group
  return group
}

/** 解散指定 GroupLayer，将子图层还原回父容器坐标系（精确保留旋转与位置） */
export function ungroupLayerInDoc(doc: ObsSceneDocument, groupId: string): string[] {
  const group = doc.layers[groupId]
  if (!group || group.type !== 'group') return []
  const parent = findParentContainer(doc, groupId)
  if (!parent) return []

  const restoredIds: string[] = []
  for (const cid of group.group.childIds) {
    const child = doc.layers[cid]
    if (!child) continue
    const worldCenter = localPointToParent(group, child.x + child.width / 2, child.y + child.height / 2)
    child.x = Math.round(worldCenter.x - child.width / 2)
    child.y = Math.round(worldCenter.y - child.height / 2)
    child.rotation = normalizeAngleDeg((child.rotation || 0) + (group.rotation || 0))
    child.opacity = Number((child.opacity * group.opacity).toFixed(3))
    if (!group.visible) child.visible = false
    restoredIds.push(cid)
  }

  parent.list.splice(parent.index, 1, ...restoredIds)
  delete doc.layers[groupId]
  return restoredIds
}

/** 将组内某个子图层移出到该组的父容器（保持视觉位置与角度不变） */
export function moveLayerOutOfGroupInDoc(doc: ObsSceneDocument, layerId: string): boolean {
  const parent = findParentContainer(doc, layerId)
  if (!parent || parent.kind !== 'group') return false
  const group = doc.layers[parent.ownerId]
  const child = doc.layers[layerId]
  if (!group || group.type !== 'group' || !child) return false
  const grandParent = findParentContainer(doc, group.id)
  if (!grandParent) return false

  const centerInGrandParent = localPointToParent(group, child.x + child.width / 2, child.y + child.height / 2)
  child.x = Math.round(centerInGrandParent.x - child.width / 2)
  child.y = Math.round(centerInGrandParent.y - child.height / 2)
  child.rotation = normalizeAngleDeg((child.rotation || 0) + (group.rotation || 0))

  parent.list.splice(parent.index, 1)
  grandParent.list.splice(grandParent.index + 1, 0, layerId)
  return true
}

/** 将任意图层移入目标组（自动在画布坐标系中保持视觉位置和角度不变） */
export function moveLayerIntoGroupInDoc(
  doc: ObsSceneDocument,
  layerId: string,
  targetGroupId: string,
  insertIndex?: number,
): boolean {
  if (layerId === targetGroupId) return false
  const targetGroup = doc.layers[targetGroupId]
  const layer = doc.layers[layerId]
  if (!targetGroup || targetGroup.type !== 'group' || !layer) return false
  if (layer.type === 'obs-source') return false
  if (isDescendantOf(doc, layerId, targetGroupId)) return false

  const oldParent = findParentContainer(doc, layerId)
  if (!oldParent) return false
  if (oldParent.kind === 'group' && oldParent.ownerId === targetGroupId) return false

  const worldPos = getLayerCenterAndRotationInCanvas(doc, layerId)
  if (!worldPos) return false
  const targetLocalCenter = canvasPointToLayerLocal(doc, targetGroupId, worldPos.cx, worldPos.cy)
  if (!targetLocalCenter) return false

  const targetAncestors = [...getAncestorGroupIds(doc, targetGroupId), targetGroupId]
  let targetAccumRotation = 0
  for (const aid of targetAncestors) {
    targetAccumRotation += doc.layers[aid]?.rotation || 0
  }

  const wasEmpty = targetGroup.group.childIds.length === 0
  oldParent.list.splice(oldParent.index, 1)
  layer.x = Math.round(targetLocalCenter.x - layer.width / 2)
  layer.y = Math.round(targetLocalCenter.y - layer.height / 2)
  layer.rotation = normalizeAngleDeg(worldPos.rotation - targetAccumRotation)

  if (insertIndex !== undefined) {
    const clamped = Math.max(0, Math.min(insertIndex, targetGroup.group.childIds.length))
    targetGroup.group.childIds.splice(clamped, 0, layerId)
  } else {
    targetGroup.group.childIds.push(layerId)
  }

  if (wasEmpty) {
    fitGroupBoundsToChildrenInDoc(doc, targetGroupId)
  }
  return true
}

/** 将任意图层移动到指定容器（父分组或根列表）并保持画布视觉位置与旋转不变 */
export function moveLayerToContainerInDoc(
  doc: ObsSceneDocument,
  layerId: string,
  targetScope: 'scene' | 'global',
  targetGroupId: string | null,
  insertIndex?: number,
): boolean {
  if (targetGroupId) {
    return moveLayerIntoGroupInDoc(doc, layerId, targetGroupId, insertIndex)
  }

  const layer = doc.layers[layerId]
  if (!layer) return false
  if (layer.type === 'obs-source' && targetScope === 'global') return false
  const oldParent = findParentContainer(doc, layerId)
  if (!oldParent) return false

  const targetList =
    targetScope === 'global' ? doc.globalLayerIds : doc.scenes[doc.activeSceneId]?.layerIds
  if (!targetList) return false
  if (oldParent.list === targetList) return false

  const worldPos = getLayerCenterAndRotationInCanvas(doc, layerId)
  if (!worldPos) return false

  oldParent.list.splice(oldParent.index, 1)
  layer.x = Math.round(worldPos.cx - layer.width / 2)
  layer.y = Math.round(worldPos.cy - layer.height / 2)
  layer.rotation = normalizeAngleDeg(worldPos.rotation)

  if (insertIndex !== undefined) {
    const clamped = Math.max(0, Math.min(insertIndex, targetList.length))
    targetList.splice(clamped, 0, layerId)
  } else {
    targetList.push(layerId)
  }
  return true
}

/** 重新收紧组的边界盒以贴合全部子图层（补偿子图层局部坐标，视觉零位移） */
export function fitGroupBoundsToChildrenInDoc(doc: ObsSceneDocument, groupId: string): boolean {
  const group = doc.layers[groupId]
  if (!group || group.type !== 'group' || group.group.childIds.length === 0) return false
  const children = group.group.childIds
    .map((cid) => doc.layers[cid])
    .filter((l): l is ObsSceneLayer => Boolean(l))
  if (children.length === 0) return false

  const box = computeBoundingBox(children)
  if (box.x === 0 && box.y === 0 && box.width === group.width && box.height === group.height) {
    return false
  }

  // 先算出新边界中心在父坐标系里的目标位置，确保带旋转的组也能精准贴合不跳动
  const newCenterInParent = localPointToParent(group, box.x + box.width / 2, box.y + box.height / 2)
  group.width = box.width
  group.height = box.height
  group.x = Math.round(newCenterInParent.x - box.width / 2)
  group.y = Math.round(newCenterInParent.y - box.height / 2)

  for (const child of children) {
    child.x = Math.round(child.x - box.x)
    child.y = Math.round(child.y - box.y)
  }
  return true
}

/** 拍摄组内所有后代图层的缩放基准快照（用于拖动缩放组时避免累计舍入误差） */
export function captureGroupSubtreeScaleSnapshot(doc: ObsSceneDocument, groupId: string): SubtreeScaleSnapshot {
  const snapshot: SubtreeScaleSnapshot = {}
  const walk = (id: string) => {
    const node = doc.layers[id]
    if (!node || node.type !== 'group') return
    for (const cid of node.group.childIds) {
      const child = doc.layers[cid]
      if (!child) continue
      const entry: SubtreeScaleEntry = {
        x: child.x,
        y: child.y,
        width: child.width,
        height: child.height,
      }
      if (child.type === 'text') entry.fontSize = child.text.fontSize
      else if (child.type === 'marquee' && child.marquee.mode === 'text') entry.fontSize = child.marquee.fontSize
      snapshot[cid] = entry
      if (child.type === 'group') walk(cid)
    }
  }
  walk(groupId)
  return snapshot
}

/** 根据快照将组内所有后代图层按 (scaleX, scaleY) 联动缩放 */
export function applyGroupSubtreeScale(
  doc: ObsSceneDocument,
  snapshot: SubtreeScaleSnapshot,
  scaleX: number,
  scaleY: number,
) {
  const fontScale = Math.sqrt(Math.max(0.05, scaleX * scaleY))
  for (const [id, base] of Object.entries(snapshot)) {
    const child = doc.layers[id]
    if (!child) continue
    child.x = Math.round(base.x * scaleX)
    child.y = Math.round(base.y * scaleY)
    child.width = Math.max(12, Math.round(base.width * scaleX))
    child.height = Math.max(12, Math.round(base.height * scaleY))
    if (base.fontSize !== undefined) {
      if (child.type === 'text') {
        child.text.fontSize = Math.max(10, Math.min(240, Math.round(base.fontSize * fontScale)))
      } else if (child.type === 'marquee' && child.marquee.mode === 'text') {
        child.marquee.fontSize = Math.max(10, Math.min(180, Math.round(base.fontSize * fontScale)))
      }
    }
  }
}
