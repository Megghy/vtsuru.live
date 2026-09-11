import { useGamepad, useRafFn } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'

import type {
  ButtonInputState,
  GamepadConnectionInfo,
  LogicalButton,
  LogicalStickName,
  NormalizedGamepadState,
} from '@/types/gamepad'
import { LogicalButtonsList } from '@/types/gamepad'

// 标准按钮映射：将浏览器 Gamepad API 的按键索引映射到逻辑按键
export const STANDARD_BUTTON_MAP: Partial<Record<number, LogicalButton>> = {
  0: 'ACTION_DOWN', // Xbox A / PS Cross / Nintendo B
  1: 'ACTION_RIGHT', // Xbox B / PS Circle / Nintendo A
  2: 'ACTION_LEFT', // Xbox X / PS Square / Nintendo Y
  3: 'ACTION_UP', // Xbox Y / PS Triangle / Nintendo X
  4: 'LEFT_SHOULDER_1', // LB / L1 / L
  5: 'RIGHT_SHOULDER_1', // RB / R1 / R
  6: 'LEFT_SHOULDER_2', // LT / L2 / ZL (线性触发器)
  7: 'RIGHT_SHOULDER_2', // RT / R2 / ZR (线性触发器)
  8: 'SELECT', // Xbox View / PS Share / Nintendo -
  9: 'START', // Xbox Menu / PS Options / Nintendo +
  10: 'LEFT_STICK_PRESS', // L3
  11: 'RIGHT_STICK_PRESS', // R3
  12: 'DPAD_UP', // 十字键 上
  13: 'DPAD_DOWN', // 十字键 下
  14: 'DPAD_LEFT', // 十字键 左
  15: 'DPAD_RIGHT', // 十字键 右
  16: 'HOME', // Xbox Guide / PS Button / Nintendo Home
  17: 'PS_TOUCHPAD', // DualSense 触摸板 / Xbox Series Share
  18: 'NINTENDO_CAPTURE', // DualSense Mute / Switch Capture
}

// 默认死区大小
export const DEFAULT_AXIS_DEADZONE = 0.08

/**
 * 带有死区重映射的摇杆轴数值过滤（平滑输出 0 ~ 1）
 */
export function applyAxisDeadzone(raw: number, deadzone = DEFAULT_AXIS_DEADZONE): number {
  if (Math.abs(raw) < deadzone) return 0
  const sign = Math.sign(raw)
  const normalized = (Math.abs(raw) - deadzone) / (1 - deadzone)
  return sign * Math.min(1, Math.max(0, normalized))
}

/**
 * 摇杆双轴圆周限幅（保证推杆在圆形轨道内，模长不超过 1）
 */
export function clampStickAxes(x: number, y: number): { x: number; y: number } {
  const mag = Math.hypot(x, y)
  if (mag <= 1) return { x, y }
  return { x: x / mag, y: y / mag }
}

export function createInitialButtonStates(): Record<LogicalButton, ButtonInputState> {
  return LogicalButtonsList.reduce(
    (acc, key) => {
      acc[key] = { pressed: false, value: 0 }
      return acc
    },
    {} as Record<LogicalButton, ButtonInputState>,
  )
}

export const useGamepadStore = defineStore('gamepad', () => {
  const { gamepads, onConnected, onDisconnected } = useGamepad()

  const activeGamepadIndex = ref<number | null>(null)
  const deadzone = ref<number>(DEFAULT_AXIS_DEADZONE)

  // 模拟/测试模式
  const isSimulating = ref(false)

  const normalizedGamepadState = reactive<NormalizedGamepadState>({
    buttons: createInitialButtonStates(),
    sticks: {
      LEFT_STICK: { x: 0, y: 0 },
      RIGHT_STICK: { x: 0, y: 0 },
    },
  })

  // 可用手柄列表
  const connectedGamepadsList = computed<GamepadConnectionInfo[]>(() => {
    return gamepads.value
      .filter((gp): gp is Gamepad => Boolean(gp && gp.connected))
      .map((gp) => ({
        id: gp.id,
        mapping: gp.mapping,
        index: gp.index,
      }))
  })

  const connectedGamepadInfo = computed<GamepadConnectionInfo | null>(() => {
    if (activeGamepadIndex.value === null) return null
    const gp = gamepads.value[activeGamepadIndex.value]
    if (!gp || !gp.connected) return null
    return {
      id: gp.id,
      mapping: gp.mapping,
      index: gp.index,
    }
  })

  const isGamepadConnected = computed(
    () => isSimulating.value || (activeGamepadIndex.value !== null && Boolean(gamepads.value[activeGamepadIndex.value]?.connected)),
  )

  function resetNormalizedState() {
    for (const key of LogicalButtonsList) {
      normalizedGamepadState.buttons[key].pressed = false
      normalizedGamepadState.buttons[key].value = 0
    }
    normalizedGamepadState.sticks.LEFT_STICK.x = 0
    normalizedGamepadState.sticks.LEFT_STICK.y = 0
    normalizedGamepadState.sticks.RIGHT_STICK.x = 0
    normalizedGamepadState.sticks.RIGHT_STICK.y = 0
  }

  function updateFromGamepad(gamepad: Gamepad | undefined) {
    if (isSimulating.value) return
    if (!gamepad || !gamepad.connected) {
      resetNormalizedState()
      return
    }

    // 更新按钮状态与线性触发器模拟量
    for (let i = 0; i < gamepad.buttons.length; i++) {
      const button = gamepad.buttons[i]
      const logicalKey = STANDARD_BUTTON_MAP[i]
      if (logicalKey && normalizedGamepadState.buttons[logicalKey]) {
        const val = button.value ?? (button.pressed ? 1 : 0)
        normalizedGamepadState.buttons[logicalKey].pressed = button.pressed || val > 0.15
        normalizedGamepadState.buttons[logicalKey].value = val
      }
    }

    // 更新左摇杆
    const rawLx = gamepad.axes[0] ?? 0
    const rawLy = gamepad.axes[1] ?? 0
    const filteredL = clampStickAxes(
      applyAxisDeadzone(rawLx, deadzone.value),
      applyAxisDeadzone(rawLy, deadzone.value),
    )
    normalizedGamepadState.sticks.LEFT_STICK.x = filteredL.x
    normalizedGamepadState.sticks.LEFT_STICK.y = filteredL.y

    // 更新右摇杆
    const rawRx = gamepad.axes[2] ?? 0
    const rawRy = gamepad.axes[3] ?? 0
    const filteredR = clampStickAxes(
      applyAxisDeadzone(rawRx, deadzone.value),
      applyAxisDeadzone(rawRy, deadzone.value),
    )
    normalizedGamepadState.sticks.RIGHT_STICK.x = filteredR.x
    normalizedGamepadState.sticks.RIGHT_STICK.y = filteredR.y
  }

  // --- 模拟/演示动画驱动 ---
  let simulationTick = 0
  const { pause: pauseSimLoop, resume: resumeSimLoop } = useRafFn(() => {
    if (!isSimulating.value) return
    simulationTick += 0.03

    // 摇杆画圆动画
    const lx = Math.cos(simulationTick) * 0.8
    const ly = Math.sin(simulationTick) * 0.8
    const rx = Math.cos(-simulationTick * 0.7) * 0.6
    const ry = Math.sin(-simulationTick * 0.7) * 0.6

    normalizedGamepadState.sticks.LEFT_STICK.x = lx
    normalizedGamepadState.sticks.LEFT_STICK.y = ly
    normalizedGamepadState.sticks.RIGHT_STICK.x = rx
    normalizedGamepadState.sticks.RIGHT_STICK.y = ry

    // 扳机周期性按压
    const trigVal = (Math.sin(simulationTick * 1.5) + 1) / 2
    normalizedGamepadState.buttons.LEFT_SHOULDER_2.value = trigVal
    normalizedGamepadState.buttons.LEFT_SHOULDER_2.pressed = trigVal > 0.15
    normalizedGamepadState.buttons.RIGHT_SHOULDER_2.value = 1 - trigVal
    normalizedGamepadState.buttons.RIGHT_SHOULDER_2.pressed = (1 - trigVal) > 0.15

    // 左右肩键周期性交替按下 (LB / RB / L1 / R1)
    const shoulderCycle = Math.floor(simulationTick * 1.6) % 4
    normalizedGamepadState.buttons.LEFT_SHOULDER_1.pressed = shoulderCycle === 0
    normalizedGamepadState.buttons.LEFT_SHOULDER_1.value = shoulderCycle === 0 ? 1 : 0
    normalizedGamepadState.buttons.RIGHT_SHOULDER_1.pressed = shoulderCycle === 2
    normalizedGamepadState.buttons.RIGHT_SHOULDER_1.value = shoulderCycle === 2 ? 1 : 0

    // 动作键交替按下
    const cycle = Math.floor(simulationTick * 2) % 4
    normalizedGamepadState.buttons.ACTION_DOWN.pressed = cycle === 0
    normalizedGamepadState.buttons.ACTION_RIGHT.pressed = cycle === 1
    normalizedGamepadState.buttons.ACTION_LEFT.pressed = cycle === 2
    normalizedGamepadState.buttons.ACTION_UP.pressed = cycle === 3

    // 方向键交替按下
    const dpadCycle = Math.floor(simulationTick * 1.5) % 4
    normalizedGamepadState.buttons.DPAD_UP.pressed = dpadCycle === 0
    normalizedGamepadState.buttons.DPAD_UP.value = dpadCycle === 0 ? 1 : 0
    normalizedGamepadState.buttons.DPAD_RIGHT.pressed = dpadCycle === 1
    normalizedGamepadState.buttons.DPAD_RIGHT.value = dpadCycle === 1 ? 1 : 0
    normalizedGamepadState.buttons.DPAD_DOWN.pressed = dpadCycle === 2
    normalizedGamepadState.buttons.DPAD_DOWN.value = dpadCycle === 2 ? 1 : 0
    normalizedGamepadState.buttons.DPAD_LEFT.pressed = dpadCycle === 3
    normalizedGamepadState.buttons.DPAD_LEFT.value = dpadCycle === 3 ? 1 : 0
  }, { immediate: false })

  function startSimulation() {
    isSimulating.value = true
    simulationTick = 0
    resumeSimLoop()
  }

  function stopSimulation() {
    isSimulating.value = false
    pauseSimLoop()
    resetNormalizedState()
  }

  function simulateButton(key: LogicalButton, pressed: boolean, value?: number) {
    if (!normalizedGamepadState.buttons[key]) return
    normalizedGamepadState.buttons[key].pressed = pressed
    normalizedGamepadState.buttons[key].value = value ?? (pressed ? 1 : 0)
  }

  function simulateStick(stick: LogicalStickName, x: number, y: number) {
    const clamped = clampStickAxes(x, y)
    normalizedGamepadState.sticks[stick].x = clamped.x
    normalizedGamepadState.sticks[stick].y = clamped.y
  }

  // --- 手柄事件监听 ---
  onConnected((index: number) => {
    if (activeGamepadIndex.value === null) {
      activeGamepadIndex.value = index
    }
  })

  onDisconnected((index: number) => {
    if (activeGamepadIndex.value === index) {
      activeGamepadIndex.value = null
      resetNormalizedState()
      const next = gamepads.value.find((gp) => gp && gp.connected)
      if (next) {
        activeGamepadIndex.value = next.index
      }
    }
  })

  // 监听当前活跃手柄状态实时变化
  watch(
    () => (activeGamepadIndex.value !== null ? gamepads.value[activeGamepadIndex.value] : undefined),
    (gamepad) => {
      updateFromGamepad(gamepad)
    },
    { deep: true, immediate: true },
  )

  return {
    gamepads,
    connectedGamepadsList,
    connectedGamepadInfo,
    activeGamepadIndex,
    isGamepadConnected,
    deadzone,
    isSimulating,
    normalizedGamepadState,
    resetNormalizedState,
    updateFromGamepad,
    startSimulation,
    stopSimulation,
    simulateButton,
    simulateStick,
  }
})
