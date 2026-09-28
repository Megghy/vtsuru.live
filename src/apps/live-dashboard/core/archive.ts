import { saveAs } from 'file-saver'
import { utils, writeFile } from 'xlsx'

import { dashboardDB } from './db'
import type { DashboardEvent } from './types'
import { EVENT_TYPE_LABELS, GUARD_NAMES } from './types'

interface ArchiveFile {
  format: 'vtsuru-live-dashboard'
  version: 1
  exportedAt: number
  events: DashboardEvent[]
}

export type ExportFormat = 'json' | 'csv' | 'xlsx'

function toRow(event: DashboardEvent) {
  return {
    时间: new Date(event.time).toLocaleString(),
    类型: EVENT_TYPE_LABELS[event.type] ?? String(event.type),
    UID: event.uid || '',
    OpenID: event.ouid,
    用户名: event.uname,
    内容: event.msg,
    数量: event.num,
    金额: event.price,
    大航海: GUARD_NAMES[event.guardLevel] ?? '',
    粉丝勋章: event.medalName ? `${event.medalName} ${event.medalLevel}` : '',
    已读: event.read ? '是' : '',
  }
}

export async function exportArchive(format: ExportFormat, range?: [number, number]) {
  const query = range ? dashboardDB.events.where('time').between(range[0], range[1], true, true) : dashboardDB.events.orderBy('time')
  const events = await query.toArray()
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  const name = `vtsuru-dashboard-${stamp}`

  if (format === 'json') {
    const file: ArchiveFile = { format: 'vtsuru-live-dashboard', version: 1, exportedAt: Date.now(), events }
    saveAs(new Blob([JSON.stringify(file)], { type: 'application/json' }), `${name}.json`)
  } else if (format === 'csv') {
    const csv = utils.sheet_to_csv(utils.json_to_sheet(events.map(toRow)))
    saveAs(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }), `${name}.csv`)
  } else {
    const book = utils.book_new()
    const groups = Map.groupBy(events, (e) => EVENT_TYPE_LABELS[e.type] ?? '其他')
    for (const [label, list] of groups) utils.book_append_sheet(book, utils.json_to_sheet(list.map(toRow)), label)
    writeFile(book, `${name}.xlsx`)
  }
  return events.length
}

export async function importArchive(file: File) {
  const data = JSON.parse(await file.text()) as ArchiveFile
  if (data.format !== 'vtsuru-live-dashboard' || !Array.isArray(data.events)) throw new Error('不是有效的中控台归档文件')
  await dashboardDB.events.bulkPut(data.events)
  return data.events.length
}

export async function countByType() {
  const counts = new Map<number, number>()
  await dashboardDB.events.each((e) => counts.set(e.type, (counts.get(e.type) ?? 0) + 1))
  return [...counts].map(([type, count]) => ({ label: EVENT_TYPE_LABELS[type] ?? String(type), count }))
}

export async function clearArchive() {
  await dashboardDB.events.clear()
}

export async function queryUserHistory(event: Pick<DashboardEvent, 'uid' | 'ouid'>, limit = 500) {
  const collection = event.uid > 0 ? dashboardDB.events.where('uid').equals(event.uid) : dashboardDB.events.where('ouid').equals(event.ouid)
  const list = await collection.toArray()
  return list.toSorted((a, b) => b.time - a.time).slice(0, limit)
}
