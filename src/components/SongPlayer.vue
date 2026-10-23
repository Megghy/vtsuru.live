<script setup lang="ts">
import { computed, ref, watch } from 'vue'
// @ts-ignore
import APlayer from 'vue3-aplayer'

import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { getApiSongListGetNeteaseLyric } from '@/api/generated/song-list/song-list'
import { Empty } from '@/shared/ui/empty'

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
    GetLyric(song)
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
  ;(
    getApiSongListGetNeteaseLyric({ id: song.id }) as unknown as Promise<{
      code: number
      data: { lyric: string; tlyric: string }
    }>
  )
    .then((data) => {
      if (data.code === 200) {
        aplayerMusic.value = {
          title: song.name,
          artist: song.author?.join('/') ?? '',
          src: song.url,
          pic: '',
          lrc: data.data.tlyric ? mergeLyrics(data.data.lyric, data.data.tlyric) : data.data.lyric,
        }
      } else {
        aplayerMusic.value = {
          title: song.name,
          artist: song.author?.join('/') ?? '',
          src: song.url,
          pic: '',
          lrc: '',
        }
      }
    })
    .finally(() => {
      emits('update:isLrcLoading', undefined)
    })
}

function mergeLyrics(originalLyrics: string, translatedLyrics: string): string {
  const originalLines = originalLyrics?.split('\n') ?? []
  const translatedLines = translatedLyrics?.split('\n') ?? []

  let mergedLyrics = ''

  for (let i = 0; i < originalLines.length; i++) {
    const originalLine = originalLines[i]?.trim()
    const originalTimeMatch = originalLine?.match(/\[(\d{2}:\d{2}\.\d{2,3})\]/)

    let mergedLine = originalLine

    if (originalTimeMatch) {
      const originalTime = originalTimeMatch[1]
      const translatedLineIndex = translatedLines.findIndex((line) => line.includes(originalTime))

      if (translatedLineIndex !== -1) {
        const translatedLine = translatedLines[translatedLineIndex]
        const translatedTimeMatch = translatedLine.match(/\[(\d{2}:\d{2}\.\d{2,3})\]/)

        if (translatedTimeMatch && translatedTimeMatch[1] === originalTime) {
          const translatedText = translatedLine.slice(translatedTimeMatch[0].length).trim()
          if (translatedText) {
            mergedLine += ` (${translatedText})`
          }
          translatedLines.splice(translatedLineIndex, 1)
        }
      }
    }
    if (!mergedLine.match(/^\[(\d{2}:\d{2}\.\d{2,3})\]$/)) {
      mergedLyrics += `${mergedLine}\n`
    }
  }

  for (const translatedLine of translatedLines) {
    const translatedText = translatedLine.trim()
    if (translatedText) {
      mergedLyrics += `${translatedText}\n`
    }
  }

  return mergedLyrics.trim()
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
