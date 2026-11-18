import {
  converter,
  formatHex,
  formatHex8,
  formatRgb,
  interpolate,
  modeHsl,
  modeHwb,
  modeLab,
  modeLch,
  modeLrgb,
  modeOklab,
  modeOklch,
  modeRgb,
  parse,
  useMode,
  wcagContrast,
  wcagLuminance,
  type Rgb,
} from 'culori/fn'

// 仅注册用户页与站点主题对比度实际用到的色彩空间，避免全量引入 culori
useMode(modeRgb)
useMode(modeLrgb)
useMode(modeHsl)
useMode(modeOklab)
useMode(modeOklch)
useMode(modeLab)
useMode(modeLch)
useMode(modeHwb)

export type { Rgb }
export { converter, formatHex, formatHex8, formatRgb, interpolate, parse, wcagContrast, wcagLuminance }
