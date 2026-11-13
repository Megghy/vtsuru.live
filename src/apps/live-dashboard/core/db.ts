import Dexie, { type EntityTable } from 'dexie'

import type { DashboardEvent } from './types'

export interface UserNote {
  /** userKeyOf() 的结果，直连用 uid、开放平台用 ouid */
  userKey: string
  uname: string
  note: string
  updatedAt: number
}

export interface LiveHighlightMarker {
  id?: number
  time: number
  label: string
  source: 'manual' | 'shortcut' | 'danmaku'
  author?: string
  replaySaved?: boolean
}

/** 中控台本地库：事件历史（用户历史 / 日期筛选 / 归档）、用户备注与直播高光打点 */
class LiveDashboardDB extends Dexie {
  events!: EntityTable<DashboardEvent, 'key'>
  notes!: EntityTable<UserNote, 'userKey'>
  markers!: EntityTable<LiveHighlightMarker, 'id'>

  constructor() {
    super('vtsuru.live-dashboard')
    this.version(1).stores({
      events: 'key, time, type, uid, ouid, [type+time]',
      notes: 'userKey',
    })
    this.version(2).stores({
      events: 'key, time, type, uid, ouid, [type+time]',
      notes: 'userKey',
      markers: '++id, time',
    })
  }
}

export const dashboardDB = new LiveDashboardDB()
