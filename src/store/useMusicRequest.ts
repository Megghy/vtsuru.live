import { DanmakuUserInfo, SongFrom, SongsInfo } from '@/api/api-models'
import { useStorage } from '@vueuse/core'
import { useMessage } from 'naive-ui'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type WaitMusicInfo = {
  from: DanmakuUserInfo
  music: SongsInfo
}
export type Music = {
  id: number
  title: string
  artist: string
  src: string
  pic: string
  lrc: string
}
export type MusicRequestSettings = {
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
  const waitingMusics = useStorage<WaitMusicInfo[]>('Setting.MusicRequest.Waiting', [])
  const originMusics = ref<SongsInfo[]>([])
  const aplayerMusics = computed(() => originMusics.value.map((m) => songToMusic(m)))
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
  const settings = useStorage<MusicRequestSettings>('Setting.MusicRequest', {
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

  const message = useMessage()

  function addWaitingMusic(info: WaitMusicInfo) {
    console.log(settings.value.orderMusicFirst + ' ' + isPlayingOrderMusic.value)
    if ((settings.value.orderMusicFirst && !isPlayingOrderMusic.value) || aplayerRef.value?.audio.paused == true) {
      playMusic(info.music)
      isPlayingOrderMusic.value = true
      console.log(`正在播放 [${info.from.name}] 点的 ${info.music.name} - ${info.music.author?.join('/')}`)
      message.success(`正在播放 [${info.from.name}] 点的 ${info.music.name} - ${info.music.author?.join('/')}`)
    } else {
      waitingMusics.value.push(info)
      message.success(`[${info.from.name}] 点了一首 ${info.music.name} - ${info.music.author?.join('/')}`)
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
      }, 10)
      return true
    } else {
      return false
    }
  }
  function playMusic(music: SongsInfo) {
    //pauseMusic()
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
      src: s.from == SongFrom.Netease ? `https://music.163.com/song/media/outer/url?id=${s.id}.mp3` : s.url,
      pic: s.cover ?? '',
      lrc: '',
    } as Music
  }
  function setSinkId() {
    try {
      aplayerRef.value?.audio.setSinkId(settings.value.deviceId ?? 'default')
      console.log('设置音频输出设备为 ' + (settings.value.deviceId ?? '默认'))
    } catch (err) {
      console.error(err)
      message.error('设置音频输出设备失败: ' + err)
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
    onMusicEnd,
    onMusicPlay,
    pauseMusic,
    nextMusic,
    aplayerRef,
  }
})
