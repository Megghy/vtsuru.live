import { getISOWeek, getISOWeekYear } from 'date-fns'

import type { ResponseScheduleModel } from '@/api/generated/model'
import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'

export type ScheduleLayout = 'list' | 'cards' | 'strip'

export interface ScheduleWidgetState {
  title: string
  subtitle: string
  layout: ScheduleLayout
  theme: ObsWidgetTheme
  accentColor: string
  fontFamily: string
  highlightToday: boolean
  hideEmptyDays: boolean
  restDayText: string
  refreshIntervalMinutes: number
  useSampleData: boolean
}

export type ScheduleWidgetAction = { type: 'REFRESH' }

export const SCHEDULE_LAYOUT_OPTIONS: { label: string; value: ScheduleLayout }[] = [
  { label: '紧凑清单', value: 'list' },
  { label: '双列卡片', value: 'cards' },
  { label: '横向 7 日条', value: 'strip' },
]

export const DEFAULT_SCHEDULE_STATE: ScheduleWidgetState = {
  title: '本周直播日程',
  subtitle: '',
  layout: 'list',
  theme: 'card',
  accentColor: '#38bdf8',
  fontFamily: '',
  highlightToday: true,
  hideEmptyDays: false,
  restDayText: '休息日',
  refreshIntervalMinutes: 10,
  useSampleData: false,
}

export function createSampleScheduleWeek(now = new Date()): ResponseScheduleModel {
  return {
    year: getISOWeekYear(now),
    week: getISOWeek(now),
    version: 'sample',
    days: [
      [{ id: 'sample-1', time: '20:00', title: '杂谈开播 · 聊聊本周新计划', tag: '杂谈', tagColor: '#38bdf8' }],
      [{ id: 'sample-2', time: '20:30', title: '艾尔登法环 DLC 探索与受苦', tag: '游戏', tagColor: '#f59e0b' }],
      [],
      [{ id: 'sample-4', time: '21:00', title: '吉他弹唱 & 观众点歌回', tag: '歌回', tagColor: '#ec4899' }],
      [{ id: 'sample-5', time: '20:00', title: '周五联机派对 · 观众水友赛', tag: '联动', tagColor: '#a855f7' }],
      [
        { id: 'sample-6a', time: '14:30', title: '午后茶话会 · 投稿鉴赏', tag: '鉴赏', tagColor: '#10b981' },
        { id: 'sample-6b', time: '20:30', title: '周末纪念歌回', tag: '歌回', tagColor: '#ec4899' },
      ],
      [],
    ],
  }
}
