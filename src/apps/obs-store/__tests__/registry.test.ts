import { describe, expect, it } from 'vitest'

import {
  OBS_CATEGORIES,
  filterObsComponents,
  getCategoryCounts,
  getCategoryMeta,
  getObsComponentById,
  getObsComponentsByCategory,
  getReadyComponentsCount,
  obsComponentList,
} from '../registry'
import type { ObsCategory } from '../registry'

describe('OBS Store Registry', () => {
  describe('数据完备性与契约约束', () => {
    it('注册表应包含至少一个已就绪组件', () => {
      expect(obsComponentList.length).toBeGreaterThan(0)
      const readyList = obsComponentList.filter((item) => item.status === 'ready')
      expect(readyList.length).toBeGreaterThanOrEqual(1)
    })

    it('所有组件 ID 必须唯一且符合命名规范', () => {
      const ids = obsComponentList.map((item) => item.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length)

      for (const id of ids) {
        expect(id).toMatch(/^[a-z0-9_-]+$/)
      }
    })

    it('所有组件必须具备完整的必填字段', () => {
      for (const item of obsComponentList) {
        expect(item.id).toBeTruthy()
        expect(item.name).toBeTruthy()
        expect(item.shortDescription).toBeTruthy()
        expect(item.description).toBeTruthy()
        expect(item.tags).toBeInstanceOf(Array)
        expect(item.tags.length).toBeGreaterThan(0)
        expect(item.features).toBeInstanceOf(Array)
        expect(item.features.length).toBeGreaterThan(0)
        expect(item.icon).toBeDefined()
        expect(['ready', 'beta', 'planned']).toContain(item.status)
        expect(['input', 'widget', 'utility', 'interactive']).toContain(item.category)
      }
    })

    it('已就绪组件必须包含合法的 obsPath 与 manageComponent', () => {
      const readyList = obsComponentList.filter((item) => item.status === 'ready')
      for (const item of readyList) {
        expect(item.obsPath).toMatch(/^\/obs-store\//)
        expect(item.manageComponent).toBeTypeOf('function')
      }
    })

    it('手柄 (gamepad) 组件元数据应符合预期', () => {
      const gamepad = getObsComponentById('gamepad')
      expect(gamepad).toBeDefined()
      expect(gamepad?.name).toContain('手柄')
      expect(gamepad?.category).toBe('input')
      expect(gamepad?.status).toBe('ready')
      expect(gamepad?.obsPath).toBe('/obs-store/gamepad')
      expect(gamepad?.defaultResolution?.width).toBe(800)
      expect(gamepad?.defaultResolution?.height).toBe(500)
    })
  })

  describe('分类与元数据查询', () => {
    it('OBS_CATEGORIES 必须包含 all 及所有业务分类', () => {
      const catIds = OBS_CATEGORIES.map((c) => c.id)
      expect(catIds).toContain('all')
      expect(catIds).toContain('input')
      expect(catIds).toContain('widget')
      expect(catIds).toContain('utility')
      expect(catIds).toContain('interactive')
    })

    it('getCategoryMeta 应能正确返回分类元数据', () => {
      const inputMeta = getCategoryMeta('input')
      expect(inputMeta?.name).toBe('外设输入')
      expect(inputMeta?.icon).toBeDefined()

      const notFound = getCategoryMeta('invalid' as ObsCategory)
      expect(notFound).toBeUndefined()
    })

    it('getCategoryCounts 统计数值应准确', () => {
      const counts = getCategoryCounts()
      expect(counts.all).toBe(obsComponentList.length)
      expect(counts.input).toBeGreaterThanOrEqual(1)
      expect(counts.input + counts.widget + counts.utility + counts.interactive).toBe(obsComponentList.length)
    })

    it('getReadyComponentsCount 统计应准确', () => {
      const readyCount = getReadyComponentsCount()
      const actualReady = obsComponentList.filter((item) => item.status === 'ready').length
      expect(readyCount).toBe(actualReady)
    })
  })

  describe('组件过滤与搜索 (filterObsComponents)', () => {
    it('默认参数应返回所有组件', () => {
      const results = filterObsComponents()
      expect(results.length).toBe(obsComponentList.length)
    })

    it('按分类过滤应只返回对应分类的组件', () => {
      const inputList = filterObsComponents({ category: 'input' })
      expect(inputList.length).toBeGreaterThan(0)
      expect(inputList.every((item) => item.category === 'input')).toBe(true)

      const byCategoryHelper = getObsComponentsByCategory('input')
      expect(byCategoryHelper).toEqual(inputList)
    })

    it('按关键词搜索应支持匹配名称、描述、ID 和标签', () => {
      // 按名称搜
      const byName = filterObsComponents({ search: '手柄' })
      expect(byName.some((item) => item.id === 'gamepad')).toBe(true)

      // 按 ID 搜
      const byId = filterObsComponents({ search: 'gamepad' })
      expect(byId.length).toBe(1)
      expect(byId[0].id).toBe('gamepad')

      // 按标签搜 (例如 Xbox)
      const byTag = filterObsComponents({ search: 'Xbox' })
      expect(byTag.some((item) => item.id === 'gamepad')).toBe(true)

      // 不存在的关键词搜
      const empty = filterObsComponents({ search: 'nonexistent-xyz-random-123' })
      expect(empty.length).toBe(0)
    })

    it('按状态过滤应正确筛选', () => {
      const readyList = filterObsComponents({ status: 'ready' })
      expect(readyList.every((item) => item.status === 'ready')).toBe(true)

      const plannedList = filterObsComponents({ status: 'planned' })
      expect(plannedList.every((item) => item.status === 'planned')).toBe(true)
    })

    it('组合多条件过滤应取交集', () => {
      const result = filterObsComponents({
        category: 'input',
        status: 'ready',
        search: '手柄',
      })
      expect(result.length).toBe(1)
      expect(result[0].id).toBe('gamepad')

      const noMatch = filterObsComponents({
        category: 'interactive',
        status: 'ready',
      })
      expect(noMatch.length).toBe(0)
    })
  })
})
