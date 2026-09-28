import { ref } from 'vue'
import { z } from 'zod'

import type { VtsAvailableItemFile, VtsItemInstance } from '@/apps/client/api/vts/messages'

import type { VtsConfig } from './config'
import type { VtsConnection } from './connection'
import type { VtsHistory, VtsOpKind } from './history'
import type { VtsMacroStep, VtsPreset } from './schemas'

type ModelTransform = Pick<VtsPreset, 'timeInSeconds' | 'positionX' | 'positionY' | 'rotation' | 'size'>
type ParamValue = { id: string; value: number; weight?: number }

const PARAM_HOLD_INTERVAL_MS = 120

const num = z.number().finite()
const replayPayloadSchemas = {
  hotkeyTrigger: z.object({ hotkeyID: z.string() }),
  expressionSet: z.object({ file: z.string(), active: z.boolean() }),
  moveModel: z.object({ timeInSeconds: num, positionX: num, positionY: num, rotation: num, size: num }),
  injectParam: z.object({ values: z.array(z.object({ id: z.string(), value: num, weight: num.optional() })) }),
  macroRun: z.object({ macroId: z.string() }),
  itemOpacity: z.object({ itemInstanceID: z.string(), opacity: num }),
  dropItem: z.object({ fileName: z.string(), x: num, size: num }),
} satisfies Partial<Record<VtsOpKind, z.ZodType>>

export const REPLAYABLE_KINDS = new Set(Object.keys(replayPayloadSchemas))

export function createVtsOperations(config: VtsConfig, conn: VtsConnection, history: VtsHistory) {
  const { call, request } = conn
  const macroRunning = ref<{ macroId: string; stepIndex: number; totalSteps: number } | null>(null)
  const canLoadItems = ref<boolean | null>(null)
  const itemInstancesInScene = ref<VtsItemInstance[]>([])
  const availableItemFiles = ref<VtsAvailableItemFile[]>([])
  const holdTimers = new Map<string, number>()

  async function triggerHotkey(hotkeyID: string) {
    await call('hotkeyTrigger', hotkeyID, async (c) => c.hotkeyTrigger({ hotkeyID }), { hotkeyID })
    // 表情类热键会改变表情状态, 同步给操作台高亮
    if (conn.hotkeys.value.find((h) => h.hotkeyID === hotkeyID)?.type.includes('Expression')) {
      await conn.refreshExpressions()
    }
  }

  async function setExpression(file: string, active: boolean) {
    await call(
      'expressionSet',
      `${file}:${active}`,
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

  async function moveModel(t: ModelTransform) {
    const payload = { ...t }
    await call('moveModel', undefined, async (c) => c.moveModel({ ...payload, valuesAreRelativeToModel: false }), payload)
  }

  async function applyPreset(presetId: string) {
    const preset = config.presets.value.find((p) => p.id === presetId)
    if (!preset) throw new Error('预设不存在')
    await moveModel(preset)
  }

  async function injectParametersAdd(values: ParamValue[]) {
    if (values.length === 0) return
    await call(
      'injectParam',
      values.map((v) => v.id).join(','),
      async (c) => c.injectParameterData({ mode: 'add', parameterValues: values }),
      { values },
    )
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
        await injectParametersAdd([{ id: slot.parameterId, value: slot.value, weight: slot.weight }])
      } catch (err) {
        stopParamHold(slotId)
        conn.lastError.value = err instanceof Error ? err.message : String(err)
      }
    }, PARAM_HOLD_INTERVAL_MS)
    holdTimers.set(slotId, timer)
  }

  function stopAllParamHolds() {
    for (const slotId of holdTimers.keys()) stopParamHold(slotId)
  }

  async function removeParamSlot(id: string) {
    stopParamHold(id)
    await config.removeParamSlotConfig(id)
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
    // vtubestudio 库把 loadedCount 标成 boolean, 实际协议返回数量
    availableItemFiles.value = data.availableItemFiles as unknown as VtsAvailableItemFile[]
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
    if (instanceIDs.length === 0 && fileNames.length === 0) throw new Error('ItemUnload 失败：未指定 instanceIDs 或 fileNames')
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

  async function setItemOpacity(itemInstanceID: string, opacity: number) {
    await call(
      'itemOpacity',
      `${itemInstanceID}:${opacity}`,
      async (c) => c.itemAnimationControl({ itemInstanceID, opacity } as Parameters<typeof c.itemAnimationControl>[0]),
      { itemInstanceID, opacity },
    )
  }

  /** 道具从画面上方掉落, 落地后自动卸载 */
  async function dropItem(fileName: string, options?: { x?: number; size?: number }) {
    const x = options?.x ?? 0
    const size = options?.size ?? 0.32
    await history.withHistory(
      'dropItem',
      fileName,
      async () => {
        const { instanceID } = await loadItem(fileName, { x, y: 1.1, size, fadeTime: 0.1 })
        try {
          await request(async (c) =>
            c.itemMove({
              itemsToMove: [{ itemInstanceID: instanceID, timeInSeconds: 0.6, fadeMode: 'easeIn', positionX: x, positionY: -0.2 }],
            }),
          )
          const landed = await conn.waitForItemEvent(instanceID, ['DroppedPinned', 'DroppedUnpinned'], 1600)
          window.setTimeout(() => void unloadItems({ instanceIDs: [instanceID] }), landed ? 300 : 1200)
        } catch (err) {
          await unloadItems({ instanceIDs: [instanceID] })
          throw err
        }
      },
      { fileName, x, size },
    )
  }

  async function toggleAccessory(id: string, visible: boolean) {
    const acc = config.accessories.value.find((a) => a.id === id)
    if (!acc) throw new Error('配饰不存在')
    if (!acc.itemInstanceID) throw new Error('配饰未绑定实例')
    await setItemOpacity(acc.itemInstanceID, visible ? 1 : 0)
    await config.upsertAccessory({ ...acc, visible })
  }

  async function triggerPanicHotkey(hotkeyID: string, label: string) {
    if (!hotkeyID) throw new Error(`未配置“${label}”热键`)
    await triggerHotkey(hotkeyID)
  }

  async function runPrank(prankId: string) {
    const prank = config.pranks.value.find((p) => p.id === prankId)
    if (!prank) throw new Error('整活不存在')
    if (prank.hotkeyID) return triggerHotkey(prank.hotkeyID)
    if (!prank.fileName) throw new Error('整活未配置道具文件或热键')
    await dropItem(prank.fileName)
  }

  async function playAudio(step: Extract<VtsMacroStep, { type: 'playAudio' }>) {
    const audio = new Audio(step.url)
    if (step.volume !== undefined) audio.volume = step.volume
    const ended = new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve()
      audio.onerror = () => reject(new Error('音效播放失败'))
    })
    await audio.play()
    if (step.waitForEnd) await ended
  }

  async function runMacroStep(step: VtsMacroStep) {
    switch (step.type) {
      case 'hotkey':
        return triggerHotkey(step.hotkeyID)
      case 'preset':
        return applyPreset(step.presetId)
      case 'wait':
        return new Promise<void>((r) => setTimeout(r, step.seconds * 1000))
      case 'injectParam':
        return injectParametersAdd([{ id: step.parameterId, value: step.value, weight: step.weight }])
      case 'accessory':
        return toggleAccessory(step.accessoryId, step.visible)
      case 'prank':
        return runPrank(step.prankId)
      case 'playAudio':
        return playAudio(step)
    }
  }

  async function runMacro(macroId: string) {
    const macro = config.macros.value.find((m) => m.id === macroId)
    if (!macro) throw new Error('宏不存在')
    if (!conn.connected.value) throw new Error('VTS 未连接')
    const totalSteps = macro.steps.length
    try {
      await history.withHistory(
        'macroRun',
        macroId,
        async () => {
          for (const [stepIndex, step] of macro.steps.entries()) {
            macroRunning.value = { macroId, stepIndex, totalSteps }
            await runMacroStep(step)
          }
        },
        { macroId },
      )
    } finally {
      macroRunning.value = null
    }
  }

  const replay =
    <S extends z.ZodType>(schema: S, fn: (p: z.output<S>) => Promise<unknown>) =>
    async (raw: unknown) =>
      fn(schema.parse(raw))
  const replayers = {
    hotkeyTrigger: replay(replayPayloadSchemas.hotkeyTrigger, async (p) => triggerHotkey(p.hotkeyID)),
    expressionSet: replay(replayPayloadSchemas.expressionSet, async (p) => setExpression(p.file, p.active)),
    moveModel: replay(replayPayloadSchemas.moveModel, moveModel),
    injectParam: replay(replayPayloadSchemas.injectParam, async (p) => injectParametersAdd(p.values)),
    macroRun: replay(replayPayloadSchemas.macroRun, async (p) => runMacro(p.macroId)),
    itemOpacity: replay(replayPayloadSchemas.itemOpacity, async (p) => setItemOpacity(p.itemInstanceID, p.opacity)),
    dropItem: replay(replayPayloadSchemas.dropItem, async (p) => dropItem(p.fileName, p)),
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

    triggerHotkey,
    setExpression,
    toggleExpression,
    clearExpressions,
    moveModel,
    applyPreset,
    injectParametersAdd,
    startParamHold,
    stopParamHold,
    stopAllParamHolds,
    removeParamSlot,
    refreshItems,
    loadItem,
    unloadItems,
    setItemOpacity,
    dropItem,
    toggleAccessory,
    panicCalibrate: async () => triggerPanicHotkey(config.panicConfig.value.calibrateHotkeyId, '校准'),
    panicResetPhysics: async () => triggerPanicHotkey(config.panicConfig.value.resetPhysicsHotkeyId, '重置物理'),
    runMacro,
    replayHistoryRecord,
  }
}

export type VtsOperations = ReturnType<typeof createVtsOperations>
