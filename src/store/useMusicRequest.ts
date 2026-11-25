import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'

import { AddBiliBlackList, SaveSetting, useAccount } from '@/api/account'
import type { EventModel } from '@/api/client-types'
import type { DanmakuUserInfo, ResponseSongModel, SettingMusicRequest } from '@/api/generated/model'
import {
  getApiMusicRequestGet,
  getApiMusicRequestSearchKugou,
  getApiMusicRequestSearchKugouList,
  getApiMusicRequestSearchNetease,
  getApiMusicRequestSearchNeteaseList,
  postApiMusicRequestUpdateWaiting,
} from '@/api/generated/music-request/music-request'
import { usePersistedStorage } from '@/shared/storage/persist'
import { GuidUtils, message, showUndoToast } from '@/shared/utils'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useOBSNotification } from '@/store/useOBSNotification'

import {
  findBlacklistHit,
  findSongInLibrary as matchLibrarySong,
  getDanmakuUserKey,
  getWaitingUserKey,
  isSameMusicSong,
  isSongPlayable,
  type Music,
  resolveSongPlaybackUrl,
  songToMusic,
} from './musicRequestHelpers'

export type { Music } from './musicRequestHelpers'

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

export interface MusicRequestSettings {
  enabled: boolean
  playMusicWhenFree: boolean
  repeat: 'repeat-one' | 'repeat-all' | 'no-repeat'
  listMaxHeight: string
  shuffle: boolean
  volume: number

  orderPrefix: string
  orderCooldown: number
  orderMusicFirst: boolean
  platform: 'netease' | 'kugou'
  autoFallbackPlatform: boolean
  obsTitle: string
  hideWhenEmpty: boolean
  obsMaxDisplayCount: number
  deviceId?: string
  maxWaitingSize: number
  maxSongsPerUser: number
  preventDuplicateInQueue: boolean
  onlyAllowLibrary: boolean
  requireFansMedal: boolean
  minFansMedalLevel: number
  guardIgnoreCooldown: boolean
  guardAutoPin: boolean
  allowSkipCommand: boolean
  skipPrefix: string
  allowCancelCommand: boolean
  cancelPrefix: string

  blacklist: string[]
}

export function createDefaultMusicRequestSettings(): MusicRequestSettings {
  return {
    enabled: true,
    playMusicWhenFree: true,
    repeat: 'repeat-all',
    listMaxHeight: '300',
    shuffle: true,
    volume: 0.5,
    orderPrefix: '点歌',
    orderCooldown: 600,
    orderMusicFirst: true,
    platform: 'netease',
    autoFallbackPlatform: true,
    obsTitle: '点歌机',
    hideWhenEmpty: false,
    obsMaxDisplayCount: 0,
    maxWaitingSize: 0,
    maxSongsPerUser: 0,
    preventDuplicateInQueue: true,
    onlyAllowLibrary: false,
    requireFansMedal: false,
    minFansMedalLevel: 0,
    guardIgnoreCooldown: false,
    guardAutoPin: false,
    allowSkipCommand: false,
    skipPrefix: '切歌',
    allowCancelCommand: true,
    cancelPrefix: '取消点歌',
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
  const danmakuClient = useDanmakuClient()

  const waitingMusics = usePersistedStorage<WaitMusicInfo[]>('Setting.MusicRequest.Waiting', [])
  const history = usePersistedStorage<MusicHistoryEntry[]>('Setting.MusicRequest.History', [])
  const cooldownMap = usePersistedStorage<Record<string, number>>('vtsuru:setting:music-request:cooldown-map', {})
  const cooldownNames = usePersistedStorage<Record<string, string>>('vtsuru:setting:music-request:cooldown-names', {})
  const settings = usePersistedStorage<MusicRequestSettings>(
    'Setting.MusicRequest',
    createDefaultMusicRequestSettings(),
  )

  const originMusics = ref<ResponseSongModel[]>([])
  const isLoadingLibrary = ref(false)
  const currentMusic = ref<Music>(createEmptyMusic())
  const currentOriginMusic = ref<WaitMusicInfo>()
  const isPlayingOrderMusic = ref(false)

  // 原生音频播放态（由 ManageMusicPlayer 或其他播放器宿主绑定）
  const audioEl = ref<HTMLAudioElement | null>(null)
  const isPlaying = ref(false)
  const isBuffering = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const isDanmakuListening = ref(false)
  const isPlayerDismissed = usePersistedStorage('Settings.MusicPlayer.Dismissed', false)

  const searchInFlightCount = ref(0)
  const isSearchingSong = computed(() => searchInFlightCount.value > 0)
  const isLoggedIn = computed(() => Boolean(accountInfo.value?.id && accountInfo.value.id > 0))

  const inFlightUsers = new Set<string>()
  let snapshotTimer: ReturnType<typeof setTimeout> | null = null
  let playerSaveTimer: ReturnType<typeof setTimeout> | null = null
  let snapshotSeq = 0
  let waitRequestSeq = 0
  let consecutiveErrorCount = 0
  let pendingPlayOnReady = false
  let pendingHistoryTrack: WaitMusicInfo | null = null

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
    const current = settings.value
    return {
      ...base,
      listMaxHeight: current.listMaxHeight ?? base.listMaxHeight,
      deviceId: current.deviceId,
      ...raw,
      enabled: raw?.enabled ?? current.enabled ?? base.enabled,
      autoFallbackPlatform: raw?.autoFallbackPlatform ?? current.autoFallbackPlatform ?? base.autoFallbackPlatform,
      obsTitle: (raw?.obsTitle ?? current.obsTitle ?? base.obsTitle) || '点歌机',
      hideWhenEmpty: raw?.hideWhenEmpty ?? current.hideWhenEmpty ?? base.hideWhenEmpty,
      obsMaxDisplayCount: Math.max(0, raw?.obsMaxDisplayCount ?? current.obsMaxDisplayCount ?? base.obsMaxDisplayCount),
      maxWaitingSize: Math.max(0, raw?.maxWaitingSize ?? current.maxWaitingSize ?? base.maxWaitingSize),
      maxSongsPerUser: Math.max(0, raw?.maxSongsPerUser ?? current.maxSongsPerUser ?? base.maxSongsPerUser),
      preventDuplicateInQueue:
        raw?.preventDuplicateInQueue ?? current.preventDuplicateInQueue ?? base.preventDuplicateInQueue,
      onlyAllowLibrary: raw?.onlyAllowLibrary ?? current.onlyAllowLibrary ?? base.onlyAllowLibrary,
      requireFansMedal: raw?.requireFansMedal ?? current.requireFansMedal ?? base.requireFansMedal,
      minFansMedalLevel: Math.max(0, raw?.minFansMedalLevel ?? current.minFansMedalLevel ?? base.minFansMedalLevel),
      guardIgnoreCooldown: raw?.guardIgnoreCooldown ?? current.guardIgnoreCooldown ?? base.guardIgnoreCooldown,
      guardAutoPin: raw?.guardAutoPin ?? current.guardAutoPin ?? base.guardAutoPin,
      allowSkipCommand: raw?.allowSkipCommand ?? current.allowSkipCommand ?? base.allowSkipCommand,
      skipPrefix: (raw?.skipPrefix ?? current.skipPrefix ?? base.skipPrefix) || '切歌',
      allowCancelCommand: raw?.allowCancelCommand ?? current.allowCancelCommand ?? base.allowCancelCommand,
      cancelPrefix: (raw?.cancelPrefix ?? current.cancelPrefix ?? base.cancelPrefix) || '取消点歌',
      repeat: (raw?.repeat as MusicRequestSettings['repeat']) || current.repeat || base.repeat,
      platform:
        raw?.platform === 'kugou' ? 'kugou' : raw?.platform === 'netease' ? 'netease' : current.platform || 'netease',
      volume: Math.min(1, Math.max(0, Number(raw?.volume ?? current.volume ?? base.volume))),
      blacklist: [...(raw?.blacklist ?? current.blacklist ?? [])],
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

  function buildSettingPayload(merged: MusicRequestSettings): SettingMusicRequest {
    return {
      enabled: merged.enabled,
      orderPrefix: merged.orderPrefix,
      platform: merged.platform,
      autoFallbackPlatform: merged.autoFallbackPlatform,
      orderCooldown: merged.orderCooldown ?? 0,
      orderMusicFirst: merged.orderMusicFirst,
      playMusicWhenFree: merged.playMusicWhenFree,
      repeat: merged.repeat,
      shuffle: merged.shuffle,
      volume: merged.volume,
      blacklist: [...merged.blacklist],
      obsTitle: merged.obsTitle,
      hideWhenEmpty: merged.hideWhenEmpty,
      obsMaxDisplayCount: merged.obsMaxDisplayCount,
      maxWaitingSize: merged.maxWaitingSize ?? 0,
      maxSongsPerUser: merged.maxSongsPerUser ?? 0,
      preventDuplicateInQueue: merged.preventDuplicateInQueue ?? true,
      onlyAllowLibrary: merged.onlyAllowLibrary,
      requireFansMedal: merged.requireFansMedal,
      minFansMedalLevel: merged.minFansMedalLevel,
      guardIgnoreCooldown: merged.guardIgnoreCooldown,
      guardAutoPin: merged.guardAutoPin,
      allowSkipCommand: merged.allowSkipCommand,
      skipPrefix: merged.skipPrefix,
      allowCancelCommand: merged.allowCancelCommand,
      cancelPrefix: merged.cancelPrefix,
    }
  }

  async function saveSettings(next?: Partial<MusicRequestSettings>, options?: { silent?: boolean }): Promise<boolean> {
    const prevSettings = normalizeSettings(settings.value)
    const merged = normalizeSettings(next ? { ...settings.value, ...next } : settings.value)
    settings.value = merged

    if (!isLoggedIn.value) {
      if (!options?.silent) message.success('点歌机设置已保存在本地')
      return true
    }

    try {
      const payload = buildSettingPayload(merged)
      await SaveSetting('MusicRequest', payload)
      if (accountInfo.value?.settings) {
        accountInfo.value.settings.musicRequest = payload
      }
      scheduleSnapshotSync()
      if (!options?.silent) message.success('点歌机设置已保存并同步到云端')
      return true
    } catch (err) {
      settings.value = prevSettings
      if (!options?.silent) {
        message.error(`保存设置失败: ${err instanceof Error ? err.message : String(err)}`)
      }
      return false
    }
  }

  /** 底部播放器高频参数（音量/循环/随机）防抖静默同步云端 */
  function schedulePlayerSettingsSave() {
    if (!isLoggedIn.value) return
    if (playerSaveTimer) clearTimeout(playerSaveTimer)
    playerSaveTimer = setTimeout(() => {
      playerSaveTimer = null
      void saveSettings(undefined, { silent: true })
    }, 800)
  }

  function updatePlaybackPreference(patch: Partial<Pick<MusicRequestSettings, 'volume' | 'shuffle' | 'repeat'>>) {
    if (patch.volume !== undefined) {
      const clamped = Math.min(1, Math.max(0, patch.volume))
      settings.value.volume = clamped
      if (audioEl.value) {
        audioEl.value.volume = clamped
      }
    }
    if (patch.shuffle !== undefined) {
      settings.value.shuffle = patch.shuffle
    }
    if (patch.repeat !== undefined) {
      settings.value.repeat = patch.repeat
    }
    schedulePlayerSettingsSave()
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
        hideWhenEmpty: settings.value.hideWhenEmpty,
        maxDisplayCount: settings.value.obsMaxDisplayCount,
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

  function startDanmakuListener() {
    if (isDanmakuListening.value) return
    danmakuClient.onEvent('danmaku', handleDanmaku)
    isDanmakuListening.value = true
  }

  function stopDanmakuListener() {
    if (!isDanmakuListening.value) return
    danmakuClient.offEvent('danmaku', handleDanmaku)
    isDanmakuListening.value = false
  }

  onScopeDispose(() => {
    if (snapshotTimer) {
      clearTimeout(snapshotTimer)
      snapshotTimer = null
    }
    if (playerSaveTimer) {
      clearTimeout(playerSaveTimer)
      playerSaveTimer = null
    }
    stopDanmakuListener()
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
    isLoadingLibrary.value = true
    try {
      const res = await getApiMusicRequestGet()
      if (res.code === 200 && res.data) {
        originMusics.value = res.data
        return res.data
      }
    } catch (err) {
      console.error('[MUSIC-REQUEST] 获取曲库失败', err)
    } finally {
      isLoadingLibrary.value = false
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

  function attachAudioElement(el: HTMLAudioElement | null) {
    audioEl.value = el
    if (!el) return
    el.volume = Math.min(1, Math.max(0, settings.value.volume ?? 0.5))
    void applySinkId(el)
    if (currentMusic.value.src && pendingPlayOnReady) {
      pendingPlayOnReady = false
      void triggerAudioPlay(el)
    }
  }

  async function applySinkId(el: HTMLAudioElement | null = audioEl.value) {
    if (!el) return
    const sinkTarget = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }
    if (!sinkTarget.setSinkId) return
    try {
      await sinkTarget.setSinkId(settings.value.deviceId ?? 'default')
    } catch (err) {
      console.error('[MUSIC-REQUEST] 设置音频输出设备失败', err)
    }
  }

  async function triggerAudioPlay(el: HTMLAudioElement | null = audioEl.value) {
    if (!el || !currentMusic.value.src) return
    if (el.src !== currentMusic.value.src) {
      el.src = currentMusic.value.src
    }
    el.volume = Math.min(1, Math.max(0, settings.value.volume ?? 0.5))
    try {
      await el.play()
    } catch (err) {
      // 浏览器自动播放策略限制或切歌中断不作为音频坏链处理
      if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
        isPlaying.value = false
        return
      }
      console.warn('[MUSIC-REQUEST] 触发音频播放异常', err)
    }
  }

  /** 播放一首音频（内部通用） */
  function playMusic(music: ResponseSongModel) {
    isPlayerDismissed.value = false
    const converted = songToMusic(music)
    currentMusic.value = converted
    currentTime.value = 0
    duration.value = 0
    if (audioEl.value) {
      pendingPlayOnReady = false
      void triggerAudioPlay(audioEl.value)
    } else {
      pendingPlayOnReady = true
    }
  }

  /** 试听/手动播放闲置曲库歌曲（同时重置观众点歌状态，避免 OBS 与主界面误显） */
  function playLibrarySong(music: ResponseSongModel) {
    pendingHistoryTrack = null
    isPlayingOrderMusic.value = false
    currentOriginMusic.value = undefined
    playMusic(music)
  }

  /** 开始播放（有待播点歌优先播点歌，否则开始轮播闲置曲库） */
  function startPlayback() {
    if (currentMusic.value.src && audioEl.value) {
      isPlayerDismissed.value = false
      void triggerAudioPlay(audioEl.value)
      return
    }
    if (playWaitingMusic()) return
    const bg = pickNextBackgroundSong(true)
    if (bg) {
      playLibrarySong(bg)
    } else {
      message.warning('待播队列与闲置曲库均为空')
    }
  }

  function pauseMusic() {
    pendingPlayOnReady = false
    if (audioEl.value && !audioEl.value.paused) {
      audioEl.value.pause()
    }
    isPlaying.value = false
  }

  /** 停止当前播放并关闭底部播放器（保留曲库与待播队列） */
  function closePlayer() {
    pendingPlayOnReady = false
    pendingHistoryTrack = null
    consecutiveErrorCount = 0
    isPlaying.value = false
    isBuffering.value = false
    isPlayingOrderMusic.value = false
    currentOriginMusic.value = undefined
    currentMusic.value = createEmptyMusic()
    currentTime.value = 0
    duration.value = 0
    isPlayerDismissed.value = true
    if (audioEl.value) {
      if (!audioEl.value.paused) {
        audioEl.value.pause()
      }
      audioEl.value.removeAttribute('src')
      audioEl.value.load()
    }
  }

  function togglePlay() {
    if (!currentMusic.value.src) {
      startPlayback()
      return
    }
    if (audioEl.value && !audioEl.value.paused) {
      pauseMusic()
    } else {
      void triggerAudioPlay()
    }
  }

  function seekTo(seconds: number) {
    if (!audioEl.value || !Number.isFinite(seconds)) return
    const maxTime = Number.isFinite(audioEl.value.duration) ? audioEl.value.duration : duration.value
    const clamped = Math.max(0, maxTime > 0 ? Math.min(seconds, maxTime) : seconds)
    audioEl.value.currentTime = clamped
    currentTime.value = clamped
  }

  function playPrevious() {
    if (audioEl.value && audioEl.value.currentTime > 3) {
      seekTo(0)
      return
    }
    const playable = originMusics.value.filter((m) => isSongPlayable(m))
    if (playable.length === 0) {
      seekTo(0)
      return
    }
    const currentIndex = playable.findIndex((m) => m.id === currentMusic.value.id)
    const target = currentIndex > 0 ? playable[currentIndex - 1] : playable[playable.length - 1]
    playLibrarySong(target)
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
    pendingHistoryTrack = target
    playMusic(target.music)
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

  /** 支持拖拽调整待播顺序（若跨过置顶分组则保持目标分组属性） */
  function reorderWaiting(fromIndex: number, toIndex: number) {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= waitingMusics.value.length ||
      toIndex >= waitingMusics.value.length
    ) {
      return
    }
    const next = waitingMusics.value.map((w) => ({ ...w }))
    const targetPinned = Boolean(next[toIndex].isPinned)
    const [moved] = next.splice(fromIndex, 1)
    moved.isPinned = targetPinned
    next.splice(toIndex, 0, moved)
    next.forEach((item, idx) => {
      item.orderSeq = idx
    })
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
      const ok = await saveSettings({ blacklist: [...existingBlacklist, keyword] }, { silent: true })
      if (!ok) return
    }
    cancelWaiting(info)
    message.success(`已屏蔽歌曲关键词「${keyword}」并移出待播`)
  }

  /** 一键拉黑当前正在播放的歌曲名并切下一首 */
  async function blockCurrentSongAndSkip() {
    const songName = currentOriginMusic.value?.music?.name?.trim() || currentMusic.value.title?.trim()
    if (!songName) return
    const existingBlacklist = settings.value.blacklist ?? []
    if (!existingBlacklist.includes(songName)) {
      await saveSettings({ blacklist: [...existingBlacklist, songName] }, { silent: true })
    }
    message.success(`已将「${songName}」加入黑名单并切歌`)
    nextMusic()
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

  function requeueFromHistory(entry: MusicHistoryEntry) {
    addWaitingMusic(
      {
        from: entry.from,
        music: entry.music,
      },
      { queueOnly: true },
    )
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

  function addWaitingMusic(info: WaitMusicInfo, options?: { queueOnly?: boolean; pin?: boolean }) {
    const target = ensureWaitRequestId(info)
    const isIdle = audioEl.value ? audioEl.value.paused : !isPlaying.value
    const shouldStartNow =
      !options?.queueOnly && !isPlayingOrderMusic.value && (settings.value.orderMusicFirst || isIdle)
    const requesterName = target.from?.name || '观众'
    if (shouldStartNow) {
      currentOriginMusic.value = target
      isPlayingOrderMusic.value = true
      pendingHistoryTrack = target
      playMusic(target.music)
      message.success(`正在播放 [${requesterName}] 点的 ${target.music.name}`)
      return
    }

    ensureWaitingOrderSeq(waitingMusics.value)
    const shouldPin = Boolean(options?.pin)
    target.isPinned = shouldPin
    target.orderSeq = nextWaitingOrderSeq()
    if (shouldPin) {
      const insertAt = waitingMusics.value.findIndex((w) => !w.isPinned)
      if (insertAt === -1) {
        waitingMusics.value.push(target)
      } else {
        waitingMusics.value.splice(insertAt, 0, target)
      }
    } else {
      waitingMusics.value.push(target)
    }
    message.success(
      options?.queueOnly ? `已加入待播: ${target.music.name}` : `[${requesterName}] 点了一首 ${target.music.name}`,
    )
  }

  function normalizeOnlineSong(song: ResponseSongModel): ResponseSongModel {
    const cloned = { ...song }
    const resolvedUrl = resolveSongPlaybackUrl(cloned)
    if (resolvedUrl) {
      cloned.url = resolvedUrl
    }
    return cloned
  }

  async function searchSinglePlatform(
    keyword: string,
    targetPlatform: 'netease' | 'kugou',
  ): Promise<ResponseSongModel | null> {
    try {
      const res =
        targetPlatform === 'kugou'
          ? await getApiMusicRequestSearchKugou({ keyword })
          : await getApiMusicRequestSearchNetease({ keyword })
      if (res.code === 200 && res.data) {
        const song = normalizeOnlineSong(res.data)
        return isSongPlayable(song) ? song : null
      }
    } catch (err) {
      console.error(`[MUSIC-REQUEST] 在线搜歌失败 (${targetPlatform})`, err)
    }
    return null
  }

  async function searchOnlineSong(
    keyword: string,
    platform?: 'netease' | 'kugou',
    options?: { allowFallback?: boolean },
  ): Promise<ResponseSongModel | null> {
    const primaryPlatform = platform ?? settings.value.platform ?? 'netease'
    const normalized = keyword.trim()
    if (!normalized) return null

    searchInFlightCount.value++
    try {
      const primary = await searchSinglePlatform(normalized, primaryPlatform)
      if (primary) return primary

      const shouldFallback = options?.allowFallback ?? settings.value.autoFallbackPlatform
      if (shouldFallback) {
        const fallbackPlatform = primaryPlatform === 'netease' ? 'kugou' : 'netease'
        return await searchSinglePlatform(normalized, fallbackPlatform)
      }
      return null
    } finally {
      searchInFlightCount.value = Math.max(0, searchInFlightCount.value - 1)
    }
  }

  /** 多候选搜索（优先调新候选接口，旧后端 404 时优雅回退单曲接口） */
  async function searchOnlineCandidates(
    keyword: string,
    platform?: 'netease' | 'kugou',
    limit = 8,
  ): Promise<ResponseSongModel[]> {
    const targetPlatform = platform ?? settings.value.platform ?? 'netease'
    const normalized = keyword.trim()
    if (!normalized) return []

    searchInFlightCount.value++
    try {
      const res =
        targetPlatform === 'kugou'
          ? await getApiMusicRequestSearchKugouList({ keyword: normalized, limit })
          : await getApiMusicRequestSearchNeteaseList({ keyword: normalized, limit })
      if (res.code === 200 && Array.isArray(res.data)) {
        return res.data.map(normalizeOnlineSong).filter((s) => isSongPlayable(s))
      }
    } catch {
      const single = await searchSinglePlatform(normalized, targetPlatform)
      return single ? [single] : []
    } finally {
      searchInFlightCount.value = Math.max(0, searchInFlightCount.value - 1)
    }
    return []
  }

  function findSongInLibrary(keyword: string): ResponseSongModel | undefined {
    return matchLibrarySong(originMusics.value, keyword)
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

  async function handleCancelCommand(danmaku: EventModel, userKey: string): Promise<boolean> {
    if (!settings.value.allowCancelCommand) return false
    const cancelPrefix = (settings.value.cancelPrefix || '取消点歌').trim()
    if (!cancelPrefix) return false
    const trimmed = danmaku.msg?.trim() ?? ''
    if (trimmed.toLowerCase() !== cancelPrefix.toLowerCase()) return false

    let targetIndex = -1
    for (let i = waitingMusics.value.length - 1; i >= 0; i--) {
      if (getWaitingUserKey(waitingMusics.value[i].from) === userKey) {
        targetIndex = i
        break
      }
    }
    if (targetIndex === -1) {
      await publishResult(false, danmaku.uname, '待播队列中没有你点的歌曲')
      return true
    }
    const [removed] = waitingMusics.value.splice(targetIndex, 1)
    pushHistory(removed, 'cancelled')
    clearCooldown(userKey)
    message.info(`[点歌机] [${danmaku.uname}] 已取消点播《${removed.music.name}》`)
    await publishResult(true, danmaku.uname, `已取消点播《${removed.music.name}》`)
    return true
  }

  async function handleSkipCommand(danmaku: EventModel, userKey: string): Promise<boolean> {
    if (!settings.value.allowSkipCommand) return false
    const skipPrefix = (settings.value.skipPrefix || '切歌').trim()
    if (!skipPrefix) return false
    const trimmed = danmaku.msg?.trim() ?? ''
    if (trimmed.toLowerCase() !== skipPrefix.toLowerCase()) return false

    if (!isPlayingOrderMusic.value || !currentOriginMusic.value) {
      return true
    }
    const isRequester = getWaitingUserKey(currentOriginMusic.value.from) === userKey
    const isOwner = Boolean(accountInfo.value?.biliId && danmaku.uid && danmaku.uid === accountInfo.value.biliId)
    const isPrivileged = isOwner || (danmaku.guard_level ?? 0) > 0
    if (!isRequester && !isPrivileged) {
      await publishResult(false, danmaku.uname, '仅点歌人本人、主播或大航海可切歌')
      return true
    }
    const skippedName = currentOriginMusic.value.music.name
    nextMusic()
    message.info(`[点歌机] [${danmaku.uname}] 触发切歌，已跳过《${skippedName}》`)
    await publishResult(true, danmaku.uname, `已切掉《${skippedName}》`)
    return true
  }

  /** 处理直播间弹幕触发的点歌/切歌/取消请求 */
  async function handleDanmaku(danmaku: EventModel) {
    if (!settings.value.enabled) return
    const trimmedMsg = danmaku.msg?.trim() ?? ''
    if (!trimmedMsg) return

    const userKey = getDanmakuUserKey(danmaku)

    // 先检查撤回/切歌指令
    if (await handleCancelCommand(danmaku, userKey)) return
    if (await handleSkipCommand(danmaku, userKey)) return

    const prefix = (settings.value.orderPrefix || '点歌').trim()
    if (!prefix) return
    if (!trimmedMsg.toLowerCase().startsWith(prefix.toLowerCase())) return

    const songKeyword = trimmedMsg.slice(prefix.length).trim()
    if (!songKeyword) return

    if (inFlightUsers.has(userKey)) return
    inFlightUsers.add(userKey)

    try {
      const isGuard = (danmaku.guard_level ?? 0) > 0

      // 1. 站点 B 站黑名单
      if (isLoggedIn.value && accountInfo.value?.biliBlackList) {
        const ouid = GuidUtils.toOuid(danmaku.uid, danmaku.open_id)
        if (ouid && accountInfo.value.biliBlackList[ouid]) {
          await publishResult(false, danmaku.uname, '你已被列入房间黑名单，无法点歌')
          return
        }
      }

      // 2. 粉丝牌门槛（大航海默认放行）
      if (!isGuard) {
        const minMedalLevel = settings.value.minFansMedalLevel ?? 0
        if (settings.value.requireFansMedal && !danmaku.fans_medal_wearing_status) {
          await publishResult(false, danmaku.uname, '请先佩戴本房间粉丝牌后再点歌')
          return
        }
        if (minMedalLevel > 0) {
          const level = danmaku.fans_medal_wearing_status ? (danmaku.fans_medal_level ?? 0) : 0
          if (level < minMedalLevel) {
            await publishResult(false, danmaku.uname, `需要佩戴 ${minMedalLevel} 级及以上粉丝牌才能点歌`)
            return
          }
        }
      }

      // 3. 关键词黑名单初筛
      const hitBlacklist = findBlacklistHit(settings.value.blacklist, songKeyword)
      if (hitBlacklist) {
        message.warning(`[点歌机] 已拦截 [${danmaku.uname}] 点播黑名单关键词: ${hitBlacklist}`)
        await publishResult(false, danmaku.uname, `歌曲「${songKeyword}」包含违禁词，已被拦截`)
        return
      }

      // 4. 点歌冷却（支持大航海免冷却）
      const cdSec = settings.value.orderCooldown ?? 0
      if (cdSec > 0 && !(isGuard && settings.value.guardIgnoreCooldown)) {
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

      // 5. 待播队列总上限
      const maxSize = settings.value.maxWaitingSize ?? 0
      if (maxSize > 0 && waitingMusics.value.length >= maxSize) {
        message.info(`[点歌机] 队列已满 (${waitingMusics.value.length}/${maxSize})，忽略 [${danmaku.uname}] 点歌`)
        await publishResult(false, danmaku.uname, `当前待播队列已达上限 (${maxSize} 首)，请稍后再点`)
        return
      }

      // 6. 单人待播上限
      const maxPerUser = settings.value.maxSongsPerUser ?? 0
      if (maxPerUser > 0) {
        const userCount =
          waitingMusics.value.filter((w) => getWaitingUserKey(w.from) === userKey).length +
          (isPlayingOrderMusic.value && getWaitingUserKey(currentOriginMusic.value?.from) === userKey ? 1 : 0)
        if (userCount >= maxPerUser) {
          message.info(`[点歌机] [${danmaku.uname}] 已达单人上限 (${userCount}/${maxPerUser})`)
          await publishResult(false, danmaku.uname, `每人最多同时排队 ${maxPerUser} 首歌曲`)
          return
        }
      }

      // 7. 匹配曲库或在线搜索
      const libraryMatch = findSongInLibrary(songKeyword)
      if (!libraryMatch && settings.value.onlyAllowLibrary) {
        message.info(`[点歌机] 仅限曲库模式，未命中: ${songKeyword}`)
        await publishResult(false, danmaku.uname, `当前仅支持点播曲库内歌曲，未找到「${songKeyword}」`)
        return
      }
      const matched = libraryMatch ?? (await searchOnlineSong(songKeyword))
      if (!matched || !isSongPlayable(matched)) {
        message.warning(`[点歌机] 未找到可播放歌曲: ${songKeyword}`)
        await publishResult(false, danmaku.uname, `未找到可播放曲目「${songKeyword}」`)
        return
      }

      // 8. 队列防重
      if (settings.value.preventDuplicateInQueue !== false) {
        if (
          isSameMusicSong(currentOriginMusic.value?.music, matched) ||
          waitingMusics.value.some((w) => isSameMusicSong(w.music, matched))
        ) {
          message.info(`[点歌机] 《${matched.name}》已在队列中，跳过重复点播`)
          await publishResult(false, danmaku.uname, `《${matched.name}》已在待播或播放中`)
          return
        }
      }

      // 9. 解析后真歌名与歌手二次黑名单复核
      const resolvedHit = findBlacklistHit(
        settings.value.blacklist,
        `${matched.name} ${(matched.author ?? []).join(' ')}`,
      )
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

      addWaitingMusic({ from: fromUser, music: matched }, { pin: isGuard && settings.value.guardAutoPin })
      if (!(isGuard && settings.value.guardIgnoreCooldown)) {
        recordCooldown(userKey, danmaku.uname)
      }
      await publishResult(true, danmaku.uname, `已点播《${matched.name}》`)
    } finally {
      inFlightUsers.delete(userKey)
    }
  }

  function pickNextBackgroundSong(forceAdvance = false): ResponseSongModel | undefined {
    const library = originMusics.value.filter((m) => isSongPlayable(m))
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
    pendingHistoryTrack = null
    if (originMusics.value.length === 0) {
      pauseMusic()
      currentMusic.value = createEmptyMusic()
      return
    }

    if (!forceBackgroundAdvance && !settings.value.playMusicWhenFree) {
      message.info('根据配置，点歌播完后已暂停背景播放')
      pauseMusic()
      currentMusic.value = createEmptyMusic()
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
    isPlaying.value = false
    advanceAfterTrack(false)
  }

  function onMusicError() {
    if (!currentMusic.value.src) return
    const failedName = currentMusic.value.title || currentOriginMusic.value?.music?.name || '当前曲目'
    const maxRetries = Math.max(1, waitingMusics.value.length + originMusics.value.length)
    pendingHistoryTrack = null
    isPlaying.value = false
    isBuffering.value = false
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
    isPlaying.value = true
    isBuffering.value = false
    if (pendingHistoryTrack && currentOriginMusic.value === pendingHistoryTrack) {
      pushHistory(pendingHistoryTrack, 'played')
      pendingHistoryTrack = null
    }
  }

  function onMusicPause() {
    isPlaying.value = false
  }

  function onTimeUpdate(time: number, dur: number) {
    currentTime.value = Number.isFinite(time) ? time : 0
    if (Number.isFinite(dur) && dur > 0) {
      duration.value = dur
    }
  }

  function playWaitingMusic() {
    const info = waitingMusics.value.shift()
    if (!info) return false

    isPlayingOrderMusic.value = true
    currentOriginMusic.value = info
    pendingHistoryTrack = info
    playMusic(info.music)
    message.success(`正在播放 [${info.from?.name || '观众'}] 点的 ${info.music.name}`)
    return true
  }

  function setSinkId() {
    void applySinkId()
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
    isLoadingLibrary,
    currentMusic,
    currentOriginMusic,
    isPlayingOrderMusic,
    isSearchingSong,
    isDanmakuListening,
    settings,

    // 原生音频状态与控制
    audioEl,
    isPlaying,
    isBuffering,
    currentTime,
    duration,
    isPlayerDismissed,
    attachAudioElement,
    updatePlaybackPreference,
    startDanmakuListener,
    stopDanmakuListener,

    loadLibrary,
    saveSettings,
    setSinkId,
    playWaitingMusic,
    playWaitingItemNow,
    playMusic,
    playLibrarySong,
    startPlayback,
    closePlayer,
    togglePlay,
    seekTo,
    playPrevious,
    addWaitingMusic,
    cancelWaiting,
    canMoveWaiting,
    moveWaiting,
    reorderWaiting,
    pinWaiting,
    clearWaitingWithUndo,
    blockSongKeyword,
    blockCurrentSongAndSkip,
    blockUser,
    requeueFromHistory,
    clearCooldown,
    clearAllCooldowns,
    clearHistory,
    searchOnlineSong,
    searchOnlineCandidates,
    handleDanmaku,
    onMusicEnd,
    onMusicError,
    onMusicPlay,
    onMusicPause,
    onTimeUpdate,
    pauseMusic,
    nextMusic,
  }
})
