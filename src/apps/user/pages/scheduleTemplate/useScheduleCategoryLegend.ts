import { computed, type MaybeRefOrGetter, toValue } from 'vue'

import type { ScheduleDayInfo } from '@/api/api-models'

import { SCHEDULE_CATEGORIES, resolveScheduleCategory, type ScheduleCategoryKey } from './scheduleCategories'

export function useScheduleCategoryLegend(
  days: MaybeRefOrGetter<{ items: ScheduleDayInfo[] }[]>,
  resolveColor: (tag?: string | null, color?: string | null) => string,
  fallbackColors?: Partial<Record<ScheduleCategoryKey, string>>,
) {
  return computed(() => {
    const items = new Map<string, { name: string; color: string }>()
    for (const day of toValue(days)) {
      for (const item of day.items) {
        if (!item.tag) continue
        const category = resolveScheduleCategory(item.tag)
        const key = category?.key ?? item.tag.trim().toLowerCase()
        if (!items.has(key)) {
          items.set(key, {
            name: category?.name ?? item.tag.trim().toUpperCase(),
            color: resolveColor(item.tag, item.tagColor),
          })
        }
      }
    }
    if (items.size) return [...items.values()]
    if (!fallbackColors) return []
    return SCHEDULE_CATEGORIES.map(({ key, name }) => ({
      name,
      color: fallbackColors[key] ?? resolveColor(name),
    }))
  })
}
