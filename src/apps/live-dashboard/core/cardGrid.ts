import type { DashboardEvent } from './types'
import { userKeyOf } from './types'

/**
 * 卡片模式：固定槽位，卡片永不移动。
 * - 相同文本命中原槽位，原地累加计数；
 * - 新文本占用编号最小的空槽；
 * - 满格时覆盖最沉寂（lastAt 最早）的槽，被悬停保护的槽除外；
 * - 重复达到阈值可临时静默，腾出槽位。
 */

export interface CardUser {
  uname: string
  count: number
  lastAt: number
}

export interface DanmakuCard {
  text: string
  display: DashboardEvent
  count: number
  lastAt: number
  users: Map<string, CardUser>
}

export interface CardGridOptions {
  autoHide: boolean
  autoHideThreshold: number
  autoHideSeconds: number
}

export function normalizeCardText(msg: string) {
  return msg.trim().replace(/\s+/g, ' ').toLowerCase()
}

export class CardGrid {
  slots: (DanmakuCard | null)[]
  /** 自动静默：文本 → 解除时间 */
  muted = new Map<string, number>()
  /** 手动隐藏，刷新后清空 */
  hidden = new Set<string>()
  protectedIndex: number | undefined

  constructor(size: number) {
    this.slots = Array.from({ length: size }, () => null)
  }

  resize(size: number) {
    if (size === this.slots.length) return
    this.slots = size < this.slots.length
      ? this.slots.slice(0, size)
      : [...this.slots, ...Array.from({ length: size - this.slots.length }, () => null)]
  }

  /** 满格时下一次将被覆盖的槽位，用于淡出预告 */
  nextVictim(): number | undefined {
    if (this.slots.includes(null)) return undefined
    let victim: number | undefined
    this.slots.forEach((card, index) => {
      if (index === this.protectedIndex || !card) return
      if (victim === undefined || card.lastAt < this.slots[victim].lastAt) victim = index
    })
    return victim
  }

  ingest(event: DashboardEvent, options: CardGridOptions) {
    const text = normalizeCardText(event.emoji ? `[表情]${event.msg}` : event.msg)
    if (!text || this.hidden.has(text)) return
    const mutedUntil = this.muted.get(text)
    if (mutedUntil !== undefined) {
      if (mutedUntil > event.time) return
      this.muted.delete(text)
    }

    const existing = this.slots.findIndex((card) => card?.text === text)
    if (existing >= 0) {
      const card = this.slots[existing]
      card.count++
      card.lastAt = event.time
      card.display = event
      const userKey = userKeyOf(event)
      const user = card.users.get(userKey)
      if (user) {
        user.count++
        user.lastAt = event.time
        user.uname = event.uname
      } else card.users.set(userKey, { uname: event.uname, count: 1, lastAt: event.time })

      if (options.autoHide && card.count >= options.autoHideThreshold) {
        this.muted.set(text, event.time + options.autoHideSeconds * 1000)
        this.slots[existing] = null
      }
      return
    }

    const empty = this.slots.indexOf(null)
    const target = empty >= 0 ? empty : this.nextVictim()
    if (target === undefined) return
    this.slots[target] = {
      text,
      display: event,
      count: 1,
      lastAt: event.time,
      users: new Map([[userKeyOf(event), { uname: event.uname, count: 1, lastAt: event.time }]]),
    }
  }

  hide(index: number) {
    const card = this.slots[index]
    if (!card) return
    this.hidden.add(card.text)
    this.slots[index] = null
  }

  clear() {
    this.slots = this.slots.map(() => null)
  }
}
