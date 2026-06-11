import type { DanmakuUserInfo, SongsInfo } from '@/api/api-models'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { SongFrom } from '@/api/api-models'
import { usePersistedStorage } from '@/shared/storage/persist'

export interface WaitMusicInfo {
  from: DanmakuUserInfo
  music: SongsInfo
}
/** 点歌历史记录项 (前端本地记录, 因后端不保存点歌历史) */
export interface MusicHistoryEntry {
  from: DanmakuUserInfo
  music: SongsInfo
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
  orderCooldown?: number
  orderMusicFirst: boolean
  platform: 'netease' | 'kugou'
  deviceId?: string

  blacklist: string[]
}

export const useMusicRequestProvider = defineStore('MusicRequest', () => {
  const waitingMusics = usePersistedStorage<WaitMusicInfo[]>(
    'Setting.MusicRequest.Waiting',
    [],
  )
  /** 点歌历史 (本地记录, 最多保留 200 条) */
  const history = usePersistedStorage<MusicHistoryEntry[]>(
    'Setting.MusicRequest.History',
    [],
  )
  const originMusics = ref<SongsInfo[]>([])
  const aplayerMusics = computed(() =>
    originMusics.value.map(m => songToMusic(m)),
  )
  const currentMusic = ref<Music>({
    id: -1,
    title: '',
    artist: '',
    src: '',
    pic: '',
    lrc: '',
  } as Music)
  const currentOriginMusic = ref<WaitMusicInfo>()
  const isPlayingOrderMusic = ref(false)
  const aplayerRef = ref()
  const settings = usePersistedStorage<MusicRequestSettings>('Setting.MusicRequest', {
    playMusicWhenFree: true,
    repeat: 'repeat-all',
    listMaxHeight: '300',
    shuffle: true,
    volume: 0.5,

    orderPrefix: '点歌',
    orderCooldown: 600,
    orderMusicFirst: true,
    platform: 'netease',

    blacklist: [],
  })

  const message = window.$message

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

  /** 从等待队列取消一首 (并记入历史) */
  function cancelWaiting(info: WaitMusicInfo) {
    const index = waitingMusics.value.indexOf(info)
    if (index > -1) {
      waitingMusics.value.splice(index, 1)
    }
    pushHistory(info, 'cancelled')
  }

  /** 清空点歌历史 */
  function clearHistory() {
    history.value = []
  }

  function addWaitingMusic(info: WaitMusicInfo) {
    if (
      (settings.value.orderMusicFirst && !isPlayingOrderMusic.value)
      || aplayerRef.value?.audio.paused == true
    ) {
      playMusic(info.music)
      isPlayingOrderMusic.value = true
      pushHistory(info, 'played')
      console.log(
        `正在播放 [${info.from.name}] 点的 ${info.music.name} - ${info.music.author?.join('/')}`,
      )
      message.success(
        `正在播放 [${info.from.name}] 点的 ${info.music.name} - ${info.music.author?.join('/')}`,
      )
    } else {
      waitingMusics.value.push(info)
      message.success(
        `[${info.from.name}] 点了一首 ${info.music.name} - ${info.music.author?.join('/')}`,
      )
    }
  }
  function onMusicEnd() {
    isPlayingOrderMusic.value = false
    if (!playWaitingMusic()) {
      if (currentOriginMusic.value) {
        currentOriginMusic.value = undefined
      }
      setTimeout(() => {
        if (!settings.value.playMusicWhenFree) {
          message.info('根据配置，已暂停播放音乐')
          currentMusic.value = aplayerMusics.value[0]
          pauseMusic()
        }
      }, 1)
    }
  }
  function onMusicPlay() {}
  function playWaitingMusic() {
    const info = waitingMusics.value.shift()
    if (info) {
      message.success(`正在播放 [${info.from.name}] 点的 ${info.music.name}`)
      console.log(`正在播放 [${info.from.name}] 点的 ${info.music.name}`)
      setTimeout(() => {
        isPlayingOrderMusic.value = true
        const index = waitingMusics.value.indexOf(info)
        if (index > -1) {
          waitingMusics.value.splice(index, 1)
        }
        currentOriginMusic.value = info
        aplayerRef.value?.pause()
        playMusic(info.music)
        pushHistory(info, 'played')
      }, 10)
      return true
    } else {
      return false
    }
  }
  function playMusic(music: SongsInfo) {
    // pauseMusic()
    currentMusic.value = songToMusic(music)
    aplayerRef.value?.thenPlay()
  }
  function pauseMusic() {
    if (!aplayerRef.value?.audio.paused) {
      aplayerRef.value?.pause()
    }
  }
  function songToMusic(s: SongsInfo) {
    return {
      id: s.id,
      title: s.name,
      artist: s.author?.join('/'),
      src:
        s.from == SongFrom.Netease
          ? `https://music.163.com/song/media/outer/url?id=${s.id}.mp3`
          : s.url,
      pic: s.cover ?? '',
      lrc: '',
    } as Music
  }
  function setSinkId() {
    try {
      aplayerRef.value?.audio.setSinkId(settings.value.deviceId ?? 'default')
      console.log(`设置音频输出设备为 ${settings.value.deviceId ?? '默认'}`)
    } catch (err) {
      console.error(err)
      message.error(`设置音频输出设备失败: ${err}`)
    }
  }
  function nextMusic() {
    if (waitingMusics.value.length > 0) {
      onMusicEnd()
    } else {
      isPlayingOrderMusic.value = false
      aplayerRef.value?.onAudioEnded()
    }
  }

  return {
    waitingMusics,
    history,
    originMusics,
    aplayerMusics,
    currentMusic,
    currentOriginMusic,
    isPlayingOrderMusic,
    settings,
    setSinkId,
    playWaitingMusic,
    playMusic,
    addWaitingMusic,
    cancelWaiting,
    clearHistory,
    onMusicEnd,
    onMusicPlay,
    pauseMusic,
    nextMusic,
    aplayerRef,
  }
})
