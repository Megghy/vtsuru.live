import { describe, expect, it } from 'vitest'

import type { EventModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'

import { getDanmakuWindowFilterType, getDeletedSuperChatIds, removeDeletedSuperChats } from '../danmakuWindowEvents'

function event(type: EventDataTypes, overrides: Partial<EventModel> = {}): EventModel {
  return {
    type,
    uname: 'tester',
    uface: '',
    uid: 1,
    open_id: '',
    msg: '',
    time: Date.now(),
    num: 1,
    price: 0,
    guard_level: 0,
    fans_medal_level: 0,
    fans_medal_name: '',
    fans_medal_wearing_status: false,
    ouid: '',
    ...overrides,
  }
}

describe('danmaku window events', () => {
  it('maps known event types to filter names', () => {
    expect(getDanmakuWindowFilterType(EventDataTypes.Message)).toBe('Message')
    expect(getDanmakuWindowFilterType(EventDataTypes.Gift)).toBe('Gift')
    expect(getDanmakuWindowFilterType(EventDataTypes.SC)).toBe('SC')
    expect(getDanmakuWindowFilterType(EventDataTypes.Guard)).toBe('Guard')
    expect(getDanmakuWindowFilterType(EventDataTypes.Enter)).toBe('Enter')
    expect(getDanmakuWindowFilterType(EventDataTypes.Like)).toBe('Like')
  })

  it('returns undefined for unfiltered event types', () => {
    expect(getDanmakuWindowFilterType(EventDataTypes.Follow)).toBeUndefined()
    expect(getDanmakuWindowFilterType(EventDataTypes.SCDel)).toBeUndefined()
  })

  it('parses deleted super chat ids from array or single payload', () => {
    expect(getDeletedSuperChatIds(event(EventDataTypes.SCDel, { msg: '' }))).toEqual(new Set())
    expect(getDeletedSuperChatIds(event(EventDataTypes.SCDel, { msg: '[100,200]' }))).toEqual(new Set(['100', '200']))
    expect(getDeletedSuperChatIds(event(EventDataTypes.SCDel, { msg: '300' }))).toEqual(new Set(['300']))
  })

  it('removes matching super chats from visible and pending lists', () => {
    const first = event(EventDataTypes.SC, { id: 100 })
    const second = event(EventDataTypes.SC, { id: 200 })
    const gift = event(EventDataTypes.Gift, { id: 100, msg: '辣条' })
    const deletion = event(EventDataTypes.SCDel, { msg: '[100]' })

    expect(getDeletedSuperChatIds(deletion)).toEqual(new Set(['100']))
    expect(removeDeletedSuperChats([first, second, gift], deletion)).toEqual([second, gift])
  })

  it('keeps all items when deletion payload has no ids', () => {
    const items = [event(EventDataTypes.SC, { id: 1 }), event(EventDataTypes.SC, { id: 2 })]
    expect(removeDeletedSuperChats(items, event(EventDataTypes.SCDel, { msg: '' }))).toEqual(items)
  })
})
