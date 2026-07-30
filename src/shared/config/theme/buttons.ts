import type { GlobalThemeOverrides } from 'naive-ui'
import { resolveReadableForeground, resolveReadableTextColor, shiftColorForInteraction } from './contrast'

type ButtonOverrides = NonNullable<GlobalThemeOverrides['Button']>
type ButtonVariantName = 'Primary' | 'Info' | 'Success' | 'Warning' | 'Error'

interface ButtonVariantColors {
  color: string
  hover?: string
  pressed?: string
}

interface AdaptiveButtonColors {
  isDark: boolean
  surface: string
  color: string
  colorHover: string
  colorPressed: string
  textColor: string
  borderColor: string
  borderWidth?: string
  borderStyle?: string
  primary?: ButtonVariantColors
  info?: ButtonVariantColors
  success?: ButtonVariantColors
  warning?: ButtonVariantColors
  error?: ButtonVariantColors
}

function variantOverrides(
  name: ButtonVariantName,
  colors: ButtonVariantColors,
  surface: string,
  isDark: boolean,
  borderWidth: string,
  borderStyle: string,
) {
  const hoverColor = colors.hover ?? shiftColorForInteraction(colors.color, 0.16)
  const pressedColor = colors.pressed ?? shiftColorForInteraction(colors.color, 0.24)
  const color = resolveReadableTextColor(colors.color, surface, isDark)
  const hover = resolveReadableTextColor(hoverColor, surface, isDark)
  const pressed = resolveReadableTextColor(pressedColor, surface, isDark)
  const foreground = resolveReadableForeground(color, surface, isDark)
  const hoverForeground = resolveReadableForeground(hover, surface, isDark)
  const pressedForeground = resolveReadableForeground(pressed, surface, isDark)

  return {
    [`color${name}`]: color,
    [`colorHover${name}`]: hover,
    [`colorPressed${name}`]: pressed,
    [`colorFocus${name}`]: hover,
    [`colorDisabled${name}`]: color,
    [`textColor${name}`]: foreground,
    [`textColorHover${name}`]: hoverForeground,
    [`textColorPressed${name}`]: pressedForeground,
    [`textColorFocus${name}`]: hoverForeground,
    [`textColorDisabled${name}`]: foreground,
    [`textColorText${name}`]: color,
    [`textColorTextHover${name}`]: hover,
    [`textColorTextPressed${name}`]: pressed,
    [`textColorTextFocus${name}`]: hover,
    [`textColorTextDisabled${name}`]: color,
    [`textColorGhost${name}`]: color,
    [`textColorGhostHover${name}`]: hover,
    [`textColorGhostPressed${name}`]: pressed,
    [`textColorGhostFocus${name}`]: hover,
    [`textColorGhostDisabled${name}`]: color,
    [`border${name}`]: `${borderWidth} ${borderStyle} ${color}`,
    [`borderHover${name}`]: `${borderWidth} ${borderStyle} ${hover}`,
    [`borderPressed${name}`]: `${borderWidth} ${borderStyle} ${pressed}`,
    [`borderFocus${name}`]: `${borderWidth} ${borderStyle} ${hover}`,
    [`borderDisabled${name}`]: `${borderWidth} ${borderStyle} ${color}`,
    [`rippleColor${name}`]: color,
  }
}

export function getAdaptiveButtonColors(options: AdaptiveButtonColors): ButtonOverrides {
  const borderWidth = options.borderWidth ?? '1px'
  const borderStyle = options.borderStyle ?? 'solid'
  const variants: Array<[ButtonVariantName, ButtonVariantColors | undefined]> = [
    ['Primary', options.primary],
    ['Info', options.info],
    ['Success', options.success],
    ['Warning', options.warning],
    ['Error', options.error],
  ]

  return {
    color: options.color,
    colorHover: options.colorHover,
    colorPressed: options.colorPressed,
    colorFocus: options.colorHover,
    colorDisabled: options.color,
    colorSecondary: options.colorHover,
    colorSecondaryHover: options.colorPressed,
    colorSecondaryPressed: options.colorPressed,
    colorTertiary: options.colorHover,
    colorTertiaryHover: options.colorPressed,
    colorTertiaryPressed: options.colorPressed,
    colorQuaternary: 'transparent',
    colorQuaternaryHover: options.colorHover,
    colorQuaternaryPressed: options.colorPressed,
    textColor: options.textColor,
    textColorHover: options.textColor,
    textColorPressed: options.textColor,
    textColorFocus: options.textColor,
    textColorDisabled: options.textColor,
    textColorTertiary: options.textColor,
    textColorText: options.textColor,
    textColorTextHover: options.textColor,
    textColorTextPressed: options.textColor,
    textColorTextFocus: options.textColor,
    textColorTextDisabled: options.textColor,
    textColorGhost: options.textColor,
    textColorGhostHover: options.textColor,
    textColorGhostPressed: options.textColor,
    textColorGhostFocus: options.textColor,
    textColorGhostDisabled: options.textColor,
    border: `${borderWidth} ${borderStyle} ${options.borderColor}`,
    borderHover: `${borderWidth} ${borderStyle} ${options.borderColor}`,
    borderPressed: `${borderWidth} ${borderStyle} ${options.borderColor}`,
    borderFocus: `${borderWidth} ${borderStyle} ${options.borderColor}`,
    borderDisabled: `${borderWidth} ${borderStyle} ${options.borderColor}`,
    ...Object.assign({}, ...variants
      .filter((entry): entry is [ButtonVariantName, ButtonVariantColors] => entry[1] !== undefined)
      .map(([name, colors]) => variantOverrides(name, colors, options.surface, options.isDark, borderWidth, borderStyle))),
  } as ButtonOverrides
}
