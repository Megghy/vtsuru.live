import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  CLOCK_THEME_PRESETS,
  DEFAULT_CLOCK_STATE,
} from '../components/clock/types'
import { clockComponent } from '../registry/items/clock'

describe('OBS Clock & Timer Component', () => {
  describe('默认状态与类型契约', () => {
    it('DEFAULT_CLOCK_STATE 应具备合法的初始字段', () => {
      expect(DEFAULT_CLOCK_STATE.mode).toBe('clock')
      expect(DEFAULT_CLOCK_STATE.theme).toBe('casio')
      expect(DEFAULT_CLOCK_STATE.is24Hour).toBe(true)
      expect(DEFAULT_CLOCK_STATE.showSeconds).toBe(true)
      expect(DEFAULT_CLOCK_STATE.countdownDuration).toBeGreaterThan(0)
      expect(DEFAULT_CLOCK_STATE.timerRunning).toBe(false)
      expect(DEFAULT_CLOCK_STATE.bgOpacity).toBeGreaterThanOrEqual(0)
    })

    it('预设清单应包含 13 种完全不同的物理形态风格', () => {
      expect(CLOCK_THEME_PRESETS.length).toBe(13)
      const themeIds = CLOCK_THEME_PRESETS.map((p) => p.id)
      expect(themeIds).toContain('casio')
      expect(themeIds).toContain('flip')
      expect(themeIds).toContain('swiss')
      expect(themeIds).toContain('vintage')
      expect(themeIds).toContain('dotmatrix')
      expect(themeIds).toContain('calculator')
      expect(themeIds).toContain('nixie')
      expect(themeIds).toContain('tactical')
      expect(themeIds).toContain('pill')
      expect(themeIds).toContain('minimal')
      expect(themeIds).toContain('cute')
      expect(themeIds).toContain('fresh')
      expect(themeIds).toContain('pixel')

      for (const preset of CLOCK_THEME_PRESETS) {
        expect(preset.name).toBeTruthy()
        expect(preset.archetype).toBeTruthy()
        expect(preset.description).toBeTruthy()
        expect(preset.tag).toBeTruthy()
      }
    })
  })

  describe('注册表元数据契约', () => {
    it('clockComponent 状态应为 ready 并包含完整路由与管理端组件', () => {
      expect(clockComponent.id).toBe('clock')
      expect(clockComponent.status).toBe('ready')
      expect(clockComponent.obsPath).toBe('/obs-store/clock')
      expect(clockComponent.managePath).toBe('/obs-store/clock-manage')
      expect(typeof clockComponent.manageComponent).toBe('function')
      expect(clockComponent.features.length).toBeGreaterThan(0)
    })
  })
})
