import type {
  DanmakuUserInfo,
  EventModel,
  Setting_LiveRequest,
  SongRequestInfo,
  SongsInfo,
} from '@/api/api-models'
import { List } from 'linqts'
import { NTime } from 'naive-ui';
import { computed, h, ref } from 'vue'
import { AddBiliBlackList, useAccount } from '@/api/account'
import { usePersistedStorage } from '@/shared/storage/persist'
import {
  EventDataTypes,
  FunctionTypes,
  QueueSortType,
  SongRequestFrom,
  SongRequestStatus,
} from '@/api/api-models'
import {
  QueryGetAPI,
  QueryPostAPI,
  QueryPostAPIWithParams,
} from '@/api/query'
import { SONG_REQUEST_API_URL } from '@/shared/config'

export const useLiveRequest = defineStore('songRequest', () => {
  const accountInfo = useAccount()

  const localActiveSongs = usePersistedStorage('SongRequest.ActiveSongs', [] as SongRequestInfo[])
  const isWarnMessageAutoClose = usePersistedStorage('SongRequest.Settings.WarnMessageAutoClose', false)
  const isReverse = usePersistedStorage('SongRequest.Settings.Reverse', false)
  const defaultPrefix = usePersistedStorage('Settings.SongRequest.DefaultPrefix', '点播')

  const isLoading = ref(false)
  const originSongs = ref<SongRequestInfo[]>([])
  const updateKey = ref(0)
  const filterSongName = ref('')
  const filterSongNameContains = ref(false)
  const filterName = ref('')
  const filterNameContains = ref(false)
  const newSongName = ref('')
  const selectedSong = ref<SongsInfo>()
  const isLrcLoading = ref('')

  const configCanEdit = computed(() => {
    return isLoggedIn.value
  })

  const isLoggedIn = computed(() => {
    return accountInfo.value != null && accountInfo.value.id !== undefined
  })

  const songs = computed<SongRequestInfo[]>(() => {
    let result = new List(originSongs.value).Where((s) => {
      if (filterName.value) {
        if (filterNameContains.value) {
          if (!s?.user?.name.toLowerCase().includes(filterName.value.toLowerCase())) {
            return false
          }
        } else if (s?.user?.name.toLowerCase() !== filterName.value.toLowerCase()) {
          return false
        }
      } else if (filterSongName.value) {
        if (filterSongNameContains.value) {
          if (!s?.songName.toLowerCase().includes(filterSongName.value.toLowerCase())) {
            return false
          }
        } else if (s?.songName.toLowerCase() !== filterSongName.value.toLowerCase()) {
          return false
        }
      }
      return true
    })

    const settings: Setting_LiveRequest = accountInfo.value?.settings?.songRequest

    switch (settings.sortType) {
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

    if ((configCanEdit.value && settings.isReverse) || (!configCanEdit.value && isReverse.value)) {
      return result.Reverse().ToArray()
    } else {
      return result.ToArray()
    }
  })

  const activeSongs = computed(() => {
    return (isLoggedIn.value ? songs.value : localActiveSongs.value)
      .sort((a, b) => b.status - a.status)
      .filter((song) => {
        return song.status == SongRequestStatus.Waiting || song.status == SongRequestStatus.Singing
      })
  })

  const historySongs = computed(() => {
    return (isLoggedIn.value ? songs.value : localActiveSongs.value)
      .sort((a, b) => a.status - b.status)
      .filter((song) => {
        return song.status == SongRequestStatus.Finish || song.status == SongRequestStatus.Cancel
      })
  })

  const STATUS_MAP = {
    [SongRequestStatus.Waiting]: '等待中',
    [SongRequestStatus.Singing]: '处理中',
    [SongRequestStatus.Finish]: '已处理',
    [SongRequestStatus.Cancel]: '已取消',
  }

  async function getAllSong() {
    if (isLoggedIn.value) {
      try {
        const data = await QueryGetAPI<SongRequestInfo[]>(`${SONG_REQUEST_API_URL}get-all`, {
          id: accountInfo.value.id,
        })
        if (data.code == 200) {
          console.log('[SONG-REQUEST] 已获取所有数据')
          return new List(data.data).OrderByDescending(s => s.createAt).ToArray()
        } else {
          window.$message.error(`无法获取数据: ${data.message}`)
          return []
        }
      } catch (_err) {
        console.error('[SONG-REQUEST] 无法获取数据', _err)
        window.$message.error('无法获取数据')
      }
      return []
    } else {
      return localActiveSongs.value
    }
  }

  async function initData() {
    originSongs.value = await getAllSong()
  }

  async function addSong(danmaku: EventModel) {
    console.log(
      `[SONG-REQUEST] 收到 [${danmaku.uname}] 的点播${danmaku.type == EventDataTypes.SC ? 'SC' : '弹幕'}: ${danmaku.msg}`,
    )

    const settings: Setting_LiveRequest = accountInfo.value?.settings?.songRequest

    if (settings.enableOnStreaming && accountInfo.value?.streamerInfo?.isStreaming != true) {
      window.$notification.info({
        title: `${danmaku.uname} 点播失败`,
        description: '当前未在直播中, 无法添加点播请求. 或者关闭设置中的仅允许直播时加入',
        meta: () => h(NTime, { type: 'relative', time: Date.now(), key: updateKey.value }),
      })
      return
    }

    if (isLoggedIn.value) {
      await QueryPostAPI<SongRequestInfo>(`${SONG_REQUEST_API_URL}try-add`, danmaku).then((data) => {
        if (data.code == 200) {
          window.$message.success(`[${danmaku.uname}] 添加曲目: ${data.data.songName}`)
          if (data.message != 'EventFetcher') originSongs.value.unshift(data.data)
        } else {
          const time = Date.now()
          window.$notification.warning({
            title: `${danmaku.uname} 点播失败`,
            description: data.message,
            duration: isWarnMessageAutoClose.value ? 3000 : 0,
            meta: () => h(NTime, { type: 'relative', time, key: updateKey.value }),
          })
          console.log(`[SONG-REQUEST] [${danmaku.uname}] 添加曲目失败: ${data.message}`)
        }
      })
    } else {
      const songData = {
        songName: danmaku.msg.trim().substring(settings.orderPrefix?.length || defaultPrefix.value.length),
        song: undefined,
        status: SongRequestStatus.Waiting,
        from: danmaku.type == EventDataTypes.Message ? SongRequestFrom.Danmaku : SongRequestFrom.SC,
        scPrice: danmaku.type == EventDataTypes.SC ? danmaku.price : 0,
        user: {
          name: danmaku.uname,
          uid: danmaku.uid,
          oid: danmaku.open_id,
          face: danmaku.uface,
          fans_medal_level: danmaku.fans_medal_level,
          fans_medal_name: danmaku.fans_medal_name,
          fans_medal_wearing_status: danmaku.fans_medal_wearing_status,
          guard_level: danmaku.guard_level,
        } as DanmakuUserInfo,
        createAt: Date.now(),
        isInLocal: true,
        id: songs.value.length == 0 ? 1 : (new List(songs.value).Max(s => s.id) ?? 0) + 1,
      } as SongRequestInfo

      localActiveSongs.value.unshift(songData)
      window.$message.success(`[${danmaku.uname}] 添加: ${songData.songName}`)
    }
  }

  async function addSongManual() {
    if (!newSongName.value) {
      window.$message.error('请输入名称')
      return
    }

    if (isLoggedIn.value) {
      await QueryPostAPIWithParams<SongRequestInfo>(`${SONG_REQUEST_API_URL}add`, {
        name: newSongName.value,
      }).then((data) => {
        if (data.code == 200) {
          window.$message.success(`已手动添加: ${data.data.songName}`)
          originSongs.value.unshift(data.data)
          newSongName.value = ''
          console.log(`[SONG-REQUEST] 已手动添加: ${data.data.songName}`)
        } else {
          window.$message.error(`手动添加失败: ${data.message}`)
        }
      })
    } else {
      const songData = {
        songName: newSongName.value,
        song: undefined,
        status: SongRequestStatus.Waiting,
        from: SongRequestFrom.Manual,
        scPrice: undefined,
        user: undefined,
        createAt: Date.now(),
        isInLocal: true,
        id: songs.value.length == 0 ? 1 : (new List(songs.value).Max(s => s.id) ?? 0) + 1,
      } as SongRequestInfo

      localActiveSongs.value.unshift(songData)
      window.$message.success(`已手动添加: ${songData.songName}`)
      newSongName.value = ''
    }
  }

  async function updateSongStatus(song: SongRequestInfo, status: SongRequestStatus) {
    if (!configCanEdit.value) {
      song.status = status
      return
    }

    isLoading.value = true
    let statusString = ''
    let statusString2 = ''

    switch (status) {
      case SongRequestStatus.Waiting:
        statusString = 'active'
        statusString2 = '等待中'
        break
      case SongRequestStatus.Cancel:
        statusString = 'cancel'
        statusString2 = '已取消'
        break
      case SongRequestStatus.Finish:
        statusString = 'finish'
        statusString2 = '已完成'
        break
      case SongRequestStatus.Singing:
        statusString = 'singing'
        statusString2 = '处理中'
        break
    }

    await QueryGetAPI(SONG_REQUEST_API_URL + statusString, {
      id: song.id,
    })
      .then((data) => {
        if (data.code == 200) {
          console.log(`[SONG-REQUEST] 更新状态: ${song.songName} -> ${statusString}`)
          song.status = status
          if (status > SongRequestStatus.Singing) {
            song.finishAt = Date.now()
          }
          window.$message.success(`已更新状态为: ${statusString2}`)
        } else {
          console.log(`[SONG-REQUEST] 更新状态失败: ${data.message}`)
          window.$message.error(`更新状态失败: ${data.message}`)
        }
      })
      .catch((_err) => {
        window.$message.error(`更新状态失败`)
      })
      .finally(() => {
        isLoading.value = false
      })
  }

  async function deleteSongs(values: SongRequestInfo[]) {
    isLoading.value = true

    try {
      const data = await QueryPostAPI(
        `${SONG_REQUEST_API_URL}del`,
        values.map(s => s.id),
      )

      if (data.code == 200) {
        window.$message.success('删除成功')
        originSongs.value = originSongs.value.filter(s => !values.includes(s))
      } else {
        window.$message.error(`删除失败: ${data.message}`)
      }
    } catch (_err) {
      console.error('[SONG-REQUEST] 删除请求失败', _err)
      window.$message.error('删除失败')
    } finally {
      isLoading.value = false
    }
  }

  async function deactiveAllSongs() {
    isLoading.value = true

    try {
      const data = await QueryGetAPI(`${SONG_REQUEST_API_URL}deactive`)

      if (data.code == 200) {
        window.$message.success('已全部取消')
        songs.value.forEach((s) => {
          if (s.status <= SongRequestStatus.Singing) {
            s.status = SongRequestStatus.Cancel
          }
        })
      } else {
        window.$message.error(`取消失败: ${data.message}`)
      }
    } catch (_err) {
      console.error('[SONG-REQUEST] 取消全部失败', _err)
      window.$message.error('取消失败')
    } finally {
      isLoading.value = false
    }
  }

  async function updateActive() {
    if (!isLoggedIn.value) return

    try {
      const data = await QueryGetAPI<SongRequestInfo[]>(`${SONG_REQUEST_API_URL}get-active`, {
        id: accountInfo.value?.id,
      })

      if (data.code == 200) {
        data.data.forEach((item) => {
          const song = originSongs.value.find(s => s.id == item.id)
          if (song) {
            if (song.status != item.status) song.status = item.status
          } else {
            originSongs.value.unshift(item)
            if (item.from == SongRequestFrom.Web) {
              window.$message.success(`[${item.user?.name}] 直接从网页歌单点播: ${item.songName}`)
            }
          }
        })
      } else {
        window.$message.error(`无法获取点播队列: ${data.message}`)
      }
    } catch (_err) {
      console.error('[SONG-REQUEST] 更新活跃歌曲失败', _err)
    }
  }

  async function blockUser(item: SongRequestInfo) {
    if (item.from != SongRequestFrom.Danmaku) {
      window.$message.error(`[${item.user?.name}] 不是来自弹幕的用户`)
      return
    }

    if (item.user) {
      try {
        const data = await AddBiliBlackList(item.user.uid, item.user.name)

        if (data.code == 200) {
          window.$message.success(`[${item.user?.name}] 已添加到黑名单`)
          updateSongStatus(item, SongRequestStatus.Cancel)
        } else {
          window.$message.error(data.message)
        }
      } catch (_err) {
        console.error('[SONG-REQUEST] 添加黑名单失败', _err)
        window.$message.error('添加黑名单失败')
      }
    }
  }

  function checkMessage(msg: string) {
    if (isLoggedIn.value && accountInfo.value?.settings?.enableFunctions?.includes(FunctionTypes.LiveRequest) != true) {
      return false
    }
    const prefix = accountInfo.value?.settings?.songRequest?.orderPrefix || defaultPrefix.value
    return msg.trim().toLowerCase().startsWith(prefix.toLowerCase())
  }

  function getSCColor(price: number): string {
    if (price === 0) return `#2a60b2`
    if (price > 0 && price < 30) return `#2a60b2`
    if (price >= 30 && price < 50) return `#2a60b2`
    if (price >= 50 && price < 100) return `#427d9e`
    if (price >= 100 && price < 500) return `#c99801`
    if (price >= 500 && price < 1000) return `#e09443`
    if (price >= 1000 && price < 2000) return `#e54d4d`
    if (price >= 2000) return `#ab1a32`
    return ''
  }

  function getGuardColor(level: number | null | undefined): string {
    if (level) {
      switch (level) {
        case 1: return 'rgb(122, 4, 35)'
        case 2: return 'rgb(157, 155, 255)'
        case 3: return 'rgb(104, 136, 241)'
      }
    }
    return ''
  }

  function onGetDanmaku(danmaku: EventModel) {
    console.log(checkMessage(danmaku.msg))
    if (checkMessage(danmaku.msg)) {
      addSong(danmaku)
    }
  }

  function onGetSC(danmaku: EventModel) {
    const settings = accountInfo.value?.settings?.songRequest

    if (settings.allowSC && checkMessage(danmaku.msg)) {
      addSong(danmaku)
    }
  }

  let updateActiveTimer: any = null

  function startUpdateTimer() {
    stopUpdateTimer()
    updateActiveTimer = setInterval(() => {
      updateActive()
    }, 2000)
  }

  function stopUpdateTimer() {
    if (updateActiveTimer) {
      clearInterval(updateActiveTimer)
      updateActiveTimer = null
    }
  }

  let updateKeyTimer: any = null

  function startUpdateKeyTimer() {
    stopUpdateKeyTimer()
    updateKeyTimer = setInterval(() => {
      updateKey.value++
    }, 1000)
  }

  function stopUpdateKeyTimer() {
    if (updateKeyTimer) {
      clearInterval(updateKeyTimer)
      updateKeyTimer = null
    }
  }

  async function init() {
    await initData()
    startUpdateKeyTimer()
    startUpdateTimer()
  }

  function dispose() {
    stopUpdateKeyTimer()
    stopUpdateTimer()
  }

  return {
    // 状态
    isLoading,
    originSongs,
    songs,
    activeSongs,
    historySongs,
    newSongName,
    selectedSong,
    isLrcLoading,
    filterSongName,
    filterSongNameContains,
    filterName,
    filterNameContains,
    updateKey,
    STATUS_MAP,
    isWarnMessageAutoClose,
    isReverse,
    defaultPrefix,

    // 计算
    configCanEdit,

    // 方法
    init,
    dispose,
    addSong,
    addSongManual,
    updateSongStatus,
    deleteSongs,
    deactiveAllSongs,
    updateActive,
    blockUser,
    checkMessage,
    onGetDanmaku,
    onGetSC,
    getSCColor,
    getGuardColor,
  }
})
