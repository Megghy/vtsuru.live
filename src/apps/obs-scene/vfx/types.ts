export type VfxLayerMode = 'preset' | 'shader' | 'media'

export type VfxBlendMode =
  | 'normal'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'multiply'
  | 'lighten'
  | 'color-dodge'

export type VfxPresetId =
  | 'vignette'
  | 'film-grain'
  | 'crt-scanlines'
  | 'vhs-glitch'
  | 'light-leak'
  | 'letterbox'
  | 'color-tint'
  | 'backdrop-filter'
  | 'sakura'
  | 'snow'
  | 'rain'
  | 'sparkles'
  | 'bokeh'
  | 'speed-lines'

export type VfxMediaFormat = 'auto' | 'video' | 'image' | 'lottie' | 'rive' | 'svga' | 'pag'

export type VfxMediaAlphaMode = 'native' | 'luma-key' | 'chroma-key'

export interface VfxPresetConfig {
  id: VfxPresetId
  /** 主强度 0~1 */
  intensity: number
  /** 动画速度倍率 0~3 */
  speed: number
  /** 粒子/颗粒密度 0.1~2 */
  density: number
  /** 元素尺寸/粗细 0.2~3 */
  size: number
  /** 主色 */
  color1: string
  /** 辅助色 */
  color2: string
  /** 方向角度（度） */
  angle: number
  /** 以下字段用于同槽位 Web backdrop-filter 模式 */
  backdropBlur: number
  backdropBrightness: number
  backdropContrast: number
  backdropSaturate: number
  backdropHueRotate: number
  backdropGrayscale: number
  backdropSepia: number
}

export interface VfxShaderConfig {
  templateId: string
  /** Shadertoy 风格片元着色器代码（实现 mainImage(out vec4 fragColor, in vec2 fragCoord)） */
  fragmentCode: string
  speed: number
  intensity: number
  color1: string
  color2: string
  /** 4 个通用自定义 Uniform 滑块 uParam1~uParam4 (0~1) */
  params: [number, number, number, number]
}

export interface VfxMediaConfig {
  url: string
  format: VfxMediaFormat
  /** 视频透明通道模式：原生透明(WebM Alpha) / 黑底去黑转Alpha / 色键抠底(绿幕等) */
  alphaMode: VfxMediaAlphaMode
  /** 色键抠底目标颜色 */
  keyColor: string
  /** 去底阈值 0~1 */
  keyThreshold: number
  /** 去底柔边 0~0.5 */
  keySmoothness: number
  objectFit: 'contain' | 'cover' | 'fill'
  loop: boolean
  muted: boolean
  playbackRate: number
  /** 可选前景色染色（用于单色光效快速换色） */
  tintColor: string
  tintStrength: number
  /** Rive 可选状态机/画板名 */
  riveStateMachine?: string
  riveArtboard?: string
}

export interface VfxLayerConfig {
  mode: VfxLayerMode
  blendMode: VfxBlendMode
  preset: VfxPresetConfig
  shader: VfxShaderConfig
  media: VfxMediaConfig
}

export type ObsColorPresetId =
  | 'none'
  | 'fresh'
  | 'warm-film'
  | 'cyber-neon'
  | 'cool-cinematic'
  | 'vintage-bw'
  | 'soft-pastel'
  | 'dark-night'
  | 'custom'

export interface ObsNativeColorFilterConfig {
  enabled: boolean
  /** -3 ~ 3, 默认 0 */
  gamma: number
  /** -2 ~ 2, 默认 0 */
  contrast: number
  /** -1 ~ 1, 默认 0 */
  brightness: number
  /** -1 ~ 5, 默认 0 */
  saturation: number
  /** -180 ~ 180, 默认 0 */
  hueShift: number
  /** 0 ~ 1, 默认 1 */
  opacity: number
  /** 乘法着色 #ffffff 为无变化 */
  colorMultiply: string
  /** 加法着色 #000000 为无变化 */
  colorAdd: string
}

export interface ObsNativeSharpnessFilterConfig {
  enabled: boolean
  /** 0 ~ 1 */
  amount: number
}

export interface ObsNativeLutFilterConfig {
  enabled: boolean
  /** 内置 LUT ID（如 'teal-orange'），'custom' 表示自定义上传/本地路径 */
  presetId: string
  /** 纯网页直连 OBS 时可手填的本机 .cube/.png 绝对路径 */
  customPath?: string
  /** 上传到云端或外链的 .cube/.png URL（连接桌面客户端时自动缓存落盘） */
  customUrl?: string
  /** 小型 .cube 文本内联内容（无需后端部署也能经客户端直接落盘） */
  inlineCubeText?: string
  customName?: string
  /** 混合强度 0 ~ 1 */
  amount: number
}

export interface ObsNativeShaderFilterConfig {
  enabled: boolean
  /** 内置 HLSL 预设 ID，'custom' 表示自定义源码 */
  presetId: string
  /** 可选：本机已有 .shader 路径（优先于源码） */
  customPath?: string
  /** 自定义 HLSL 源码（obs-shaderfilter 格式） */
  customCode?: string
  customName?: string
  /** 可调参数（映射到 obs-shaderfilter 的 uniform settings） */
  intensity: number
  speed: number
  param1: number
  param2: number
}

export interface ObsNativeFilterConfig {
  enabled: boolean
  colorPreset: ObsColorPresetId
  color: ObsNativeColorFilterConfig
  sharpness: ObsNativeSharpnessFilterConfig
  lut: ObsNativeLutFilterConfig
  shaderFilter: ObsNativeShaderFilterConfig
}

export const DEFAULT_SHADER_FRAGMENT_CODE = `// Shadertoy 兼容片元着色器
// 内置变量: iTime (秒), iResolution (vec2), uIntensity, uSpeed, uColor1, uColor2, uParam1..uParam4
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= iResolution.x / max(1.0, iResolution.y);

  float t = iTime * (0.4 + uSpeed * 0.6);
  float wave = sin(p.x * 2.4 + t) * cos(p.y * 2.0 - t * 0.7);
  float band = smoothstep(0.15, 0.95, 0.5 + 0.5 * sin(p.y * 3.5 + wave * (1.2 + uParam1 * 2.0) - t));
  float edgeFade = smoothstep(1.35, 0.25, length(p * vec2(0.75, 1.0)));

  vec3 col = mix(uColor1, uColor2, band);
  float alpha = band * edgeFade * 0.42 * uIntensity;
  fragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}`

const VALID_VFX_MODES = new Set<VfxLayerMode>(['preset', 'shader', 'media'])
const VALID_BLEND_MODES = new Set<VfxBlendMode>([
  'normal',
  'screen',
  'overlay',
  'soft-light',
  'multiply',
  'lighten',
  'color-dodge',
])
const VALID_PRESET_IDS = new Set<VfxPresetId>([
  'vignette',
  'film-grain',
  'crt-scanlines',
  'vhs-glitch',
  'light-leak',
  'letterbox',
  'color-tint',
  'backdrop-filter',
  'sakura',
  'snow',
  'rain',
  'sparkles',
  'bokeh',
  'speed-lines',
])
const VALID_MEDIA_FORMATS = new Set<VfxMediaFormat>(['auto', 'video', 'image', 'lottie', 'rive', 'svga', 'pag'])
const VALID_ALPHA_MODES = new Set<VfxMediaAlphaMode>(['native', 'luma-key', 'chroma-key'])
const VALID_COLOR_PRESETS = new Set<ObsColorPresetId>([
  'none',
  'fresh',
  'warm-film',
  'cyber-neon',
  'cool-cinematic',
  'vintage-bw',
  'soft-pastel',
  'dark-night',
  'custom',
])

function clampNum(raw: unknown, min: number, max: number, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function strOr(raw: unknown, fallback: string): string {
  return typeof raw === 'string' && raw.trim() ? raw.trim() : fallback
}

export function createDefaultVfxConfig(mode: VfxLayerMode = 'preset', presetId: VfxPresetId = 'vignette'): VfxLayerConfig {
  return {
    mode,
    blendMode: 'normal',
    preset: {
      id: presetId,
      intensity: 0.6,
      speed: 1,
      density: 1,
      size: 1,
      color1: '#000000',
      color2: '#38bdf8',
      angle: 135,
      backdropBlur: 8,
      backdropBrightness: 100,
      backdropContrast: 100,
      backdropSaturate: 100,
      backdropHueRotate: 0,
      backdropGrayscale: 0,
      backdropSepia: 0,
    },
    shader: {
      templateId: 'aurora-veil',
      fragmentCode: DEFAULT_SHADER_FRAGMENT_CODE,
      speed: 1,
      intensity: 0.8,
      color1: '#38bdf8',
      color2: '#c084fc',
      params: [0.5, 0.5, 0.5, 0.5],
    },
    media: {
      url: '',
      format: 'auto',
      alphaMode: 'native',
      keyColor: '#00ff00',
      keyThreshold: 0.14,
      keySmoothness: 0.12,
      objectFit: 'contain',
      loop: true,
      muted: true,
      playbackRate: 1,
      tintColor: '#ffffff',
      tintStrength: 0,
    },
  }
}

export function normalizeVfxConfig(raw: unknown): VfxLayerConfig {
  const base = createDefaultVfxConfig()
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Partial<VfxLayerConfig>

  const mode = VALID_VFX_MODES.has(obj.mode as VfxLayerMode) ? (obj.mode as VfxLayerMode) : base.mode
  const blendMode = VALID_BLEND_MODES.has(obj.blendMode as VfxBlendMode)
    ? (obj.blendMode as VfxBlendMode)
    : base.blendMode

  const p = (obj.preset ?? {}) as Partial<VfxPresetConfig>
  const presetId = VALID_PRESET_IDS.has(p.id as VfxPresetId) ? (p.id as VfxPresetId) : base.preset.id

  const s = (obj.shader ?? {}) as Partial<VfxShaderConfig>
  const rawParams = Array.isArray(s.params) ? s.params : []
  const params: [number, number, number, number] = [
    clampNum(rawParams[0], 0, 1, 0.5),
    clampNum(rawParams[1], 0, 1, 0.5),
    clampNum(rawParams[2], 0, 1, 0.5),
    clampNum(rawParams[3], 0, 1, 0.5),
  ]

  const m = (obj.media ?? {}) as Partial<VfxMediaConfig>
  const format = VALID_MEDIA_FORMATS.has(m.format as VfxMediaFormat) ? (m.format as VfxMediaFormat) : 'auto'
  const alphaMode = VALID_ALPHA_MODES.has(m.alphaMode as VfxMediaAlphaMode)
    ? (m.alphaMode as VfxMediaAlphaMode)
    : 'native'
  const objectFit = m.objectFit === 'cover' || m.objectFit === 'fill' ? m.objectFit : 'contain'

  return {
    mode,
    blendMode,
    preset: {
      id: presetId,
      intensity: clampNum(p.intensity, 0, 1, base.preset.intensity),
      speed: clampNum(p.speed, 0, 3, base.preset.speed),
      density: clampNum(p.density, 0.1, 2, base.preset.density),
      size: clampNum(p.size, 0.2, 3, base.preset.size),
      color1: strOr(p.color1, base.preset.color1),
      color2: strOr(p.color2, base.preset.color2),
      angle: clampNum(p.angle, 0, 360, base.preset.angle),
      backdropBlur: clampNum(p.backdropBlur, 0, 64, base.preset.backdropBlur),
      backdropBrightness: clampNum(p.backdropBrightness, 0, 200, base.preset.backdropBrightness),
      backdropContrast: clampNum(p.backdropContrast, 0, 200, base.preset.backdropContrast),
      backdropSaturate: clampNum(p.backdropSaturate, 0, 300, base.preset.backdropSaturate),
      backdropHueRotate: clampNum(p.backdropHueRotate, -180, 180, base.preset.backdropHueRotate),
      backdropGrayscale: clampNum(p.backdropGrayscale, 0, 100, base.preset.backdropGrayscale),
      backdropSepia: clampNum(p.backdropSepia, 0, 100, base.preset.backdropSepia),
    },
    shader: {
      templateId: strOr(s.templateId, base.shader.templateId),
      fragmentCode: typeof s.fragmentCode === 'string' && s.fragmentCode.trim() ? s.fragmentCode : base.shader.fragmentCode,
      speed: clampNum(s.speed, 0, 3, base.shader.speed),
      intensity: clampNum(s.intensity, 0, 1, base.shader.intensity),
      color1: strOr(s.color1, base.shader.color1),
      color2: strOr(s.color2, base.shader.color2),
      params,
    },
    media: {
      url: typeof m.url === 'string' ? m.url.trim() : '',
      format,
      alphaMode,
      keyColor: strOr(m.keyColor, base.media.keyColor),
      keyThreshold: clampNum(m.keyThreshold, 0, 1, base.media.keyThreshold),
      keySmoothness: clampNum(m.keySmoothness, 0, 0.5, base.media.keySmoothness),
      objectFit,
      loop: m.loop !== false,
      muted: m.muted !== false,
      playbackRate: clampNum(m.playbackRate, 0.1, 4, 1),
      tintColor: strOr(m.tintColor, '#ffffff'),
      tintStrength: clampNum(m.tintStrength, 0, 1, 0),
      riveStateMachine: typeof m.riveStateMachine === 'string' && m.riveStateMachine.trim() ? m.riveStateMachine.trim() : undefined,
      riveArtboard: typeof m.riveArtboard === 'string' && m.riveArtboard.trim() ? m.riveArtboard.trim() : undefined,
    },
  }
}

export function createDefaultObsNativeFilterConfig(): ObsNativeFilterConfig {
  return {
    enabled: false,
    colorPreset: 'none',
    color: {
      enabled: false,
      gamma: 0,
      contrast: 0,
      brightness: 0,
      saturation: 0,
      hueShift: 0,
      opacity: 1,
      colorMultiply: '#ffffff',
      colorAdd: '#000000',
    },
    sharpness: {
      enabled: false,
      amount: 0.15,
    },
    lut: {
      enabled: false,
      presetId: 'teal-orange',
      amount: 0.75,
    },
    shaderFilter: {
      enabled: false,
      presetId: 'rgb-split',
      intensity: 0.5,
      speed: 1,
      param1: 0.5,
      param2: 0.5,
    },
  }
}

export function normalizeObsNativeFilterConfig(raw: unknown): ObsNativeFilterConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const base = createDefaultObsNativeFilterConfig()
  const obj = raw as Partial<ObsNativeFilterConfig>
  const c = (obj.color ?? {}) as Partial<ObsNativeColorFilterConfig>
  const sh = (obj.sharpness ?? {}) as Partial<ObsNativeSharpnessFilterConfig>
  const lut = (obj.lut ?? {}) as Partial<ObsNativeLutFilterConfig>
  const sf = (obj.shaderFilter ?? {}) as Partial<ObsNativeShaderFilterConfig>

  return {
    enabled: Boolean(obj.enabled),
    colorPreset: VALID_COLOR_PRESETS.has(obj.colorPreset as ObsColorPresetId)
      ? (obj.colorPreset as ObsColorPresetId)
      : base.colorPreset,
    color: {
      enabled: Boolean(c.enabled),
      gamma: clampNum(c.gamma, -3, 3, 0),
      contrast: clampNum(c.contrast, -2, 2, 0),
      brightness: clampNum(c.brightness, -1, 1, 0),
      saturation: clampNum(c.saturation, -1, 5, 0),
      hueShift: clampNum(c.hueShift, -180, 180, 0),
      opacity: clampNum(c.opacity, 0, 1, 1),
      colorMultiply: strOr(c.colorMultiply, '#ffffff'),
      colorAdd: strOr(c.colorAdd, '#000000'),
    },
    sharpness: {
      enabled: Boolean(sh.enabled),
      amount: clampNum(sh.amount, 0, 1, 0.15),
    },
    lut: {
      enabled: Boolean(lut.enabled),
      presetId: strOr(lut.presetId, 'teal-orange'),
      customPath: typeof lut.customPath === 'string' && lut.customPath.trim() ? lut.customPath.trim() : undefined,
      customUrl: typeof lut.customUrl === 'string' && lut.customUrl.trim() ? lut.customUrl.trim() : undefined,
      inlineCubeText: typeof lut.inlineCubeText === 'string' && lut.inlineCubeText.trim() ? lut.inlineCubeText : undefined,
      customName: typeof lut.customName === 'string' && lut.customName.trim() ? lut.customName.trim() : undefined,
      amount: clampNum(lut.amount, 0, 1, 0.75),
    },
    shaderFilter: {
      enabled: Boolean(sf.enabled),
      presetId: strOr(sf.presetId, 'rgb-split'),
      customPath: typeof sf.customPath === 'string' && sf.customPath.trim() ? sf.customPath.trim() : undefined,
      customCode: typeof sf.customCode === 'string' && sf.customCode.trim() ? sf.customCode : undefined,
      customName: typeof sf.customName === 'string' && sf.customName.trim() ? sf.customName.trim() : undefined,
      intensity: clampNum(sf.intensity, 0, 1, 0.5),
      speed: clampNum(sf.speed, 0, 3, 1),
      param1: clampNum(sf.param1, 0, 1, 0.5),
      param2: clampNum(sf.param2, 0, 1, 0.5),
    },
  }
}

export function hasActiveObsNativeFilters(config?: ObsNativeFilterConfig | null): boolean {
  if (!config || !config.enabled) return false
  return Boolean(config.color.enabled || config.sharpness.enabled || config.lut.enabled || config.shaderFilter.enabled)
}

export function detectVfxMediaFormat(url: string, explicit: VfxMediaFormat): Exclude<VfxMediaFormat, 'auto'> {
  if (explicit !== 'auto') return explicit
  const clean = url.split(/[?#]/)[0].toLowerCase()
  if (clean.endsWith('.lottie') || clean.endsWith('.json')) return 'lottie'
  if (clean.endsWith('.riv')) return 'rive'
  if (clean.endsWith('.svga')) return 'svga'
  if (clean.endsWith('.pag')) return 'pag'
  if (clean.endsWith('.webm') || clean.endsWith('.mp4') || clean.endsWith('.mov') || clean.endsWith('.m4v') || clean.endsWith('.ogv')) {
    return 'video'
  }
  if (clean.endsWith('.png') || clean.endsWith('.apng') || clean.endsWith('.webp') || clean.endsWith('.gif') || clean.endsWith('.jpg') || clean.endsWith('.jpeg')) {
    return 'image'
  }
  return 'video'
}
