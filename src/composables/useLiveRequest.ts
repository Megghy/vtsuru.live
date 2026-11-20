import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { AddBiliBlackList, useAccount } from '@/api/account'
import type { EventModel, SongRequestInfo } from '@/api/client-types'
import {
  getApiLiveRequestGetActive,
  getApiLiveRequestGetAll,
  getApiLiveRequestStats,
  postApiLiveRequestActive,
  postApiLiveRequestAdd,
  postApiLiveRequestBatchStatus,
  postApiLiveRequestCancel,
  postApiLiveRequestDeactivate,
  postApiLiveRequestDelete,
  postApiLiveRequestFinish,
  postApiLiveRequestReorder,
  postApiLiveRequestResetOrder,
  postApiLiveRequestSinging,
  postApiLiveRequestTryAdd,
} from '@/api/generated/live-request/live-request'
import type { ResponseLiveRequestStatsModel, ResponseSongModel } from '@/api/generated/model'
import { EventDataTypes, FunctionTypes, SongRequestFrom, SongRequestStatus } from '@/api/generated/model'
import { usePersistedStorage } from '@/shared/storage/persist'
import { GuidUtils } from '@/shared/utils'
import { getGuardColor, getSCColor, sortByQueueType } from '@/shared/utils/queue'

export const useLiveRequest = defineStore('songRequest', () => {
  const accountInfo = useAccount()

  const localActiveSongs = usePersistedStorage('SongRequest.ActiveSongs', [] as SongRequestInfo[])
  const isWarnMessageAutoClose = usePersistedStorage('SongRequest.Settings.WarnMessageAutoClose', false)
  const isReverse = usePersistedStorage('SongRequest.Settings.Reverse', false)
  const defaultPrefix = usePersistedStorage('Settings.SongRequest.DefaultPrefix', '点播')

  const isBatchLoading = ref(false)
  const operatingIds = ref<number[]>([])
  const isLoading = computed({
    get: () => isBatchLoading.value || operatingIds.value.length > 0,
    set: (val: boolean) => {
      isBatchLoading.value = val
    },
  })

  const originSongs = ref<SongRequestInfo[]>([])

  // 历史检索（独立于当前队列，避免在历史 Tab 搜索后导致当前队列静默空屏）
  const filterSongName = ref('')
  const filterSongNameContains = ref(true)
  const filterName = ref('')
  const filterNameContains = ref(true)

  // 当前队列检索
  const activeFilterKeyword = ref('')

  const newSongName = ref('')
  const selectedSong = ref<ResponseSongModel>()
  const isLrcLoading = ref('')

  const stats = ref<ResponseLiveRequestStatsModel | null>(null)
  const isStatsLoading = ref(false)

  const isLoggedIn = computed(() => {
    return accountInfo.value != null && accountInfo.value.id !== undefined && accountInfo.value.id > 0
  })

  const configCanEdit = computed(() => isLoggedIn.value)

  function isSongOperating(id: number) {
    return operatingIds.value.includes(id)
  }

  function markOperating(id: number, active: boolean) {
    if (active) {
      if (!operatingIds.value.includes(id)) {
        operatingIds.value = [...operatingIds.value, id]
      }
    } else {
      operatingIds.value = operatingIds.value.filter((item) => item !== id)
    }
  }

  const sourceList = computed(() => (isLoggedIn.value ? originSongs.value : localActiveSongs.value))

  /** 当前全部点播数据按规则排序后的全量视图（不应用历史搜索条件） */
  const songs = computed<SongRequestInfo[]>(() => {
    const settings = accountInfo.value?.settings?.songRequest
    const reverse = configCanEdit.value ? Boolean(settings?.isReverse) : isReverse.value

    return sortByQueueType(sourceList.value, settings?.sortType, reverse, {
      createAt: (q) => q.createAt,
      guardLevel: (q) => q.user?.guard_level,
      price: (q) => q.price,
      fansMedalLevel: (q) => q.user?.fans_medal_level,
      fansMedalWearing: (q) => q.user?.fans_medal_wearing_status,
      priorityLevel: (q) => q.priorityLevel,
      sortOrder: (q) => q.sortOrder,
    })
  })

  /** 未过滤的当前活跃队列（正在演唱排在最前） */
  const unfilteredActiveSongs = computed(() => {
    return songs.value
      .filter((song) => song.status === SongRequestStatus.Waiting || song.status === SongRequestStatus.Singing)
      .toSorted((a, b) => {
        if (a.status === SongRequestStatus.Singing && b.status !== SongRequestStatus.Singing) return -1
        if (b.status === SongRequestStatus.Singing && a.status !== SongRequestStatus.Singing) return 1
        return 0
      })
  })

  /** 经过当前队列搜索关键词过滤的活跃队列 */
  const activeSongs = computed(() => {
    const kw = activeFilterKeyword.value.trim().toLowerCase()
    if (!kw) return unfilteredActiveSongs.value
    return unfilteredActiveSongs.value.filter(
      (song) => song.songName?.toLowerCase().includes(kw) || song.user?.name?.toLowerCase().includes(kw),
    )
  })

  const hasCustomOrder = computed(() =>
    unfilteredActiveSongs.value.some((s) => s.sortOrder !== null && s.sortOrder !== undefined),
  )

  const historySongs = computed(() => {
    return songs.value.filter(
      (song) => song.status === SongRequestStatus.Finish || song.status === SongRequestStatus.Cancel,
    )
  })

  const STATUS_MAP = {
    [SongRequestStatus.Waiting]: '等待中',
    [SongRequestStatus.Singing]: '正在演唱',
    [SongRequestStatus.Finish]: '已完成',
    [SongRequestStatus.Cancel]: '已取消',
  }

  async function getAllSong(): Promise<SongRequestInfo[]> {
    if (!isLoggedIn.value) {
      return localActiveSongs.value
    }
    try {
      const data = await getApiLiveRequestGetAll()
      if (data.code === 200) {
        return [...data.data].toSorted((a, b) => b.createAt - a.createAt)
      }
      window.$message.error(`无法获取点播数据: ${data.message}`)
    } catch (err) {
      console.error('[SONG-REQUEST] 无法获取数据', err)
      window.$message.error('无法获取点播数据')
    }
    return []
  }

  async function fetchStats() {
    if (!isLoggedIn.value) return null
    isStatsLoading.value = true
    try {
      const res = await getApiLiveRequestStats()
      if (res.code === 200) {
        stats.value = res.data
        return res.data
      }
    } catch (err) {
      console.error('[SONG-REQUEST] 获取统计失败', err)
    } finally {
      isStatsLoading.value = false
    }
    return null
  }

  async function initData() {
    originSongs.value = await getAllSong()
  }

  function nextLocalId() {
    return sourceList.value.length === 0 ? 1 : Math.max(...sourceList.value.map((s) => s.id)) + 1
  }

  async function addSong(danmaku: EventModel) {
    const settings = accountInfo.value?.settings?.songRequest

    if (settings?.enableOnStreaming && accountInfo.value?.streamerInfo?.isStreaming !== true) {
      window.$notification.info({
        title: `${danmaku.uname} 点播失败`,
        description: '当前未在直播中，无法添加点播请求；或关闭设置中的「仅在直播时允许加入」。',
        meta: new Date().toLocaleTimeString(),
      })
      return
    }

    if (isLoggedIn.value) {
      const data = await (postApiLiveRequestTryAdd(danmaku as any) as Promise<unknown> as Promise<{
        code: number
        message: string
        data: SongRequestInfo
      }>)
      if (data.code === 200) {
        if (data.message !== 'EventFetcher') {
          const idx = originSongs.value.findIndex((s) => s.id === data.data.id)
          if (idx > -1) {
            originSongs.value.splice(idx, 1, data.data)
            window.$message.success(`[${danmaku.uname}] 使用积分插队: ${data.data.songName}`)
          } else {
            originSongs.value.unshift(data.data)
            window.$message.success(`[${danmaku.uname}] 添加曲目: ${data.data.songName}`)
          }
        } else {
          window.$message.success(`[${danmaku.uname}] 添加曲目: ${data.data.songName}`)
        }
      } else {
        window.$notification.warning({
          title: `${danmaku.uname} 点播失败`,
          description: data.message,
          duration: isWarnMessageAutoClose.value ? 3000 : 0,
          meta: new Date().toLocaleTimeString(),
        })
      }
    } else {
      const prefixLen = settings?.orderPrefix?.length || defaultPrefix.value.length
      const songData = {
        songName: danmaku.msg.trim().substring(prefixLen).trim() || danmaku.msg.trim(),
        song: undefined,
        status: SongRequestStatus.Waiting,
        from: danmaku.type === EventDataTypes.Message ? SongRequestFrom.Danmaku : SongRequestFrom.SC,
        price: danmaku.type === EventDataTypes.SC ? danmaku.price : 0,
        user: {
          name: danmaku.uname,
          uid: danmaku.uid,
          oid: danmaku.open_id,
          face: danmaku.uface,
          fans_medal_level: danmaku.fans_medal_level,
          fans_medal_name: danmaku.fans_medal_name,
          fans_medal_wearing_status: danmaku.fans_medal_wearing_status,
          guard_level: danmaku.guard_level,
        },
        createAt: Date.now(),
        priorityLevel: 0,
        isInLocal: true,
        id: nextLocalId(),
      } as SongRequestInfo

      localActiveSongs.value.unshift(songData)
      window.$message.success(`[${danmaku.uname}] 添加: ${songData.songName}`)
    }
  }

  async function addSongManual() {
    const trimmed = newSongName.value.trim()
    if (!trimmed) {
      window.$message.error('请输入歌曲名称')
      return
    }

    if (isLoggedIn.value) {
      const data = await (postApiLiveRequestAdd({ name: trimmed }) as Promise<unknown> as Promise<{
        code: number
        message: string
        data: SongRequestInfo
      }>)
      if (data.code === 200) {
        window.$message.success(`已手动添加: ${data.data.songName}`)
        originSongs.value.unshift(data.data)
        newSongName.value = ''
      } else {
        window.$message.error(`手动添加失败: ${data.message}`)
      }
    } else {
      const songData = {
        songName: trimmed,
        song: undefined,
        status: SongRequestStatus.Waiting,
        from: SongRequestFrom.Manual,
        price: undefined,
        user: undefined,
        createAt: Date.now(),
        priorityLevel: 0,
        isInLocal: true,
        id: nextLocalId(),
      } as SongRequestInfo

      localActiveSongs.value.unshift(songData)
      window.$message.success(`已手动添加: ${songData.songName}`)
      newSongName.value = ''
    }
  }

  function applySongStatusUpdate(song: SongRequestInfo, status: SongRequestStatus, refundPoint: boolean, now: number) {
    song.status = status
    if (status === SongRequestStatus.Singing) {
      song.startSingAt = now
    } else if (status > SongRequestStatus.Singing) {
      song.finishAt = now
    }
    if (status === SongRequestStatus.Cancel && refundPoint && song.pointCost && song.pointCost > 0) {
      song.pointRefunded = true
    }
  }

  async function updateSongStatus(song: SongRequestInfo, status: SongRequestStatus, refundPoint = false) {
    if (!isLoggedIn.value) {
      applySongStatusUpdate(song, status, false, Date.now())
      window.$message.success(`已更新状态为: ${STATUS_MAP[status]}`)
      return
    }

    markOperating(song.id, true)
    try {
      const res =
        status === SongRequestStatus.Waiting
          ? await postApiLiveRequestActive({ id: song.id })
          : status === SongRequestStatus.Cancel
            ? await postApiLiveRequestCancel({ id: song.id, refundPoint })
            : status === SongRequestStatus.Finish
              ? await postApiLiveRequestFinish({ id: song.id })
              : await postApiLiveRequestSinging({ id: song.id })

      if (res.code === 200) {
        applySongStatusUpdate(song, status, refundPoint, Date.now())
        window.$message.success(
          status === SongRequestStatus.Cancel && refundPoint && song.pointCost
            ? '已取消点播并退回积分'
            : `已更新状态为: ${STATUS_MAP[status]}`,
        )
      } else {
        window.$message.error(`更新状态失败: ${res.message}`)
      }
    } catch (err) {
      console.error('[SONG-REQUEST] 更新状态失败', err)
      window.$message.error('更新状态失败')
    } finally {
      markOperating(song.id, false)
    }
  }

  async function batchUpdateStatus(ids: number[], status: SongRequestStatus, refundPoint = false) {
    if (ids.length === 0) return false
    if (!isLoggedIn.value) {
      const idSet = new Set(ids)
      const now = Date.now()
      for (const s of localActiveSongs.value) {
        if (idSet.has(s.id)) {
          s.status = status
          if (status > SongRequestStatus.Singing) s.finishAt = now
        }
      }
      window.$message.success(`已批量更新 ${ids.length} 条记录`)
      return true
    }

    isBatchLoading.value = true
    try {
      const res = await postApiLiveRequestBatchStatus({ ids, status, refundPoint })
      if (res.code === 200) {
        const updatedSet = new Set(res.data)
        const now = Date.now()
        for (const s of originSongs.value) {
          if (updatedSet.has(s.id)) {
            applySongStatusUpdate(s, status, refundPoint, now)
          }
        }
        window.$message.success(`已批量更新 ${res.data.length} 条点播状态为「${STATUS_MAP[status]}」`)
        return true
      }
      window.$message.error(`批量更新失败: ${res.message}`)
    } catch (err) {
      console.error('[SONG-REQUEST] 批量更新失败', err)
      window.$message.error('批量更新失败')
    } finally {
      isBatchLoading.value = false
    }
    return false
  }

  async function reorderSongs(orderedIds: number[]) {
    if (orderedIds.length === 0) return false
    const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]))
    for (const item of sourceList.value) {
      const idx = orderMap.get(item.id)
      if (idx !== undefined) {
        item.sortOrder = idx
      }
    }

    if (!isLoggedIn.value) return true

    try {
      const res = await postApiLiveRequestReorder(orderedIds)
      if (res.code !== 200) {
        window.$message.error(`保存排序失败: ${res.message}`)
        return false
      }
      return true
    } catch (err) {
      console.error('[SONG-REQUEST] 调序失败', err)
      window.$message.error('保存排序失败')
      return false
    }
  }

  async function reorderWaitingSongs(
    targetId: number,
    buildReordered: (waiting: SongRequestInfo[], idx: number) => SongRequestInfo[] | null,
  ) {
    const waiting = unfilteredActiveSongs.value.filter((s) => s.status === SongRequestStatus.Waiting)
    const idx = waiting.findIndex((s) => s.id === targetId)
    if (idx === -1) return false
    const reordered = buildReordered(waiting, idx)
    if (!reordered) return false
    const singing = unfilteredActiveSongs.value.filter((s) => s.status === SongRequestStatus.Singing)
    return reorderSongs([...singing.map((s) => s.id), ...reordered.map((s) => s.id)])
  }

  async function moveSong(song: SongRequestInfo, direction: 'up' | 'down') {
    await reorderWaitingSongs(song.id, (waiting, idx) => {
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1
      if (targetIdx < 0 || targetIdx >= waiting.length) return null
      const reordered = [...waiting]
      const [moved] = reordered.splice(idx, 1)
      reordered.splice(targetIdx, 0, moved)
      return reordered
    })
  }

  async function pinSong(song: SongRequestInfo) {
    const ok = await reorderWaitingSongs(song.id, (waiting, idx) =>
      idx <= 0 ? null : [song, ...waiting.filter((s) => s.id !== song.id)],
    )
    if (ok) {
      window.$message.success(`已将「${song.songName}」置顶`)
    }
  }

  async function resetOrder() {
    for (const item of sourceList.value) {
      if (item.status <= SongRequestStatus.Singing) {
        item.sortOrder = null
      }
    }
    if (!isLoggedIn.value) {
      window.$message.success('已恢复按规则排序')
      return true
    }

    isBatchLoading.value = true
    try {
      const res = await postApiLiveRequestResetOrder()
      if (res.code === 200) {
        window.$message.success('已恢复为规则排序')
        return true
      }
      window.$message.error(`恢复排序失败: ${res.message}`)
    } catch (err) {
      console.error('[SONG-REQUEST] 重置排序失败', err)
      window.$message.error('恢复排序失败')
    } finally {
      isBatchLoading.value = false
    }
    return false
  }

  async function deleteSongs(values: SongRequestInfo[]) {
    if (values.length === 0) return
    const idSet = new Set(values.map((s) => s.id))
    if (!isLoggedIn.value) {
      localActiveSongs.value = localActiveSongs.value.filter((s) => !idSet.has(s.id))
      window.$message.success('删除成功')
      return
    }

    isBatchLoading.value = true
    try {
      const data = await postApiLiveRequestDelete(values.map((s) => s.id))
      if (data.code === 200) {
        window.$message.success('删除成功')
        originSongs.value = originSongs.value.filter((s) => !idSet.has(s.id))
      } else {
        window.$message.error(`删除失败: ${data.message}`)
      }
    } catch (err) {
      console.error('[SONG-REQUEST] 删除请求失败', err)
      window.$message.error('删除失败')
    } finally {
      isBatchLoading.value = false
    }
  }

  async function deactiveAllSongs(refundPoint = false) {
    if (!isLoggedIn.value) {
      const now = Date.now()
      for (const s of localActiveSongs.value) {
        if (s.status <= SongRequestStatus.Singing) {
          applySongStatusUpdate(s, SongRequestStatus.Cancel, false, now)
        }
      }
      window.$message.success('已全部取消')
      return
    }

    isBatchLoading.value = true
    try {
      const data = await postApiLiveRequestDeactivate({ refundPoint })
      if (data.code === 200) {
        const now = Date.now()
        for (const s of originSongs.value) {
          if (s.status <= SongRequestStatus.Singing) {
            applySongStatusUpdate(s, SongRequestStatus.Cancel, refundPoint, now)
          }
        }
        window.$message.success(refundPoint ? '已全部取消并退回已消费积分' : '已全部取消')
      } else {
        window.$message.error(`取消失败: ${data.message}`)
      }
    } catch (err) {
      console.error('[SONG-REQUEST] 取消全部失败', err)
      window.$message.error('取消失败')
    } finally {
      isBatchLoading.value = false
    }
  }

  async function updateActive() {
    if (!isLoggedIn.value) return

    try {
      const data = await getApiLiveRequestGetActive({ id: accountInfo.value?.id })
      if (data.code === 200) {
        for (const item of data.data) {
          const song = originSongs.value.find((s) => s.id === item.id)
          if (song) {
            if (song.status !== item.status) song.status = item.status
            if (song.priorityLevel !== item.priorityLevel) song.priorityLevel = item.priorityLevel
            if (song.pointCost !== item.pointCost) song.pointCost = item.pointCost
            if (song.pointRefunded !== item.pointRefunded) song.pointRefunded = item.pointRefunded
            if (song.sortOrder !== item.sortOrder) song.sortOrder = item.sortOrder
            if (item.startSingAt && !song.startSingAt) song.startSingAt = item.startSingAt
            if (item.finishAt && !song.finishAt) song.finishAt = item.finishAt
          } else {
            originSongs.value.unshift(item)
            if (item.from === SongRequestFrom.Web) {
              window.$message.success(`[${item.user?.name}] 直接从网页歌单点播: ${item.songName}`)
            }
          }
        }
      } else {
        window.$message.error(`无法获取点播队列: ${data.message}`)
      }
    } catch (err) {
      console.error('[SONG-REQUEST] 更新活跃歌曲失败', err)
    }
  }

  async function blockUser(item: SongRequestInfo) {
    if (
      item.from !== SongRequestFrom.Danmaku &&
      item.from !== SongRequestFrom.SC &&
      item.from !== SongRequestFrom.Gift
    ) {
      window.$message.error(`[${item.user?.name || '该记录'}] 不是来自直播间观众`)
      return
    }
    if (!item.user) return

    try {
      const data = await AddBiliBlackList(GuidUtils.toOuid(item.user.uid, item.user.oid), item.user.name)
      if (data.code === 200) {
        window.$message.success(`[${item.user.name}] 已添加到黑名单`)
        await updateSongStatus(item, SongRequestStatus.Cancel)
      } else {
        window.$message.error(data.message)
      }
    } catch (err) {
      console.error('[SONG-REQUEST] 添加黑名单失败', err)
      window.$message.error('添加黑名单失败')
    }
  }

  function checkMessage(msg: string) {
    if (
      isLoggedIn.value &&
      accountInfo.value?.settings?.enableFunctions?.includes(FunctionTypes.SongRequest) !== true
    ) {
      return false
    }
    const reqSettings = accountInfo.value?.settings?.songRequest
    const priorityKeyword = reqSettings?.allowPointPriority ? reqSettings.pointPriorityKeyword?.trim() : ''
    if (priorityKeyword && msg.trim().toLowerCase().startsWith(priorityKeyword.toLowerCase())) {
      return true
    }
    const prefix = reqSettings?.orderPrefix || defaultPrefix.value
    return msg.trim().toLowerCase().startsWith(prefix.toLowerCase())
  }

  function onGetDanmaku(danmaku: EventModel) {
    if (checkMessage(danmaku.msg)) {
      void addSong(danmaku)
    }
  }

  function onGetSC(danmaku: EventModel) {
    const settings = accountInfo.value?.settings?.songRequest
    if (settings?.allowSC && checkMessage(danmaku.msg)) {
      void addSong(danmaku)
    }
  }

  let updateActiveTimer: ReturnType<typeof setInterval> | null = null

  function startUpdateTimer() {
    stopUpdateTimer()
    updateActiveTimer = setInterval(() => {
      void updateActive()
    }, 3000)
  }

  function stopUpdateTimer() {
    if (updateActiveTimer) {
      clearInterval(updateActiveTimer)
      updateActiveTimer = null
    }
  }

  async function init() {
    await initData()
    startUpdateTimer()
  }

  function dispose() {
    stopUpdateTimer()
  }

  return {
    isLoading,
    isBatchLoading,
    originSongs,
    songs,
    activeSongs,
    unfilteredActiveSongs,
    hasCustomOrder,
    historySongs,
    newSongName,
    selectedSong,
    isLrcLoading,
    activeFilterKeyword,
    filterSongName,
    filterSongNameContains,
    filterName,
    filterNameContains,
    stats,
    isStatsLoading,
    STATUS_MAP,
    isWarnMessageAutoClose,
    isReverse,
    defaultPrefix,
    configCanEdit,
    isSongOperating,

    init,
    dispose,
    fetchStats,
    addSong,
    addSongManual,
    updateSongStatus,
    batchUpdateStatus,
    reorderSongs,
    moveSong,
    pinSong,
    resetOrder,
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
