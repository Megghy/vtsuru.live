import type {
  RpcObsSceneLayoutItem,
  RpcObsSyncSceneLayoutParams,
  RpcVtsSceneActionParams,
} from '@/shared/rpc/contract'

import type { ObsSceneDocument, ObsSceneLayer, ObsSourceLayer } from '../types'
import { buildObsScenePlayerUrl } from '../types'

export interface SceneBrowserSlotDef {
  /** 槽位唯一标识：'main' | '0' | '1' ... | 'global' */
  key: string
  /** 拼接到 /obs/scene?slot= 的参数；单源模式为 undefined（100% 兼容旧链接） */
  slotParam?: string
  /** 面向 UI 展示与 OBS 源命名后缀的槽位名 */
  label: string
}

export type SceneStackEntry =
  | {
      kind: 'browser-slot'
      slotKey: string
      slotParam?: string
      label: string
      layerIds: string[]
      isGlobal?: boolean
    }
  | {
      kind: 'obs-source'
      layerId: string
      layer: ObsSourceLayer
    }

export interface SceneCompositionPlan {
  mode: 'single' | 'sliced'
  /** 项目所有子场景共需的浏览器源槽位（跨子场景复用，切场不销毁重载） */
  slots: SceneBrowserSlotDef[]
  /** 目标子场景的真实 OBS 堆叠顺序（bottom -> top） */
  activeStack: SceneStackEntry[]
  /** 其他子场景用到、但在目标子场景中为空的浏览器源槽位 */
  unusedSlotKeys: string[]
  /** 目标子场景内包含的全部本地 OBS 源图层（bottom -> top） */
  activeObsSources: ObsSourceLayer[]
  /** 负责驱动本地 RPC（OBS Transform/Z序 + VTS 动作）的唯一主槽位 key */
  primaryDriverSlotKey: string
}

export interface RawSceneSliceResult {
  webSegments: string[][]
  entries: Array<
    | { kind: 'web-segment'; segmentIndex: number; layerIds: string[] }
    | { kind: 'obs-source'; layerId: string; layer: ObsSourceLayer }
  >
  obsSources: ObsSourceLayer[]
}

/**
 * 将单个子场景顶层 layerIds（bottom -> top）按 obs-source 拆分成连续的非空 Web 图层区段与本地源节点。
 */
export function sliceSingleSceneLayers(
  layerIds: string[],
  layers: Record<string, ObsSceneLayer>,
): RawSceneSliceResult {
  const webSegments: string[][] = []
  const entries: RawSceneSliceResult['entries'] = []
  const obsSources: ObsSourceLayer[] = []
  let buffer: string[] = []

  const flushBuffer = () => {
    if (buffer.length === 0) return
    const segmentIndex = webSegments.length
    webSegments.push(buffer)
    entries.push({ kind: 'web-segment', segmentIndex, layerIds: buffer })
    buffer = []
  }

  for (const id of layerIds) {
    const layer = layers[id]
    if (!layer) continue
    if (layer.type === 'obs-source') {
      flushBuffer()
      obsSources.push(layer)
      entries.push({ kind: 'obs-source', layerId: id, layer })
    } else {
      buffer.push(id)
    }
  }
  flushBuffer()

  return { webSegments, entries, obsSources }
}

/** 判断整个场景项目中是否至少有一个子场景包含 obs-source 图层 */
export function documentHasObsSources(doc: ObsSceneDocument): boolean {
  for (const scene of Object.values(doc.scenes)) {
    for (const lid of scene.layerIds) {
      if (doc.layers[lid]?.type === 'obs-source') return true
    }
  }
  return false
}

/** 根据项目名称与槽位生成稳定的 OBS 浏览器源名称 */
export function buildSlotBrowserSourceName(baseName: string, slot: SceneBrowserSlotDef, mode: 'single' | 'sliced'): string {
  const cleaned = baseName.trim() || 'VTsuru Overlay'
  if (mode === 'single') return cleaned
  return `${cleaned} [${slot.label}]`
}

function getSlotLabel(index: number, total: number): string {
  if (total === 1) return '叠加层'
  if (total === 2) return index === 0 ? '底层' : '顶层'
  return `第 ${index + 1} 层`
}

/**
 * 计算项目的完整多段合成计划：
 * - 无 obs-source 时退化为单浏览器源（mode = 'single'）
 * - 存在 obs-source 时按跨子场景最大非空段数分配固定槽位（0..N-1），若有全局常驻层再追加顶层 'global' 槽位
 */
export function buildSceneCompositionPlan(doc: ObsSceneDocument, targetSceneId?: string): SceneCompositionPlan {
  const sceneId = targetSceneId && doc.scenes[targetSceneId] ? targetSceneId : doc.activeSceneId
  const activeScene = doc.scenes[sceneId]

  if (!documentHasObsSources(doc)) {
    const mainSlot: SceneBrowserSlotDef = { key: 'main', label: '全量叠层' }
    const activeLayerIds = activeScene?.layerIds ?? []
    return {
      mode: 'single',
      slots: [mainSlot],
      activeStack: [
        {
          kind: 'browser-slot',
          slotKey: 'main',
          label: mainSlot.label,
          layerIds: [...activeLayerIds, ...doc.globalLayerIds],
        },
      ],
      unusedSlotKeys: [],
      activeObsSources: [],
      primaryDriverSlotKey: 'main',
    }
  }

  let maxWebSegments = 0
  for (const sc of Object.values(doc.scenes)) {
    const { webSegments } = sliceSingleSceneLayers(sc.layerIds, doc.layers)
    if (webSegments.length > maxWebSegments) {
      maxWebSegments = webSegments.length
    }
  }

  const hasGlobal = doc.globalLayerIds.length > 0
  const slots: SceneBrowserSlotDef[] = []
  for (let i = 0; i < maxWebSegments; i++) {
    slots.push({
      key: String(i),
      slotParam: String(i),
      label: getSlotLabel(i, maxWebSegments),
    })
  }
  if (hasGlobal) {
    slots.push({
      key: 'global',
      slotParam: 'global',
      label: '全局顶层',
    })
  }

  const sliced = sliceSingleSceneLayers(activeScene?.layerIds ?? [], doc.layers)
  const activeStack: SceneStackEntry[] = []
  const usedSlotKeys = new Set<string>()

  for (const entry of sliced.entries) {
    if (entry.kind === 'obs-source') {
      activeStack.push(entry)
    } else {
      const slotDef = slots[entry.segmentIndex]
      if (!slotDef) continue
      usedSlotKeys.add(slotDef.key)
      activeStack.push({
        kind: 'browser-slot',
        slotKey: slotDef.key,
        slotParam: slotDef.slotParam,
        label: slotDef.label,
        layerIds: entry.layerIds,
      })
    }
  }

  if (hasGlobal) {
    usedSlotKeys.add('global')
    activeStack.push({
      kind: 'browser-slot',
      slotKey: 'global',
      slotParam: 'global',
      label: '全局顶层',
      layerIds: [...doc.globalLayerIds],
      isGlobal: true,
    })
  }

  const unusedSlotKeys = slots.map((s) => s.key).filter((k) => !usedSlotKeys.has(k))
  const primaryDriverSlotKey = slots[0]?.key ?? 'main'

  return {
    mode: 'sliced',
    slots,
    activeStack,
    unusedSlotKeys,
    activeObsSources: sliced.obsSources,
    primaryDriverSlotKey,
  }
}

/**
 * 供 ObsSceneRenderer 在 live 模式下按 slot 参数精准过滤需要渲染的 sceneLayers / globalLayers。
 * - slot 未传：保留兼容行为，渲染所有非 obs-source 场景层 + 全局层
 * - slot === 'global'：仅渲染全局层
 * - slot === '0' | '1' ...：仅渲染当前子场景对应段序号的 Web 图层
 */
export function resolveSlotRenderLayerIds(
  doc: ObsSceneDocument,
  sceneId: string,
  slot?: string,
): { sceneLayerIds: string[]; globalLayerIds: string[] } {
  const scene = doc.scenes[sceneId]
  const normalizedSlot = slot?.trim()

  if (!normalizedSlot) {
    return {
      sceneLayerIds: scene?.layerIds ?? [],
      globalLayerIds: doc.globalLayerIds,
    }
  }

  if (normalizedSlot === 'global') {
    return {
      sceneLayerIds: [],
      globalLayerIds: doc.globalLayerIds,
    }
  }

  const idx = Number(normalizedSlot)
  if (!Number.isInteger(idx) || idx < 0) {
    return { sceneLayerIds: [], globalLayerIds: [] }
  }

  const { webSegments } = sliceSingleSceneLayers(scene?.layerIds ?? [], doc.layers)
  return {
    sceneLayerIds: webSegments[idx] ?? [],
    globalLayerIds: [],
  }
}

/** 判断当前播放器实例是否应作为唯一本地 RPC 驱动者（防多槽位重复执行切场同步与 VTS 动作） */
export function isPrimaryPlayerSlot(plan: SceneCompositionPlan, slot?: string): boolean {
  const normalizedSlot = slot?.trim()
  if (!normalizedSlot) return true
  return normalizedSlot === plan.primaryDriverSlotKey
}

/** 根据场景合成计划构建提交给 OBS WebSocket / 客户端 RPC 的完整布局同步参数 */
export function buildSyncLayoutParamsForScene(options: {
  doc: ObsSceneDocument
  sceneId?: string
  obsSceneName: string
  baseSourceName: string
  shareKey: string
  origin?: string
  authToken?: string
}): RpcObsSyncSceneLayoutParams {
  const { doc, sceneId, obsSceneName, baseSourceName, shareKey, origin, authToken } = options
  const plan = buildSceneCompositionPlan(doc, sceneId)
  const slotMap = new Map(plan.slots.map((s) => [s.key, s]))

  const items: RpcObsSceneLayoutItem[] = []
  for (const entry of plan.activeStack) {
    if (entry.kind === 'browser-slot') {
      const slotDef = slotMap.get(entry.slotKey)
      if (!slotDef) continue
      items.push({
        kind: 'browser-slot',
        sourceName: buildSlotBrowserSourceName(baseSourceName, slotDef, plan.mode),
        url: buildObsScenePlayerUrl(shareKey, origin, authToken, slotDef.slotParam),
        width: doc.canvas.width,
        height: doc.canvas.height,
      })
    } else {
      const layer = entry.layer
      const isVtsPresetMode =
        layer.obsSource.controller.type === 'vts' && layer.obsSource.controller.positionMode === 'vts-preset'
      items.push({
        kind: 'obs-source',
        sourceName: layer.obsSource.sourceName,
        visible: layer.visible,
        applyTransform: !isVtsPresetMode,
        x: layer.x,
        y: layer.y,
        width: layer.width,
        height: layer.height,
        rotation: layer.rotation,
        crop: layer.obsSource.syncCrop !== false ? layer.crop : undefined,
      })
    }
  }

  const unusedBrowserSlots = plan.unusedSlotKeys
    .map((key) => slotMap.get(key))
    .filter((s): s is SceneBrowserSlotDef => Boolean(s))
    .map((slotDef) => ({
      sourceName: buildSlotBrowserSourceName(baseSourceName, slotDef, plan.mode),
      url: buildObsScenePlayerUrl(shareKey, origin, authToken, slotDef.slotParam),
      width: doc.canvas.width,
      height: doc.canvas.height,
    }))

  return {
    sceneName: obsSceneName,
    canvasWidth: doc.canvas.width,
    canvasHeight: doc.canvas.height,
    items,
    unusedBrowserSlots: unusedBrowserSlots.length > 0 ? unusedBrowserSlots : undefined,
  }
}

/** 提取目标子场景中所有可见 VTS 控制器的切场动作列表 */
export function extractSceneVtsActions(doc: ObsSceneDocument, sceneId?: string): RpcVtsSceneActionParams[] {
  const resolvedId = sceneId && doc.scenes[sceneId] ? sceneId : doc.activeSceneId
  const scene = doc.scenes[resolvedId]
  if (!scene) return []

  const actions: RpcVtsSceneActionParams[] = []
  for (const lid of scene.layerIds) {
    const layer = doc.layers[lid]
    if (!layer || layer.type !== 'obs-source' || !layer.visible) continue
    const ctrl = layer.obsSource.controller
    if (ctrl.type !== 'vts') continue

    const action: RpcVtsSceneActionParams = {}
    if (ctrl.presetId) action.presetId = ctrl.presetId
    if (ctrl.expressionFile) {
      action.expressionFile = ctrl.expressionFile
      action.expressionActive = ctrl.expressionActive !== false
    }
    if (ctrl.hotkeyId) action.hotkeyId = ctrl.hotkeyId
    if (ctrl.macroId) action.macroId = ctrl.macroId

    if (action.presetId || action.expressionFile || action.hotkeyId || action.macroId) {
      actions.push(action)
    }
  }
  return actions
}
