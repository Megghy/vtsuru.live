import type { EventModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'

const FILTER_TYPES: Partial<Record<EventDataTypes, string>> = {
  [EventDataTypes.Message]: 'Message',
  [EventDataTypes.Gift]: 'Gift',
  [EventDataTypes.SC]: 'SC',
  [EventDataTypes.Guard]: 'Guard',
  [EventDataTypes.Enter]: 'Enter',
  [EventDataTypes.Like]: 'Like',
}

export function getDanmakuWindowFilterType(type: EventDataTypes) {
  return FILTER_TYPES[type]
}

export function getDeletedSuperChatIds(event: EventModel): Set<string> {
  if (!event.msg) return new Set()

  const value = JSON.parse(event.msg) as unknown
  const ids = Array.isArray(value) ? value : [value]
  return new Set(ids.map(String))
}

export function removeDeletedSuperChats<T extends EventModel>(items: T[], event: EventModel): T[] {
  const ids = getDeletedSuperChatIds(event)
  if (ids.size === 0) return items
  return items.filter((item) => item.type !== EventDataTypes.SC || item.id === undefined || !ids.has(String(item.id)))
}
