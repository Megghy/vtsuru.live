import Dexie, { type EntityTable } from 'dexie'

import type { DashboardEvent } from './types'

export interface UserNote {
  /** userKeyOf() 的结果，直连用 uid、开放平台用 ouid */
  userKey: string
  uname: string
  note: string
  updatedAt: number
}

/** 中控台本地库：事件历史（用户历史 / 日期筛选 / 归档）与用户备注 */
class LiveDashboardDB extends Dexie {
  events!: EntityTable<DashboardEvent, 'key'>
  notes!: EntityTable<UserNote, 'userKey'>

  constructor() {
    super('vtsuru.live-dashboard')
    this.version(1).stores({
      events: 'key, time, type, uid, ouid, [type+time]',
      notes: 'userKey',
    })
  }
}

export const dashboardDB = new LiveDashboardDB()
