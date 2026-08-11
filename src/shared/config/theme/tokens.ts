/**
 * 主题语义令牌：尺寸、字体、阴影、圆角等与具体组件无关的设计变量。
 * 组件 override 直接消费场景对应的 ThemeTokens。
 */
import { brand, neutral, pickByMode, rgba } from './colors'

export interface ThemeTokens {
  isDark: boolean

  // 半径
  radiusSurface: string
  radiusControl: string
  radiusSmall: string

  // 表面层级
  canvas: string
  surface: string
  surfaceHover: string
  inset: string
  elevated: string

  // 文本与控件
  foreground: string
  mutedForeground: string
  control: string
  controlHover: string
  controlPressed: string
  secondary: string
  secondaryHover: string
  secondaryPressed: string
  borderColor: string
  cardBorderColor: string
  inputBorderColor: string
  inputBorderHover: string
  placeholder: string
  placeholderDisabled: string
  disabledForeground: string

  // primary（中性 shadcn 风格）
  primary: string
  primaryHover: string
  primaryPressed: string
  primaryForeground: string

  // brand（VTsuru 品牌色，sky-cyan）
  brand: string
  brandHover: string
  brandPressed: string
  brandRail: string
  brandSoft: string
  brandTint: string

  // 焦点 ring
  ringColor: string
  ringShadow: string

  // 阴影
  shadow1: string
  shadow2: string
  shadowPopover: string

  // tooltip
  tooltipColor: string
  tooltipTextColor: string
}

interface SurfacePalette {
  canvas: string
  surface: string
  surfaceHover: string
  inset: string
  elevated: string
  control: string
  controlHover: string
  controlPressed: string
  secondary: string
  secondaryHover: string
  secondaryPressed: string
  cardBorderColor: string
}

function createTokens(isDark: boolean, surfaces: SurfacePalette): ThemeTokens {
  const radiusSurface = '6px'
  const radiusControl = '4px'
  const radiusSmall = '2px'

  const foreground = isDark ? neutral[50] : neutral[950]

  // 暗色边框用 700：site surface=900 / manage surface=800 都能看见描边
  // （旧值 800 在 manage 的 surface/control 上会与底色同色，边框“消失”）
  const borderColor = isDark ? neutral[700] : neutral[300]
  const inputBorderColor = borderColor
  const inputBorderHover = isDark ? neutral[500] : neutral[400]
  const mutedForeground = isDark ? neutral[400] : neutral[600]

  const ringColor = isDark ? neutral[300] : neutral[400]
  const ringShadow = `0 0 0 2px ${rgba(ringColor, isDark ? 0.35 : 0.3)}`

  // primary：保留 shadcn 风格的中性灰
  const primary = isDark ? neutral[200] : neutral[900]
  const primaryHover = isDark ? neutral[100] : neutral[800]
  const primaryPressed = isDark ? neutral[300] : neutral[950]
  const primaryForeground = isDark ? neutral[950] : neutral[50]

  // brand：暗色用 brand[300] 提亮，亮色用 brand[400]
  const brandColor = pickByMode(isDark, brand[300], brand[400])
  const brandHover = pickByMode(isDark, brand[200], brand[300])
  const brandPressed = pickByMode(isDark, brand[400], brand[500])
  const brandRail = pickByMode(isDark, rgba(brand[400], 0.22), rgba(brand[400], 0.18))
  const brandSoft = pickByMode(isDark, rgba(brand[400], 0.14), rgba(brand[400], 0.1))
  const brandTint = pickByMode(isDark, rgba(brand[400], 0.18), rgba(brand[400], 0.14))

  const tooltipColor = isDark ? neutral[800] : neutral[900]
  const tooltipTextColor = neutral[50]

  // 浮层阴影：暗色统一加 1px 极弱描边，与页面背景剥离
  const shadowGlow = isDark ? `0 0 0 1px ${rgba(neutral[50], 0.06)}` : ''
  const shadow1Base = isDark ? `0 1px 2px ${rgba(neutral[950], 0.6)}` : `0 1px 2px ${rgba(neutral[950], 0.06)}`
  const shadow2Base = isDark ? `0 4px 12px ${rgba(neutral[950], 0.7)}` : `0 4px 12px ${rgba(neutral[950], 0.12)}`
  const shadow3Base = isDark ? `0 8px 30px ${rgba(neutral[950], 0.7)}` : `0 8px 30px ${rgba(neutral[950], 0.12)}`

  const shadow1 = isDark ? `${shadowGlow}, ${shadow1Base}` : shadow1Base
  const shadow2 = isDark ? `${shadowGlow}, ${shadow2Base}` : shadow2Base
  const shadowPopover = isDark ? `${shadowGlow}, ${shadow3Base}` : shadow3Base

  return {
    isDark,
    radiusSurface,
    radiusControl,
    radiusSmall,
    ...surfaces,
    foreground,
    mutedForeground,
    borderColor,
    inputBorderColor,
    inputBorderHover,
    // placeholder 用 muted 档，避免暗色下过暗（neutral[600] 在 800 底上看起来像“坏了的灰字”）
    placeholder: isDark ? neutral[400] : neutral[500],
    placeholderDisabled: isDark ? neutral[600] : neutral[400],
    disabledForeground: isDark ? neutral[500] : neutral[400],
    primary,
    primaryHover,
    primaryPressed,
    primaryForeground,
    brand: brandColor,
    brandHover,
    brandPressed,
    brandRail,
    brandSoft,
    brandTint,
    ringColor,
    ringShadow,
    shadow1,
    shadow2,
    shadowPopover,
    tooltipColor,
    tooltipTextColor,
  }
}

export function buildSiteTokens(isDark: boolean): ThemeTokens {
  return createTokens(
    isDark,
    isDark
      ? {
          canvas: neutral[950],
          surface: neutral[900],
          surfaceHover: neutral[800],
          inset: neutral[950],
          elevated: neutral[800],
          control: neutral[900],
          controlHover: neutral[800],
          controlPressed: neutral[700],
          secondary: neutral[700],
          secondaryHover: neutral[600],
          secondaryPressed: neutral[500],
          cardBorderColor: neutral[800],
        }
      : {
          canvas: '#ffffff',
          surface: '#ffffff',
          surfaceHover: neutral[100],
          inset: neutral[100],
          elevated: '#ffffff',
          control: '#ffffff',
          controlHover: neutral[100],
          controlPressed: neutral[200],
          secondary: neutral[200],
          secondaryHover: neutral[300],
          secondaryPressed: neutral[400],
          cardBorderColor: neutral[300],
        },
  )
}

export function buildManageTokens(isDark: boolean): ThemeTokens {
  return createTokens(
    isDark,
    isDark
      ? {
          canvas: neutral[900],
          surface: neutral[800],
          surfaceHover: neutral[700],
          inset: neutral[950],
          elevated: neutral[700],
          control: neutral[800],
          controlHover: neutral[700],
          controlPressed: neutral[600],
          secondary: neutral[700],
          secondaryHover: neutral[600],
          secondaryPressed: neutral[500],
          cardBorderColor: neutral[700],
        }
      : {
          canvas: neutral[100],
          surface: '#ffffff',
          surfaceHover: neutral[100],
          inset: neutral[200],
          elevated: '#ffffff',
          control: '#ffffff',
          controlHover: neutral[100],
          controlPressed: neutral[200],
          secondary: neutral[200],
          secondaryHover: neutral[300],
          secondaryPressed: neutral[400],
          cardBorderColor: neutral[300],
        },
  )
}
