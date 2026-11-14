import type { ResponseScheduleDayModel } from '@/api/generated/model'

export interface TimeRange {
  startHour: number
  endHour: number
  startMinutes: number
  endMinutes: number
  totalMinutes: number
  ticks: number[]
}

export interface TimelineEventItem {
  item: ResponseScheduleDayModel
  minutes: number
  leftPercent: number
  shiftPercent: number
  subRowIndex: number
  color: string
}

const DEFAULT_TIME_RANGE: TimeRange = {
  startHour: 0,
  endHour: 24,
  startMinutes: 0,
  endMinutes: 1440,
  totalMinutes: 1440,
  ticks: [0, 3, 6, 9, 12, 15, 18, 21, 24],
}

const PILL_RIGHT_ANCHOR_START = 64
const PILL_RIGHT_ANCHOR_END = 98
const PILL_MIN_VISUAL_WIDTH_PERCENT = 28
const PILL_MIN_SPAN_MINUTES = 75
const PILL_GAP_PERCENT = 1.5

const beijingFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** 将任意时刻转换为北京时间 (UTC+8) 的本地墙钟 Date 对象 */
export function toBeijingWallDate(now: Date): Date {
  const parts = beijingFormatter.formatToParts(now)
  const getPart = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return new Date(
    getPart('year'),
    getPart('month') - 1,
    getPart('day'),
    getPart('hour'),
    getPart('minute'),
    getPart('second'),
  )
}

/** 仅接受有效时分 (00:00 ~ 24:00) 的分钟数, 异常文本返回 undefined 归入待定栏 */
export function parseTimeGridMinutes(time?: string | null): number | undefined {
  if (!time) return undefined
  const match = time.match(/(\d{1,2})\s*[:：]\s*(\d{2})/)
  if (!match) return undefined
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59) return undefined
  const total = hour * 60 + minute
  return total <= 1440 ? total : undefined
}

export function computeActiveTimeRange(timedMinutes: number[], autoFocus: boolean): TimeRange {
  if (!autoFocus || timedMinutes.length === 0) {
    return DEFAULT_TIME_RANGE
  }

  const minM = Math.min(...timedMinutes)
  const maxM = Math.max(...timedMinutes)

  let startHour = Math.max(0, Math.floor(minM / 60) - 1)
  let endHour = Math.min(24, Math.ceil((maxM + 120) / 60) + 1)

  const minSpan = 6
  if (endHour - startHour < minSpan) {
    const diff = minSpan - (endHour - startHour)
    const padBefore = Math.floor(diff / 2)
    const padAfter = diff - padBefore
    startHour = Math.max(0, startHour - padBefore)
    endHour = Math.min(24, endHour + padAfter)
    if (endHour - startHour < minSpan) {
      if (startHour === 0) endHour = Math.min(24, startHour + minSpan)
      if (endHour === 24) startHour = Math.max(0, endHour - minSpan)
    }
  }

  const startMinutes = startHour * 60
  const endMinutes = endHour * 60
  const totalMinutes = endMinutes - startMinutes

  const spanHours = endHour - startHour
  const step = spanHours <= 8 ? 1 : spanHours <= 16 ? 2 : 3
  const ticks: number[] = []
  for (let h = startHour; h <= endHour; h += step) {
    ticks.push(h)
  }
  const lastTick = ticks[ticks.length - 1]
  if (lastTick !== endHour) {
    if (ticks.length > 1 && endHour - lastTick < Math.ceil(step / 2)) {
      ticks[ticks.length - 1] = endHour
    } else {
      ticks.push(endHour)
    }
  }

  return {
    startHour,
    endHour,
    startMinutes,
    endMinutes,
    totalMinutes,
    ticks,
  }
}

export function minutesToPercent(minutes: number, range: TimeRange): number {
  const clamped = Math.max(range.startMinutes, Math.min(range.endMinutes, minutes))
  return ((clamped - range.startMinutes) / range.totalMinutes) * 100
}

/** 接近右边界时线性左移胶囊锚点, 避免胶囊冲出轨道右侧 */
export function computePillShiftPercent(leftPercent: number): number {
  if (leftPercent <= PILL_RIGHT_ANCHOR_START) return 0
  return Math.min(
    100,
    ((leftPercent - PILL_RIGHT_ANCHOR_START) / (PILL_RIGHT_ANCHOR_END - PILL_RIGHT_ANCHOR_START)) * 100,
  )
}

export function layoutDayEvents(
  items: ResponseScheduleDayModel[],
  range: TimeRange,
  resolveColor: (item: ResponseScheduleDayModel) => string,
) {
  const scheduledRaw: { item: ResponseScheduleDayModel; minutes: number }[] = []
  const allday: ResponseScheduleDayModel[] = []

  for (const item of items) {
    const minutes = parseTimeGridMinutes(item.time)
    if (minutes !== undefined) {
      scheduledRaw.push({ item, minutes })
    } else {
      allday.push(item)
    }
  }

  scheduledRaw.sort((a, b) => a.minutes - b.minutes)

  const reservedWidthPct = Math.max(PILL_MIN_VISUAL_WIDTH_PERCENT, (PILL_MIN_SPAN_MINUTES / range.totalMinutes) * 100)
  const subRowVisualEnds: number[] = []

  const scheduled: TimelineEventItem[] = scheduledRaw.map(({ item, minutes }) => {
    const leftPercent = minutesToPercent(minutes, range)
    const shiftPercent = computePillShiftPercent(leftPercent)
    const visualStart = leftPercent - (shiftPercent / 100) * reservedWidthPct
    const visualEnd = visualStart + reservedWidthPct

    let assignedRow = subRowVisualEnds.length
    for (let r = 0; r < subRowVisualEnds.length; r++) {
      if (visualStart >= subRowVisualEnds[r] + PILL_GAP_PERCENT) {
        assignedRow = r
        break
      }
    }
    subRowVisualEnds[assignedRow] = visualEnd

    return {
      item,
      minutes,
      leftPercent,
      shiftPercent,
      subRowIndex: assignedRow,
      color: resolveColor(item),
    }
  })

  return {
    scheduled,
    allday,
    totalSubRows: Math.max(1, subRowVisualEnds.length),
  }
}
