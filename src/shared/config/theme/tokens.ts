/**
 * 主题语义令牌：尺寸、字体、阴影、圆角等与具体组件无关的设计变量。
 * shadcn CSS 变量和页面画布变量共用此处生成的调色板。
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

  // 控件高度与基线契约
  controlHeightXs: string
  controlHeightSm: string
  controlHeightDefault: string
  controlHeightLg: string

  // 阴影
  shadow1: string
  shadow2: string
  shadowPopover: string
}

interface SurfacePalette {
  canvas: string
  surface: string
  surfaceHover: string
  inset: string
  elevated: string
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

  // 控件统一尺寸契约（全局单一真源：xs=28px, sm=32px, default=36px, lg=40px）
  const controlHeightXs = '28px'
  const controlHeightSm = '32px'
  const controlHeightDefault = '36px'
  const controlHeightLg = '40px'

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
    controlHeightXs,
    controlHeightSm,
    controlHeightDefault,
    controlHeightLg,
    shadow1,
    shadow2,
    shadowPopover,
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
          cardBorderColor: neutral[800],
        }
      : {
          canvas: '#ffffff',
          surface: '#ffffff',
          surfaceHover: neutral[100],
          inset: neutral[50],
          elevated: '#ffffff',
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
          cardBorderColor: neutral[700],
        }
      : {
          canvas: neutral[100],
          surface: '#ffffff',
          surfaceHover: neutral[200],
          inset: neutral[200],
          elevated: '#ffffff',
          cardBorderColor: neutral[300],
        },
  )
}
