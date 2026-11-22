export type TypingCatCoatId = 'tuxedo' | 'orange' | 'tabby' | 'calico' | 'white' | 'blue'

export type TypingCatAutoMode = 'off' | 'chill' | 'normal' | 'fast'

export type TypingCatIdleActivity = 'off' | 'quiet' | 'normal' | 'lively'

export type TypingCatTurboSensitivity = 'easy' | 'normal' | 'hard'

export type TypingCatDeskThemeId = 'classic' | 'dark' | 'sakura' | 'mint' | 'cyber'

export interface TypingCatDeskTheme {
  id: TypingCatDeskThemeId
  name: string
  base: string
  plain: string
  mod: string
  accent: string
  mouse: string
  /** 为空时跟随猫咪主眼虹膜色 */
  hit: string | null
}

export const TYPING_CAT_DESK_THEMES: readonly TypingCatDeskTheme[] = [
  {
    id: 'classic',
    name: '经典复古',
    base: '#22231f',
    plain: '#fbfbf3',
    mod: '#e3dfce',
    accent: '#f2b25c',
    mouse: '#fbfbf3',
    hit: null,
  },
  {
    id: 'dark',
    name: '暗黑机械',
    base: '#13151a',
    plain: '#2a2e39',
    mod: '#1f232c',
    accent: '#6366f1',
    mouse: '#2a2e39',
    hit: '#38bdf8',
  },
  {
    id: 'sakura',
    name: '樱花粉甜',
    base: '#7a4b5c',
    plain: '#fff5f8',
    mod: '#f9d5e3',
    accent: '#f472b6',
    mouse: '#fff5f8',
    hit: '#fb7185',
  },
  {
    id: 'mint',
    name: '薄荷奶油',
    base: '#31524a',
    plain: '#f5fbf8',
    mod: '#d4eee3',
    accent: '#34d399',
    mouse: '#f5fbf8',
    hit: '#10b981',
  },
  {
    id: 'cyber',
    name: '赛博霓虹',
    base: '#171126',
    plain: '#2b2044',
    mod: '#211837',
    accent: '#f43f5e',
    mouse: '#2b2044',
    hit: '#22d3ee',
  },
] as const

export interface TypingCatAccessories {
  headphones: boolean
  collar: boolean
  glasses: boolean
  crown: boolean
}

export const DEFAULT_TYPING_CAT_ACCESSORIES: TypingCatAccessories = {
  headphones: false,
  collar: false,
  glasses: false,
  crown: false,
}

export const TYPING_CAT_ACCESSORY_SPECS: readonly { key: keyof TypingCatAccessories; label: string }[] = [
  { key: 'headphones', label: '头戴式耳机' },
  { key: 'collar', label: '蝴蝶结铃铛项圈' },
  { key: 'glasses', label: '圆框眼镜' },
  { key: 'crown', label: '迷你皇冠' },
] as const

export interface TypingCatLiveReactions {
  enabled: boolean
  onDanmaku: boolean
  onGift: boolean
  onGuardOrSc: boolean
}

export const DEFAULT_TYPING_CAT_LIVE_REACTIONS: TypingCatLiveReactions = {
  enabled: false,
  onDanmaku: true,
  onGift: true,
  onGuardOrSc: true,
}

export interface TypingCatCoatPreset {
  id: TypingCatCoatId
  name: string
  pattern?: 'tabby' | 'calico'
  fur: string
  patch: string
  patchA?: string
  patchB?: string
  tail?: string
  line: string
  eye: string
  whisker: string
  whiskerOut?: string
  stripe: string
  inner: string
  swatchAccent?: string
}

export const TYPING_CAT_COATS: readonly TypingCatCoatPreset[] = [
  {
    id: 'tuxedo',
    name: '奶牛猫',
    fur: '#151515',
    patch: '#f8f6ef',
    line: '#8b8f86',
    eye: '#e2b93b',
    whisker: '#f4f4ee',
    stripe: '#151515',
    inner: '#151515',
    swatchAccent: '#f8f6ef',
  },
  {
    id: 'orange',
    name: '橘猫',
    pattern: 'tabby',
    fur: '#e9973f',
    patch: '#fbe8c9',
    line: '#7a4312',
    eye: '#5c8a3a',
    whisker: '#fffaf0',
    stripe: '#c26a1f',
    inner: '#e9973f',
    swatchAccent: '#c26a1f',
  },
  {
    id: 'tabby',
    name: '狸花猫',
    pattern: 'tabby',
    fur: '#a08a6c',
    patch: '#a08a6c',
    line: '#3f3324',
    eye: '#8fae4a',
    whisker: '#f4f0e4',
    stripe: '#4d3d2b',
    inner: '#d9a79a',
    swatchAccent: '#4d3d2b',
  },
  {
    id: 'calico',
    name: '三花猫',
    pattern: 'calico',
    fur: '#f8f6ef',
    patch: '#f8f6ef',
    patchA: '#e9973f',
    patchB: '#1d1c1a',
    tail: '#1d1c1a',
    line: '#8a8676',
    eye: '#c79a2e',
    whisker: '#b5b1a2',
    whiskerOut: '#b5b1a2',
    stripe: '#f8f6ef',
    inner: '#f2b9b0',
    swatchAccent: '#e9973f',
  },
  {
    id: 'white',
    name: '白猫',
    fur: '#f8f6ef',
    patch: '#f8f6ef',
    line: '#8a8676',
    eye: '#5aa9c9',
    whisker: '#b5b1a2',
    whiskerOut: '#b5b1a2',
    stripe: '#f8f6ef',
    inner: '#f2b9b0',
    swatchAccent: '#5aa9c9',
  },
  {
    id: 'blue',
    name: '蓝灰猫',
    fur: '#8090a0',
    patch: '#8090a0',
    line: '#3c4650',
    eye: '#e0a63a',
    whisker: '#f4f4ee',
    stripe: '#667686',
    inner: '#c59aa0',
    swatchAccent: '#e0a63a',
  },
] as const

export interface TypingCatShapeParams {
  headSize: number
  headW: number
  headH: number
  neck: number
  neckW: number
  earSize: number
  earSpread: number
  eyeSize: number
  eyeSpread: number
  eyeY: number
  eyeTilt: number
  bodyW: number
  bodyH: number
  legThick: number
  legGap: number
  footSize: number
  tailThick: number
  shoulderW: number
  whiskY: number
}

export interface TypingCatShapeSpec {
  key: keyof TypingCatShapeParams
  label: string
  min: number
  max: number
  defaultValue: number
}

export const TYPING_CAT_SHAPE_SPECS: readonly TypingCatShapeSpec[] = [
  { key: 'headSize', label: '头的大小', min: 0.75, max: 1.5, defaultValue: 0.86 },
  { key: 'headW', label: '头的宽度', min: 0.8, max: 1.35, defaultValue: 0.94 },
  { key: 'headH', label: '头的高度', min: 0.75, max: 1.25, defaultValue: 1.01 },
  { key: 'neck', label: '头的高低', min: -0.3, max: 0.3, defaultValue: 0.02 },
  { key: 'neckW', label: '脖子宽度', min: 0.8, max: 2.2, defaultValue: 1.31 },
  { key: 'earSize', label: '耳朵大小', min: 0.5, max: 1.6, defaultValue: 1.05 },
  { key: 'earSpread', label: '耳朵间距', min: 0.6, max: 1.4, defaultValue: 0.95 },
  { key: 'eyeSize', label: '眼睛大小', min: 0.6, max: 1.8, defaultValue: 1.2 },
  { key: 'eyeSpread', label: '眼睛间距', min: 0.6, max: 1.5, defaultValue: 0.9 },
  { key: 'eyeY', label: '眼睛高低', min: -0.25, max: 0.4, defaultValue: 0.31 },
  { key: 'eyeTilt', label: '眼睛角度', min: -0.7, max: 0.7, defaultValue: -0.08 },
  { key: 'bodyW', label: '身体宽度', min: 0.7, max: 1.5, defaultValue: 0.86 },
  { key: 'bodyH', label: '身体高度', min: 0.8, max: 1.3, defaultValue: 0.98 },
  { key: 'legThick', label: '腿的粗细', min: 0.5, max: 1.7, defaultValue: 0.97 },
  { key: 'legGap', label: '两腿间距', min: 0.5, max: 1.8, defaultValue: 1 },
  { key: 'footSize', label: '脚的大小', min: 0.6, max: 1.7, defaultValue: 0.89 },
  { key: 'tailThick', label: '尾巴粗细', min: 0.4, max: 1.7, defaultValue: 0.73 },
  { key: 'shoulderW', label: '肩颈宽度', min: 0.8, max: 1.6, defaultValue: 1.15 },
  { key: 'whiskY', label: '胡子高低', min: -0.15, max: 0.25, defaultValue: 0.08 },
] as const

export const DEFAULT_TYPING_CAT_SHAPE: TypingCatShapeParams = TYPING_CAT_SHAPE_SPECS.reduce(
  (acc, spec) => {
    acc[spec.key] = spec.defaultValue
    return acc
  },
  {} as TypingCatShapeParams,
)

export interface TypingCatCustomColors {
  head: string
  body: string
  limbs: string
  ear: string
  inner: string
  tail: string
  paws: string
  eye: string
  eyeRight: string
  pupil: string
  blush: string
  whisker: string
  stripe: string
  line: string
  patchA: string
  patchB: string
}

export interface TypingCatColorSpec {
  key: keyof TypingCatCustomColors
  label: string
  /** 仅在对应花纹预设下显示（如三花斑块） */
  patternOnly?: 'calico'
}

export const TYPING_CAT_COLOR_SPECS: readonly TypingCatColorSpec[] = [
  { key: 'head', label: '头部毛色' },
  { key: 'body', label: '身体毛色' },
  { key: 'limbs', label: '前腿毛色' },
  { key: 'ear', label: '外耳颜色' },
  { key: 'inner', label: '内耳颜色' },
  { key: 'tail', label: '尾巴颜色' },
  { key: 'paws', label: '爪子颜色' },
  { key: 'eye', label: '左眼 / 主眼虹膜' },
  { key: 'eyeRight', label: '右眼虹膜（异瞳）' },
  { key: 'pupil', label: '瞳孔颜色' },
  { key: 'blush', label: '摸头腮红' },
  { key: 'whisker', label: '胡须颜色' },
  { key: 'stripe', label: '额纹 / 虎斑' },
  { key: 'line', label: '轮廓线条' },
  { key: 'patchA', label: '三花斑块 A', patternOnly: 'calico' },
  { key: 'patchB', label: '三花斑块 B', patternOnly: 'calico' },
] as const

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export function normalizeHexColor(val: unknown): string | null {
  if (typeof val !== 'string') return null
  const trimmed = val.trim()
  if (HEX_COLOR_RE.test(trimmed)) return trimmed.toLowerCase()
  return null
}

export function getCoatDefaultColors(coatId?: TypingCatCoatId): TypingCatCustomColors {
  const preset = TYPING_CAT_COATS.find((c) => c.id === coatId) ?? TYPING_CAT_COATS[0]
  return {
    head: preset.fur,
    body: preset.fur,
    limbs: preset.fur,
    ear: preset.fur,
    inner: preset.inner,
    tail: preset.tail ?? preset.fur,
    paws: preset.patch,
    eye: preset.eye,
    eyeRight: preset.eye,
    pupil: '#0b0b0b',
    blush: '#f08f9c',
    whisker: preset.whisker,
    stripe: preset.stripe,
    line: preset.line,
    patchA: preset.patchA ?? '#e9973f',
    patchB: preset.patchB ?? '#1d1c1a',
  }
}

export function resolveTypingCatColors(
  coatId?: TypingCatCoatId,
  overrides?: Partial<TypingCatCustomColors>,
): TypingCatCustomColors {
  const preset = TYPING_CAT_COATS.find((c) => c.id === coatId) ?? TYPING_CAT_COATS[0]
  const base = getCoatDefaultColors(preset.id)
  if (!overrides) return base
  for (const spec of TYPING_CAT_COLOR_SPECS) {
    const hex = normalizeHexColor(overrides[spec.key])
    if (hex) base[spec.key] = hex
  }
  // 右眼未单独设置时默认跟随主眼虹膜色；单独设置后即呈异瞳效果
  if (!normalizeHexColor(overrides.eyeRight)) {
    base.eyeRight = base.eye
  }
  // 无额纹花色（额纹默认同底色）在改头色且未单独指定额纹色时，额纹自动跟随头部颜色避免意外显露黑点
  if (preset.stripe.toLowerCase() === preset.fur.toLowerCase() && !normalizeHexColor(overrides.stripe)) {
    base.stripe = base.head
  }
  return base
}

export interface TypingCatState {
  coat: TypingCatCoatId
  deskTheme: TypingCatDeskThemeId
  showKeyboard: boolean
  showMouse: boolean
  leftMouse: boolean
  followKeys: boolean
  showKeyChips: boolean
  showSpeedBadge: boolean
  showOutline: boolean
  mirror: boolean
  scale: number
  opacity: number
  /** 镜头水平偏航角（-30 ~ 30 度） */
  cameraYaw: number
  /** 无人操作后自动入睡分钟数，0 表示不自动入睡 */
  sleepMinutes: number
  /** OBS 自主打字演示节奏 */
  autoTyping: TypingCatAutoMode
  /** 待机小动作（打哈欠、舔爪、歪头、扑击等）触发频率 */
  idleActivity: TypingCatIdleActivity
  /** 闲置片刻后先缩成猫面包揣手待机 */
  loafOnIdle: boolean
  /** 点击/按住头部抚摸互动 */
  allowPetting: boolean
  /** 高速打字时眯眼并让尾巴加入拍打键盘 */
  turboTailTyping: boolean
  /** 高速狂暴模式触发灵敏度 */
  turboSensitivity: TypingCatTurboSensitivity
  /** 3D 头饰与颈饰穿戴开关 */
  accessories: TypingCatAccessories
  /** 直播间弹幕/礼物/舰长事件联动 */
  liveReactions: TypingCatLiveReactions
  /** 仅保存偏离当前花色默认值的部位自定义配色 */
  colors: Partial<TypingCatCustomColors>
  /** 仅保存偏离默认值的体型参数 */
  shape: Partial<TypingCatShapeParams>
}

export const DEFAULT_TYPING_CAT_STATE: TypingCatState = {
  coat: 'tuxedo',
  deskTheme: 'classic',
  showKeyboard: true,
  showMouse: true,
  leftMouse: false,
  followKeys: true,
  showKeyChips: true,
  showSpeedBadge: false,
  showOutline: true,
  mirror: false,
  scale: 100,
  opacity: 100,
  cameraYaw: 0,
  sleepMinutes: 5,
  autoTyping: 'off',
  idleActivity: 'normal',
  loafOnIdle: true,
  allowPetting: true,
  turboTailTyping: true,
  turboSensitivity: 'normal',
  accessories: { ...DEFAULT_TYPING_CAT_ACCESSORIES },
  liveReactions: { ...DEFAULT_TYPING_CAT_LIVE_REACTIONS },
  colors: {},
  shape: {},
}

export const TYPING_CAT_CONFIG_FILE_TYPE = 'vtsuru-typing-cat-config'

export interface TypingCatConfigFile {
  type: typeof TYPING_CAT_CONFIG_FILE_TYPE
  version: 1
  exportedAt: string
  config: TypingCatState
}

const VALID_COAT_IDS = new Set<string>(TYPING_CAT_COATS.map((c) => c.id))
const VALID_DESK_THEMES = new Set<string>(TYPING_CAT_DESK_THEMES.map((t) => t.id))
const VALID_AUTO_MODES = new Set<string>(['off', 'chill', 'normal', 'fast'])
const VALID_IDLE_ACTIVITIES = new Set<string>(['off', 'quiet', 'normal', 'lively'])
const VALID_TURBO_SENSITIVITIES = new Set<string>(['easy', 'normal', 'hard'])
const STATE_KEYS = new Set<string>(Object.keys(DEFAULT_TYPING_CAT_STATE))

export function createTypingCatConfigExport(state: TypingCatState): TypingCatConfigFile {
  return {
    type: TYPING_CAT_CONFIG_FILE_TYPE,
    version: 1,
    exportedAt: new Date().toISOString(),
    config: {
      ...DEFAULT_TYPING_CAT_STATE,
      ...state,
      accessories: { ...DEFAULT_TYPING_CAT_ACCESSORIES, ...state.accessories },
      liveReactions: { ...DEFAULT_TYPING_CAT_LIVE_REACTIONS, ...state.liveReactions },
      colors: { ...state.colors },
      shape: { ...state.shape },
    },
  }
}

export function parseTypingCatConfigImport(rawText: string): TypingCatState {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error('配置文件不是有效的 JSON 格式')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('配置文件结构无效')
  }

  const root = parsed as Record<string, unknown>
  if ('type' in root && root.type !== TYPING_CAT_CONFIG_FILE_TYPE) {
    throw new Error('不是小猫打字组件的配置文件')
  }

  const source =
    root.config && typeof root.config === 'object' && !Array.isArray(root.config)
      ? (root.config as Record<string, unknown>)
      : root

  const recognizedKeys = Object.keys(source).filter((k) => STATE_KEYS.has(k))
  if (recognizedKeys.length === 0) {
    throw new Error('配置文件中未包含有效的小猫打字配置项')
  }

  const coat: TypingCatCoatId =
    typeof source.coat === 'string' && VALID_COAT_IDS.has(source.coat)
      ? (source.coat as TypingCatCoatId)
      : DEFAULT_TYPING_CAT_STATE.coat

  const deskTheme: TypingCatDeskThemeId =
    typeof source.deskTheme === 'string' && VALID_DESK_THEMES.has(source.deskTheme)
      ? (source.deskTheme as TypingCatDeskThemeId)
      : DEFAULT_TYPING_CAT_STATE.deskTheme

  const autoTyping: TypingCatAutoMode =
    typeof source.autoTyping === 'string' && VALID_AUTO_MODES.has(source.autoTyping)
      ? (source.autoTyping as TypingCatAutoMode)
      : DEFAULT_TYPING_CAT_STATE.autoTyping

  const idleActivity: TypingCatIdleActivity =
    typeof source.idleActivity === 'string' && VALID_IDLE_ACTIVITIES.has(source.idleActivity)
      ? (source.idleActivity as TypingCatIdleActivity)
      : DEFAULT_TYPING_CAT_STATE.idleActivity

  const turboSensitivity: TypingCatTurboSensitivity =
    typeof source.turboSensitivity === 'string' && VALID_TURBO_SENSITIVITIES.has(source.turboSensitivity)
      ? (source.turboSensitivity as TypingCatTurboSensitivity)
      : DEFAULT_TYPING_CAT_STATE.turboSensitivity

  const clampNum = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback
  }

  const boolOr = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

  const shape: Partial<TypingCatShapeParams> = {}
  if (source.shape && typeof source.shape === 'object' && !Array.isArray(source.shape)) {
    const rawShape = source.shape as Record<string, unknown>
    for (const spec of TYPING_CAT_SHAPE_SPECS) {
      const val = Number(rawShape[spec.key])
      if (Number.isFinite(val)) {
        const clamped = Number(Math.max(spec.min, Math.min(spec.max, val)).toFixed(2))
        if (Math.abs(clamped - spec.defaultValue) >= 0.001) {
          shape[spec.key] = clamped
        }
      }
    }
  }

  const colors: Partial<TypingCatCustomColors> = {}
  if (source.colors && typeof source.colors === 'object' && !Array.isArray(source.colors)) {
    const rawColors = source.colors as Record<string, unknown>
    const defaults = getCoatDefaultColors(coat)
    for (const spec of TYPING_CAT_COLOR_SPECS) {
      const hex = normalizeHexColor(rawColors[spec.key])
      if (hex && hex !== defaults[spec.key].toLowerCase()) {
        colors[spec.key] = hex
      }
    }
  }

  const accessories: TypingCatAccessories = { ...DEFAULT_TYPING_CAT_ACCESSORIES }
  if (source.accessories && typeof source.accessories === 'object' && !Array.isArray(source.accessories)) {
    const rawAcc = source.accessories as Record<string, unknown>
    for (const spec of TYPING_CAT_ACCESSORY_SPECS) {
      accessories[spec.key] = boolOr(rawAcc[spec.key], DEFAULT_TYPING_CAT_ACCESSORIES[spec.key])
    }
  }

  const liveReactions: TypingCatLiveReactions = { ...DEFAULT_TYPING_CAT_LIVE_REACTIONS }
  if (source.liveReactions && typeof source.liveReactions === 'object' && !Array.isArray(source.liveReactions)) {
    const rawLive = source.liveReactions as Record<string, unknown>
    liveReactions.enabled = boolOr(rawLive.enabled, DEFAULT_TYPING_CAT_LIVE_REACTIONS.enabled)
    liveReactions.onDanmaku = boolOr(rawLive.onDanmaku, DEFAULT_TYPING_CAT_LIVE_REACTIONS.onDanmaku)
    liveReactions.onGift = boolOr(rawLive.onGift, DEFAULT_TYPING_CAT_LIVE_REACTIONS.onGift)
    liveReactions.onGuardOrSc = boolOr(rawLive.onGuardOrSc, DEFAULT_TYPING_CAT_LIVE_REACTIONS.onGuardOrSc)
  }

  return {
    coat,
    deskTheme,
    showKeyboard: boolOr(source.showKeyboard, DEFAULT_TYPING_CAT_STATE.showKeyboard),
    showMouse: boolOr(source.showMouse, DEFAULT_TYPING_CAT_STATE.showMouse),
    leftMouse: boolOr(source.leftMouse, DEFAULT_TYPING_CAT_STATE.leftMouse),
    followKeys: boolOr(source.followKeys, DEFAULT_TYPING_CAT_STATE.followKeys),
    showKeyChips: boolOr(source.showKeyChips, DEFAULT_TYPING_CAT_STATE.showKeyChips),
    showSpeedBadge: boolOr(source.showSpeedBadge, DEFAULT_TYPING_CAT_STATE.showSpeedBadge),
    showOutline: boolOr(source.showOutline, DEFAULT_TYPING_CAT_STATE.showOutline),
    mirror: boolOr(source.mirror, DEFAULT_TYPING_CAT_STATE.mirror),
    scale: Math.round(clampNum(source.scale, 60, 140, DEFAULT_TYPING_CAT_STATE.scale)),
    opacity: Math.round(clampNum(source.opacity, 35, 100, DEFAULT_TYPING_CAT_STATE.opacity)),
    cameraYaw: Math.round(clampNum(source.cameraYaw, -30, 30, DEFAULT_TYPING_CAT_STATE.cameraYaw)),
    sleepMinutes: Math.round(clampNum(source.sleepMinutes, 0, 60, DEFAULT_TYPING_CAT_STATE.sleepMinutes)),
    autoTyping,
    idleActivity,
    loafOnIdle: boolOr(source.loafOnIdle, DEFAULT_TYPING_CAT_STATE.loafOnIdle),
    allowPetting: boolOr(source.allowPetting, DEFAULT_TYPING_CAT_STATE.allowPetting),
    turboTailTyping: boolOr(source.turboTailTyping, DEFAULT_TYPING_CAT_STATE.turboTailTyping),
    turboSensitivity,
    accessories,
    liveReactions,
    colors,
    shape,
  }
}

export type TypingCatAction =
  | { type: 'KEY_DOWN'; code: string }
  | { type: 'KEY_UP'; code: string }
  | { type: 'KEY_TAP'; code: string }
  | { type: 'MOUSE_DOWN'; button: string }
  | { type: 'MOUSE_UP'; button: string }
  | { type: 'MOUSE_MOVE'; dx?: number; dy?: number }
  | { type: 'PET' }
  | { type: 'SPIN' }
  | { type: 'SLEEP' }
  | { type: 'WAKE' }
  | { type: 'STRETCH' }
  | { type: 'YAWN' }
  | { type: 'LICK' }
  | { type: 'POUNCE' }
  | { type: 'LOAF' }
  | { type: 'BURST' }
  | { type: 'CLEAR' }
