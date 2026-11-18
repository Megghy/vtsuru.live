export type KeyboardLayoutPreset = 'wasd' | 'moba' | '60' | 'tkl'

export interface KeyboardKeyDef {
  code?: string
  label?: string
  subLabel?: string
  /** 相对标准 1u 键帽的宽度，必须为 0.25 的整数倍 */
  width: number
  /** 为 true 时渲染透明占位符 */
  spacer?: boolean
}

export interface KeyboardRowDef {
  keys: KeyboardKeyDef[]
  /** 行高倍数（默认 1，功能键行可更紧凑） */
  heightScale?: number
  /** 行后额外垂直间距倍数 */
  marginBottomScale?: number
}

export interface KeyboardLayoutSpec {
  id: KeyboardLayoutPreset
  name: string
  description: string
  /** 总宽度（单位 u），网格列数为 totalUnits * 4 */
  totalUnits: number
  rows: KeyboardRowDef[]
}

export interface ComputedKeyBox {
  code: string
  label: string
  subLabel?: string
  x: number
  y: number
  width: number
  height: number
  isWide: boolean
}

export interface ComputedKeyboardGeometry {
  preset: KeyboardLayoutPreset
  width: number
  height: number
  padding: number
  keys: ComputedKeyBox[]
}

const ROW_NUMBERS: KeyboardRowDef = {
  keys: [
    { code: 'Backquote', label: '~', subLabel: '`', width: 1 },
    { code: 'Digit1', label: '1', width: 1 },
    { code: 'Digit2', label: '2', width: 1 },
    { code: 'Digit3', label: '3', width: 1 },
    { code: 'Digit4', label: '4', width: 1 },
    { code: 'Digit5', label: '5', width: 1 },
    { code: 'Digit6', label: '6', width: 1 },
    { code: 'Digit7', label: '7', width: 1 },
    { code: 'Digit8', label: '8', width: 1 },
    { code: 'Digit9', label: '9', width: 1 },
    { code: 'Digit0', label: '0', width: 1 },
    { code: 'Minus', label: '-', width: 1 },
    { code: 'Equal', label: '=', width: 1 },
    { code: 'Backspace', label: 'Back', width: 2 },
  ],
}

const ROW_QWERTY: KeyboardRowDef = {
  keys: [
    { code: 'Tab', label: 'Tab', width: 1.5 },
    { code: 'KeyQ', label: 'Q', width: 1 },
    { code: 'KeyW', label: 'W', width: 1 },
    { code: 'KeyE', label: 'E', width: 1 },
    { code: 'KeyR', label: 'R', width: 1 },
    { code: 'KeyT', label: 'T', width: 1 },
    { code: 'KeyY', label: 'Y', width: 1 },
    { code: 'KeyU', label: 'U', width: 1 },
    { code: 'KeyI', label: 'I', width: 1 },
    { code: 'KeyO', label: 'O', width: 1 },
    { code: 'KeyP', label: 'P', width: 1 },
    { code: 'BracketLeft', label: '[', width: 1 },
    { code: 'BracketRight', label: ']', width: 1 },
    { code: 'Backslash', label: '\\', width: 1.5 },
  ],
}

const ROW_HOME: KeyboardRowDef = {
  keys: [
    { code: 'CapsLock', label: 'Caps', width: 1.75 },
    { code: 'KeyA', label: 'A', width: 1 },
    { code: 'KeyS', label: 'S', width: 1 },
    { code: 'KeyD', label: 'D', width: 1 },
    { code: 'KeyF', label: 'F', width: 1 },
    { code: 'KeyG', label: 'G', width: 1 },
    { code: 'KeyH', label: 'H', width: 1 },
    { code: 'KeyJ', label: 'J', width: 1 },
    { code: 'KeyK', label: 'K', width: 1 },
    { code: 'KeyL', label: 'L', width: 1 },
    { code: 'Semicolon', label: ';', width: 1 },
    { code: 'Quote', label: "'", width: 1 },
    { code: 'Enter', label: 'Enter', width: 2.25 },
  ],
}

const ROW_BOTTOM_ALPHA: KeyboardRowDef = {
  keys: [
    { code: 'ShiftLeft', label: 'Shift', width: 2.25 },
    { code: 'KeyZ', label: 'Z', width: 1 },
    { code: 'KeyX', label: 'X', width: 1 },
    { code: 'KeyC', label: 'C', width: 1 },
    { code: 'KeyV', label: 'V', width: 1 },
    { code: 'KeyB', label: 'B', width: 1 },
    { code: 'KeyN', label: 'N', width: 1 },
    { code: 'KeyM', label: 'M', width: 1 },
    { code: 'Comma', label: ',', width: 1 },
    { code: 'Period', label: '.', width: 1 },
    { code: 'Slash', label: '/', width: 1 },
    { code: 'ShiftRight', label: 'Shift', width: 2.75 },
  ],
}

const ROW_MODIFIERS: KeyboardRowDef = {
  keys: [
    { code: 'ControlLeft', label: 'Ctrl', width: 1.25 },
    { code: 'MetaLeft', label: 'Win', width: 1.25 },
    { code: 'AltLeft', label: 'Alt', width: 1.25 },
    { code: 'Space', label: 'Space', width: 6.25 },
    { code: 'AltRight', label: 'Alt', width: 1.25 },
    { code: 'MetaRight', label: 'Fn', width: 1.25 },
    { code: 'ContextMenu', label: 'Menu', width: 1.25 },
    { code: 'ControlRight', label: 'Ctrl', width: 1.25 },
  ],
}

export const KEYBOARD_LAYOUTS: Record<KeyboardLayoutPreset, KeyboardLayoutSpec> = {
  wasd: {
    id: 'wasd',
    name: 'FPS / 动作精简区 (WASD)',
    description: '只保留 FPS 与动作游戏常用左半区键位，紧凑不遮挡画面',
    totalUnits: 6,
    rows: [
      {
        keys: [
          { code: 'Escape', label: 'Esc', width: 1 },
          { code: 'Digit1', label: '1', width: 1 },
          { code: 'Digit2', label: '2', width: 1 },
          { code: 'Digit3', label: '3', width: 1 },
          { code: 'Digit4', label: '4', width: 1 },
          { code: 'Digit5', label: '5', width: 1 },
        ],
      },
      {
        keys: [
          { code: 'Tab', label: 'Tab', width: 1.25 },
          { code: 'KeyQ', label: 'Q', width: 1 },
          { code: 'KeyW', label: 'W', width: 1 },
          { code: 'KeyE', label: 'E', width: 1 },
          { code: 'KeyR', label: 'R', width: 1 },
          { width: 0.75, spacer: true },
        ],
      },
      {
        keys: [
          { code: 'CapsLock', label: 'Caps', width: 1.5 },
          { code: 'KeyA', label: 'A', width: 1 },
          { code: 'KeyS', label: 'S', width: 1 },
          { code: 'KeyD', label: 'D', width: 1 },
          { code: 'KeyF', label: 'F', width: 1 },
          { width: 0.5, spacer: true },
        ],
      },
      {
        keys: [
          { code: 'ShiftLeft', label: 'Shift', width: 1.75 },
          { code: 'KeyZ', label: 'Z', width: 1 },
          { code: 'KeyX', label: 'X', width: 1 },
          { code: 'KeyC', label: 'C', width: 1 },
          { code: 'KeyV', label: 'V', width: 1 },
          { width: 0.25, spacer: true },
        ],
      },
      {
        keys: [
          { code: 'ControlLeft', label: 'Ctrl', width: 1.25 },
          { code: 'AltLeft', label: 'Alt', width: 1.25 },
          { code: 'Space', label: 'Space', width: 3.5 },
        ],
      },
    ],
  },
  moba: {
    id: 'moba',
    name: 'MOBA / RTS 技能区',
    description: '聚焦 1-6 物品栏、QWER 技能、DF 召唤师技能、A/S/B 与功能修饰键',
    totalUnits: 6,
    rows: [
      {
        keys: [
          { code: 'Digit1', label: '1', width: 1 },
          { code: 'Digit2', label: '2', width: 1 },
          { code: 'Digit3', label: '3', width: 1 },
          { code: 'Digit4', label: '4', width: 1 },
          { code: 'Digit5', label: '5', width: 1 },
          { code: 'Digit6', label: '6', width: 1 },
        ],
      },
      {
        keys: [
          { code: 'Tab', label: 'Tab', width: 1 },
          { code: 'KeyQ', label: 'Q', width: 1 },
          { code: 'KeyW', label: 'W', width: 1 },
          { code: 'KeyE', label: 'E', width: 1 },
          { code: 'KeyR', label: 'R', width: 1 },
          { code: 'KeyB', label: 'B', width: 1 },
        ],
      },
      {
        keys: [
          { code: 'CapsLock', label: 'Caps', width: 1.25 },
          { code: 'KeyA', label: 'A', width: 1 },
          { code: 'KeyS', label: 'S', width: 1 },
          { code: 'KeyD', label: 'D', width: 1 },
          { code: 'KeyF', label: 'F', width: 1 },
          { code: 'KeyG', label: 'G', width: 0.75 },
        ],
      },
      {
        keys: [
          { code: 'ShiftLeft', label: 'Shift', width: 1.5 },
          { code: 'KeyZ', label: 'Z', width: 1 },
          { code: 'KeyX', label: 'X', width: 1 },
          { code: 'KeyC', label: 'C', width: 1 },
          { code: 'KeyV', label: 'V', width: 1 },
          { code: 'KeyP', label: 'P', width: 0.5 },
        ],
      },
      {
        keys: [
          { code: 'ControlLeft', label: 'Ctrl', width: 1.25 },
          { code: 'AltLeft', label: 'Alt', width: 1.25 },
          { code: 'Space', label: 'Space', width: 3.5 },
        ],
      },
    ],
  },
  '60': {
    id: '60',
    name: '60% 紧凑机械盘 (61 键)',
    description: '标准 ANSI 60% 主键盘布局，兼顾打字教学与日常游戏',
    totalUnits: 15,
    rows: [ROW_NUMBERS, ROW_QWERTY, ROW_HOME, ROW_BOTTOM_ALPHA, ROW_MODIFIERS],
  },
  tkl: {
    id: 'tkl',
    name: '80% 标准电竞盘 (TKL 87 键)',
    description: '完整 F 功能行、编辑键区与独立方向键的 87 键布局',
    totalUnits: 18.5,
    rows: [
      {
        heightScale: 0.86,
        marginBottomScale: 0.45,
        keys: [
          { code: 'Escape', label: 'Esc', width: 1 },
          { width: 1, spacer: true },
          { code: 'F1', label: 'F1', width: 1 },
          { code: 'F2', label: 'F2', width: 1 },
          { code: 'F3', label: 'F3', width: 1 },
          { code: 'F4', label: 'F4', width: 1 },
          { width: 0.5, spacer: true },
          { code: 'F5', label: 'F5', width: 1 },
          { code: 'F6', label: 'F6', width: 1 },
          { code: 'F7', label: 'F7', width: 1 },
          { code: 'F8', label: 'F8', width: 1 },
          { width: 0.5, spacer: true },
          { code: 'F9', label: 'F9', width: 1 },
          { code: 'F10', label: 'F10', width: 1 },
          { code: 'F11', label: 'F11', width: 1 },
          { code: 'F12', label: 'F12', width: 1 },
          { width: 0.5, spacer: true },
          { code: 'PrintScreen', label: 'PrtSc', width: 1 },
          { code: 'ScrollLock', label: 'ScrLk', width: 1 },
          { code: 'Pause', label: 'Pause', width: 1 },
        ],
      },
      {
        keys: [
          ...ROW_NUMBERS.keys,
          { width: 0.5, spacer: true },
          { code: 'Insert', label: 'Ins', width: 1 },
          { code: 'Home', label: 'Home', width: 1 },
          { code: 'PageUp', label: 'PgUp', width: 1 },
        ],
      },
      {
        keys: [
          ...ROW_QWERTY.keys,
          { width: 0.5, spacer: true },
          { code: 'Delete', label: 'Del', width: 1 },
          { code: 'End', label: 'End', width: 1 },
          { code: 'PageDown', label: 'PgDn', width: 1 },
        ],
      },
      {
        keys: [...ROW_HOME.keys, { width: 3.5, spacer: true }],
      },
      {
        keys: [
          ...ROW_BOTTOM_ALPHA.keys,
          { width: 1.5, spacer: true },
          { code: 'ArrowUp', label: '↑', width: 1 },
          { width: 1, spacer: true },
        ],
      },
      {
        keys: [
          ...ROW_MODIFIERS.keys,
          { width: 0.5, spacer: true },
          { code: 'ArrowLeft', label: '←', width: 1 },
          { code: 'ArrowDown', label: '↓', width: 1 },
          { code: 'ArrowRight', label: '→', width: 1 },
        ],
      },
    ],
  },
}

/**
 * 基于 0.25u 网格步长计算像素级严丝合缝的键帽与外壳矩形几何坐标
 */
export function computeKeyboardGeometry(
  preset: KeyboardLayoutPreset,
  keyUnit = 38,
  gap = 4,
  originX = 0,
  originY = 0,
): ComputedKeyboardGeometry {
  const spec = KEYBOARD_LAYOUTS[preset] ?? KEYBOARD_LAYOUTS.wasd
  const quarterStep = (keyUnit - gap * 3) / 4
  const spanToWidth = (units: number) => {
    const cols = Math.round(units * 4)
    return cols * quarterStep + Math.max(0, cols - 1) * gap
  }
  const padding = Math.round(gap * 2.4)
  const contentWidth = spanToWidth(spec.totalUnits)
  const keys: ComputedKeyBox[] = []

  let curY = originY + padding
  for (let r = 0; r < spec.rows.length; r++) {
    const row = spec.rows[r]
    const rowHeight = Math.round(keyUnit * (row.heightScale ?? 1))
    let curX = originX + padding

    for (const keyDef of row.keys) {
      const boxW = spanToWidth(keyDef.width)
      if (!keyDef.spacer && keyDef.code) {
        keys.push({
          code: keyDef.code,
          label: keyDef.label ?? keyDef.code,
          subLabel: keyDef.subLabel,
          x: curX,
          y: curY,
          width: boxW,
          height: rowHeight,
          isWide: keyDef.width > 1.2,
        })
      }
      curX += boxW + gap
    }

    const extraMargin = row.marginBottomScale ? gap * row.marginBottomScale : 0
    curY += rowHeight + (r < spec.rows.length - 1 ? gap + extraMargin : 0)
  }

  return {
    preset: spec.id,
    width: contentWidth + padding * 2,
    height: curY - originY + padding,
    padding,
    keys,
  }
}
