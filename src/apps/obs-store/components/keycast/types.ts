import type { KeyboardLayoutPreset } from './keyboardLayouts'

export type KeycastDisplayMode = 'overlay' | 'stream'
export type KeycastTheme = 'mechanical' | 'minimal' | 'neon' | 'glass' | 'immersive'
export type KeycastDirection = 'row' | 'column'
export type KeycastPressEffect = 'none' | 'ripple' | 'shockwave' | 'spark' | 'beam'
export type KeycastColorMode = 'solid' | 'rainbow' | 'zone'

export type MouseButtonName = 'left' | 'middle' | 'right' | 'back' | 'forward'
export type MouseWheelDirection = 'up' | 'down'

export interface KeycastState {
  displayMode: KeycastDisplayMode
  keyboardLayout: KeyboardLayoutPreset
  showMouse: boolean
  showKeyCount: boolean
  pressEffect: KeycastPressEffect
  colorMode: KeycastColorMode
  afterglowMs: number
  enableAfterglow: boolean
  enableRipple: boolean
  enableHeatmap: boolean
  enableMouseTrail: boolean
  opacity: number
  theme: KeycastTheme
  direction: KeycastDirection
  maxKeys: number
  fadeDelayMs: number
  showApm: boolean
  showCombos: boolean
  accentColor: string
  fontSize: number
  fontFamily?: string
}

export interface KeyPressPayload {
  label: string
  modifiers: string[]
  code: string
  ts: number
}

export type KeycastAction =
  | { type: 'KEY_PRESS'; payload: KeyPressPayload }
  | { type: 'KEY_DOWN'; code: string; payload?: KeyPressPayload }
  | { type: 'KEY_UP'; code: string }
  | { type: 'MOUSE_DOWN'; button: MouseButtonName }
  | { type: 'MOUSE_UP'; button: MouseButtonName }
  | { type: 'MOUSE_WHEEL'; direction: MouseWheelDirection }
  | { type: 'MOUSE_MOVE'; dx: number; dy: number }
  | { type: 'CLEAR' }

export const DEFAULT_KEYCAST_STATE: KeycastState = {
  displayMode: 'overlay',
  keyboardLayout: 'wasd',
  showMouse: true,
  showKeyCount: false,
  pressEffect: 'ripple',
  colorMode: 'solid',
  afterglowMs: 340,
  enableAfterglow: true,
  enableRipple: true,
  enableHeatmap: false,
  enableMouseTrail: true,
  opacity: 100,
  theme: 'mechanical',
  direction: 'row',
  maxKeys: 6,
  fadeDelayMs: 2200,
  showApm: true,
  showCombos: true,
  accentColor: '#38bdf8',
  fontSize: 15,
  fontFamily: '',
}

const KEY_LABEL_MAP: Record<string, string> = {
  ' ': 'Space',
  Spacebar: 'Space',
  Escape: 'Esc',
  Enter: 'Enter',
  Backspace: 'Backspace',
  Tab: 'Tab',
  Delete: 'Del',
  Insert: 'Ins',
  Home: 'Home',
  End: 'End',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  CapsLock: 'Caps',
  Control: 'Ctrl',
  Shift: 'Shift',
  Alt: 'Alt',
  Meta: 'Win',
}

const MOUSE_BUTTON_MAP: Record<number, MouseButtonName> = {
  0: 'left',
  1: 'middle',
  2: 'right',
  3: 'back',
  4: 'forward',
}

export function mapMouseButton(button: number): MouseButtonName | null {
  return MOUSE_BUTTON_MAP[button] ?? null
}

export function resolvePressEffect(state: Pick<KeycastState, 'pressEffect' | 'enableRipple'>): KeycastPressEffect {
  if (state.pressEffect) return state.pressEffect
  return state.enableRipple ? 'ripple' : 'none'
}

export function resolveAfterglowMs(state: Pick<KeycastState, 'afterglowMs' | 'enableAfterglow'>): number {
  if (typeof state.afterglowMs === 'number') return Math.max(0, state.afterglowMs)
  return state.enableAfterglow ? 340 : 0
}

export function formatKeyboardEvent(event: KeyboardEvent, ignoreRepeat = true): KeyPressPayload | null {
  if (ignoreRepeat && event.repeat) return null
  const modifiers: string[] = []
  if (event.ctrlKey && event.key !== 'Control') modifiers.push('Ctrl')
  if (event.shiftKey && event.key !== 'Shift') modifiers.push('Shift')
  if (event.altKey && event.key !== 'Alt') modifiers.push('Alt')
  if (event.metaKey && event.key !== 'Meta') modifiers.push('Win')

  const mapped = KEY_LABEL_MAP[event.key]
  const label = mapped ?? (event.key.length === 1 ? event.key.toUpperCase() : event.key)

  return {
    label,
    modifiers,
    code: event.code || event.key,
    ts: Date.now(),
  }
}
