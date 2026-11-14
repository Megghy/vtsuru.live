import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import type { SongRequestInfo } from '@/api/client-types'
import { getApiLiveRequestGetActiveAndSettings } from '@/api/generated/live-request/live-request'
import type { SettingSongRequest } from '@/api/generated/model'
import { SongRequestStatus } from '@/api/generated/model'
import { sortByQueueType } from '@/shared/utils/queue'

export function useLiveRequestData(currentId: MaybeRefOrGetter<string | number | null | undefined>) {
  const originSongs = ref<SongRequestInfo[]>([])
  const settings = ref<SettingSongRequest>({} as SettingSongRequest)
  const key = ref(Date.now())

  // 计算属性
  const songs = computed(() => {
    return sortByQueueType(originSongs.value, settings.value.sortType, Boolean(settings.value.isReverse), {
      createAt: (q) => q.createAt,
      guardLevel: (q) => q.user?.guard_level,
      price: (q) => q.price,
      fansMedalLevel: (q) => q.user?.fans_medal_level,
      fansMedalWearing: (q) => q.user?.fans_medal_wearing_status,
      priorityLevel: (q) => q.priorityLevel,
    })
  })

  const singing = computed(() => {
    return songs.value.find((s) => s.status == SongRequestStatus.Singing)
  })

  const activeSongs = computed(() => {
    return songs.value.filter((s) => s.status == SongRequestStatus.Waiting)
  })

  const allowGuardTypes = computed(() => {
    const types: string[] = []
    if (settings.value.needTidu) {
      types.push('提督')
    }
    if (settings.value.needZongdu) {
      types.push('总督')
    }
    if (settings.value.needJianzhang) {
      types.push('舰长')
    }
    return types
  })

  // 数据获取方法
  async function get() {
    try {
      const rawId = toValue(currentId)
      const idStr = rawId === undefined || rawId === null ? '' : String(rawId)
      const params = idStr ? { id: Number(idStr) } : {}

      const data = await getApiLiveRequestGetActiveAndSettings(params)
      if (data.code == 200) {
        return data.data
      }
    } catch (err) {
      console.log(err)
    }
    return {
      songs: [],
      setting: {} as SettingSongRequest,
    } as { songs: SongRequestInfo[]; setting: SettingSongRequest }
  }

  async function update() {
    const r = await get()
    if (r) {
      const isCountChange = originSongs.value.length != (r.songs?.length ?? 0)
      originSongs.value = (r.songs ?? []).toSorted((a, b) => {
        return b.createAt - a.createAt
      })
      settings.value = r.setting ?? ({} as SettingSongRequest)
      if (isCountChange) {
        key.value = Date.now()
      }
    }
  }

  watch(
    () => toValue(currentId),
    () => {
      void update()
    },
  )

  return {
    originSongs,
    songs,
    settings,
    singing,
    activeSongs,
    allowGuardTypes,
    key,
    get,
    update,
  }
}
