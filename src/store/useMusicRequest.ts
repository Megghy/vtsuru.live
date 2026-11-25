import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'

import { AddBiliBlackList, SaveSetting, useAccount } from '@/api/account'
import type { EventModel } from '@/api/client-types'
import type { DanmakuUserInfo, ResponseSongModel, SettingMusicRequest } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import {
  getApiMusicRequestGet,
  getApiMusicRequestSearchKugou,
  getApiMusicRequestSearchNetease,
  postApiMusicRequestUpdateWaiting,
} from '@/api/generated/music-request/music-request'
import { usePersistedStorage } from '@/shared/storage/persist'
import { GuidUtils, message, showUndoToast } from '@/shared/utils'
import { useOBSNotification } from '@/store/useOBSNotification'

export interface WaitMusicInfo {
  from: DanmakuUserInfo
  music: ResponseSongModel
  requestId?: string
  isPinned?: boolean
  orderSeq?: number
}

/** 点歌历史记录项 (前端本地记录, 因后端不保存点歌机历史) */
export interface MusicHistoryEntry {
  from: DanmakuUserInfo
  music: ResponseSongModel
  /** played: 已播放 / cancelled: 已取消 */
  status: 'played' | 'cancelled'
  time: number
}

export interface Music {
  id: number
  title: string
  artist: string
  src: string
  pic: string
  lrc: string
}

export interface MusicRequestSettings {
  playMusicWhenFree: boolean
  repeat: 'repeat-one' | 'repeat-all' | 'no-repeat'
  listMaxHeight: string
  shuffle: boolean
  volume: number

  orderPrefix: string
  orderCooldown: number
  orderMusicFirst: boolean
  platform: 'netease' | 'kugou'
  obsTitle: string
  deviceId?: string
  maxWaitingSize: number
  preventDuplicateInQueue: boolean

  blacklist: string[]
}

export function createDefaultMusicRequestSettings(): MusicRequestSettings {
  return {
    playMusicWhenFree: true,
    repeat: 'repeat-all',
    listMaxHeight: '300',
    shuffle: true,
    volume: 0.5,
    orderPrefix: '点歌',
    orderCooldown: 600,
    orderMusicFirst: true,
    platform: 'netease',
    obsTitle: '点歌机',
    maxWaitingSize: 0,
    preventDuplicateInQueue: true,
    blacklist: [],
  }
}

export function createEmptyMusic(): Music {
  return {
    id: -1,
    title: '',
    artist: '',
    src: '',
    pic: '',
    lrc: '',
  }
}

export const useMusicRequestProvider = defineStore('MusicRequest', () => {
  const accountInfo = useAccount()
  const obsNotification = useOBSNotification()

  const waitingMusics = usePersistedStorage<WaitMusicInfo[]>('Setting.MusicRequest.Waiting', [])
  const history = usePersistedStorage<MusicHistoryEntry[]>('Setting.MusicRequest.History', [])
  const cooldownMap = usePersistedStorage<Record<string, number>>('Setting.MusicRequest.CooldownMap', {})
  const cooldownNames = usePersistedStorage<Record<string, string>>('Setting.MusicRequest.CooldownNames', {})
  const settings = usePersistedStorage<MusicRequestSettings>(
    'Setting.MusicRequest',
    createDefaultMusicRequestSettings(),
  )

  const originMusics = ref<ResponseSongModel[]>([])
  const aplayerMusics = computed(() => originMusics.value.map((m) => songToMusic(m)))
  const currentMusic = ref<Music>(createEmptyMusic())
  const currentOriginMusic = ref<WaitMusicInfo>()
  const isPlayingOrderMusic = ref(false)
  const aplayerRef = ref<any>()
  const searchInFlightCount = ref(0)
  const isSearchingSong = computed(() => searchInFlightCount.value > 0)

  const isLoggedIn = computed(() => Boolean(accountInfo.value?.id && accountInfo.value.id > 0))
  const inFlightUsers = new Set<string>()
  let snapshotTimer: ReturnType<typeof setTimeout> | null = null
  let snapshotSeq = 0
  let waitRequestSeq = 0
  let consecutiveErrorCount = 0

  function ensureWaitRequestId(info: WaitMusicInfo): WaitMusicInfo {
    if (!info.requestId) {
      info.requestId = `req-${Date.now()}-${++waitRequestSeq}`
    }
    return info
  }

  function nextWaitingOrderSeq(list: readonly WaitMusicInfo[] = waitingMusics.value): number {
    let maxSeq = -1
    for (const item of list) {
      if (typeof item.orderSeq === 'number' && Number.isFinite(item.orderSeq) && item.orderSeq > maxSeq) {
        maxSeq = item.orderSeq
      }
    }
    return maxSeq + 1
  }

  function ensureWaitingOrderSeq(list: WaitMusicInfo[]) {
    let seq = nextWaitingOrderSeq(list)
    for (const item of list) {
      if (typeof item.orderSeq !== 'number' || !Number.isFinite(item.orderSeq)) {
        item.orderSeq = seq++
      }
    }
  }

  function findWaitingIndex(info: WaitMusicInfo): number {
    const refIdx = waitingMusics.value.indexOf(info)
    if (refIdx > -1) return refIdx
    if (info.requestId) {
      const idIdx = waitingMusics.value.findIndex((w) => w.requestId === info.requestId)
      if (idIdx > -1) return idIdx
    }
    return waitingMusics.value.findIndex((w) => w.music.id === info.music.id && w.from?.name === info.from?.name)
  }

  function normalizeSettings(
    raw?: Partial<SettingMusicRequest> | Partial<MusicRequestSettings> | null,
  ): MusicRequestSettings {
    const base = createDefaultMusicRequestSettings()
    return {
      ...base,
      listMaxHeight: settings.value.listMaxHeight ?? base.listMaxHeight,
      deviceId: settings.value.deviceId,
      ...raw,
      obsTitle: (raw?.obsTitle ?? settings.value.obsTitle ?? base.obsTitle) || '点歌机',
      repeat: (raw?.repeat as MusicRequestSettings['repeat']) || settings.value.repeat || base.repeat,
      platform: (raw?.platform as MusicRequestSettings['platform']) || settings.value.platform || base.platform,
      blacklist: [...(raw?.blacklist ?? settings.value.blacklist ?? [])],
    }
  }

  function hydrateSettingsFromAccount() {
    const remote = accountInfo.value?.settings?.musicRequest
    if (remote) {
      settings.value = normalizeSettings(remote)
    }
  }

  watch(
    () => accountInfo.value?.id,
    (id) => {
      if (id && id > 0) {
        hydrateSettingsFromAccount()
      }
    },
    { immediate: true },
  )

  async function saveSettings(next?: Partial<MusicRequestSettings>): Promise<boolean> {
    const prevSettings = normalizeSettings(settings.value)
    const merged = normalizeSettings(next ? { ...settings.value, ...next } : settings.value)
    settings.value = merged

    if (!isLoggedIn.value) {
      message.success('点歌机设置已保存在本地')
      return true
    }

    try {
      const payload: SettingMusicRequest = {
        orderPrefix: merged.orderPrefix,
        platform: merged.platform,
        orderCooldown: merged.orderCooldown ?? 0,
        orderMusicFirst: merged.orderMusicFirst,
        playMusicWhenFree: merged.playMusicWhenFree,
        repeat: merged.repeat,
        shuffle: merged.shuffle,
        volume: merged.volume,
        blacklist: [...merged.blacklist],
        obsTitle: merged.obsTitle,
        maxWaitingSize: merged.maxWaitingSize ?? 0,
        preventDuplicateInQueue: merged.preventDuplicateInQueue ?? true,
      }
      await SaveSetting('MusicRequest', payload)
      if (accountInfo.value?.settings) {
        accountInfo.value.settings.musicRequest = payload
      }
      scheduleSnapshotSync()
      message.success('点歌机设置已保存并同步到云端')
      return true
    } catch (err) {
      settings.value = prevSettings
      message.error(`保存设置失败: ${err instanceof Error ? err.message : String(err)}`)
      return false
    }
  }

  /** 向后端 Redis & OBS 实时同步当前正在播放与待播列表 */
  function scheduleSnapshotSync() {
    if (!isLoggedIn.value) return
    if (snapshotTimer) clearTimeout(snapshotTimer)
    const seq = ++snapshotSeq
    snapshotTimer = setTimeout(() => {
      snapshotTimer = null
      void postApiMusicRequestUpdateWaiting({
        playing: currentOriginMusic.value
          ? {
              from: currentOriginMusic.value.from,
              music: currentOriginMusic.value.music,
              isPinned: Boolean(currentOriginMusic.value.isPinned),
            }
          : undefined,
        waiting: waitingMusics.value.map((w) => ({
          from: w.from,
          music: w.music,
          isPinned: Boolean(w.isPinned),
        })),
        obsTitle: settings.value.obsTitle || '点歌机',
      })
        .then((res) => {
          if (seq === snapshotSeq && res && res.code !== 200) {
            console.warn('[MUSIC-REQUEST] 同步待播快照返回异常状态', res.code, res.message)
          }
        })
        .catch((err) => {
          console.warn('[MUSIC-REQUEST] 同步待播快照失败', err)
        })
    }, 250)
  }

  onScopeDispose(() => {
    if (snapshotTimer) {
      clearTimeout(snapshotTimer)
      snapshotTimer = null
    }
  })

  watch(
    [waitingMusics, currentOriginMusic],
    () => {
      scheduleSnapshotSync()
    },
    { deep: true },
  )

  async function loadLibrary(): Promise<ResponseSongModel[]> {
    if (!isLoggedIn.value) return originMusics.value
    try {
      const res = await getApiMusicRequestGet()
      if (res.code === 200 && res.data) {
        originMusics.value = res.data
        return res.data
      }
    } catch (err) {
      console.error('[MUSIC-REQUEST] 获取曲库失败', err)
    }
    return originMusics.value
  }

  /** 记录一条点歌历史 (本地保留最多 200 条) */
  function pushHistory(info: WaitMusicInfo, status: MusicHistoryEntry['status']) {
    history.value.unshift({
      from: info.from,
      music: info.music,
      status,
      time: Date.now(),
    })
    if (history.value.length > 200) {
      history.value.splice(200)
    }
  }

  /** 立即切播指定待播点歌 */
  function playWaitingItemNow(info: WaitMusicInfo) {
    const index = findWaitingIndex(info)
    if (index > -1) {
      waitingMusics.value.splice(index, 1)
    }
    const target = ensureWaitRequestId(info)
    currentOriginMusic.value = target
    isPlayingOrderMusic.value = true
    playMusic(target.music)
    pushHistory(target, 'played')
    message.success(`正在切播 [${target.from?.name || '观众'}] 点的 ${target.music.name}`)
  }

  /** 从等待队列取消一首 (并记入历史) */
  function cancelWaiting(info: WaitMusicInfo) {
    const index = findWaitingIndex(info)
    if (index > -1) {
      waitingMusics.value.splice(index, 1)
    }
    pushHistory(info, 'cancelled')
  }

  function canMoveWaiting(index: number, direction: 'up' | 'down'): boolean {
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || index >= waitingMusics.value.length || targetIdx < 0 || targetIdx >= waitingMusics.value.length) {
      return false
    }
    return Boolean(waitingMusics.value[index].isPinned) === Boolean(waitingMusics.value[targetIdx].isPinned)
  }

  function moveWaiting(index: number, direction: 'up' | 'down') {
    if (!canMoveWaiting(index, direction)) return
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    const next = waitingMusics.value.map((w) => ({ ...w }))
    ensureWaitingOrderSeq(next)
    const [moved] = next.splice(index, 1)
    next.splice(targetIdx, 0, moved)
    if (!moved.isPinned) {
      const prevIdx = direction === 'up' ? targetIdx + 1 : targetIdx - 1
      const swapped = next[prevIdx]
      const movedSeq = moved.orderSeq
      moved.orderSeq = swapped.orderSeq
      swapped.orderSeq = movedSeq
    }
    waitingMusics.value = next
  }

  function pinWaiting(index: number, pinned?: boolean) {
    if (index < 0 || index >= waitingMusics.value.length) return
    const next = waitingMusics.value.map((w) => ({ ...w }))
    ensureWaitingOrderSeq(next)
    const target = next[index]
    const nextPinned = pinned ?? !target.isPinned
    if (nextPinned === Boolean(target.isPinned)) return

    if (nextPinned) {
      next.splice(index, 1)
      target.isPinned = true
      next.unshift(target)
      waitingMusics.value = next
      message.success(`已将「${target.music.name}」置顶至下一首播放`)
      return
    }

    target.isPinned = false
    const pinnedItems = next.filter((w) => Boolean(w.isPinned))
    const unpinnedItems = next.filter((w) => !w.isPinned).toSorted((a, b) => (a.orderSeq ?? 0) - (b.orderSeq ?? 0))
    waitingMusics.value = [...pinnedItems, ...unpinnedItems]
    message.success(`已取消置顶「${target.music.name}」`)
  }

  function clearWaitingWithUndo() {
    if (waitingMusics.value.length === 0) return
    const snapshot = [...waitingMusics.value]
    waitingMusics.value = []
    showUndoToast(`已清空 ${snapshot.length} 首待播点歌`, () => {
      waitingMusics.value = [...snapshot, ...waitingMusics.value]
    })
  }

  /** 将歌曲名加入拦截黑名单并取消当前待播 */
  async function blockSongKeyword(info: WaitMusicInfo) {
    const keyword = info.music.name?.trim()
    if (!keyword) return
    const existingBlacklist = settings.value.blacklist ?? []
    if (!existingBlacklist.includes(keyword)) {
      const ok = await saveSettings({ blacklist: [...existingBlacklist, keyword] })
      if (!ok) return
    }
    cancelWaiting(info)
    message.success(`已屏蔽歌曲关键词「${keyword}」并移出待播`)
  }

  /** 将点歌观众加入 B 站黑名单并取消当前待播 */
  async function blockUser(info: WaitMusicInfo) {
    if (!isLoggedIn.value || (!info.from?.uid && !info.from?.oid)) {
      message.warning(`观众「${info.from?.name || '未知'}」暂无有效 UID/OpenID，请改用屏蔽歌名关键词`)
      return
    }
    try {
      const ouid = GuidUtils.toOuid(info.from.uid, info.from.oid)
      const res = await AddBiliBlackList(ouid, info.from.name)
      if (res.code === 200) {
        cancelWaiting(info)
        message.success(`已将观众「${info.from.name}」加入 B 站黑名单`)
      } else {
        message.error(res.message || '拉黑失败')
      }
    } catch (err) {
      message.error(`拉黑失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  function clearHistory() {
    history.value = []
  }

  function recordCooldown(userKey: string, userName: string) {
    cooldownMap.value = { ...cooldownMap.value, [userKey]: Date.now() }
    if (userName) {
      cooldownNames.value = { ...cooldownNames.value, [userKey]: userName }
    }
  }

  function clearCooldown(userKey: string) {
    const next = { ...cooldownMap.value }
    delete next[userKey]
    cooldownMap.value = next
  }

  function clearAllCooldowns() {
    cooldownMap.value = {}
  }

  function addWaitingMusic(info: WaitMusicInfo, options?: { queueOnly?: boolean }) {
    const target = ensureWaitRequestId(info)
    const isIdle = aplayerRef.value?.audio?.paused !== false
    const shouldStartNow =
      !options?.queueOnly && !isPlayingOrderMusic.value && (settings.value.orderMusicFirst || isIdle)
    const requesterName = target.from?.name || '观众'
    if (shouldStartNow) {
      currentOriginMusic.value = target
      isPlayingOrderMusic.value = true
      playMusic(target.music)
      pushHistory(target, 'played')
      message.success(`正在播放 [${requesterName}] 点的 ${target.music.name}`)
    } else {
      ensureWaitingOrderSeq(waitingMusics.value)
      target.isPinned = false
      target.orderSeq = nextWaitingOrderSeq()
      waitingMusics.value.push(target)
      message.success(
        options?.queueOnly ? `已加入待播: ${target.music.name}` : `[${requesterName}] 点了一首 ${target.music.name}`,
      )
    }
  }

  async function searchOnlineSong(keyword: string, platform?: 'netease' | 'kugou'): Promise<ResponseSongModel | null> {
    const targetPlatform = platform ?? settings.value.platform ?? 'netease'
    const normalized = keyword.trim()
    if (!normalized) return null

    searchInFlightCount.value++
    try {
      const res =
        targetPlatform === 'kugou'
          ? await getApiMusicRequestSearchKugou({ keyword: normalized })
          : await getApiMusicRequestSearchNetease({ keyword: normalized })
      if (res.code === 200 && res.data) {
        const song = { ...res.data }
        if (song.from === SongPlatform.Netease && !song.url && song.id) {
          song.url = `https://music.163.com/song/media/outer/url?id=${song.id}.mp3`
        }
        return song
      }
    } catch (err) {
      console.error('[MUSIC-REQUEST] 在线搜歌失败', err)
    } finally {
      searchInFlightCount.value = Math.max(0, searchInFlightCount.value - 1)
    }
    return null
  }

  function findSongInLibrary(keyword: string): ResponseSongModel | undefined {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return undefined
    return (
      originMusics.value.find((m) => m.name.toLowerCase() === kw) ??
      originMusics.value.find((m) => m.name.toLowerCase().includes(kw))
    )
  }

  function findBlacklistHit(text: string): string | undefined {
    const normalized = text.trim().toLowerCase()
    if (!normalized) return undefined
    return (settings.value.blacklist ?? []).find((b) => {
      const needle = b?.trim().toLowerCase()
      return Boolean(needle && normalized.includes(needle))
    })
  }

  async function publishResult(success: boolean, userName: string, msgText: string) {
    if (!isLoggedIn.value) return
    try {
      await obsNotification.publish({
        Type: success ? 'success' : 'failed',
        Title: '点歌机',
        Source: 'music-request',
        UserName: userName,
        Message: msgText,
      })
    } catch (err) {
      console.warn('[MUSIC-REQUEST] 推送 OBS 通知失败', err)
    }
  }

  /** 处理直播间弹幕触发的点歌请求 */
  async function handleDanmaku(danmaku: EventModel) {
    const prefix = (settings.value.orderPrefix || '点歌').trim()
    if (!prefix) return

    const trimmedMsg = danmaku.msg?.trim() ?? ''
    if (!trimmedMsg.toLowerCase().startsWith(prefix.toLowerCase())) return

    const songKeyword = trimmedMsg.slice(prefix.length).trim()
    if (!songKeyword) return

    const userKey = String(danmaku.uid || danmaku.open_id || danmaku.uname)
    if (inFlightUsers.has(userKey)) return
    inFlightUsers.add(userKey)

    try {
      // 检查站点 B 站黑名单
      if (isLoggedIn.value && accountInfo.value?.biliBlackList) {
        const ouid = GuidUtils.toOuid(danmaku.uid, danmaku.open_id)
        if (ouid && accountInfo.value.biliBlackList[ouid]) {
          await publishResult(false, danmaku.uname, '你已被列入房间黑名单，无法点歌')
          return
        }
      }

      // 检查关键词黑名单
      const hitBlacklist = findBlacklistHit(songKeyword)
      if (hitBlacklist) {
        message.warning(`[点歌机] 已拦截 [${danmaku.uname}] 点播黑名单关键词: ${hitBlacklist}`)
        await publishResult(false, danmaku.uname, `歌曲「${songKeyword}」包含违禁词，已被拦截`)
        return
      }

      // 检查点歌冷却
      const cdSec = settings.value.orderCooldown ?? 0
      if (cdSec > 0) {
        const lastAt = cooldownMap.value[userKey]
        if (lastAt) {
          const remain = Math.ceil((lastAt + cdSec * 1000 - Date.now()) / 1000)
          if (remain > 0) {
            message.info(`[点歌机] [${danmaku.uname}] 冷却中，剩余 ${remain} 秒`)
            await publishResult(false, danmaku.uname, `点歌冷却中，请等待 ${remain} 秒后再试`)
            return
          }
        }
      }

      // 检查待播队列上限
      const maxSize = settings.value.maxWaitingSize ?? 0
      if (maxSize > 0 && waitingMusics.value.length >= maxSize) {
        message.info(`[点歌机] 队列已满 (${waitingMusics.value.length}/${maxSize})，忽略 [${danmaku.uname}] 点歌`)
        await publishResult(false, danmaku.uname, `当前待播队列已达上限 (${maxSize} 首)，请稍后再点`)
        return
      }

      // 优先命中本地闲置曲库，未命中时搜索在线音乐平台
      const matched = findSongInLibrary(songKeyword) ?? (await searchOnlineSong(songKeyword))
      if (!matched || (!matched.url && matched.from !== SongPlatform.Netease)) {
        message.warning(`[点歌机] 未找到可播放歌曲: ${songKeyword}`)
        await publishResult(false, danmaku.uname, `未找到可播放曲目「${songKeyword}」`)
        return
      }

      // 检查是否已在播放或待播队列中（防重）
      if (settings.value.preventDuplicateInQueue !== false) {
        const isSameSong = (song: ResponseSongModel | undefined) => {
          if (!song) return false
          if (song.id > 0 && matched.id > 0 && song.from === matched.from) {
            return song.id === matched.id
          }
          return song.name.trim().toLowerCase() === matched.name.trim().toLowerCase()
        }
        if (isSameSong(currentOriginMusic.value?.music) || waitingMusics.value.some((w) => isSameSong(w.music))) {
          message.info(`[点歌机] 《${matched.name}》已在队列中，跳过重复点播`)
          await publishResult(false, danmaku.uname, `《${matched.name}》已在待播或播放中`)
          return
        }
      }

      // 二次复核解析后的真实歌名与歌手，避免别名搜索绕过黑名单
      const resolvedHit = findBlacklistHit(`${matched.name} ${(matched.author ?? []).join(' ')}`)
      if (resolvedHit) {
        message.warning(`[点歌机] 已拦截 [${danmaku.uname}] 命中黑名单曲目《${matched.name}》: ${resolvedHit}`)
        await publishResult(false, danmaku.uname, `歌曲《${matched.name}》包含违禁词，已被拦截`)
        return
      }

      const fromUser: DanmakuUserInfo = {
        name: danmaku.uname,
        uid: danmaku.uid,
        oid: danmaku.open_id,
        guard_level: danmaku.guard_level,
        fans_medal_level: danmaku.fans_medal_level,
        fans_medal_name: danmaku.fans_medal_name,
        fans_medal_wearing_status: danmaku.fans_medal_wearing_status,
        face: danmaku.uface ?? '',
      }

      addWaitingMusic({ from: fromUser, music: matched })
      recordCooldown(userKey, danmaku.uname)
      await publishResult(true, danmaku.uname, `已点播《${matched.name}》`)
    } finally {
      inFlightUsers.delete(userKey)
    }
  }

  function pickNextBackgroundSong(forceAdvance = false): ResponseSongModel | undefined {
    const library = originMusics.value
    if (library.length === 0) return undefined

    const currentIdx = library.findIndex((m) => m.id === currentMusic.value.id)
    if (!forceAdvance && settings.value.repeat === 'repeat-one' && currentIdx > -1) {
      return library[currentIdx]
    }
    if (settings.value.shuffle) {
      if (library.length === 1) return library[0]
      let randomIdx = Math.floor(Math.random() * library.length)
      if (randomIdx === currentIdx) {
        randomIdx = (randomIdx + 1) % library.length
      }
      return library[randomIdx]
    }
    if (currentIdx === -1) {
      return library[0]
    }
    if (!forceAdvance && settings.value.repeat === 'no-repeat' && currentIdx >= library.length - 1) {
      return undefined
    }
    return library[(currentIdx + 1) % library.length]
  }

  function advanceAfterTrack(forceBackgroundAdvance: boolean) {
    const wasOrderTrack = isPlayingOrderMusic.value
    isPlayingOrderMusic.value = false

    if (playWaitingMusic()) {
      return
    }

    currentOriginMusic.value = undefined
    if (originMusics.value.length === 0) {
      pauseMusic()
      currentMusic.value = createEmptyMusic()
      return
    }

    if (!forceBackgroundAdvance && !settings.value.playMusicWhenFree) {
      message.info('根据配置，点歌播完后已暂停背景播放')
      currentMusic.value = songToMusic(originMusics.value[0])
      pauseMusic()
      return
    }

    const nextBg = pickNextBackgroundSong(forceBackgroundAdvance || wasOrderTrack)
    if (nextBg) {
      playMusic(nextBg)
    } else {
      pauseMusic()
    }
  }

  function onMusicEnd() {
    advanceAfterTrack(false)
  }

  function onMusicError() {
    const failedName = currentMusic.value.title || currentOriginMusic.value?.music?.name || '当前曲目'
    const maxRetries = Math.max(1, waitingMusics.value.length + originMusics.value.length)
    consecutiveErrorCount++
    if (consecutiveErrorCount > maxRetries) {
      isPlayingOrderMusic.value = false
      currentOriginMusic.value = undefined
      pauseMusic()
      message.error('连续多首歌曲播放失败，已停止自动切歌')
      return
    }
    message.warning(`播放失败或资源不可用: ${failedName}，尝试切换下一首`)
    advanceAfterTrack(true)
  }

  function onMusicPlay() {
    consecutiveErrorCount = 0
  }

  function playWaitingMusic() {
    const info = waitingMusics.value.shift()
    if (!info) return false

    isPlayingOrderMusic.value = true
    currentOriginMusic.value = info
    playMusic(info.music)
    pushHistory(info, 'played')
    message.success(`正在播放 [${info.from?.name || '观众'}] 点的 ${info.music.name}`)
    return true
  }

  function playMusic(music: ResponseSongModel) {
    currentMusic.value = songToMusic(music)
    aplayerRef.value?.thenPlay?.()
  }

  function pauseMusic() {
    if (aplayerRef.value?.audio && !aplayerRef.value.audio.paused) {
      aplayerRef.value.pause()
    }
  }

  function songToMusic(s: ResponseSongModel): Music {
    return {
      id: s.id,
      title: s.name,
      artist: s.author?.join('/') ?? '',
      src:
        s.from === SongPlatform.Netease
          ? s.url || `https://music.163.com/song/media/outer/url?id=${s.id}.mp3`
          : (s.url ?? ''),
      pic: s.cover ?? '',
      lrc: '',
    }
  }

  function setSinkId() {
    try {
      aplayerRef.value?.audio?.setSinkId?.(settings.value.deviceId ?? 'default')
    } catch (err) {
      console.error(err)
      message.error(`设置音频输出设备失败: ${err}`)
    }
  }

  function nextMusic() {
    advanceAfterTrack(true)
  }

  return {
    waitingMusics,
    history,
    cooldownMap,
    cooldownNames,
    originMusics,
    aplayerMusics,
    currentMusic,
    currentOriginMusic,
    isPlayingOrderMusic,
    isSearchingSong,
    settings,
    aplayerRef,

    loadLibrary,
    saveSettings,
    setSinkId,
    playWaitingMusic,
    playWaitingItemNow,
    playMusic,
    addWaitingMusic,
    cancelWaiting,
    canMoveWaiting,
    moveWaiting,
    pinWaiting,
    clearWaitingWithUndo,
    blockSongKeyword,
    blockUser,
    clearCooldown,
    clearAllCooldowns,
    clearHistory,
    searchOnlineSong,
    handleDanmaku,
    onMusicEnd,
    onMusicError,
    onMusicPlay,
    pauseMusic,
    nextMusic,
  }
})
