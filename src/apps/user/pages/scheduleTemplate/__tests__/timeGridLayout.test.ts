import { describe, expect, it } from 'vitest'

import type { ResponseScheduleDayModel } from '@/api/generated/model'

import {
  computeActiveTimeRange,
  computePillShiftPercent,
  layoutDayEvents,
  minutesToPercent,
  parseTimeGridMinutes,
  toBeijingWallDate,
} from '../timeGridLayout'

describe('timeGridLayout', () => {
  it('parses valid HH:mm strings and rejects empty or invalid times', () => {
    expect(parseTimeGridMinutes('09:30')).toBe(570)
    expect(parseTimeGridMinutes('20：00')).toBe(1200)
    expect(parseTimeGridMinutes('24:00')).toBe(1440)
    expect(parseTimeGridMinutes('')).toBeUndefined()
    expect(parseTimeGridMinutes(null)).toBeUndefined()
    expect(parseTimeGridMinutes('待定')).toBeUndefined()
    expect(parseTimeGridMinutes('25:30')).toBeUndefined()
    expect(parseTimeGridMinutes('12:99')).toBeUndefined()
  })

  it('converts UTC timestamp to Beijing wall-clock date regardless of host timezone', () => {
    // 2026-04-20T20:00:00Z -> 2026-04-21 04:00:00 in Asia/Shanghai
    const wall = toBeijingWallDate(new Date('2026-04-20T20:00:00Z'))
    expect(wall.getFullYear()).toBe(2026)
    expect(wall.getMonth()).toBe(3)
    expect(wall.getDate()).toBe(21)
    expect(wall.getHours()).toBe(4)
    expect(wall.getMinutes()).toBe(0)
  })

  it('computes focused time range with minimum 6h span and avoids crowded end ticks', () => {
    expect(computeActiveTimeRange([], true)).toEqual({
      startHour: 0,
      endHour: 24,
      startMinutes: 0,
      endMinutes: 1440,
      totalMinutes: 1440,
      ticks: [0, 3, 6, 9, 12, 15, 18, 21, 24],
    })

    const narrow = computeActiveTimeRange([20 * 60], true)
    expect(narrow.endHour - narrow.startHour).toBeGreaterThanOrEqual(6)
    expect(narrow.startHour).toBeLessThanOrEqual(19)
    expect(narrow.endHour).toBeGreaterThanOrEqual(23)

    const full = computeActiveTimeRange([20 * 60], false)
    expect(full.startHour).toBe(0)
    expect(full.endHour).toBe(24)
  })

  it('separates untimed items into allday without producing NaN percentages', () => {
    const items: ResponseScheduleDayModel[] = [
      { id: '1', title: '待定联动', time: '时间待定', tag: '联机', tagColor: '#6C8BE7' },
      { id: '2', title: '晚间歌回', time: '20:00', tag: '歌回', tagColor: '#3FB8B0' },
      { id: '3', title: '深夜杂谈', time: '23:00', tag: '杂谈', tagColor: '#E97A9B' },
    ]
    const range = computeActiveTimeRange([1200, 1380], true)
    const result = layoutDayEvents(items, range, (item) => item.tagColor || '#10b981')

    expect(result.allday).toHaveLength(1)
    expect(result.allday[0].title).toBe('待定联动')
    expect(result.scheduled).toHaveLength(2)
    expect(result.scheduled.every((entry) => Number.isFinite(entry.leftPercent))).toBe(true)
    // 23:00 is near right edge -> shifted left so it does not overflow track
    expect(result.scheduled[1].shiftPercent).toBeGreaterThan(0)
  })

  it('pushes colliding events on wide 24h spans onto separate sub-rows', () => {
    const items: ResponseScheduleDayModel[] = [
      { id: '1', title: '午间电台', time: '14:00', tag: '电台', tagColor: '' },
      { id: '2', title: '下午游戏', time: '15:30', tag: '游戏', tagColor: '' },
    ]
    const fullRange = computeActiveTimeRange([840, 930], false)
    const layout = layoutDayEvents(items, fullRange, () => 'var(--timegrid-accent)')

    expect(layout.totalSubRows).toBe(2)
    expect(layout.scheduled[0].subRowIndex).toBe(0)
    expect(layout.scheduled[1].subRowIndex).toBe(1)
  })

  it('keeps distant events on the same sub-row and anchors right-edge pills within track', () => {
    const items: ResponseScheduleDayModel[] = [
      { id: '1', title: '早安', time: '09:00', tag: '杂谈', tagColor: '' },
      { id: '2', title: '晚安', time: '21:00', tag: '杂谈', tagColor: '' },
    ]
    const fullRange = computeActiveTimeRange([540, 1260], false)
    const layout = layoutDayEvents(items, fullRange, () => 'var(--timegrid-accent)')

    expect(layout.totalSubRows).toBe(1)
    expect(computePillShiftPercent(50)).toBe(0)
    expect(computePillShiftPercent(100)).toBe(100)
    expect(minutesToPercent(1500, fullRange)).toBe(100)
  })
})
