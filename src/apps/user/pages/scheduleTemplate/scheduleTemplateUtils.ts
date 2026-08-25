import { getISOWeek, getISOWeekYear } from 'date-fns'
import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import type { BiliLiveReserveItem, ScheduleDayInfo, ScheduleWeekInfo } from '@/api/api-models'

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

const BILI_RESERVE_TAG = '预约'
const BILI_RESERVE_COLOR = '#FB7299'

export function mergeBiliReservesIntoWeeks(
  weeks: ScheduleWeekInfo[],
  items: BiliLiveReserveItem[],
): ScheduleWeekInfo[] {
  if (!items.length) return weeks
  const now = Date.now() / 1000
  const upcoming = items.filter((item) => item.planStart >= now - 2 * 3600)
  if (!upcoming.length) return weeks

  const cloned = weeks.map((week) => ({
    ...week,
    days: week.days.map((day) => day.map((item) => ({ ...item }))),
  }))

  for (const item of upcoming) {
    let week = cloned.find((entry) => entry.year === item.year && entry.week === item.week)
    if (!week) {
      week = {
        year: item.year,
        week: item.week,
        days: Array.from({ length: 7 }, () => [] as ScheduleDayInfo[]),
      }
      cloned.push(week)
    }
    const day = item.dayOfWeek
    if (day < 0 || day > 6) continue
    if (!Array.isArray(week.days[day])) week.days[day] = []
    const exists = week.days[day].some(
      (entry) => entry.tag === BILI_RESERVE_TAG && entry.time === item.time && entry.title === item.title,
    )
    if (exists) continue
    week.days[day].push({
      title: item.title,
      tag: BILI_RESERVE_TAG,
      tagColor: BILI_RESERVE_COLOR,
      time: item.time,
      id: `bili-${item.sid}`,
    })
  }

  cloned.sort((a, b) => b.year - a.year || b.week - a.week)
  return cloned
}

export function useScheduleWeek(data: MaybeRefOrGetter<ScheduleWeekInfo[] | undefined>) {
  const selectedWeek = ref<string>()
  const weekDirection = ref(0)
  const weeks = computed(() => toValue(data) ?? [])
  // 在 computed 内求值, 跨零点挂载时"今天/本周"可随之刷新
  const currentWeekKey = computed(() => {
    const now = new Date()
    return `${getISOWeekYear(now)}-${getISOWeek(now)}`
  })

  const currentWeek = computed(() => {
    const selected = weeks.value.find((week) => `${week.year}-${week.week}` === selectedWeek.value)
    return selected ?? weeks.value.find((week) => `${week.year}-${week.week}` === currentWeekKey.value) ?? weeks.value[0]
  })

  watch(
    currentWeek,
    (week) => {
      selectedWeek.value = week ? `${week.year}-${week.week}` : undefined
    },
    { immediate: true },
  )

  watch(selectedWeek, (next, prev) => {
    if (!next || !prev || next === prev) {
      weekDirection.value = 0
      return
    }
    const [nextYear, nextWeek] = next.split('-').map(Number)
    const [prevYear, prevWeek] = prev.split('-').map(Number)
    weekDirection.value = nextYear === prevYear ? Math.sign(nextWeek - prevWeek) : Math.sign(nextYear - prevYear)
  })

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

  return { selectedWeek, currentWeek, days, weekLabel, eventCount, weekDirection }
}
