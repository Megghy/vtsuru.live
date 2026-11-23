import { computed, inject, provide, ref } from 'vue'
import type { InjectionKey } from 'vue'

import { getApiOrgOrgIdLives } from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import { toast } from '@/shared/utils'

import type { OrgLiveItem } from '../types'
import type { OrgContext } from './useOrgContext'

export type LiveSortKey = 'startAt' | 'income' | 'interaction' | 'danmaku'

export interface StreamerRankItem {
  id: number
  name: string
  faceUrl?: string
  income: number
  danmaku: number
  interaction: number
  liveCount: number
}

export function useOrgLives(ctx: OrgContext) {
  const lives = ref<OrgLiveItem[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const error = ref<string | null>(null)

  const streamerFilter = ref<number>(0)
  const sortKey = ref<LiveSortKey>('startAt')
  const rangeDays = ref<number>(60)
  const search = ref('')

  const view = computed(() => {
    let list = lives.value
    if (streamerFilter.value > 0) list = list.filter((i) => i.streamer.id === streamerFilter.value)
    if (search.value) {
      const q = search.value.toLowerCase()
      list = list.filter((i) => i.live.title.toLowerCase().includes(q) || i.streamer.name.toLowerCase().includes(q))
    }
    return [...list].toSorted((a, b) => {
      switch (sortKey.value) {
        case 'income':
          return b.live.totalIncomeWithGuard - a.live.totalIncomeWithGuard
        case 'interaction':
          return b.live.interactionCount - a.live.interactionCount
        case 'danmaku':
          return b.live.danmakusCount - a.live.danmakusCount
        default:
          return b.live.startAt - a.live.startAt
      }
    })
  })

  function computeRanking(days?: number): StreamerRankItem[] {
    const cutoffMs = days ? Date.now() - days * 86_400_000 : 0
    const map = new Map<number, StreamerRankItem>()
    for (const { streamer, live } of lives.value) {
      const startMs = live.startAt > 1e11 ? live.startAt : live.startAt * 1000
      if (cutoffMs && startMs < cutoffMs) continue
      const cur = map.get(streamer.id) ?? {
        id: streamer.id,
        name: streamer.name,
        faceUrl: streamer.faceUrl,
        income: 0,
        danmaku: 0,
        interaction: 0,
        liveCount: 0,
      }
      cur.income += live.totalIncomeWithGuard
      cur.danmaku += live.danmakusCount
      cur.interaction += live.interactionCount
      cur.liveCount += 1
      map.set(streamer.id, cur)
    }
    return [...map.values()]
  }

  const ranking = computed<StreamerRankItem[]>(() => computeRanking())

  function reset() {
    lives.value = []
    loaded.value = false
    error.value = null
    streamerFilter.value = 0
  }

  async function load(force = false, days = rangeDays.value) {
    if (!ctx.orgId.value) return
    if (loaded.value && !force && days === rangeDays.value) return
    rangeDays.value = days
    loading.value = true
    error.value = null
    try {
      const nowMs = Date.now()
      const fromMs = nowMs - days * 86_400_000
      lives.value = unwrapOk(
        (await getApiOrgOrgIdLives(ctx.orgId.value, { from: fromMs, to: nowMs })) as any,
        '加载直播记录失败',
      )
      loaded.value = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载直播记录失败'
      error.value = msg
      toast.error(msg)
    } finally {
      loading.value = false
    }
  }

  return {
    lives,
    loading,
    loaded,
    error,
    streamerFilter,
    sortKey,
    rangeDays,
    search,
    view,
    ranking,
    computeRanking,
    reset,
    load,
  }
}

export type OrgLivesStore = ReturnType<typeof useOrgLives>

const LIVES_KEY: InjectionKey<OrgLivesStore> = Symbol('org-lives')

export function provideOrgLives(ctx: OrgContext): OrgLivesStore {
  const store = useOrgLives(ctx)
  provide(LIVES_KEY, store)
  return store
}

export function injectOrgLives(): OrgLivesStore {
  const store = inject(LIVES_KEY)
  if (!store) throw new Error('injectOrgLives 必须在 provideOrgLives 之后调用')
  return store
}
