import { z } from 'zod'

const id = z.string().trim().min(1)

export const presetSchema = z.object({
  id,
  name: z.string(),
  timeInSeconds: z.number(),
  positionX: z.number(),
  positionY: z.number(),
  rotation: z.number(),
  size: z.number(),
})

export const macroStepSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('hotkey'), hotkeyID: id }),
  z.object({ type: z.literal('expression'), file: id, active: z.boolean() }),
  z.object({ type: z.literal('clearExpressions') }),
  z.object({ type: z.literal('preset'), presetId: id }),
  z.object({ type: z.literal('wait'), seconds: z.number().nonnegative() }),
  z.object({
    type: z.literal('injectParam'),
    parameterId: id,
    value: z.number(),
    weight: z.number().optional(),
    mode: z.enum(['add', 'set']).optional(),
  }),
  z.object({ type: z.literal('accessory'), accessoryId: id, visible: z.boolean() }),
  z.object({ type: z.literal('prank'), prankId: id }),
  z.object({
    type: z.literal('colorTint'),
    color: z.string(),
    rainbow: z.boolean().optional(),
    reset: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('postProcessing'),
    enabled: z.boolean(),
    preset: z.string().optional(),
    fadeTime: z.number().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('playAudio'),
    url: id,
    volume: z.number().min(0).max(1).optional(),
    waitForEnd: z.boolean().optional(),
  }),
])

export const macroSchema = z.object({ id, name: z.string(), steps: z.array(macroStepSchema) })

export const paramSlotSchema = z.object({
  id,
  name: z.string(),
  parameterId: id,
  min: z.number(),
  max: z.number(),
  step: z.number(),
  weight: z.number(),
  value: z.number(),
  defaultValue: z.number().optional(),
  mode: z.enum(['add', 'set']).optional(),
  hold: z.boolean(),
})

export const panicSchema = z.object({ calibrateHotkeyId: z.string(), resetPhysicsHotkeyId: z.string() })

export const obsLinkSchema = z.object({
  enabled: z.boolean(),
  debounceMs: z.number().nonnegative(),
  sceneToPresetId: z.record(z.string(), z.string()),
})

export const hotkeyCustomSchema = z.object({
  hotkeyID: id,
  pinned: z.boolean().optional(),
  group: z.string().optional(),
  color: z.string().optional(),
  iconDataUrl: z.string().optional(),
  displayName: z.string().optional(),
})

export const accessorySchema = z.object({
  id,
  name: z.string(),
  itemInstanceID: z.string(),
  fileName: z.string().optional(),
  visible: z.boolean(),
})

export const prankSchema = z.object({
  id,
  name: z.string(),
  fileName: z.string(),
  hotkeyID: z.string().optional(),
  dropX: z.number().optional(),
  dropSize: z.number().optional(),
  randomX: z.boolean().optional(),
})

export const DECK_ACTION_TYPES = [
  'expression',
  'clearExpressions',
  'hotkey',
  'preset',
  'macro',
  'accessory',
  'dropItem',
  'colorTint',
  'postProcessing',
  'panicCalibrate',
  'panicReset',
] as const

export const deckTileSchema = z.object({
  id,
  type: z.enum(DECK_ACTION_TYPES),
  /** 表情文件 / 热键 ID / 预设 ID / 宏 ID / 配饰 ID / 道具文件名 / 染色(#hex|rainbow|reset) / 滤镜(预设名|__off__); 无目标的动作为空串 */
  targetId: z.string(),
  label: z.string(),
  color: z.string().optional(),
  shortcut: z.string().optional(),
  group: z.string().optional(),
})

export const profileDataSchema = z.object({
  hotkeyCustomizations: z.array(hotkeyCustomSchema),
  presets: z.array(presetSchema),
  macros: z.array(macroSchema),
  paramSlots: z.array(paramSlotSchema),
  panic: panicSchema,
  obsLink: obsLinkSchema,
  accessories: z.array(accessorySchema),
  pranks: z.array(prankSchema),
  deck: z.array(deckTileSchema).optional(),
})

export const profileExportSchema = z.object({
  version: z.literal(1),
  name: id,
  modelId: z.string().optional(),
  modelName: z.string().optional(),
  autoApplyOnModelLoad: z.boolean().optional(),
  data: profileDataSchema,
})

export const minimalExportSchema = z.object({
  version: z.literal(1),
  wsUrl: id,
  authToken: z.string().optional(),
})

export const fullExportSchema = z.object({
  ...profileDataSchema.shape,
  version: z.literal(2),
  wsUrl: id,
  authToken: z.string().optional(),
  obsLink: obsLinkSchema.optional(),
  deck: z.array(deckTileSchema).optional(),
})

export type VtsPreset = z.infer<typeof presetSchema>
export type VtsMacroStep = z.infer<typeof macroStepSchema>
export type VtsMacro = z.infer<typeof macroSchema>
export type VtsParamSlot = z.infer<typeof paramSlotSchema>
export type VtsPanicConfig = z.infer<typeof panicSchema>
export type VtsObsLinkConfig = z.infer<typeof obsLinkSchema>
export type VtsHotkeyCustomization = z.infer<typeof hotkeyCustomSchema>
export type VtsAccessoryBinding = z.infer<typeof accessorySchema>
export type VtsPrankBinding = z.infer<typeof prankSchema>
export type VtsDeckActionType = (typeof DECK_ACTION_TYPES)[number]
export type VtsDeckTile = z.infer<typeof deckTileSchema>
export type VtsProfileData = z.infer<typeof profileDataSchema>
export type VtsProfileExportV1 = z.infer<typeof profileExportSchema>
export type VtsMinimalExportV1 = z.infer<typeof minimalExportSchema>
export type VtsExportV2 = z.infer<typeof fullExportSchema>

export interface VtsProfile {
  id: string
  name: string
  modelId?: string
  modelName?: string
  autoApplyOnModelLoad?: boolean
  data: VtsProfileData
}

/** 外部导入数据的唯一校验入口 */
export function parseImport<T extends z.ZodType>(schema: T, payload: unknown): z.infer<T> {
  const result = schema.safeParse(payload)
  if (!result.success) throw new Error(`导入失败：${z.prettifyError(result.error)}`)
  return result.data
}
