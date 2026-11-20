import type { ObsSceneDocument, ObsSceneLayer } from '../types'
import {
  canvasPointToLayerLocal,
  getAncestorGroupIds,
  isLayerEffectivelyLocked,
  isLayerEffectivelyVisible,
} from './groupTree'
import { buildMaskShapePath } from './maskShapes'

export interface HitLayerEntry {
  layerId: string
  layer: ObsSceneLayer
  /** 从根组到直接父组的 ID 链 */
  ancestorGroupIds: string[]
  /** 自身或任意祖先已锁定 */
  effectivelyLocked: boolean
  /** 点击落在了空心装饰框的内部空白区（未落在边框命中带上） */
  isHollowInterior: boolean
}

let strokeTestCtx: CanvasRenderingContext2D | null = null

function getStrokeTestContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  if (!strokeTestCtx) {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    strokeTestCtx = canvas.getContext('2d')
  }
  return strokeTestCtx
}

/** 判断颜色字符串是否为完全透明 */
export function isTransparentColor(color?: string | null): boolean {
  if (!color) return true
  const raw = color.trim().toLowerCase()
  if (!raw || raw === 'transparent' || raw === 'none') return true

  // #rgba / #rrggbbaa
  if (raw.startsWith('#')) {
    if (raw.length === 5) return raw[4] === '0'
    if (raw.length === 9) return raw.slice(7, 9) === '00'
    return false
  }

  // rgba(r, g, b, a) / hsla(h, s, l, a) / rgb(r g b / a)
  const slashMatch = raw.match(/\/\s*([\d.]+)(%?)\s*\)$/)
  if (slashMatch) {
    const val = Number.parseFloat(slashMatch[1])
    return Number.isFinite(val) && val <= 0.005
  }
  const commaMatch = raw.match(/^(?:rgba|hsla)\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/)
  if (commaMatch) {
    const val = Number.parseFloat(commaMatch[1])
    return Number.isFinite(val) && val <= 0.005
  }
  return false
}

/** 是否为空心装饰框（透明填充且无毛玻璃，仅画边框） */
export function isHollowShapeLayer(layer: ObsSceneLayer): boolean {
  if (layer.type !== 'shape') return false
  return layer.shape.borderWidth > 0 && layer.shape.backdropBlur <= 0 && isTransparentColor(layer.shape.fill)
}

/** 判断局部坐标点是否落在空心装饰框的边框命中带内 */
export function isPointOnHollowShapeBorder(layer: ObsSceneLayer, localX: number, localY: number): boolean {
  if (layer.type !== 'shape') return true
  const band = Math.max(10, layer.shape.borderWidth + 6)
  const w = Math.max(1, layer.width)
  const h = Math.max(1, layer.height)

  if (layer.maskShape && layer.maskShape !== 'none') {
    const ctx = getStrokeTestContext()
    if (ctx && typeof Path2D !== 'undefined') {
      const pathStr = buildMaskShapePath(layer.maskShape, w, h, layer.borderRadius ?? 0)
      if (pathStr) {
        ctx.lineWidth = band * 2
        ctx.lineJoin = 'round'
        return ctx.isPointInStroke(new Path2D(pathStr), localX, localY)
      }
    }
  }

  const distToEdge = Math.min(localX, localY, w - localX, h - localY)
  return distToEdge <= band
}

/** 检验局部坐标点是否落在图层边界（以及异形遮罩）内 */
function isLocalPointInsideLayer(layer: ObsSceneLayer, lx: number, ly: number): boolean {
  if (lx < 0 || ly < 0 || lx > layer.width || ly > layer.height) return false
  if (layer.maskShape && layer.maskShape !== 'none') {
    const ctx = getStrokeTestContext()
    if (ctx && typeof Path2D !== 'undefined') {
      const pathStr = buildMaskShapePath(layer.maskShape, layer.width, layer.height, layer.borderRadius ?? 0)
      if (pathStr) {
        return ctx.isPointInPath(new Path2D(pathStr), lx, ly)
      }
    }
  }
  return true
}

/** 将视口客户端坐标换算为逻辑画布坐标 */
export function clientPointToCanvasPoint(
  doc: ObsSceneDocument,
  stageEl: HTMLElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = stageEl.getBoundingClientRect()
  return {
    x: ((clientX - rect.left) / Math.max(1, rect.width)) * doc.canvas.width,
    y: ((clientY - rect.top) / Math.max(1, rect.height)) * doc.canvas.height,
  }
}

/**
 * 采集光标位置命中的所有可见叶子/容器图层，严格按视觉从顶到底（top -> bottom）排序。
 * - 自动尊重旋转、嵌套组相对坐标、异形 clip-path 遮罩、组的 clipContent 裁切。
 * - 包含已锁定层（通过 effectivelyLocked 标记），以便左键穿透而右键菜单仍能选中。
 */
export function collectHitLayersAtClientPoint(
  doc: ObsSceneDocument,
  stageEl: HTMLElement,
  clientX: number,
  clientY: number,
): HitLayerEntry[] {
  const canvasPt = clientPointToCanvasPoint(doc, stageEl, clientX, clientY)
  const hits: HitLayerEntry[] = []

  const visitListTopToBottom = (ids: string[], parentClipped: boolean) => {
    for (let i = ids.length - 1; i >= 0; i--) {
      const id = ids[i]
      const layer = doc.layers[id]
      if (!layer || !isLayerEffectivelyVisible(doc, id)) continue

      const localPt = canvasPointToLayerLocal(doc, id, canvasPt.x, canvasPt.y)
      if (!localPt) continue
      const insideBox = isLocalPointInsideLayer(layer, localPt.x, localPt.y)

      if (layer.type === 'group') {
        const groupClips = Boolean(
          layer.group.clipContent || (layer.maskShape && layer.maskShape !== 'none') || (layer.borderRadius ?? 0) > 0,
        )
        // 若组开启裁切且点击在组外，跳过整棵子树
        if (groupClips && !insideBox) continue
        // 先遍历子图层（子图层视觉上在组容器上方）
        visitListTopToBottom(layer.group.childIds, parentClipped || groupClips)
        // 若点击在组边界内，也记录组本身（用于空组或点击组留白区时仍可命中组）
        if (insideBox) {
          hits.push({
            layerId: id,
            layer,
            ancestorGroupIds: getAncestorGroupIds(doc, id),
            effectivelyLocked: isLayerEffectivelyLocked(doc, id),
            isHollowInterior: true,
          })
        }
        continue
      }

      if (!insideBox) continue
      const hollowInterior = isHollowShapeLayer(layer) && !isPointOnHollowShapeBorder(layer, localPt.x, localPt.y)
      hits.push({
        layerId: id,
        layer,
        ancestorGroupIds: getAncestorGroupIds(doc, id),
        effectivelyLocked: isLayerEffectivelyLocked(doc, id),
        isHollowInterior: hollowInterior,
      })
    }
  }

  // 全局常驻层 zIndex 更高（1000+），优先遍历
  visitListTopToBottom(doc.globalLayerIds, false)
  const activeScene = doc.scenes[doc.activeSceneId]
  if (activeScene) {
    visitListTopToBottom(activeScene.layerIds, false)
  }

  return hits
}

/**
 * 将一个深层命中的图层解析到当前编辑层级（editingGroupId）对应的可操作目标 ID。
 * - 若 editingGroupId 为 null（画布顶层），命中组内子图层时返回其最外层顶层组 ID；
 * - 若 editingGroupId 为某组 G，命中 G 内部后代时返回 G 的直接子节点 ID；
 * - 若命中了 G 外部的图层，返回其顶层节点 ID（同时调用方会退出当前组编辑）。
 */
export function resolveTargetAtEditingScope(
  doc: ObsSceneDocument,
  hitLayerId: string,
  editingGroupId: string | null,
): { targetId: string; nextEditingGroupId: string | null } {
  const ancestors = getAncestorGroupIds(doc, hitLayerId)
  if (editingGroupId) {
    const idx = ancestors.indexOf(editingGroupId)
    if (idx >= 0) {
      return {
        targetId: ancestors[idx + 1] ?? hitLayerId,
        nextEditingGroupId: editingGroupId,
      }
    }
    if (hitLayerId === editingGroupId) {
      return { targetId: editingGroupId, nextEditingGroupId: editingGroupId }
    }
  }
  return {
    targetId: ancestors[0] ?? hitLayerId,
    nextEditingGroupId: null,
  }
}
