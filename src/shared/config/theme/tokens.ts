/**
 * 主题语义令牌：尺寸、字体、阴影、圆角等与具体组件无关的设计变量。
 * 组件 override 直接消费 buildTokens(isDark) 的返回值。
 */
import { brand, neutral, pickByMode, rgba } from './colors'

export interface ThemeTokens {
  isDark: boolean

  // 半径
  radiusSurface: string
  radiusControl: string
  radiusSmall: string

  // 文本与背景
  background: string
  foreground: string
  muted: string
  mutedForeground: string
  embeddedColor: string
  borderColor: string
  inputBorderColor: string
  inputBorderHover: string
  placeholder: string
  placeholderDisabled: string

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

  // 在彩色按钮 / 标签上反转文字颜色（仅暗色模式有效）
  darkTextOnTint: string | undefined
}

export function buildTokens(isDark: boolean): ThemeTokens {
  const radiusSurface = '6px'
  const radiusControl = '4px'
  const radiusSmall = '2px'

  const background = isDark ? neutral[950] : '#ffffff'
  const foreground = isDark ? neutral[50] : neutral[950]

  const borderColor = isDark ? neutral[800] : neutral[300]
  const inputBorderColor = borderColor
  const inputBorderHover = isDark ? neutral[700] : neutral[300]

  const muted = isDark ? neutral[900] : neutral[100]
  const mutedForeground = isDark ? neutral[400] : neutral[500]
  const embeddedColor = isDark ? neutral[900] : neutral[50]

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
  const brandSoft = pickByMode(isDark, rgba(brand[400], 0.14), rgba(brand[400], 0.10))
  const brandTint = pickByMode(isDark, rgba(brand[400], 0.18), rgba(brand[400], 0.14))

  const tooltipColor = isDark ? neutral[800] : neutral[900]
  const tooltipTextColor = neutral[50]

  // 浮层阴影：暗色统一加 1px 极弱描边，与页面背景剥离
  const shadowGlow = isDark ? `0 0 0 1px ${rgba(neutral[50], 0.06)}` : ''
  const shadow1Base = isDark
    ? `0 1px 2px ${rgba(neutral[950], 0.6)}`
    : `0 1px 2px ${rgba(neutral[950], 0.06)}`
  const shadow2Base = isDark
    ? `0 4px 12px ${rgba(neutral[950], 0.7)}`
    : `0 4px 12px ${rgba(neutral[950], 0.12)}`
  const shadow3Base = isDark
    ? `0 8px 30px ${rgba(neutral[950], 0.7)}`
    : `0 8px 30px ${rgba(neutral[950], 0.12)}`

  const shadow1 = isDark ? `${shadowGlow}, ${shadow1Base}` : shadow1Base
  const shadow2 = isDark ? `${shadowGlow}, ${shadow2Base}` : shadow2Base
  const shadowPopover = isDark ? `${shadowGlow}, ${shadow3Base}` : shadow3Base

  return {
    isDark,
    radiusSurface,
    radiusControl,
    radiusSmall,
    background,
    foreground,
    muted,
    mutedForeground,
    embeddedColor,
    borderColor,
    inputBorderColor,
    inputBorderHover,
    placeholder: isDark ? neutral[600] : neutral[400],
    placeholderDisabled: isDark ? neutral[700] : neutral[300],
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
    darkTextOnTint: isDark ? neutral[950] : undefined,
  }
}
