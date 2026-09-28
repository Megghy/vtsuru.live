import { useIntervalFn } from '@vueuse/core'
import type { ShallowRef } from 'vue'
import { computed, reactive, ref } from 'vue'

import { EventDataTypes } from '@/api/api-models'

import type { DashboardEvent } from '../core/types'
import { userKeyOf } from '../core/types'

export interface PayerSummary {
  userKey: string
  uname: string
  uface: string
  total: number
}

const RATE_WINDOW_MS = 60_000

/** 实时统计：统计周期从页面打开（或手动重置）开始，付费汇总直接从付费列表派生 */
export function useDashboardStats(paid: ShallowRef<DashboardEvent[]>) {
  const since = ref(Date.now())
  const counters = reactive({ danmaku: 0, interaction: 0 })
  const users = new Set<string>()
  const userCount = ref(0)
  const lastEventAt = ref<number>()
  const lastEventType = ref<EventDataTypes>()
  const now = ref(Date.now())
  let arrivals: number[] = []

  useIntervalFn(() => {
    now.value = Date.now()
    arrivals = arrivals.filter((t) => t > now.value - RATE_WINDOW_MS)
  }, 1000)

  function record(event: DashboardEvent) {
    const arrivedAt = Date.now()
    arrivals.push(arrivedAt)
    lastEventAt.value = arrivedAt
    lastEventType.value = event.type
    if (event.type === EventDataTypes.Message) counters.danmaku++
    else if (event.type === EventDataTypes.Enter || event.type === EventDataTypes.Follow || event.type === EventDataTypes.Like) counters.interaction++
    const key = userKeyOf(event)
    if (!users.has(key)) {
      users.add(key)
      userCount.value = users.size
    }
  }

  function reset() {
    since.value = Date.now()
    counters.danmaku = 0
    counters.interaction = 0
    users.clear()
    userCount.value = 0
    arrivals = []
  }

  const perMinute = computed(() => {
    void now.value
    return arrivals.length
  })

  const paidInPeriod = computed(() => paid.value.filter((e) => e.time >= since.value))

  const totals = computed(() => {
    const result = { sc: 0, gift: 0, guard: 0, guardCount: 0 }
    for (const event of paidInPeriod.value) {
      if (event.type === EventDataTypes.SC) result.sc += event.price
      else if (event.type === EventDataTypes.Gift) result.gift += event.price
      else {
        result.guard += event.price
        result.guardCount += event.num
      }
    }
    return result
  })

  const topPayers = computed<PayerSummary[]>(() => {
    const map = new Map<string, PayerSummary>()
    for (const event of paidInPeriod.value) {
      if (event.price <= 0) continue
      const key = userKeyOf(event)
      const entry = map.get(key) ?? { userKey: key, uname: event.uname, uface: event.uface, total: 0 }
      entry.total += event.price
      map.set(key, entry)
    }
    return [...map.values()].toSorted((a, b) => b.total - a.total).slice(0, 6)
  })

  const duration = computed(() => now.value - since.value)

  return { since, counters, userCount, perMinute, totals, topPayers, duration, lastEventAt, lastEventType, record, reset }
}
