import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  applyAxisDeadzone,
  clampStickAxes,
  createInitialButtonStates,
  STANDARD_BUTTON_MAP,
  useGamepadStore,
} from '../useGamepadStore'

describe('useGamepadStore 算法与状态测试', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('applyAxisDeadzone 死区计算', () => {
    it('在死区阈值内应过滤为 0', () => {
      expect(applyAxisDeadzone(0, 0.08)).toBe(0)
      expect(applyAxisDeadzone(0.05, 0.08)).toBe(0)
      expect(applyAxisDeadzone(-0.07, 0.08)).toBe(0)
    })

    it('超出死区阈值后应线性平滑输出至 1', () => {
      // 当 raw = 1.0 时，输出必须是 1.0
      expect(applyAxisDeadzone(1.0, 0.08)).toBeCloseTo(1.0, 5)
      // 当 raw = -1.0 时，输出必须是 -1.0
      expect(applyAxisDeadzone(-1.0, 0.08)).toBeCloseTo(-1.0, 5)
      // 中间值线性重映射
      const mid = applyAxisDeadzone(0.54, 0.08)
      expect(mid).toBeGreaterThan(0)
      expect(mid).toBeLessThan(1)
    })
  })

  describe('clampStickAxes 圆周限幅', () => {
    it('模长小于等于 1 时保持原样', () => {
      const res = clampStickAxes(0.5, 0.5)
      expect(res.x).toBe(0.5)
      expect(res.y).toBe(0.5)
    })

    it('模长大于 1 时归一化至单位圆内', () => {
      const res = clampStickAxes(1.0, 1.0)
      expect(Math.hypot(res.x, res.y)).toBeCloseTo(1.0, 5)
      expect(res.x).toBeCloseTo(Math.SQRT1_2, 5)
      expect(res.y).toBeCloseTo(Math.SQRT1_2, 5)
    })
  })

  describe('标准按键映射完整性', () => {
    it('应包含主要的标准游戏按键', () => {
      expect(STANDARD_BUTTON_MAP[0]).toBe('ACTION_DOWN')
      expect(STANDARD_BUTTON_MAP[1]).toBe('ACTION_RIGHT')
      expect(STANDARD_BUTTON_MAP[2]).toBe('ACTION_LEFT')
      expect(STANDARD_BUTTON_MAP[3]).toBe('ACTION_UP')
      expect(STANDARD_BUTTON_MAP[6]).toBe('LEFT_SHOULDER_2')
      expect(STANDARD_BUTTON_MAP[7]).toBe('RIGHT_SHOULDER_2')
      expect(STANDARD_BUTTON_MAP[10]).toBe('LEFT_STICK_PRESS')
      expect(STANDARD_BUTTON_MAP[11]).toBe('RIGHT_STICK_PRESS')
    })
  })

  describe('Store 模拟与状态重置', () => {
    it('初始状态所有按键和摇杆均为零', () => {
      const store = useGamepadStore()
      expect(store.normalizedGamepadState.buttons.ACTION_DOWN.pressed).toBe(false)
      expect(store.normalizedGamepadState.buttons.ACTION_DOWN.value).toBe(0)
      expect(store.normalizedGamepadState.sticks.LEFT_STICK.x).toBe(0)
      expect(store.normalizedGamepadState.sticks.LEFT_STICK.y).toBe(0)
    })

    it('手动模拟单个按键与摇杆', () => {
      const store = useGamepadStore()
      store.simulateButton('ACTION_DOWN', true, 1)
      expect(store.normalizedGamepadState.buttons.ACTION_DOWN.pressed).toBe(true)
      expect(store.normalizedGamepadState.buttons.ACTION_DOWN.value).toBe(1)

      store.simulateStick('LEFT_STICK', 0.8, -0.6)
      expect(store.normalizedGamepadState.sticks.LEFT_STICK.x).toBeCloseTo(0.8, 5)
      expect(store.normalizedGamepadState.sticks.LEFT_STICK.y).toBeCloseTo(-0.6, 5)

      store.resetNormalizedState()
      expect(store.normalizedGamepadState.buttons.ACTION_DOWN.pressed).toBe(false)
      expect(store.normalizedGamepadState.sticks.LEFT_STICK.x).toBe(0)
    })

    it('启动与停止模拟演示模式', () => {
      const store = useGamepadStore()
      store.startSimulation()
      expect(store.isSimulating).toBe(true)
      expect(store.isGamepadConnected).toBe(true)

      store.stopSimulation()
      expect(store.isSimulating).toBe(false)
    })
  })
})
