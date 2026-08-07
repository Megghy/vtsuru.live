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
  it('maps like events to the configured filter name', () => {
    expect(getDanmakuWindowFilterType(EventDataTypes.Like)).toBe('Like')
  })

  it('removes matching super chats from visible and pending lists', () => {
    const first = event(EventDataTypes.SC, { id: 100 })
    const second = event(EventDataTypes.SC, { id: 200 })
    const deletion = event(EventDataTypes.SCDel, { msg: '[100]' })

    expect(getDeletedSuperChatIds(deletion)).toEqual(new Set(['100']))
    expect(removeDeletedSuperChats([first, second], deletion)).toEqual([second])
  })
})
