// src/types/gamepad.ts

import type { FunctionalComponent, SVGAttributes } from 'vue'

export interface Position {
  top: string // e.g., '50%'
  left: string // e.g., '25%'
  width: string // e.g., '15%'
  height?: string // e.g., '10%', optional
}

// 使用 as const 来获得更精确的字符串字面量类型，类似于枚举
export const LogicalButtonsList = [
  'ACTION_DOWN',
  'ACTION_RIGHT',
  'ACTION_LEFT',
  'ACTION_UP',
  'LEFT_SHOULDER_1',
  'RIGHT_SHOULDER_1',
  'LEFT_SHOULDER_2',
  'RIGHT_SHOULDER_2',
  'SELECT',
  'START',
  'LEFT_STICK_PRESS',
  'RIGHT_STICK_PRESS',
  'DPAD_UP',
  'DPAD_DOWN',
  'DPAD_LEFT',
  'DPAD_RIGHT',
  'HOME',
  'PS_TOUCHPAD',
  'NINTENDO_CAPTURE',
] as const

// 从上面的数组生成联合类型
export type LogicalButton = typeof LogicalButtonsList[number]

// 用于摇杆的特定逻辑名 (区别于按键的 LogicalButton)
export type LogicalStickName = 'LEFT_STICK' | 'RIGHT_STICK'

interface BaseComponentConfig {
  svg: FunctionalComponent<SVGAttributes>
  position: Position
}

export interface ButtonComponentConfig extends BaseComponentConfig {
  type: 'button'
  logicalButton: LogicalButton // 对应 LogicalButtons 中的一个
  name: string // 显示名称，如 "A", "Cross"
}

export interface StickComponentConfig extends BaseComponentConfig {
  type: 'stick'
  logicalButton: LogicalStickName // 'LEFT_STICK' or 'RIGHT_STICK'
}

export type GamepadComponentConfig = ButtonComponentConfig | StickComponentConfig

export interface GamepadConfig {
  name: string
  bodySvg: FunctionalComponent<SVGAttributes>
  aspectRatio: string // e.g., '1000/625'
  components: GamepadComponentConfig[]
  defaultViewBox: string
}

export type GamepadType = 'xbox' | 'ps' | 'nintendo' // 或者更通用的 string

export type AllGamepadConfigs = Record<GamepadType, GamepadConfig>

// --- Types for useGamepad composable ---
export interface ButtonInputState {
  pressed: boolean
  value: number // For analog buttons/triggers
}

export interface StickInputState {
  x: number
  y: number
}

export type NormalizedButtonsInputState = Partial<Record<LogicalButton, ButtonInputState>>
// 使用 Partial 是因为并非所有手柄都会映射所有 LogicalButton

export interface NormalizedSticksInputState {
  LEFT_STICK: StickInputState
  RIGHT_STICK: StickInputState
}

export interface NormalizedGamepadState {
  buttons: NormalizedButtonsInputState
  sticks: NormalizedSticksInputState
}

export interface RawGamepadState {
  buttons: readonly GamepadButton[] // GamepadButton is a browser native type
  axes: readonly number[]
}

export interface GamepadConnectionInfo {
  id: string
  mapping: string // GamepadMappingType is a browser native type
}
