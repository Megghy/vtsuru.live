import type { Component } from 'vue'

// 统一标准手柄逻辑按键定义
export const LogicalButtonsList = [
  'ACTION_DOWN', // Xbox A / PS Cross / Nintendo B
  'ACTION_RIGHT', // Xbox B / PS Circle / Nintendo A
  'ACTION_LEFT', // Xbox X / PS Square / Nintendo Y
  'ACTION_UP', // Xbox Y / PS Triangle / Nintendo X
  'LEFT_SHOULDER_1', // LB / L1 / L
  'RIGHT_SHOULDER_1', // RB / R1 / R
  'LEFT_SHOULDER_2', // LT / L2 / ZL (线性触发器)
  'RIGHT_SHOULDER_2', // RT / R2 / ZR (线性触发器)
  'SELECT', // Xbox View / PS Share/Create / Nintendo -
  'START', // Xbox Menu / PS Options / Nintendo +
  'LEFT_STICK_PRESS', // L3
  'RIGHT_STICK_PRESS', // R3
  'DPAD_UP', // 十字键 上
  'DPAD_DOWN', // 十字键 下
  'DPAD_LEFT', // 十字键 左
  'DPAD_RIGHT', // 十字键 右
  'HOME', // Guide / Home / PS
  'PS_TOUCHPAD', // PS 触摸板点击
  'NINTENDO_CAPTURE', // 任天堂截图键
] as const

export type LogicalButton = (typeof LogicalButtonsList)[number]

export type LogicalStickName = 'LEFT_STICK' | 'RIGHT_STICK'

export interface GamepadConfig {
  name: string
  bodySvg: Component
  aspectRatio: string // 宽高比，例如 '1543.24 / 956.31'
  defaultViewBox: string
}

export type GamepadType = 'xbox' | 'ps' | 'nintendo'

export type AllGamepadConfigs = Record<GamepadType, GamepadConfig>

// --- 输入状态模型 ---

export interface ButtonInputState {
  pressed: boolean
  value: number // 0.0 ~ 1.0 (线性量)
}

export interface StickInputState {
  x: number // -1.0 ~ 1.0
  y: number // -1.0 ~ 1.0
}

export type NormalizedButtonsInputState = Record<LogicalButton, ButtonInputState>

export interface NormalizedSticksInputState {
  LEFT_STICK: StickInputState
  RIGHT_STICK: StickInputState
}

export interface NormalizedGamepadState {
  buttons: NormalizedButtonsInputState
  sticks: NormalizedSticksInputState
}

export interface GamepadConnectionInfo {
  id: string
  mapping: string
  index: number
}
