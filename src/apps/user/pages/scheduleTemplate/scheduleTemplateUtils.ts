import { getISOWeek, getISOWeekYear } from 'date-fns'
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import type { ScheduleDayInfo, ScheduleWeekInfo } from '@/api/api-models'

export const SCHEDULE_DAYS = [
  { label: '周一', shortLabel: '一', english: 'MON' },
  { label: '周二', shortLabel: '二', english: 'TUE' },
  { label: '周三', shortLabel: '三', english: 'WED' },
  { label: '周四', shortLabel: '四', english: 'THU' },
  { label: '周五', shortLabel: '五', english: 'FRI' },
  { label: '周六', shortLabel: '六', english: 'SAT' },
  { label: '周日', shortLabel: '日', english: 'SUN' },
] as const

const dateFormatter = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' })

export function getISOWeekStart(year: number, week: number) {
  const januaryFourth = new Date(year, 0, 4)
  const mondayOffset = (januaryFourth.getDay() + 6) % 7
  januaryFourth.setDate(januaryFourth.getDate() - mondayOffset + (week - 1) * 7)
  return januaryFourth
}

function hasScheduleContent(item: ScheduleDayInfo) {
  return Boolean(item.title || item.time || item.tag)
}

export function useScheduleWeek(data: MaybeRefOrGetter<ScheduleWeekInfo[] | undefined>) {
  const selectedWeek = ref<string>()
  const weeks = computed(() => toValue(data) ?? [])
  const currentWeekKey = `${getISOWeekYear(new Date())}-${getISOWeek(new Date())}`

  const currentWeek = computed(() => {
    const selected = weeks.value.find((week) => `${week.year}-${week.week}` === selectedWeek.value)
    return selected ?? weeks.value.find((week) => `${week.year}-${week.week}` === currentWeekKey) ?? weeks.value[0]
  })

  watch(
    currentWeek,
    (week) => {
      selectedWeek.value = week ? `${week.year}-${week.week}` : undefined
    },
    { immediate: true },
  )

  const days = computed(() => {
    const week = currentWeek.value
    if (!week) return []
    const start = getISOWeekStart(week.year, week.week)
    const today = new Date()

    return SCHEDULE_DAYS.map((day, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return {
        ...day,
        date: dateFormatter.format(date),
        isToday: date.toDateString() === today.toDateString(),
        items: (week.days[index] ?? []).filter(hasScheduleContent),
      }
    })
  })

  const weekLabel = computed(() => {
    const week = currentWeek.value
    if (!week) return '本周日程'
    const start = getISOWeekStart(week.year, week.week)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return `${dateFormatter.format(start)} - ${dateFormatter.format(end)}`
  })

  const eventCount = computed(() => days.value.reduce((count, day) => count + day.items.length, 0))

  return { selectedWeek, currentWeek, days, weekLabel, eventCount }
}
