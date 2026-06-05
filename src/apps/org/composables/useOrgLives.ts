import { computed, inject, provide, ref } from 'vue'
import type { InjectionKey } from 'vue'
import { useMessage } from 'naive-ui'
import { QueryGetAPI, unwrapOk } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'
import type { OrgContext } from './useOrgContext'
import type { OrgLiveItem } from '../types'

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
  const message = useMessage()
  const lives = ref<OrgLiveItem[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  const streamerFilter = ref<number | null>(null)
  const sortKey = ref<LiveSortKey>('startAt')
  const search = ref('')

  const view = computed(() => {
    let list = lives.value
    if (streamerFilter.value) list = list.filter(i => i.streamer.id === streamerFilter.value)
    if (search.value) {
      const q = search.value.toLowerCase()
      list = list.filter(i =>
        i.live.title.toLowerCase().includes(q) || i.streamer.name.toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) => {
      switch (sortKey.value) {
        case 'income': return b.live.totalIncomeWithGuard - a.live.totalIncomeWithGuard
        case 'interaction': return b.live.interactionCount - a.live.interactionCount
        case 'danmaku': return b.live.danmakusCount - a.live.danmakusCount
        default: return b.live.startAt - a.live.startAt
      }
    })
  })

  const ranking = computed<StreamerRankItem[]>(() => {
    const map = new Map<number, StreamerRankItem>()
    for (const { streamer, live } of lives.value) {
      const cur = map.get(streamer.id) ?? {
        id: streamer.id, name: streamer.name, faceUrl: streamer.faceUrl,
        income: 0, danmaku: 0, interaction: 0, liveCount: 0,
      }
      cur.income += live.totalIncomeWithGuard
      cur.danmaku += live.danmakusCount
      cur.interaction += live.interactionCount
      cur.liveCount += 1
      map.set(streamer.id, cur)
    }
    return [...map.values()]
  })

  async function load(force = false) {
    if (!ctx.orgId.value) return
    if (loaded.value && !force) return
    loading.value = true
    try {
      lives.value = unwrapOk(
        await QueryGetAPI<OrgLiveItem[]>(`${ORG_API_URL}${ctx.orgId.value}/lives`),
        '加载直播记录失败',
      )
      loaded.value = true
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载直播记录失败')
    } finally {
      loading.value = false
    }
  }

  return { lives, loading, loaded, streamerFilter, sortKey, search, view, ranking, load }
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
