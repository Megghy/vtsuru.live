<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
// @ts-ignore
import APlayer from 'vue3-aplayer'

import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { Empty } from '@/shared/ui/empty'
import { fetchNeteaseMergedLyric } from '@/shared/utils/lyric'

const props = defineProps<{
  song: ResponseSongModel | undefined
  isLrcLoading?: string
}>()
const emits = defineEmits(['update:isLrcLoading', 'update:close', 'update:volume'])

const aplayerRef = ref<any>()
const aplayerMusic = ref({
  title: '',
  artist: '',
  src: '',
  pic: '',
  lrc: '',
})
let lyricSeq = 0

function resolveSongUrl(song: ResponseSongModel): string {
  if (song.url) return song.url
  if (song.from === SongPlatform.Netease && song.id) {
    return `https://music.163.com/song/media/outer/url?id=${song.id}.mp3`
  }
  return ''
}

function triggerPlay(seq: number) {
  void nextTick(() => {
    if (seq !== lyricSeq) return
    aplayerRef.value?.thenPlay?.()
  })
}

async function onPlayMusic(song: ResponseSongModel, seq: number) {
  const src = resolveSongUrl(song)
  if (song.from === SongPlatform.Netease) {
    await loadNeteaseLyric(song, src, seq)
    return
  }
  emits('update:isLrcLoading', undefined)
  aplayerMusic.value = {
    title: song.name,
    artist: song.author?.join('/') ?? '',
    src,
    pic: '',
    lrc: '',
  }
  triggerPlay(seq)
}

async function loadNeteaseLyric(song: ResponseSongModel, src: string, seq: number) {
  emits('update:isLrcLoading', song.key)
  try {
    const lrc = await fetchNeteaseMergedLyric(song.id)
    if (seq !== lyricSeq) return
    aplayerMusic.value = {
      title: song.name,
      artist: song.author?.join('/') ?? '',
      src,
      pic: '',
      lrc,
    }
    triggerPlay(seq)
  } finally {
    if (seq === lyricSeq) {
      emits('update:isLrcLoading', undefined)
    }
  }
}

watch(
  () => props.song,
  (newSong) => {
    const seq = ++lyricSeq
    if (!newSong) {
      aplayerMusic.value = { title: '', artist: '', src: '', pic: '', lrc: '' }
      emits('update:isLrcLoading', undefined)
      return
    }
    void onPlayMusic(newSong, seq)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  lyricSeq++
  emits('update:isLrcLoading', undefined)
  aplayerRef.value?.pause?.()
})
</script>

<template>
  <Empty
    v-if="!aplayerMusic.src"
    :description="props.isLrcLoading ? '歌词加载中...' : '暂无歌曲'"
    class="py-6"
  />
  <APlayer
    v-else
    ref="aplayerRef"
    :music="aplayerMusic"
    autoplay
    :show-lrc="Boolean(aplayerMusic.lrc)"
  />
</template>
