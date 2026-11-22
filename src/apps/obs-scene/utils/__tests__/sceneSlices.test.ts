import { describe, expect, it } from 'vitest'

import {
  buildObsScenePlayerUrl,
  createDefaultSceneDocument,
  createGroupLayer,
  createObsSourceLayer,
  createShapeLayer,
  createTextLayer,
  normalizeSceneDocument,
} from '../../types'
import {
  buildSceneCompositionPlan,
  buildSyncLayoutParamsForScene,
  extractSceneVtsActions,
  isPrimaryPlayerSlot,
  resolveSlotRenderLayerIds,
} from '../sceneSlices'

describe('sceneSlices N 段自动切片与 VTS 编排', () => {
  it('无 obs-source 时退化为单浏览器源兼容模式', () => {
    const doc = createDefaultSceneDocument()
    const bg = createShapeLayer(doc.canvas)
    const txt = createTextLayer(doc.canvas)
    doc.layers[bg.id] = bg
    doc.layers[txt.id] = txt
    doc.scenes.scene_main.layerIds = [bg.id, txt.id]

    const plan = buildSceneCompositionPlan(doc, 'scene_main')
    expect(plan.mode).toBe('single')
    expect(plan.slots).toHaveLength(1)
    expect(plan.slots[0].slotParam).toBeUndefined()
    expect(plan.activeObsSources).toHaveLength(0)
    expect(buildObsScenePlayerUrl('abc123', 'https://vtsuru.live', undefined, plan.slots[0].slotParam)).toBe(
      'https://vtsuru.live/obs/scene?key=abc123',
    )
  })

  it('单 VTS 皮套夹心（底图 → VTS → 弹幕）切分为 2 个浏览器源槽位', () => {
    const doc = createDefaultSceneDocument()
    const bg = createShapeLayer(doc.canvas)
    const vts = createObsSourceLayer('vts', doc.canvas, { sourceName: 'VTube Studio Spout2' })
    const fg = createTextLayer(doc.canvas)
    doc.layers[bg.id] = bg
    doc.layers[vts.id] = vts
    doc.layers[fg.id] = fg
    doc.scenes.scene_main.layerIds = [bg.id, vts.id, fg.id]

    const plan = buildSceneCompositionPlan(doc, 'scene_main')
    expect(plan.mode).toBe('sliced')
    expect(plan.slots.map((s) => s.slotParam)).toEqual(['0', '1'])
    expect(plan.activeStack.map((e) => e.kind)).toEqual(['browser-slot', 'obs-source', 'browser-slot'])
    expect(resolveSlotRenderLayerIds(doc, 'scene_main', '0')).toEqual({
      sceneLayerIds: [bg.id],
      globalLayerIds: [],
    })
    expect(resolveSlotRenderLayerIds(doc, 'scene_main', '1')).toEqual({
      sceneLayerIds: [fg.id],
      globalLayerIds: [],
    })
  })

  it('VTS 置底无背景层时仅分配 1 个前景浏览器源，不建空槽位', () => {
    const doc = createDefaultSceneDocument()
    const vts = createObsSourceLayer('vts', doc.canvas, { sourceName: 'VTS' })
    const fg = createTextLayer(doc.canvas)
    doc.layers[vts.id] = vts
    doc.layers[fg.id] = fg
    doc.scenes.scene_main.layerIds = [vts.id, fg.id]

    const plan = buildSceneCompositionPlan(doc, 'scene_main')
    expect(plan.mode).toBe('sliced')
    expect(plan.slots).toHaveLength(1)
    expect(plan.activeStack.map((e) => e.kind)).toEqual(['obs-source', 'browser-slot'])
  })

  it('游戏 + VTS 多源夹心与相邻本地源去空段，并正确挂载 global 顶层槽位', () => {
    const doc = createDefaultSceneDocument()
    const bg = createShapeLayer(doc.canvas)
    const game = createObsSourceLayer('game', doc.canvas, { sourceName: 'Game Capture' })
    const desk = createShapeLayer(doc.canvas)
    const vts = createObsSourceLayer('vts', doc.canvas, { sourceName: 'VTS Spout2' })
    const fg = createTextLayer(doc.canvas)
    const globalHud = createTextLayer(doc.canvas)

    for (const l of [bg, game, desk, vts, fg, globalHud]) doc.layers[l.id] = l
    doc.scenes.scene_main.layerIds = [bg.id, game.id, desk.id, vts.id, fg.id]
    doc.globalLayerIds = [globalHud.id]

    // 第二子场景中游戏与 VTS 紧贴（中间无 Web 层），验证跨子场景槽位复用与 unusedSlotKeys
    const game2 = createObsSourceLayer('game', doc.canvas, { sourceName: 'Game Capture' })
    const vts2 = createObsSourceLayer('vts', doc.canvas, { sourceName: 'VTS Spout2' })
    const fg2 = createTextLayer(doc.canvas)
    for (const l of [game2, vts2, fg2]) doc.layers[l.id] = l
    doc.scenes.scene_clean = {
      id: 'scene_clean',
      name: '极简游戏',
      layerIds: [game2.id, vts2.id, fg2.id],
      transition: 'fade',
    }
    doc.sceneOrder.push('scene_clean')

    const mainPlan = buildSceneCompositionPlan(doc, 'scene_main')
    expect(mainPlan.slots.map((s) => s.key)).toEqual(['0', '1', '2', 'global'])
    expect(mainPlan.activeStack.map((e) => e.kind)).toEqual([
      'browser-slot',
      'obs-source',
      'browser-slot',
      'obs-source',
      'browser-slot',
      'browser-slot',
    ])

    const cleanPlan = buildSceneCompositionPlan(doc, 'scene_clean')
    expect(cleanPlan.unusedSlotKeys).toEqual(['1', '2'])
    expect(resolveSlotRenderLayerIds(doc, 'scene_clean', '0')).toEqual({
      sceneLayerIds: [fg2.id],
      globalLayerIds: [],
    })
    expect(resolveSlotRenderLayerIds(doc, 'scene_clean', 'global')).toEqual({
      sceneLayerIds: [],
      globalLayerIds: [globalHud.id],
    })
    expect(isPrimaryPlayerSlot(cleanPlan, '0')).toBe(true)
    expect(isPrimaryPlayerSlot(cleanPlan, '1')).toBe(false)
    expect(isPrimaryPlayerSlot(cleanPlan, 'global')).toBe(false)
  })

  it('构建同步参数时区分 obs-transform 与 vts-preset，并正确提取可见 VTS 动作', () => {
    const doc = createDefaultSceneDocument()
    const vtsPresetLayer = createObsSourceLayer('vts', doc.canvas, { sourceName: 'VTS Main' })
    vtsPresetLayer.obsSource.controller = {
      type: 'vts',
      positionMode: 'vts-preset',
      presetId: 'preset_talk',
      expressionFile: 'happy.exp3.json',
      expressionActive: true,
    }
    const hiddenVts = createObsSourceLayer('vts', doc.canvas, { sourceName: 'VTS Alt' })
    hiddenVts.visible = false
    hiddenVts.obsSource.controller = {
      type: 'vts',
      positionMode: 'obs-transform',
      hotkeyId: 'hk_hidden',
    }
    const otherAvatar = createObsSourceLayer('avatar', doc.canvas, { sourceName: 'Warudo Spout' })

    for (const l of [vtsPresetLayer, hiddenVts, otherAvatar]) doc.layers[l.id] = l
    doc.scenes.scene_main.layerIds = [vtsPresetLayer.id, hiddenVts.id, otherAvatar.id]

    const syncParams = buildSyncLayoutParamsForScene({
      doc,
      sceneId: 'scene_main',
      obsSceneName: '主直播',
      baseSourceName: 'VTsuru - 测试',
      shareKey: 'deadbeef',
      origin: 'https://vtsuru.live',
    })

    const obsItems = syncParams.items.filter((i) => i.kind === 'obs-source')
    expect(obsItems).toHaveLength(3)
    expect(obsItems[0].applyTransform).toBe(false)
    expect(obsItems[2].applyTransform).toBe(true)

    const actions = extractSceneVtsActions(doc, 'scene_main')
    expect(actions).toEqual([
      {
        presetId: 'preset_talk',
        expressionFile: 'happy.exp3.json',
        expressionActive: true,
      },
    ])
  })

  it('normalizeSceneDocument 会阻止 obs-source 留在分组内部或全局常驻层', () => {
    const doc = createDefaultSceneDocument()
    const vts = createObsSourceLayer('vts', doc.canvas, { sourceName: 'VTS' })
    const txt = createTextLayer(doc.canvas)
    const grp = createGroupLayer('G', { x: 0, y: 0, width: 400, height: 400 }, [vts.id, txt.id])
    doc.layers[vts.id] = vts
    doc.layers[txt.id] = txt
    doc.layers[grp.id] = grp
    doc.scenes.scene_main.layerIds = [grp.id]
    doc.globalLayerIds = [vts.id]

    const normalized = normalizeSceneDocument(doc)
    const normGrp = normalized.layers[grp.id]
    expect(normGrp.type).toBe('group')
    if (normGrp.type === 'group') {
      expect(normGrp.group.childIds).toEqual([txt.id])
    }
    expect(normalized.globalLayerIds).toEqual([])
  })
})
