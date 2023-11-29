<script setup lang="ts">
import { SongsInfo, SongFrom } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { SONG_API_URL } from '@/data/constants'
import { NEmpty } from 'naive-ui'
import { computed, ref, toRef, toRefs, watch } from 'vue'
import APlayer from 'vue3-aplayer'

const props = defineProps<{
  song: SongsInfo | undefined
  isLrcLoading?: string
}>()
const currentSong = toRef(props, 'song')
const emits = defineEmits(['update:isLrcLoading'])

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
  if (newV) console.log('开始播放: ' + newV.name)
})

function OnPlayMusic(song: SongsInfo) {
  if (song.from == SongFrom.Netease) GetLyric(song)
  else {
    aplayerMusic.value = {
      title: song.name,
      artist: song.author?.join('/') ?? '',
      src: song.url,
      pic: '',
      lrc: '',
    }
  }
}
async function GetLyric(song: SongsInfo) {
  emits('update:isLrcLoading', song.key)
  QueryGetAPI<{ lyric: string; tlyric: string }>(SONG_API_URL + 'get-netease-lyric', { id: song.id })
    .then((data) => {
      console.log(mergeLyrics(data.data.lyric, data.data.tlyric))
      if (data.code == 200) {
        //props.song.value.lrc = data.data.tlyric ? mergeLyrics(data.data.lyric, data.data.tlyric) : data.data.lyric

        aplayerMusic.value = {
          title: song.name,
          artist: song.author?.join('/') ?? '',
          src: song.url,
          pic: '',
          lrc: data.data.tlyric ? mergeLyrics(data.data.lyric, data.data.tlyric) : data.data.lyric,
        }
        //aplayerMusic.value.lrc = data.data.lyric
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
    .catch((err) => {
      console.error(err)
    })
    .finally(() => {
      emits('update:isLrcLoading', undefined)
    })
}
function mergeLyrics(originalLyrics: string, translatedLyrics: string): string {
  const originalLines = originalLyrics.split('\n')
  const translatedLines = translatedLyrics.split('\n')

  let mergedLyrics = ''

  for (let i = 0; i < originalLines.length; i++) {
    const originalLine = originalLines[i]?.trim()
    const originalTimeMatch = originalLine?.match(/\[(\d{2}:\d{2}\.\d{2,3})\]/) // 匹配原歌词的时间字符串

    let mergedLine = originalLine

    if (originalTimeMatch) {
      const originalTime = originalTimeMatch[1]
      const translatedLineIndex = translatedLines.findIndex((line) => line.includes(originalTime))

      if (translatedLineIndex !== -1) {
        const translatedLine = translatedLines[translatedLineIndex]
        const translatedTimeMatch = translatedLine.match(/\[(\d{2}:\d{2}\.\d{2,3})\]/) // 匹配翻译歌词的时间字符串

        if (translatedTimeMatch && translatedTimeMatch[1] === originalTime) {
          const translatedText = translatedLine.slice(translatedTimeMatch[0].length).trim()
          if (translatedText) {
            mergedLine += ` (${translatedText})`
          }
          translatedLines.splice(translatedLineIndex, 1) // 从翻译歌词数组中移除已匹配的行
        }
      }
    }
    if (!mergedLine.match(/^\[(\d{2}:\d{2}\.\d{2,3})\]$/)) {
      //不是空行
      mergedLyrics += `${mergedLine}\n`
    }
  }

  // 将剩余的非空翻译歌词单独放在一行
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
  <NEmpty v-if="!aplayerMusic.src" :description="props.isLrcLoading ? '歌词加载中...' : '暂无歌曲'" />
  <APlayer v-else :music="aplayerMusic" autoplay :showLrc="aplayerMusic?.lrc && aplayerMusic.lrc.length > 0" />
</template>
