import type {
  Setting_LiveRequest,
  SongRequestInfo,
} from '@/api/api-models'
import { List } from 'linqts'
import { computed, ref } from 'vue'
import {
  QueueSortType,
  SongRequestStatus,
} from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { SONG_REQUEST_API_URL } from '@/data/constants'
import { useWebRTC } from '@/store/useRTC'

export function useLiveRequestData(currentId: string) {
  const rtc = ref<any>(null)
  const originSongs = ref<SongRequestInfo[]>([])
  const settings = ref<Setting_LiveRequest>({} as Setting_LiveRequest)
  const key = ref(Date.now())

  // 计算属性
  const songs = computed(() => {
    let result = new List(originSongs.value)
    switch (settings.value.sortType) {
      case QueueSortType.TimeFirst: {
        result = result.ThenBy(q => q.createAt)
        break
      }
      case QueueSortType.GuardFirst: {
        result = result
          .OrderBy(q => (q.user?.guard_level == 0 || q.user?.guard_level == null ? 4 : q.user.guard_level))
          .ThenBy(q => q.createAt)
        break
      }
      case QueueSortType.PaymentFist: {
        result = result.OrderByDescending(q => q.price ?? 0).ThenBy(q => q.createAt)
        break
      }
      case QueueSortType.FansMedalFirst: {
        result = result.OrderByDescending(q => q.user?.fans_medal_level ?? 0).ThenBy(q => q.createAt)
        break
      }
    }
    if (settings.value.isReverse) {
      return result.Reverse().ToArray()
    } else {
      return result.ToArray()
    }
  })

  const singing = computed(() => {
    return songs.value.find(s => s.status == SongRequestStatus.Singing)
  })

  const activeSongs = computed(() => {
    return songs.value.filter(s => s.status == SongRequestStatus.Waiting)
  })

  const allowGuardTypes = computed(() => {
    const types = []
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
      const data = await QueryGetAPI<{ songs: SongRequestInfo[], setting: Setting_LiveRequest }>(
        `${SONG_REQUEST_API_URL}get-active-and-settings`,
        {
          id: currentId,
        },
      )
      if (data.code == 200) {
        return data.data
      }
    } catch (err) {
      console.log(err)
    }
    return {
      songs: [],
      setting: {} as Setting_LiveRequest,
    } as { songs: SongRequestInfo[], setting: Setting_LiveRequest }
  }

  async function update() {
    const r = await get()
    if (r) {
      const isCountChange = originSongs.value.length != r.songs.length
      originSongs.value = r.songs.sort((a, b) => {
        return b.createAt - a.createAt
      })
      settings.value = r.setting
      if (isCountChange) {
        key.value = Date.now()
      }
    }
  }

  // RTC初始化
  async function initRTC() {
    rtc.value = await useWebRTC().Init('slave')
    // 接收点播结果消息
    rtc.value.on('function.live-request.add', async () => update())
  }

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
    initRTC,
  }
}
