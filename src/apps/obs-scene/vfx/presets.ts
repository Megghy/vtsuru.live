import type {
  ObsColorPresetId,
  ObsNativeColorFilterConfig,
  ObsNativeFilterConfig,
  VfxBlendMode,
  VfxPresetConfig,
  VfxPresetId,
} from './types'
import { DEFAULT_SHADER_FRAGMENT_CODE } from './types'

export interface VfxPresetMeta {
  id: VfxPresetId
  label: string
  category: 'overlay' | 'particles' | 'backdrop'
  description: string
  recommendedBlendMode: VfxBlendMode
  controls: Array<'intensity' | 'speed' | 'density' | 'size' | 'color1' | 'color2' | 'angle' | 'backdrop'>
  defaults: Partial<VfxPresetConfig>
}

export const VFX_BLEND_MODE_OPTIONS: Array<{ value: VfxBlendMode; label: string }> = [
  { value: 'normal', label: '正常 (Normal)' },
  { value: 'screen', label: '滤色 / 提亮 (Screen)' },
  { value: 'overlay', label: '叠加 (Overlay)' },
  { value: 'soft-light', label: '柔光 (Soft Light)' },
  { value: 'multiply', label: '正片叠底 (Multiply)' },
  { value: 'lighten', label: '变亮 (Lighten)' },
  { value: 'color-dodge', label: '颜色减淡 (Dodge)' },
]

export const VFX_PRESET_LIST: VfxPresetMeta[] = [
  {
    id: 'vignette',
    label: '电影暗角',
    category: 'overlay',
    description: '四周柔和压暗，突出中心人物或游戏主体',
    recommendedBlendMode: 'normal',
    controls: ['intensity', 'size', 'color1'],
    defaults: { intensity: 0.65, size: 1, color1: '#000000' },
  },
  {
    id: 'film-grain',
    label: '胶片颗粒',
    category: 'overlay',
    description: '实时动态噪点颗粒，营造胶片或复古监控质感',
    recommendedBlendMode: 'overlay',
    controls: ['intensity', 'speed', 'density', 'size'],
    defaults: { intensity: 0.35, speed: 1.2, density: 1, size: 1 },
  },
  {
    id: 'crt-scanlines',
    label: 'CRT 扫描线',
    category: 'overlay',
    description: '复古显像管水平扫描线与轻微滚屏闪烁',
    recommendedBlendMode: 'normal',
    controls: ['intensity', 'speed', 'size', 'color1'],
    defaults: { intensity: 0.45, speed: 0.8, size: 1, color1: '#000000' },
  },
  {
    id: 'vhs-glitch',
    label: 'VHS 复古干扰',
    category: 'overlay',
    description: '周期性横向信号条纹与色带闪烁效果',
    recommendedBlendMode: 'screen',
    controls: ['intensity', 'speed', 'density', 'color1', 'color2'],
    defaults: { intensity: 0.55, speed: 1.1, density: 1, color1: '#22d3ee', color2: '#f43f5e' },
  },
  {
    id: 'light-leak',
    label: '胶片漏光',
    category: 'overlay',
    description: '边缘流动的暖色或霓虹柔光光晕',
    recommendedBlendMode: 'screen',
    controls: ['intensity', 'speed', 'angle', 'color1', 'color2'],
    defaults: { intensity: 0.55, speed: 0.7, angle: 35, color1: '#fb923c', color2: '#f472b6' },
  },
  {
    id: 'letterbox',
    label: '电影黑边',
    category: 'overlay',
    description: '上下宽银幕遮幅黑边（2.39:1 / 自定义高度）',
    recommendedBlendMode: 'normal',
    controls: ['intensity', 'size', 'color1'],
    defaults: { intensity: 1, size: 1, color1: '#000000' },
  },
  {
    id: 'color-tint',
    label: '氛围渐变罩',
    category: 'overlay',
    description: '双色线性渐变氛围罩，适合快速统一画面冷暖调',
    recommendedBlendMode: 'soft-light',
    controls: ['intensity', 'angle', 'color1', 'color2'],
    defaults: { intensity: 0.35, angle: 135, color1: '#38bdf8', color2: '#f472b6' },
  },
  {
    id: 'sakura',
    label: '樱花飘落',
    category: 'particles',
    description: '轻盈旋转飘落的樱花花瓣氛围粒子',
    recommendedBlendMode: 'normal',
    controls: ['intensity', 'speed', 'density', 'size', 'color1', 'color2'],
    defaults: { intensity: 0.85, speed: 1, density: 1, size: 1, color1: '#fbcfe8', color2: '#f472b6' },
  },
  {
    id: 'snow',
    label: '冬日飘雪',
    category: 'particles',
    description: '多景深柔焦雪花缓缓飘落',
    recommendedBlendMode: 'screen',
    controls: ['intensity', 'speed', 'density', 'size', 'color1'],
    defaults: { intensity: 0.85, speed: 0.9, density: 1, size: 1, color1: '#ffffff' },
  },
  {
    id: 'rain',
    label: '细雨雨丝',
    category: 'particles',
    description: '斜向疾落雨丝氛围层',
    recommendedBlendMode: 'screen',
    controls: ['intensity', 'speed', 'density', 'size', 'color1', 'angle'],
    defaults: { intensity: 0.65, speed: 1.4, density: 1.1, size: 1, color1: '#bae6fd', angle: 14 },
  },
  {
    id: 'sparkles',
    label: '星尘 / 萤火虫',
    category: 'particles',
    description: '缓慢上升与呼吸闪烁的微光粒子',
    recommendedBlendMode: 'screen',
    controls: ['intensity', 'speed', 'density', 'size', 'color1', 'color2'],
    defaults: { intensity: 0.9, speed: 0.8, density: 1, size: 1, color1: '#fef08a', color2: '#38bdf8' },
  },
  {
    id: 'bokeh',
    label: '梦幻光斑',
    category: 'particles',
    description: '大景深柔和散景圆斑漂浮效果',
    recommendedBlendMode: 'screen',
    controls: ['intensity', 'speed', 'density', 'size', 'color1', 'color2'],
    defaults: { intensity: 0.55, speed: 0.6, density: 0.8, size: 1.2, color1: '#f9a8d4', color2: '#7dd3fc' },
  },
  {
    id: 'speed-lines',
    label: '动漫专注线',
    category: 'particles',
    description: '四周向中心汇聚的高燃漫画速度线',
    recommendedBlendMode: 'screen',
    controls: ['intensity', 'speed', 'density', 'size', 'color1'],
    defaults: { intensity: 0.75, speed: 1.5, density: 1.1, size: 1, color1: '#ffffff' },
  },
  {
    id: 'backdrop-filter',
    label: 'Web 局部滤镜',
    category: 'backdrop',
    description: '对同浏览器源槽位内下层 Web 组件施加模糊/调色/灰度',
    recommendedBlendMode: 'normal',
    controls: ['backdrop'],
    defaults: {
      intensity: 1,
      backdropBlur: 10,
      backdropBrightness: 100,
      backdropContrast: 105,
      backdropSaturate: 115,
      backdropHueRotate: 0,
      backdropGrayscale: 0,
      backdropSepia: 0,
    },
  },
]

export function getVfxPresetMeta(id: VfxPresetId): VfxPresetMeta {
  return VFX_PRESET_LIST.find((p) => p.id === id) ?? VFX_PRESET_LIST[0]
}

export interface VfxShaderTemplate {
  id: string
  label: string
  description: string
  color1: string
  color2: string
  paramLabels: [string, string, string, string]
  code: string
}

export const VFX_SHADER_TEMPLATES: VfxShaderTemplate[] = [
  {
    id: 'aurora-veil',
    label: '极光薄雾',
    description: '流动的半透明极光色带叠加',
    color1: '#38bdf8',
    color2: '#c084fc',
    paramLabels: ['波纹扭曲', '保留', '保留', '保留'],
    code: DEFAULT_SHADER_FRAGMENT_CODE,
  },
  {
    id: 'cyber-grid-border',
    label: '霓虹边框扫描',
    description: '画面四周流动的赛博能量边框与光扫描',
    color1: '#22d3ee',
    color2: '#f43f5e',
    paramLabels: ['边框厚度', '扫描宽度', '角标高亮', '脉冲幅度'],
    code: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float thickness = 0.008 + uParam1 * 0.04;
  float border = 1.0 - smoothstep(0.0, thickness, edge);
  float glow = exp(-edge * (18.0 - uParam1 * 10.0));

  float t = iTime * (0.6 + uSpeed * 1.1);
  float sweep = 0.5 + 0.5 * sin((uv.x + uv.y) * (4.0 + uParam2 * 8.0) - t * 2.5);
  float pulse = 0.75 + 0.25 * uParam4 * sin(t * 3.0);

  vec3 col = mix(uColor1, uColor2, sweep);
  float alpha = clamp((border * 0.9 + glow * 0.45) * pulse * uIntensity, 0.0, 1.0);
  fragColor = vec4(col, alpha);
}`,
  },
  {
    id: 'holo-ring',
    label: '全息光环',
    description: '旋转扩散的科幻全息能量环，适合做角色光环或背景',
    color1: '#38bdf8',
    color2: '#a855f7',
    paramLabels: ['环半径', '环宽', '纹理频率', '闪烁'],
    code: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = (fragCoord - 0.5 * iResolution.xy) / max(1.0, iResolution.y);
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float t = iTime * (0.5 + uSpeed);

  float targetR = 0.18 + uParam1 * 0.26;
  float width = 0.008 + uParam2 * 0.035;
  float wobble = sin(a * (6.0 + floor(uParam3 * 10.0)) + t * 2.0) * 0.012;
  float ring = exp(-pow((r - targetR - wobble) / width, 2.0));
  float outer = exp(-abs(r - targetR) * 14.0) * 0.35;

  float shimmer = 0.7 + 0.3 * uParam4 * sin(a * 3.0 - t * 3.2);
  vec3 col = mix(uColor1, uColor2, 0.5 + 0.5 * cos(a * 2.0 + t));
  float alpha = clamp((ring + outer) * shimmer * uIntensity, 0.0, 1.0);
  fragColor = vec4(col, alpha);
}`,
  },
  {
    id: 'pulse-vignette',
    label: '心跳警报暗角',
    description: '四周脉动发光暗角（可做低血量/高燃/警报氛围）',
    color1: '#ef4444',
    color2: '#f97316',
    paramLabels: ['覆盖范围', '脉动频率', '柔和度', '噪点微扰'],
    code: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  vec2 d = (uv - 0.5) * 2.0;
  float dist = length(d * vec2(1.0, 1.0));
  float t = iTime * (1.5 + uSpeed * 2.5) * (0.5 + uParam2);
  float beat = pow(0.5 + 0.5 * sin(t), 2.0);
  float start = 0.55 - uParam1 * 0.35;
  float mask = smoothstep(start, start + 0.45 + uParam3 * 0.5, dist);
  float grain = fract(sin(dot(fragCoord.xy, vec2(12.9898, 78.233)) + iTime) * 43758.5453);
  mask *= 1.0 - uParam4 * 0.12 * grain;
  vec3 col = mix(uColor1, uColor2, beat * 0.6);
  fragColor = vec4(col, clamp(mask * (0.45 + 0.55 * beat) * uIntensity, 0.0, 1.0));
}`,
  },
  {
    id: 'caustic-shimmer',
    label: '水波焦散光影',
    description: '柔和晃动的水下波光焦散层，适合海洋/治愈主题',
    color1: '#38bdf8',
    color2: '#e0f2fe',
    paramLabels: ['波纹缩放', '对比锐度', '层次', '柔边'],
    code: `void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float scale = 3.0 + uParam1 * 8.0;
  vec2 p = uv * scale;
  float t = iTime * (0.4 + uSpeed * 0.7);

  float v = 0.0;
  v += sin(p.x + t + sin(p.y * 1.2 - t * 0.8));
  v += sin(p.y * 1.4 - t * 1.1 + cos(p.x * 1.1 + t * 0.6));
  v += sin((p.x + p.y) * (0.9 + uParam3 * 0.6) + t * 0.7);
  v = abs(v / 3.0);

  float caustic = pow(1.0 - clamp(v, 0.0, 1.0), 2.0 + uParam2 * 5.0);
  float fade = smoothstep(0.0, 0.2 + uParam4 * 0.3, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  vec3 col = mix(uColor1, uColor2, caustic);
  fragColor = vec4(col, clamp(caustic * fade * 0.55 * uIntensity, 0.0, 1.0));
}`,
  },
  {
    id: 'glitch-bars',
    label: '故障扫描光带',
    description: '随机跳动的 RGB 故障细条纹叠加',
    color1: '#06b6d4',
    color2: '#ec4899',
    paramLabels: ['条纹密度', '触发频率', '条纹细度', '闪烁强度'],
    code: `float hash(float n) { return fract(sin(n) * 43758.5453123); }

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float stepTime = floor(iTime * (6.0 + uSpeed * 12.0));
  float row = floor(uv.y * (18.0 + uParam1 * 64.0));
  float n = hash(row * 17.3 + stepTime * 3.1);
  float gate = step(0.86 - uParam2 * 0.35, n);
  float xShift = hash(row * 31.7 + stepTime);
  float seg = step(xShift * 0.6, uv.x) * step(uv.x, xShift * 0.6 + 0.2 + uParam3 * 0.5);
  float flick = 0.6 + 0.4 * uParam4 * hash(stepTime + row);
  vec3 col = mix(uColor1, uColor2, step(0.5, hash(row + stepTime * 7.0)));
  fragColor = vec4(col, clamp(gate * seg * flick * 0.65 * uIntensity, 0.0, 1.0));
}`,
  },
]

export function getVfxShaderTemplate(id: string): VfxShaderTemplate {
  return VFX_SHADER_TEMPLATES.find((t) => t.id === id) ?? VFX_SHADER_TEMPLATES[0]
}

export interface ObsColorPresetMeta {
  id: Exclude<ObsColorPresetId, 'custom'>
  label: string
  description: string
  values: Omit<ObsNativeColorFilterConfig, 'enabled'>
}

export const OBS_COLOR_PRESETS: ObsColorPresetMeta[] = [
  {
    id: 'none',
    label: '原始画面',
    description: '不做色彩调整',
    values: { gamma: 0, contrast: 0, brightness: 0, saturation: 0, hueShift: 0, opacity: 1, colorMultiply: '#ffffff', colorAdd: '#000000' },
  },
  {
    id: 'fresh',
    label: '日系通透',
    description: '略微提亮、清新柔和，适合杂谈与室内摄像头',
    values: { gamma: 0.14, contrast: -0.05, brightness: 0.04, saturation: 0.12, hueShift: -2, opacity: 1, colorMultiply: '#f8fcff', colorAdd: '#000000' },
  },
  {
    id: 'warm-film',
    label: '胶片暖调',
    description: '温暖柔和的胶片色彩，提升温馨氛围',
    values: { gamma: 0.06, contrast: 0.08, brightness: 0.02, saturation: 0.16, hueShift: 6, opacity: 1, colorMultiply: '#fff4e6', colorAdd: '#080400' },
  },
  {
    id: 'cyber-neon',
    label: '赛博霓虹',
    description: '高对比高饱和微偏青紫，突出电竞赛博感',
    values: { gamma: -0.08, contrast: 0.22, brightness: -0.02, saturation: 0.42, hueShift: -12, opacity: 1, colorMultiply: '#eef2ff', colorAdd: '#000000' },
  },
  {
    id: 'cool-cinematic',
    label: '冷调电影',
    description: '微冷低饱和高质感，适合剧情游戏与歌回',
    values: { gamma: -0.06, contrast: 0.16, brightness: -0.03, saturation: -0.18, hueShift: -8, opacity: 1, colorMultiply: '#e8f4ff', colorAdd: '#000000' },
  },
  {
    id: 'vintage-bw',
    label: '复古黑白',
    description: '高对比经典单色电影画面',
    values: { gamma: -0.05, contrast: 0.25, brightness: 0, saturation: -1, hueShift: 0, opacity: 1, colorMultiply: '#ffffff', colorAdd: '#000000' },
  },
  {
    id: 'soft-pastel',
    label: '柔雾粉彩',
    description: '轻微低对比粉嫩柔和风格，适合可爱系皮套',
    values: { gamma: 0.18, contrast: -0.1, brightness: 0.05, saturation: 0.08, hueShift: 4, opacity: 1, colorMultiply: '#fff0f6', colorAdd: '#050004' },
  },
  {
    id: 'dark-night',
    label: '暗夜护眼',
    description: '适度降亮防刺眼，适合深夜杂谈/恐怖游戏',
    values: { gamma: -0.22, contrast: 0.1, brightness: -0.08, saturation: -0.1, hueShift: 0, opacity: 1, colorMultiply: '#e2e8f0', colorAdd: '#000000' },
  },
]

export function getObsColorPreset(id: ObsColorPresetId): ObsColorPresetMeta | undefined {
  return OBS_COLOR_PRESETS.find((p) => p.id === id)
}

/**
 * 将 OBS color_filter_v2 参数近似换算为编辑器内 CSS filter（用于画布实时预览）
 */
export function buildObsNativeFilterPreviewCss(config?: ObsNativeFilterConfig | null): string | undefined {
  if (!config || !config.enabled) return undefined
  const parts: string[] = []
  if (config.color.enabled) {
    const c = config.color
    const brightness = Math.max(0.1, 1 + c.brightness * 0.8 + c.gamma * 0.22)
    const contrast = Math.max(0.1, 1 + c.contrast * 0.65)
    const saturate = Math.max(0, 1 + c.saturation)
    if (Math.abs(brightness - 1) > 0.005) parts.push(`brightness(${brightness.toFixed(3)})`)
    if (Math.abs(contrast - 1) > 0.005) parts.push(`contrast(${contrast.toFixed(3)})`)
    if (Math.abs(saturate - 1) > 0.005) parts.push(`saturate(${saturate.toFixed(3)})`)
    if (Math.abs(c.hueShift) > 0.5) parts.push(`hue-rotate(${Math.round(c.hueShift)}deg)`)
  }
  if (config.lut.enabled && config.lut.amount > 0.02) {
    const amt = config.lut.amount
    if (config.lut.presetId === 'mono-noir') {
      parts.push(`grayscale(${Math.min(1, amt).toFixed(2)})`)
      parts.push(`contrast(${(1 + 0.22 * amt).toFixed(2)})`)
    } else if (config.lut.presetId === 'kodak-gold') {
      parts.push(`sepia(${(0.28 * amt).toFixed(2)})`)
      parts.push(`saturate(${(1 + 0.18 * amt).toFixed(2)})`)
    } else if (config.lut.presetId === 'teal-orange') {
      parts.push(`contrast(${(1 + 0.14 * amt).toFixed(2)})`)
      parts.push(`saturate(${(1 + 0.2 * amt).toFixed(2)})`)
    } else if (config.lut.presetId === 'cyberpunk-blue') {
      parts.push(`hue-rotate(${Math.round(-16 * amt)}deg)`)
      parts.push(`saturate(${(1 + 0.35 * amt).toFixed(2)})`)
    } else if (config.lut.presetId === 'fuji-fresh') {
      parts.push(`brightness(${(1 + 0.06 * amt).toFixed(2)})`)
      parts.push(`saturate(${(1 + 0.14 * amt).toFixed(2)})`)
    }
  }
  return parts.length > 0 ? parts.join(' ') : undefined
}

export interface ObsBuiltinLutPreset {
  id: string
  label: string
  description: string
}

export const OBS_BUILTIN_LUT_PRESETS: ObsBuiltinLutPreset[] = [
  { id: 'teal-orange', label: '青橙电影 (Teal & Orange)', description: '暗部偏青蓝、高光偏暖橙的经典院线调色' },
  { id: 'fuji-fresh', label: '富士清新 (Fuji Fresh)', description: '高光清透、暗部微绿蓝的日系人像质感' },
  { id: 'kodak-gold', label: '柯达暖金 (Kodak Gold)', description: '柔和怀旧暖金色调，适合歌回与谈心' },
  { id: 'cyberpunk-blue', label: '赛博蓝紫 (Cyberpunk)', description: '冷青暗部与品红高光碰撞的赛博调色' },
  { id: 'mono-noir', label: '黑白胶片 (Mono Noir)', description: '高反差胶片感黑白 LUT' },
]

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function sCurve(v: number, strength: number): number {
  const s = v * v * (3 - 2 * v)
  return clamp01(v + (s - v) * strength)
}

/**
 * 程序化生成标准 17x17x17 Adobe .cube 3D LUT 文本（零外部二进制依赖，OBS color_grade_filter 原生支持）
 */
export function generateBuiltinCubeLut(presetId: string): string {
  const size = 17
  const lines: string[] = [
    `TITLE "VTsuru ${presetId}"`,
    `LUT_3D_SIZE ${size}`,
    'DOMAIN_MIN 0.0 0.0 0.0',
    'DOMAIN_MAX 1.0 1.0 1.0',
  ]

  for (let b = 0; b < size; b++) {
    const fb = b / (size - 1)
    for (let g = 0; g < size; g++) {
      const fg = g / (size - 1)
      for (let r = 0; r < size; r++) {
        const fr = r / (size - 1)
        const luma = 0.2126 * fr + 0.7152 * fg + 0.0722 * fb
        let outR = fr
        let outG = fg
        let outB = fb

        if (presetId === 'teal-orange') {
          const shadow = 1 - luma
          const high = luma
          outR = sCurve(fr + high * 0.09 - shadow * 0.04, 0.35)
          outG = sCurve(fg + high * 0.02 + shadow * 0.02, 0.28)
          outB = sCurve(fb + shadow * 0.11 - high * 0.06, 0.35)
        } else if (presetId === 'fuji-fresh') {
          const shadow = 1 - luma
          outR = clamp01(fr * 0.99 + 0.015)
          outG = clamp01(fg * 1.03 + shadow * 0.03)
          outB = clamp01(fb * 1.04 + shadow * 0.05)
          outR = sCurve(outR, 0.15)
          outG = sCurve(outG, 0.15)
          outB = sCurve(outB, 0.15)
        } else if (presetId === 'kodak-gold') {
          const mid = 1 - Math.abs(luma - 0.5) * 2
          outR = sCurve(fr * 1.06 + mid * 0.05 + 0.015, 0.25)
          outG = sCurve(fg * 1.01 + mid * 0.02 + 0.008, 0.22)
          outB = sCurve(fb * 0.9 + 0.02, 0.2)
        } else if (presetId === 'cyberpunk-blue') {
          const shadow = 1 - luma
          const high = luma
          outR = sCurve(fr + high * 0.14 - shadow * 0.05, 0.45)
          outG = sCurve(fg - 0.03 + shadow * 0.05, 0.38)
          outB = sCurve(fb + 0.12 + shadow * 0.08, 0.42)
        } else if (presetId === 'mono-noir') {
          const m = sCurve(luma, 0.55)
          outR = m
          outG = m
          outB = clamp01(m * 1.02)
        }

        lines.push(`${clamp01(outR).toFixed(5)} ${clamp01(outG).toFixed(5)} ${clamp01(outB).toFixed(5)}`)
      }
    }
  }

  return `${lines.join('\n')}\n`
}

export interface ObsShaderFilterPreset {
  id: string
  label: string
  description: string
  param1Label: string
  param2Label: string
  hlslCode: string
}

/**
 * 兼容 obs-shaderfilter 插件的 HLSL 像素后处理预设
 * 参数命名约定: intensity, speed, param1, param2（全部由 syncObsSourceFilters 自动下发）
 */
export const OBS_SHADER_FILTER_PRESETS: ObsShaderFilterPreset[] = [
  {
    id: 'rgb-split',
    label: 'RGB 色差分离',
    description: '对真实画面施加色散/故障 RGB 通道偏移',
    param1Label: '水平偏移',
    param2Label: '纵向抖动',
    hlslCode: `uniform float intensity<
  string label = "Intensity";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.5;
uniform float speed<
  string label = "Speed";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 3.0;
> = 1.0;
uniform float param1<
  string label = "Shift";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.5;
uniform float param2<
  string label = "Jitter";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.5;

float4 mainImage(VertData v_in) : TARGET
{
  float t = elapsed_time * (1.0 + speed * 3.0);
  float pulse = 0.65 + 0.35 * sin(t * 2.7);
  float offset = (0.002 + param1 * 0.018) * intensity * pulse;
  float yOff = (sin(v_in.uv.y * 40.0 + t * 5.0) * 0.004 * param2 * intensity);
  float4 baseCol = image.Sample(textureSampler, v_in.uv);
  float r = image.Sample(textureSampler, v_in.uv + float2(offset, yOff)).r;
  float b = image.Sample(textureSampler, v_in.uv - float2(offset, yOff)).b;
  return float4(r, baseCol.g, b, baseCol.a);
}
`,
  },
  {
    id: 'crt-curve',
    label: 'CRT 曲面扫描线',
    description: '经典街机/电视机桶形曲面畸变 + 扫描线 + 暗角',
    param1Label: '曲面弯度',
    param2Label: '扫描线密度',
    hlslCode: `uniform float intensity<
  string label = "Intensity";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.6;
uniform float speed<
  string label = "Speed";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 3.0;
> = 1.0;
uniform float param1<
  string label = "Curvature";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.5;
uniform float param2<
  string label = "Scanlines";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.5;

float4 mainImage(VertData v_in) : TARGET
{
  float2 centered = v_in.uv * 2.0 - 1.0;
  float k = (0.05 + param1 * 0.25) * intensity;
  float2 curved = centered * (1.0 + k * dot(centered, centered));
  float2 uv = curved * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return float4(0.0, 0.0, 0.0, 1.0);
  }
  float4 col = image.Sample(textureSampler, uv);
  float lines = 180.0 + param2 * 420.0;
  float scan = 1.0 - (0.12 + 0.25 * intensity) * (0.5 + 0.5 * sin(uv.y * lines * 3.14159 + elapsed_time * speed * 6.0));
  float vig = 1.0 - 0.35 * intensity * dot(centered * 0.75, centered * 0.75);
  col.rgb *= scan * clamp(vig, 0.0, 1.0);
  return col;
}
`,
  },
  {
    id: 'pixelate',
    label: '复古像素化',
    description: '将直播画面实时转为像素游戏马赛克风',
    param1Label: '像素块大小',
    param2Label: '色彩量化',
    hlslCode: `uniform float intensity<
  string label = "Intensity";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.5;
uniform float param1<
  string label = "Pixel Size";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.4;
uniform float param2<
  string label = "Posterize";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.2;

float4 mainImage(VertData v_in) : TARGET
{
  float block = max(1.0, (2.0 + param1 * 28.0) * intensity);
  float2 grid = uv_size / block;
  float2 uv = (floor(v_in.uv * grid) + 0.5) / grid;
  float4 col = image.Sample(textureSampler, uv);
  if (param2 > 0.05) {
    float levels = max(4.0, 32.0 - param2 * 26.0);
    col.rgb = floor(col.rgb * levels + 0.5) / levels;
  }
  return col;
}
`,
  },
  {
    id: 'wave-ripple',
    label: '水波梦幻扭曲',
    description: '对画面施加柔和正弦波纹畸变，适合转场或回忆氛围',
    param1Label: '波纹频率',
    param2Label: '扭曲幅度',
    hlslCode: `uniform float intensity<
  string label = "Intensity";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.45;
uniform float speed<
  string label = "Speed";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 3.0;
> = 1.0;
uniform float param1<
  string label = "Frequency";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.5;
uniform float param2<
  string label = "Amplitude";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.5;

float4 mainImage(VertData v_in) : TARGET
{
  float freq = 8.0 + param1 * 32.0;
  float amp = (0.002 + param2 * 0.025) * intensity;
  float t = elapsed_time * (1.2 + speed * 2.5);
  float2 uv = v_in.uv;
  uv.x += sin(uv.y * freq + t) * amp;
  uv.y += cos(uv.x * freq - t * 0.8) * amp * 0.7;
  return image.Sample(textureSampler, clamp(uv, 0.0, 1.0));
}
`,
  },
  {
    id: 'fisheye',
    label: '鱼眼广角畸变',
    description: '夸张广角鱼眼特效，适合搞笑/整活瞬间',
    param1Label: '畸变强度',
    param2Label: '边缘缩放',
    hlslCode: `uniform float intensity<
  string label = "Intensity";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.55;
uniform float param1<
  string label = "Strength";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.6;
uniform float param2<
  string label = "Zoom";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.5;

float4 mainImage(VertData v_in) : TARGET
{
  float2 p = v_in.uv * 2.0 - 1.0;
  float r = length(p);
  float power = 1.0 + (param1 * 1.4) * intensity;
  float zoom = 0.8 + param2 * 0.4;
  float2 uv = (r > 0.0001) ? (normalize(p) * pow(r, power) / zoom) * 0.5 + 0.5 : v_in.uv;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return float4(0.0, 0.0, 0.0, 0.0);
  }
  return image.Sample(textureSampler, uv);
}
`,
  },
  {
    id: 'dreamy-bloom',
    label: '梦幻柔光辉光',
    description: '高光溢出柔焦（Bloom），打造唯美梦幻氛围',
    param1Label: '发光半径',
    param2Label: '高光阈值',
    hlslCode: `uniform float intensity<
  string label = "Intensity";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.5;
uniform float param1<
  string label = "Radius";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.5;
uniform float param2<
  string label = "Threshold";
  string widget_type = "slider";
  float minimum = 0.0;
  float maximum = 1.0;
> = 0.5;

float4 mainImage(VertData v_in) : TARGET
{
  float4 baseCol = image.Sample(textureSampler, v_in.uv);
  float2 stepUv = uv_pixel_interval * (2.0 + param1 * 10.0);
  float3 acc = float3(0.0, 0.0, 0.0);
  float thresh = 0.35 + param2 * 0.45;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      float3 s = image.Sample(textureSampler, v_in.uv + float2(x, y) * stepUv).rgb;
      float l = dot(s, float3(0.2126, 0.7152, 0.0722));
      acc += s * smoothstep(thresh, thresh + 0.25, l);
    }
  }
  acc /= 9.0;
  return float4(saturate(baseCol.rgb + acc * intensity * 1.1), baseCol.a);
}
`,
  },
]

export function getObsShaderFilterPreset(id: string): ObsShaderFilterPreset {
  return OBS_SHADER_FILTER_PRESETS.find((p) => p.id === id) ?? OBS_SHADER_FILTER_PRESETS[0]
}
