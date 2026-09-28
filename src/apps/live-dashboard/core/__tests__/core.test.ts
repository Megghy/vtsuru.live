import { describe, expect, it } from 'vitest'

import { EventDataTypes } from '@/api/api-models'

import { CardGrid } from '../cardGrid'
import { parseMessage } from '../message'
import { createSearchPredicate, parseSearch } from '../search'
import type { DashboardEvent } from '../types'

let seq = 0
function ev(partial: Partial<DashboardEvent>): DashboardEvent {
  seq++
  return {
    key: `k${seq}`,
    type: EventDataTypes.Message,
    time: seq * 1000,
    uid: seq,
    ouid: `o${seq}`,
    uname: `user${seq}`,
    uface: '',
    msg: '',
    price: 0,
    num: 1,
    guardLevel: 0,
    medalLevel: 0,
    medalName: '',
    medalWearing: false,
    read: false,
    deleted: false,
    ...partial,
  }
}

const match = (query: string, event: DashboardEvent, note?: string) =>
  createSearchPredicate(query, () => note)(event)

describe('search', () => {
  it('parses quoted, negated and multi-value terms', () => {
    expect(parseSearch('type:superchat,toast -username:"网友 小A" 你好')).toEqual([
      { field: 'type', negate: false, values: ['superchat', 'toast'] },
      { field: 'username', negate: true, values: ['网友 小A'] },
      { field: 'text', negate: false, values: ['你好'] },
    ])
    expect(parseSearch(String.raw`message:"他说\"你好\""`)[0].values).toEqual(['他说"你好"'])
  })

  it('matches keywords with AND logic', () => {
    const sc = ev({ type: EventDataTypes.SC, uid: 12345, price: 30, msg: 'hello' })
    expect(match('type:superchat uid:12345', sc)).toBe(true)
    expect(match('type:superchat uid:1', sc)).toBe(false)
    expect(match('-type:message', sc)).toBe(true)
    expect(match('HELLO', sc)).toBe(true)
    expect(match('-hello', sc)).toBe(false)
  })

  it('compares price only on paid events', () => {
    const gift = ev({ type: EventDataTypes.Gift, price: 12.5 })
    expect(match('price:>=10', gift)).toBe(true)
    expect(match('price:10..12', gift)).toBe(false)
    expect(match('price:12.5', gift)).toBe(true)
    expect(match('price:<100', ev({ msg: 'x' }))).toBe(false)
    expect(match('-price:<10', ev({ msg: 'x' }))).toBe(false)
  })

  it('searches notes', () => {
    expect(match('note:字幕组', ev({}), '字幕组组长')).toBe(true)
    expect(match('组长', ev({}), '字幕组组长')).toBe(true)
  })
})

describe('card grid', () => {
  const options = { autoHide: false, autoHideThreshold: 3, autoHideSeconds: 10 }

  it('keeps slots in place and merges duplicates', () => {
    const grid = new CardGrid(2)
    grid.ingest(ev({ msg: 'a' }), options)
    grid.ingest(ev({ msg: 'b' }), options)
    grid.ingest(ev({ msg: ' A ' }), options)
    expect(grid.slots.map((c) => [c?.text, c?.count])).toEqual([['a', 2], ['b', 1]])
    // 满格覆盖最沉寂的槽位（b），a 保持原位
    grid.ingest(ev({ msg: 'c' }), options)
    expect(grid.slots.map((c) => c?.text)).toEqual(['a', 'c'])
  })

  it('never overwrites the protected slot', () => {
    const grid = new CardGrid(2)
    grid.ingest(ev({ msg: 'a' }), options)
    grid.ingest(ev({ msg: 'b' }), options)
    grid.protectedIndex = 0
    grid.ingest(ev({ msg: 'c' }), options)
    expect(grid.slots.map((c) => c?.text)).toEqual(['a', 'c'])
    expect(grid.nextVictim()).toBe(1)
  })

  it('auto hides spam then releases after timeout', () => {
    const grid = new CardGrid(2)
    const spam = { ...options, autoHide: true }
    for (let i = 0; i < 3; i++) grid.ingest(ev({ msg: 'spam', time: 1000 + i }), spam)
    expect(grid.slots.every((c) => c === null)).toBe(true)
    grid.ingest(ev({ msg: 'spam', time: 5000 }), spam)
    expect(grid.slots[0]).toBeNull()
    grid.ingest(ev({ msg: 'spam', time: 20_000 }), spam)
    expect(grid.slots[0]?.text).toBe('spam')
  })

  it('manual hide blacklists text', () => {
    const grid = new CardGrid(1)
    grid.ingest(ev({ msg: 'x' }), options)
    grid.hide(0)
    grid.ingest(ev({ msg: 'x' }), options)
    expect(grid.slots[0]).toBeNull()
  })
})

describe('message segments', () => {
  const emojis = { '[doge]': 'https://e/doge.png' }

  it('parses spoilers and emojis', () => {
    expect(parseMessage('主播你是真||可爱||啊[doge]', emojis)).toEqual([
      { kind: 'text', text: '主播你是真' },
      { kind: 'spoiler', text: '可爱' },
      { kind: 'text', text: '啊' },
      { kind: 'emoji', name: '[doge]', url: 'https://e/doge.png' },
    ])
  })

  it('treats unclosed leading spoiler as spoiler to the end', () => {
    expect(parseMessage('||从这里开始', {})).toEqual([{ kind: 'spoiler', text: '从这里开始' }])
    expect(parseMessage('a||b', {})).toEqual([{ kind: 'text', text: 'a' }, { kind: 'text', text: '||b' }])
  })
})
