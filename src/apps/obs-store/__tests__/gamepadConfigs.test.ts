import { describe, expect, it } from 'vitest'

import { controllerBodies, gamepadConfigs } from '../data/gamepadConfigs'

describe('gamepadConfigs 配置完整性测试', () => {
  const types = ['xbox', 'ps', 'nintendo'] as const

  it('所有定义的手柄类型都应具备名称、aspectRatio、defaultViewBox 和 components 列表', () => {
    for (const type of types) {
      const config = gamepadConfigs[type]
      expect(config).toBeDefined()
      expect(config.name).toBeTruthy()
      expect(config.aspectRatio).toMatch(/\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?/)
      expect(config.defaultViewBox).toMatch(/^0\s+0\s+\d+(\.\d+)?\s+\d+(\.\d+)?$/)
      expect(Array.isArray(config.components)).toBe(true)
      expect(config.components.length).toBeGreaterThan(10)
    }
  })

  it('所有手柄类型都应包含左右双摇杆且带有 pressLogicalButton', () => {
    for (const type of types) {
      const config = gamepadConfigs[type]
      const sticks = config.components.filter((c) => c.type === 'stick')
      expect(sticks.length).toBe(2)

      const leftStick = sticks.find((s) => s.logicalButton === 'LEFT_STICK')
      const rightStick = sticks.find((s) => s.logicalButton === 'RIGHT_STICK')

      expect(leftStick).toBeDefined()
      expect(leftStick?.pressLogicalButton).toBe('LEFT_STICK_PRESS')
      expect(rightStick).toBeDefined()
      expect(rightStick?.pressLogicalButton).toBe('RIGHT_STICK_PRESS')
    }
  })

  it('所有手柄底壳选项都应具备合法 id、name、body 与 defaultViewBox', () => {
    for (const type of types) {
      const bodies = controllerBodies[type]
      expect(Array.isArray(bodies)).toBe(true)
      expect(bodies.length).toBeGreaterThanOrEqual(1)

      for (const body of bodies) {
        expect(body.id).toBeTruthy()
        expect(body.name).toBeTruthy()
        expect(body.body).toBeDefined()
        expect(body.defaultViewBox).toBeTruthy()
      }
    }
  })

  it('按键与摇杆的百分比坐标格式合法', () => {
    const percentRegex = /^\d+(\.\d+)?%$/
    for (const type of types) {
      const config = gamepadConfigs[type]
      for (const comp of config.components) {
        expect(comp.position.top).toMatch(percentRegex)
        expect(comp.position.left).toMatch(percentRegex)
        expect(comp.position.width).toMatch(percentRegex)
      }
    }
  })
})
