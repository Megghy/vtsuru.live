import { describe, expect, it } from 'vitest'

import { controllerBodies, gamepadConfigs } from '../data/gamepadConfigs'

describe('gamepadConfigs 配置完整性测试', () => {
  const types = ['xbox', 'ps', 'nintendo'] as const

  it('所有定义的手柄类型都应具备名称、aspectRatio、defaultViewBox 和 bodySvg', () => {
    for (const type of types) {
      const config = gamepadConfigs[type]
      expect(config).toBeDefined()
      expect(config.name).toBeTruthy()
      expect(config.aspectRatio).toMatch(/\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?/)
      expect(config.defaultViewBox).toMatch(/^0\s+0\s+\d+(\.\d+)?\s+\d+(\.\d+)?$/)
      expect(config.bodySvg).toBeDefined()
    }
  })

  it('所有手柄底壳选项都应具备合法 id、name、body、aspectRatio 与 defaultViewBox', () => {
    for (const type of types) {
      const bodies = controllerBodies[type]
      expect(Array.isArray(bodies)).toBe(true)
      expect(bodies.length).toBeGreaterThanOrEqual(1)

      for (const body of bodies) {
        expect(body.id).toBeTruthy()
        expect(body.name).toBeTruthy()
        expect(body.body).toBeDefined()
        expect(body.defaultViewBox).toMatch(/^0\s+0\s+\d+(\.\d+)?\s+\d+(\.\d+)?$/)
        expect(body.aspectRatio).toMatch(/\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?/)
      }
    }
  })
})
