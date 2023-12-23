<script setup lang="ts">
import { EventModel, SongsInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import DanmakuClient, { RoomAuthInfo } from '@/data/DanmakuClient'
import { MUSIC_REQUEST_API_URL } from '@/data/constants'
import { useStorage } from '@vueuse/core'
import { onMounted, onUnmounted, ref } from 'vue'
import APlayer from 'vue3-aplayer'

type MusicRequestSettings = {
  playMusicWhenFree: boolean
}
type Music = {
  title: string
  artist: string
  src: string
  pic: string
  lrc: string
}

const settings = useStorage<MusicRequestSettings>('Setting.MusicRequest', {
  playMusicWhenFree: true,
})

const props = defineProps<{
  client: DanmakuClient
  roomInfo: RoomAuthInfo
  code: string | undefined
  isOpenLive?: boolean
}>()

const aplayer = ref()

const musics = ref<Music[]>([])

function onGetEvent(data: EventModel) {}
function searchMusic(keyword: string) {
  QueryGetAPI<SongsInfo>(MUSIC_REQUEST_API_URL + 'search-kugou', {
    keyword: keyword,
  }).then((data) => {
    if (data.code == 200) {
      musics.value.push({
        title: data.data.name,
        artist: data.data.author?.join('/'),
        src: data.data.url,
        pic: data.data.cover ?? '',
        lrc: '',
      })
    }
  })
}

onMounted(() => {
  props.client.onEvent('danmaku', onGetEvent)
})
onUnmounted(() => {
  props.client.offEvent('danmaku', onGetEvent)
})
</script>

<template>
  <APlayer :list="musics" ref="aplayer" />
</template>
