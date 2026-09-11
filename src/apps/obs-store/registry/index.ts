import { OBS_CATEGORIES, getCategoryMeta } from './categories'
import { clockComponent } from './items/clock'
import { counterComponent } from './items/counter'
import { gamepadComponent } from './items/gamepad'
import { plannedComponents } from './items/planned'
import type {
  ObsCategory,
  ObsCategoryMeta,
  ObsComponentDefinition,
  ObsComponentStatus,
} from './types'

export * from './categories'
export * from './types'

/**
 * 所有收录的 OBS 独立纯前端组件清单（单一真源）
 * 新增独立组件时在此数组中登记即可
 */
export const obsComponentList: ObsComponentDefinition[] = [
  gamepadComponent,
  counterComponent,
  clockComponent,
  ...plannedComponents,
]

/**
 * 根据组件唯一 ID 获取元数据
 */
export function getObsComponentById(id: string): ObsComponentDefinition | undefined {
  return obsComponentList.find((item) => item.id === id)
}

/**
 * 获取某个分类下的所有组件
 */
export function getObsComponentsByCategory(category: ObsCategory): ObsComponentDefinition[] {
  if (category === 'all') return obsComponentList
  return obsComponentList.filter((item) => item.category === category)
}

export interface FilterObsComponentsOptions {
  category?: ObsCategory
  search?: string
  status?: ObsComponentStatus | 'all'
}

/**
 * 按分类、关键词和状态组合过滤组件
 */
export function filterObsComponents(options: FilterObsComponentsOptions = {}): ObsComponentDefinition[] {
  const { category = 'all', search = '', status = 'all' } = options
  const query = search.trim().toLowerCase()

  return obsComponentList.filter((item) => {
    // 1. 分类匹配
    if (category !== 'all' && item.category !== category) {
      return false
    }

    // 2. 状态匹配
    if (status !== 'all' && item.status !== status) {
      return false
    }

    // 3. 搜索关键词匹配 (匹配名称、描述、标签、ID)
    if (query) {
      const matchName = item.name.toLowerCase().includes(query)
      const matchShortDesc = item.shortDescription.toLowerCase().includes(query)
      const matchDesc = item.description.toLowerCase().includes(query)
      const matchId = item.id.toLowerCase().includes(query)
      const matchTag = item.tags.some((tag) => tag.toLowerCase().includes(query))
      if (!matchName && !matchShortDesc && !matchDesc && !matchId && !matchTag) {
        return false
      }
    }

    return true
  })
}

/**
 * 统计每个分类下的组件数量
 */
export function getCategoryCounts(): Record<ObsCategory, number> {
  const counts: Record<ObsCategory, number> = {
    all: obsComponentList.length,
    input: 0,
    widget: 0,
    utility: 0,
    interactive: 0,
  }

  for (const item of obsComponentList) {
    if (item.category in counts) {
      counts[item.category]++
    }
  }

  return counts
}

/**
 * 获取已就绪的组件数量
 */
export function getReadyComponentsCount(): number {
  return obsComponentList.filter((item) => item.status === 'ready').length
}
