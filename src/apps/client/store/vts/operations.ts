import { ref } from 'vue'
import { z } from 'zod'

import type { VtsAvailableItemFile, VtsItemInstance } from '@/apps/client/api/vts/messages'
import { resolveAudioPlayUrl } from '@/apps/client/store/autoAction/modules/audioPlayer'

import type { VtsConfig } from './config'
import type { VtsConnection } from './connection'
import type { VtsHistory, VtsOpKind } from './history'
import type { VtsMacroStep, VtsPreset } from './schemas'

type ModelTransform = Pick<VtsPreset, 'timeInSeconds' | 'positionX' | 'positionY' | 'rotation' | 'size'>
type ParamValue = { id: string; value: number; weight?: number }

const PARAM_HOLD_INTERVAL_MS = 120

function parseHexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.trim().replace(/^#/, '')
  const normalized =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : cleaned.slice(0, 6)
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    throw new Error(`无效的颜色值: ${hex}`)
  }
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  }
}

const num = z.number().finite()
const replayPayloadSchemas = {
  modelLoad: z.object({ modelID: z.string() }),
  hotkeyTrigger: z.object({ hotkeyID: z.string() }),
  expressionSet: z.object({ file: z.string(), active: z.boolean() }),
  moveModel: z.object({ timeInSeconds: num, positionX: num, positionY: num, rotation: num, size: num }),
  injectParam: z.object({
    values: z.array(z.object({ id: z.string(), value: num, weight: num.optional() })),
    mode: z.enum(['add', 'set']).optional(),
  }),
  macroRun: z.object({ macroId: z.string() }),
  itemOpacity: z.object({ itemInstanceID: z.string(), opacity: num }),
  dropItem: z.object({ fileName: z.string(), x: num, size: num }),
  colorTint: z.object({
    colorHex: z.string().optional(),
    rainbow: z.boolean().optional(),
    reset: z.boolean().optional(),
  }),
  postProcessing: z.object({
    enabled: z.boolean(),
    preset: z.string().optional(),
    fadeTime: num.optional(),
  }),
} satisfies Partial<Record<VtsOpKind, z.ZodType>>

export const REPLAYABLE_KINDS = new Set(Object.keys(replayPayloadSchemas))

export function createVtsOperations(config: VtsConfig, conn: VtsConnection, history: VtsHistory) {
  const { call, request } = conn
  const macroRunning = ref<{ macroId: string; stepIndex: number; totalSteps: number } | null>(null)
  const canLoadItems = ref<boolean | null>(null)
  const itemInstancesInScene = ref<VtsItemInstance[]>([])
  const availableItemFiles = ref<VtsAvailableItemFile[]>([])
  const holdTimers = new Map<string, number>()
  let activeMacroAbort: AbortController | null = null
  let activeMacroAudio: HTMLAudioElement | null = null

  async function loadModel(modelID: string) {
    const model = conn.availableModels.value.find((m) => m.modelID === modelID)
    await call('modelLoad', model?.modelName || modelID, async (c) => c.modelLoad({ modelID }), { modelID })
    await Promise.all([conn.refreshModelState(), conn.refreshAvailableModels().catch(() => {})])
  }

  async function triggerHotkey(hotkeyID: string) {
    const hk = conn.hotkeys.value.find((h) => h.hotkeyID === hotkeyID)
    await call('hotkeyTrigger', hk?.name || hotkeyID, async (c) => c.hotkeyTrigger({ hotkeyID }), { hotkeyID })
    if (hk?.type.includes('Expression')) {
      await conn.refreshExpressions()
    }
  }

  async function setExpression(file: string, active: boolean) {
    const exp = conn.expressions.value.find((e) => e.file === file)
    await call(
      'expressionSet',
      `${exp?.name || file}: ${active ? '开启' : '关闭'}`,
      async (c) => c.expressionActivation({ expressionFile: file, active }),
      { file, active },
    )
    conn.expressions.value = conn.expressions.value.map((e) => (e.file === file ? { ...e, active } : e))
  }

  async function toggleExpression(file: string) {
    const expression = conn.expressions.value.find((e) => e.file === file)
    if (!expression) throw new Error(`当前模型没有表情: ${file}`)
    await setExpression(file, !expression.active)
  }

  async function clearExpressions() {
    for (const e of conn.expressions.value.filter((x) => x.active)) await setExpression(e.file, false)
  }

  async function moveModel(t: ModelTransform, options?: { silent?: boolean }) {
    const payload = { ...t }
    if (options?.silent) {
      await request(async (c) => c.moveModel({ ...payload, valuesAreRelativeToModel: false }))
      return
    }
    await call(
      'moveModel',
      `x=${t.positionX.toFixed(2)}, y=${t.positionY.toFixed(2)}, size=${t.size.toFixed(0)}`,
      async (c) => c.moveModel({ ...payload, valuesAreRelativeToModel: false }),
      payload,
    )
  }

  async function applyPreset(presetId: string) {
    const preset = config.presets.value.find((p) => p.id === presetId)
    if (!preset) throw new Error('预设不存在')
    await moveModel(preset)
  }

  async function injectParameters(values: ParamValue[], options?: { mode?: 'add' | 'set'; silent?: boolean }) {
    if (values.length === 0) return
    const mode = options?.mode ?? 'add'
    if (options?.silent) {
      await request(async (c) => c.injectParameterData({ mode, parameterValues: values }))
      return
    }
    await call(
      'injectParam',
      `${values.map((v) => `${v.id}=${v.value}`).join(', ')} (${mode})`,
      async (c) => c.injectParameterData({ mode, parameterValues: values }),
      { values, mode },
    )
  }

  async function injectParametersAdd(values: ParamValue[]) {
    return injectParameters(values, { mode: 'add' })
  }

  function stopParamHold(slotId: string) {
    window.clearInterval(holdTimers.get(slotId))
    holdTimers.delete(slotId)
  }

  function startParamHold(slotId: string) {
    if (holdTimers.has(slotId)) return
    const timer = window.setInterval(async () => {
      const slot = config.paramSlots.value.find((s) => s.id === slotId)
      if (!slot?.hold) return stopParamHold(slotId)
      try {
        await injectParameters([{ id: slot.parameterId, value: slot.value, weight: slot.weight }], {
          mode: slot.mode ?? 'add',
          silent: true,
        })
      } catch (err) {
        stopParamHold(slotId)
        if (slot.hold) void config.upsertParamSlot({ ...slot, hold: false })
        conn.lastError.value = err instanceof Error ? err.message : String(err)
      }
    }, PARAM_HOLD_INTERVAL_MS)
    holdTimers.set(slotId, timer)
  }

  async function stopAllParamHolds() {
    for (const slotId of holdTimers.keys()) stopParamHold(slotId)
    const held = config.paramSlots.value.filter((s) => s.hold)
    if (held.length > 0) {
      await Promise.all(held.map((s) => config.upsertParamSlot({ ...s, hold: false })))
    }
  }

  async function removeParamSlot(id: string) {
    stopParamHold(id)
    await config.removeParamSlotConfig(id)
  }

  async function autoRebindAccessories() {
    const instances = itemInstancesInScene.value
    if (instances.length === 0) return
    const aliveIds = new Set(instances.map((i) => i.instanceID))
    const usedIds = new Set(
      config.accessories.value.filter((a) => aliveIds.has(a.itemInstanceID)).map((a) => a.itemInstanceID),
    )

    for (const acc of config.accessories.value) {
      if (acc.itemInstanceID && aliveIds.has(acc.itemInstanceID)) {
        if (!acc.fileName) {
          const matched = instances.find((i) => i.instanceID === acc.itemInstanceID)
          if (matched) await config.upsertAccessory({ ...acc, fileName: matched.fileName })
        }
        continue
      }
      if (!acc.fileName) continue
      const candidate =
        instances.find((i) => i.fileName === acc.fileName && !usedIds.has(i.instanceID)) ??
        instances.find((i) => i.fileName === acc.fileName)
      if (candidate) {
        usedIds.add(candidate.instanceID)
        await config.upsertAccessory({ ...acc, itemInstanceID: candidate.instanceID })
      }
    }
  }

  async function refreshItems(options?: { includeFiles?: boolean }) {
    const data = await request(async (c) =>
      c.itemList({
        includeAvailableSpots: false,
        includeItemInstancesInScene: true,
        includeAvailableItemFiles: options?.includeFiles ?? true,
      }),
    )
    canLoadItems.value = data.canLoadItemsRightNow
    itemInstancesInScene.value = data.itemInstancesInScene
    availableItemFiles.value = data.availableItemFiles as unknown as VtsAvailableItemFile[]
    await autoRebindAccessories()
  }

  async function loadItem(
    fileName: string,
    options?: { x?: number; y?: number; size?: number; rotation?: number; fadeTime?: number; order?: number },
  ) {
    return call(
      'itemLoad',
      fileName,
      async (c) =>
        c.itemLoad({
          fileName,
          positionX: options?.x,
          positionY: options?.y,
          size: options?.size,
          rotation: options?.rotation,
          fadeTime: options?.fadeTime ?? 0.2,
          order: options?.order,
          failIfOrderTaken: false,
          unloadWhenPluginDisconnects: true,
        }),
      { fileName, ...options },
    )
  }

  async function unloadItems({ instanceIDs = [], fileNames = [] }: { instanceIDs?: string[]; fileNames?: string[] }) {
    if (instanceIDs.length === 0 && fileNames.length === 0)
      throw new Error('ItemUnload 失败：未指定 instanceIDs 或 fileNames')
    await call(
      'itemUnload',
      [...fileNames, ...instanceIDs].join(','),
      async (c) =>
        c.itemUnload({
          unloadAllInScene: false,
          unloadAllLoadedByThisPlugin: false,
          allowUnloadingItemsLoadedByUserOrOtherPlugins: true,
          instanceIDs,
          fileNames,
        }),
      { instanceIDs, fileNames },
    )
  }

  async function unloadAllPluginItems() {
    await call('itemUnload', '本插件全部道具', async (c) =>
      c.itemUnload({
        unloadAllInScene: false,
        unloadAllLoadedByThisPlugin: true,
        allowUnloadingItemsLoadedByUserOrOtherPlugins: false,
        instanceIDs: [],
        fileNames: [],
      }),
    )
    await refreshItems({ includeFiles: true })
  }

  async function pinItem(
    itemInstanceID: string,
    pin: boolean,
    options?: { artMeshID?: string; modelID?: string },
  ) {
    const useArtMesh = Boolean(pin && options?.artMeshID)
    await call(
      'itemPin',
      `${itemInstanceID.slice(0, 8)}:${pin ? (options?.artMeshID ? `钉选(${options.artMeshID})` : '固定') : '取消固定'}`,
      async (c) =>
        c.itemPin({
          itemInstanceID,
          pin,
          angleRelativeTo: 'RelativeToCurrentItemRotation',
          sizeRelativeTo: 'RelativeToCurrentItemSize',
          vertexPinType: 'Center',
          ...(useArtMesh
            ? {
                pinInfo: {
                  modelID: options?.modelID ?? conn.currentModelId.value ?? undefined,
                  artMeshID: options?.artMeshID,
                  angle: 0,
                  size: 0.3,
                },
              }
            : {}),
        }),
      { itemInstanceID, pin, ...options },
    )
    await refreshItems({ includeFiles: false })
  }

  async function sortItem(
    itemInstanceID: string,
    options: {
      frontOn?: boolean
      backOn?: boolean
      withinModelOrderFront?: string
      withinModelOrderBack?: string
    },
  ) {
    await call(
      'itemSort',
      `${itemInstanceID.slice(0, 8)}:${options.frontOn ? '前层' : ''}${options.backOn ? '后层' : ''}`,
      async (c) =>
        c.itemSort({
          itemInstanceID,
          frontOn: options.frontOn,
          backOn: options.backOn,
          setFrontOrder: options.withinModelOrderFront ? 'UseArtMeshID' : 'Unchanged',
          setBackOrder: options.withinModelOrderBack ? 'UseArtMeshID' : 'Unchanged',
          withinModelOrderFront: options.withinModelOrderFront,
          withinModelOrderBack: options.withinModelOrderBack,
        }),
      { itemInstanceID, ...options },
    )
    await refreshItems({ includeFiles: false })
  }

  async function controlItemAnimation(
    itemInstanceID: string,
    options: {
      framerate?: number
      frame?: number
      brightness?: number
      opacity?: number
      setAnimationPlayState?: boolean
      animationPlayState?: boolean
    },
  ) {
    return call(
      'itemAnimation',
      itemInstanceID.slice(0, 8),
      async (c) =>
        c.itemAnimationControl({
          itemInstanceID,
          framerate: options.framerate ?? -1,
          frame: options.frame ?? -1,
          brightness: options.brightness ?? -1,
          opacity: options.opacity ?? -1,
          setAutoStopFrames: false,
          autoStopFrames: [],
          setAnimationPlayState: options.setAnimationPlayState ?? false,
          animationPlayState: options.animationPlayState ?? true,
        }),
      { itemInstanceID, ...options },
    )
  }

  async function setItemOpacity(itemInstanceID: string, opacity: number) {
    await call(
      'itemOpacity',
      `${itemInstanceID.slice(0, 8)}:${opacity}`,
      async (c) => c.itemAnimationControl({ itemInstanceID, opacity } as Parameters<typeof c.itemAnimationControl>[0]),
      { itemInstanceID, opacity },
    )
  }

  /** 道具从画面上方掉落, 落地后自动卸载 */
  async function dropItem(fileName: string, options?: { x?: number; size?: number; randomX?: boolean }) {
    const x = options?.randomX ? Number(((Math.random() - 0.5) * 1.2).toFixed(2)) : (options?.x ?? 0)
    const size = options?.size ?? 0.32
    await history.withHistory(
      'dropItem',
      fileName,
      async () => {
        const { instanceID } = await loadItem(fileName, { x, y: 1.1, size, fadeTime: 0.1 })
        try {
          await request(async (c) =>
            c.itemMove({
              itemsToMove: [
                { itemInstanceID: instanceID, timeInSeconds: 0.6, fadeMode: 'easeIn', positionX: x, positionY: -0.2 },
              ],
            }),
          )
          const landed = await conn.waitForItemEvent(instanceID, ['DroppedPinned', 'DroppedUnpinned'], 1600)
          window.setTimeout(() => void unloadItems({ instanceIDs: [instanceID] }).catch(() => {}), landed ? 300 : 1200)
        } catch (err) {
          await unloadItems({ instanceIDs: [instanceID] }).catch(() => {})
          throw err
        }
      },
      { fileName, x, size },
    )
  }

  async function tintModel(options: {
    colorHex?: string
    rainbow?: boolean
    reset?: boolean
    mixWithSceneLighting?: number
    artMeshMatcher?: {
      tintAll?: boolean
      nameExact?: string[]
      nameContains?: string[]
      tagExact?: string[]
      tagContains?: string[]
      artMeshGroupIDExact?: string[]
    }
  }) {
    const payload = {
      colorHex: options.colorHex,
      rainbow: options.rainbow,
      reset: options.reset,
      artMeshMatcher: options.artMeshMatcher,
    }
    const rgb =
      options.reset || options.rainbow ? { r: 255, g: 255, b: 255 } : parseHexToRgb(options.colorHex || '#ffffff')
    const hasScopedMatcher = Boolean(
      options.artMeshMatcher &&
        ((options.artMeshMatcher.nameExact?.length ?? 0) > 0 ||
          (options.artMeshMatcher.nameContains?.length ?? 0) > 0 ||
          (options.artMeshMatcher.tagExact?.length ?? 0) > 0 ||
          (options.artMeshMatcher.tagContains?.length ?? 0) > 0 ||
          (options.artMeshMatcher.artMeshGroupIDExact?.length ?? 0) > 0),
    )
    const matcher =
      hasScopedMatcher && !options.artMeshMatcher?.tintAll
        ? { tintAll: false, ...options.artMeshMatcher }
        : { tintAll: true }
    const scopeLabel = hasScopedMatcher && !matcher.tintAll ? ' (分部位)' : ''
    const detail = `${options.reset ? '重置颜色' : options.rainbow ? '彩虹染色' : options.colorHex || '#ffffff'}${scopeLabel}`
    return call(
      'colorTint',
      detail,
      async (c) =>
        c.colorTint({
          colorTint: {
            colorR: rgb.r,
            colorG: rgb.g,
            colorB: rgb.b,
            colorA: 255,
            mixWithSceneLightingColor: options.mixWithSceneLighting ?? 0,
            ...(options.rainbow ? { jeb_: true as const } : {}),
          },
          artMeshMatcher: matcher,
        }),
      payload,
    )
  }

  async function selectArtMeshesInVts(options?: {
    requestedCount?: number
    activeArtMeshes?: string[]
    text?: string
    help?: string
  }) {
    return call(
      'artMeshSelection',
      'VTS 内可视点选部位',
      async (c) =>
        c.artMeshSelection({
          textOverride: options?.text ?? '请选择要染色或绑定的模型部位 (ArtMesh)',
          helpOverride: options?.help ?? '点选完成后点击确定，客户端将自动接收所选部位列表',
          requestedArtMeshCount: options?.requestedCount ?? 0,
          activeArtMeshes: options?.activeArtMeshes,
        }),
      options,
    )
  }

  async function setModelPhysics(options: {
    strength?: number
    wind?: number
    overrideSeconds?: number
    setBaseValue?: boolean
    groupId?: string
  }) {
    const id = options.groupId ?? ''
    const overrideSeconds = options.overrideSeconds ?? 5
    const setBaseValue = options.setBaseValue ?? false
    const strengthOverrides =
      options.strength !== undefined
        ? [{ id, value: options.strength, setBaseValue, overrideSeconds }]
        : []
    const windOverrides =
      options.wind !== undefined
        ? [{ id, value: options.wind, setBaseValue, overrideSeconds }]
        : []
    if (strengthOverrides.length === 0 && windOverrides.length === 0) return

    await call(
      'physicsOverride',
      `强度=${options.strength ?? '-'} 风力=${options.wind ?? '-'} (${overrideSeconds}s)`,
      async (c) => c.setCurrentModelPhysics({ strengthOverrides, windOverrides }),
      options,
    )
    await conn.refreshPhysics().catch(() => {})
  }

  async function resetPhysicsDirect() {
    await setModelPhysics({ strength: 0, wind: 0, overrideSeconds: 0.5, setBaseValue: false })
  }

  async function updateNdiConfig(options: {
    ndiActive: boolean
    useNDI5?: boolean
    useCustomResolution?: boolean
    customWidthNDI?: number
    customHeightNDI?: number
  }) {
    const current = conn.ndiState.value
    const payload = {
      setNewConfig: true,
      ndiActive: options.ndiActive,
      useNDI5: options.useNDI5 ?? current?.useNDI5 ?? true,
      useCustomResolution: options.useCustomResolution ?? current?.useCustomResolution ?? false,
      customWidthNDI: options.customWidthNDI ?? current?.customWidthNDI ?? -1,
      customHeightNDI: options.customHeightNDI ?? current?.customHeightNDI ?? -1,
    }
    const res = await call(
      'ndiConfig',
      options.ndiActive ? '开启 NDI 输出' : '关闭 NDI 输出',
      async (c) => c.ndiConfig(payload),
      payload,
    )
    conn.ndiState.value = {
      ndiActive: res.ndiActive,
      useNDI5: res.useNDI5,
      useCustomResolution: res.useCustomResolution,
      customWidthNDI: res.customWidthNDI,
      customHeightNDI: res.customHeightNDI,
    }
    return res
  }

  async function createCustomParameter(input: {
    parameterName: string
    explanation: string
    min: number
    max: number
    defaultValue: number
  }) {
    const res = await call(
      'customParam',
      `创建 ${input.parameterName}`,
      async (c) => c.parameterCreation(input),
      input,
    )
    await conn.refreshInputParameters().catch(() => {})
    return res
  }

  async function deleteCustomParameter(parameterName: string) {
    const res = await call(
      'customParam',
      `删除 ${parameterName}`,
      async (c) => c.parameterDeletion({ parameterName }),
      { parameterName },
    )
    await conn.refreshInputParameters().catch(() => {})
    return res
  }

  async function getParameterValue(name: string) {
    return request(async (c) => c.parameterValue({ name }))
  }

  async function updatePostProcessing(options: { enabled: boolean; preset?: string; fadeTime?: number }) {
    const payload = { enabled: options.enabled, preset: options.preset, fadeTime: options.fadeTime }
    const detail = options.enabled ? (options.preset ? `预设: ${options.preset}` : '开启滤镜') : '关闭滤镜'
    const res = await call(
      'postProcessing',
      detail,
      async (c) =>
        c.postProcessingUpdate({
          postProcessingOn: options.enabled,
          setPostProcessingPreset: Boolean(options.enabled && options.preset),
          presetToSet: options.preset,
          postProcessingFadeTime: options.fadeTime ?? 0.3,
        }),
      payload,
    )
    if (conn.postProcessing.value) {
      conn.postProcessing.value = {
        ...conn.postProcessing.value,
        active: res.postProcessingActive,
        activePreset: res.activePreset,
      }
    }
  }

  async function toggleAccessory(id: string, visible: boolean) {
    const acc = config.accessories.value.find((a) => a.id === id)
    if (!acc) throw new Error('配饰不存在')
    if (!acc.itemInstanceID) throw new Error('配饰未绑定实例')
    await setItemOpacity(acc.itemInstanceID, visible ? 1 : 0)
    await config.upsertAccessory({ ...acc, visible })
  }

  async function triggerPanicHotkey(hotkeyID: string, label: string) {
    if (!hotkeyID) throw new Error(`未配置“${label}”热键，请先在「设置」中绑定`)
    await triggerHotkey(hotkeyID)
  }

  async function runPrank(prankId: string) {
    const prank = config.pranks.value.find((p) => p.id === prankId)
    if (!prank) throw new Error('整活不存在')
    if (prank.hotkeyID) return triggerHotkey(prank.hotkeyID)
    if (!prank.fileName) throw new Error('整活未配置道具文件或热键')
    await dropItem(prank.fileName, {
      x: prank.dropX,
      size: prank.dropSize,
      randomX: prank.randomX,
    })
  }

  function waitAbortable(seconds: number, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(new Error('宏已中止'))
      const timer = window.setTimeout(() => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      }, seconds * 1000)
      const onAbort = () => {
        window.clearTimeout(timer)
        reject(new Error('宏已中止'))
      }
      signal.addEventListener('abort', onAbort, { once: true })
    })
  }

  async function playAudio(step: Extract<VtsMacroStep, { type: 'playAudio' }>, signal?: AbortSignal) {
    const resolvedUrl = await resolveAudioPlayUrl(step.url)
    const audio = new Audio(resolvedUrl)
    if (step.volume !== undefined) audio.volume = Math.min(1, Math.max(0, step.volume))
    activeMacroAudio = audio
    const ended = new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        if (activeMacroAudio === audio) activeMacroAudio = null
        signal?.removeEventListener('abort', onAbort)
      }
      const onAbort = () => {
        audio.pause()
        cleanup()
        reject(new Error('宏已中止'))
      }
      audio.onended = () => {
        cleanup()
        resolve()
      }
      audio.onerror = () => {
        cleanup()
        reject(new Error('音效播放失败'))
      }
      signal?.addEventListener('abort', onAbort, { once: true })
    })
    await audio.play()
    if (step.waitForEnd) await ended
  }

  async function runMacroStep(step: VtsMacroStep, signal: AbortSignal) {
    if (signal.aborted) throw new Error('宏已中止')
    switch (step.type) {
      case 'hotkey':
        return triggerHotkey(step.hotkeyID)
      case 'expression':
        return setExpression(step.file, step.active)
      case 'clearExpressions':
        return clearExpressions()
      case 'preset':
        return applyPreset(step.presetId)
      case 'wait':
        return waitAbortable(step.seconds, signal)
      case 'injectParam':
        return injectParameters([{ id: step.parameterId, value: step.value, weight: step.weight }], {
          mode: step.mode ?? 'add',
        })
      case 'accessory':
        return toggleAccessory(step.accessoryId, step.visible)
      case 'prank':
        return runPrank(step.prankId)
      case 'colorTint':
        return tintModel({ colorHex: step.color, rainbow: step.rainbow, reset: step.reset })
      case 'postProcessing':
        return updatePostProcessing({ enabled: step.enabled, preset: step.preset, fadeTime: step.fadeTime })
      case 'playAudio':
        return playAudio(step, signal)
    }
  }

  function stopMacro() {
    if (!activeMacroAbort) return
    activeMacroAbort.abort()
    activeMacroAbort = null
    activeMacroAudio?.pause()
    activeMacroAudio = null
    macroRunning.value = null
  }

  async function runMacro(macroId: string) {
    const macro = config.macros.value.find((m) => m.id === macroId)
    if (!macro) throw new Error('宏不存在')
    if (!conn.connected.value) throw new Error('VTS 未连接')
    if (activeMacroAbort) throw new Error('已有宏正在执行，请等待完成或先点击「停止」')

    const controller = new AbortController()
    activeMacroAbort = controller
    const totalSteps = macro.steps.length
    try {
      await history.withHistory(
        'macroRun',
        macro.name || macroId,
        async () => {
          for (const [stepIndex, step] of macro.steps.entries()) {
            if (controller.signal.aborted) throw new Error('宏已中止')
            macroRunning.value = { macroId, stepIndex, totalSteps }
            await runMacroStep(step, controller.signal)
          }
        },
        { macroId },
      )
    } finally {
      if (activeMacroAbort === controller) {
        activeMacroAbort = null
        macroRunning.value = null
      }
    }
  }

  conn.onSessionReady(() => {
    void refreshItems({ includeFiles: true }).catch(() => {})
  })

  conn.onSessionReset(() => {
    stopMacro()
    void stopAllParamHolds()
    canLoadItems.value = null
    itemInstancesInScene.value = []
    availableItemFiles.value = []
  })

  const replay =
    <S extends z.ZodType>(schema: S, fn: (p: z.output<S>) => Promise<unknown>) =>
    async (raw: unknown) =>
      fn(schema.parse(raw))
  const replayers = {
    modelLoad: replay(replayPayloadSchemas.modelLoad, async (p) => loadModel(p.modelID)),
    hotkeyTrigger: replay(replayPayloadSchemas.hotkeyTrigger, async (p) => triggerHotkey(p.hotkeyID)),
    expressionSet: replay(replayPayloadSchemas.expressionSet, async (p) => setExpression(p.file, p.active)),
    moveModel: replay(replayPayloadSchemas.moveModel, moveModel),
    injectParam: replay(replayPayloadSchemas.injectParam, async (p) =>
      injectParameters(p.values, { mode: p.mode ?? 'add' }),
    ),
    macroRun: replay(replayPayloadSchemas.macroRun, async (p) => runMacro(p.macroId)),
    itemOpacity: replay(replayPayloadSchemas.itemOpacity, async (p) => setItemOpacity(p.itemInstanceID, p.opacity)),
    dropItem: replay(replayPayloadSchemas.dropItem, async (p) => dropItem(p.fileName, p)),
    colorTint: replay(replayPayloadSchemas.colorTint, tintModel),
    postProcessing: replay(replayPayloadSchemas.postProcessing, updatePostProcessing),
  } satisfies Record<keyof typeof replayPayloadSchemas, (raw: unknown) => Promise<unknown>>

  async function replayHistoryRecord(recordId: string) {
    const record = history.history.value.find((r) => r.id === recordId)
    if (!record) throw new Error('历史记录不存在')
    if (!(record.kind in replayers)) throw new Error(`该历史记录不支持回放: ${record.kind}`)
    await replayers[record.kind as keyof typeof replayers](record.payload)
  }

  return {
    macroRunning,
    canLoadItems,
    itemInstancesInScene,
    availableItemFiles,

    loadModel,
    triggerHotkey,
    setExpression,
    toggleExpression,
    clearExpressions,
    moveModel,
    applyPreset,
    injectParameters,
    injectParametersAdd,
    startParamHold,
    stopParamHold,
    stopAllParamHolds,
    removeParamSlot,
    refreshItems,
    loadItem,
    unloadItems,
    unloadAllPluginItems,
    pinItem,
    sortItem,
    controlItemAnimation,
    setItemOpacity,
    dropItem,
    tintModel,
    selectArtMeshesInVts,
    setModelPhysics,
    resetPhysicsDirect,
    updateNdiConfig,
    createCustomParameter,
    deleteCustomParameter,
    getParameterValue,
    updatePostProcessing,
    toggleAccessory,
    panicCalibrate: async () => triggerPanicHotkey(config.panicConfig.value.calibrateHotkeyId, '校准'),
    panicResetPhysics: async () => {
      if (config.panicConfig.value.resetPhysicsHotkeyId) {
        await triggerHotkey(config.panicConfig.value.resetPhysicsHotkeyId)
      } else {
        await resetPhysicsDirect()
      }
    },
    runMacro,
    stopMacro,
    replayHistoryRecord,
  }
}

export type VtsOperations = ReturnType<typeof createVtsOperations>
