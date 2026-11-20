<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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

const aplayerMusic = ref({
  title: '',
  artist: '',
  src: '',
  pic: '',
  lrc: '',
})
const temp = computed(() => {
  if (props.song) OnPlayMusic(props.song)
  return props.song
})

watch(temp, (newV) => {
  if (newV) console.log(`开始播放: ${newV.name}`)
})

function OnPlayMusic(song: ResponseSongModel) {
  if (song.from === SongPlatform.Netease) {
    void GetLyric(song)
  } else {
    aplayerMusic.value = {
      title: song.name,
      artist: song.author?.join('/') ?? '',
      src: song.url,
      pic: '',
      lrc: '',
    }
  }
}

async function GetLyric(song: ResponseSongModel) {
  emits('update:isLrcLoading', song.key)
  try {
    const lrc = await fetchNeteaseMergedLyric(song.id)
    aplayerMusic.value = {
      title: song.name,
      artist: song.author?.join('/') ?? '',
      src: song.url,
      pic: '',
      lrc,
    }
  } finally {
    emits('update:isLrcLoading', undefined)
  }
}
</script>

<template>
  <Empty
    v-if="!aplayerMusic.src"
    :description="props.isLrcLoading ? '歌词加载中...' : '暂无歌曲'"
    class="py-6"
  />
  <APlayer
    v-else
    :music="aplayerMusic"
    autoplay
    :show-lrc="aplayerMusic?.lrc && aplayerMusic.lrc.length > 0"
  />
</template>
